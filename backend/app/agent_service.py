"""
Agent layer — real Claude tool calls where an API key is configured, falling back to
the deterministic simulation (the _simulate_* functions) on any failure: no key set,
network error, rate limit, or a malformed response. This keeps local dev frictionless
without a key, and keeps the app resilient rather than crashing when Claude is briefly
unavailable. See docs/TRD.md §5 for the original design of this seam.
"""

import json
import logging
import random
from typing import Dict, List, Optional

from anthropic import Anthropic

from .config import settings

logger = logging.getLogger(__name__)

DESTINATIONS: Dict[str, Dict] = {
    "paris": {"aliases": ["paris", "france"], "name": "Paris"},
    "tokyo": {"aliases": ["tokyo", "japan"], "name": "Tokyo"},
    "newyork": {"aliases": ["new york", "nyc", "manhattan"], "name": "New York"},
    "rome": {"aliases": ["rome", "italy"], "name": "Rome"},
    "santorini": {"aliases": ["santorini", "greece", "greek islands"], "name": "Santorini"},
    "bali": {"aliases": ["bali", "indonesia"], "name": "Bali"},
    "iceland": {"aliases": ["iceland", "reykjavik"], "name": "Iceland"},
    "dubai": {"aliases": ["dubai", "uae", "emirates"], "name": "Dubai"},
}

ACTIVITY_POOL: Dict[str, List[str]] = {
    "paris": ["Louvre skip-the-line tour", "Seine river cruise at dusk", "Pastry-making class in Le Marais"],
    "tokyo": ["Tsukiji Outer Market food crawl", "teamLab digital art museum", "Evening in Shibuya"],
    "newyork": ["Top of the Rock at sunset", "Broadway show", "High Line walk + Chelsea Market"],
    "rome": ["Colosseum underground tour", "Trastevere food crawl", "Vatican Museums early entry"],
    "santorini": ["Caldera sunset sail", "Oia village wander", "Volcanic wine tasting"],
    "bali": ["Ubud rice terrace trek", "Sunrise at Mount Batur", "Uluwatu temple + kecak dance"],
    "iceland": ["Golden Circle day trip", "Blue Lagoon soak", "Northern lights hunt"],
    "dubai": ["Desert safari + BBQ dinner", "Burj Khalifa observation deck", "Old Dubai souk crawl"],
    "fallback": ["Scenic overlook drive", "Local food market crawl", "Sunset lookout point"],
}

BUDGET_CAPS: Dict[str, float] = {
    "Budget-friendly": 1200,
    "Balanced": 2800,
    "Treat yourself": 6000,
}

SLOTS = ["morning", "afternoon", "evening"]


def match_destination(raw: str) -> str:
    q = raw.strip().lower()
    if not q:
        return "fallback"
    for key, info in DESTINATIONS.items():
        for alias in info["aliases"]:
            if alias in q or q in alias:
                return key
    return "fallback"


def destination_name(key: str, raw: str) -> str:
    if key == "fallback":
        return raw or "your destination"
    return DESTINATIONS[key]["name"]


def budget_cap_for(budget_answer: Optional[str]) -> float:
    return BUDGET_CAPS.get(budget_answer or "", 2800)


def next_day_slot(existing_item_count: int, trip_days: int):
    day = min(existing_item_count // 3 + 1, trip_days)
    slot = SLOTS[existing_item_count % 3]
    return day, slot


# ---------------------------------------------------------------------------
# Claude client + a small tool-calling helper shared by the three agent tasks
# ---------------------------------------------------------------------------

_client: Optional[Anthropic] = None


def _get_client() -> Optional[Anthropic]:
    global _client
    if not settings.anthropic_api_key:
        return None
    if _client is None:
        _client = Anthropic(api_key=settings.anthropic_api_key)
    return _client


def _call_tool(system: str, user: str, tool_name: str, description: str, input_schema: dict) -> dict:
    client = _get_client()
    if client is None:
        raise RuntimeError("no ANTHROPIC_API_KEY configured")
    response = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=1024,
        system=system,
        messages=[{"role": "user", "content": user}],
        tools=[{"name": tool_name, "description": description, "input_schema": input_schema}],
        tool_choice={"type": "tool", "name": tool_name},
    )
    for block in response.content:
        if block.type == "tool_use" and block.name == tool_name:
            return block.input
    raise RuntimeError(f"Claude response did not include the expected '{tool_name}' tool call")


def _extract_list_field(result: dict, field: str) -> list:
    """Claude occasionally double-encodes a complex tool input — instead of
    {"field": [...]} it sometimes returns {"field": "<the same JSON, as a string>"}.
    Handle both shapes rather than failing on the second one."""
    value = result.get(field)
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except (json.JSONDecodeError, TypeError):
            parsed = None
        if isinstance(parsed, list):
            return parsed
        if isinstance(parsed, dict) and isinstance(parsed.get(field), list):
            return parsed[field]
    raise RuntimeError(f"Claude did not return a usable '{field}' list")


# ---------------------------------------------------------------------------
# Route drafting
# ---------------------------------------------------------------------------

def draft_route_stops(
    destination_key: str,
    raw: str,
    days: int,
    special_requests: Optional[str] = None,
    when_answer: Optional[str] = None,
    who_answer: Optional[str] = None,
    budget_answer: Optional[str] = None,
    pace_answer: Optional[str] = None,
) -> List[Dict[str, str]]:
    name = destination_name(destination_key, raw)
    # The real agent can reason about any place, so give it exactly what the customer
    # typed — not the canonicalized name from our small 8-destination matcher, which
    # exists for the destination-art lookup and the simulated fallback, not for this.
    agent_destination = raw.strip() or name
    try:
        return _agent_draft_route_stops(agent_destination, days, special_requests, when_answer, who_answer, budget_answer, pace_answer)
    except Exception as exc:
        logger.warning("Route drafting fell back to simulation: %s", exc)
        return _simulate_draft_route_stops(name, days, special_requests)


def _agent_draft_route_stops(
    name: str, days: int, special_requests: Optional[str],
    when_answer: Optional[str], who_answer: Optional[str], budget_answer: Optional[str], pace_answer: Optional[str],
) -> List[Dict[str, str]]:
    context = [f"Destination: {name}", f"Trip length: {days} day{'s' if days != 1 else ''}"]
    if when_answer:
        context.append(f"When: {when_answer}")
    if who_answer:
        context.append(f"Who's coming: {who_answer}")
    if budget_answer:
        context.append(f"Budget vibe: {budget_answer}")
    if pace_answer:
        context.append(f"Pace: {pace_answer}")
    if special_requests:
        context.append(f"Special requests: {special_requests}")

    result = _call_tool(
        system=(
            "You are the trip-planning agent for TripBuggy. You draft concise, concrete routes grounded in "
            "real knowledge of the destination — use actual neighborhoods, landmarks, and place names, not "
            "generic placeholders."
        ),
        user=(
            "Draft a short, high-level route for this trip — 3 to 6 waypoint-style stops (not a literal "
            "day-by-day schedule), covering arrival through departure. Keep each note to one short sentence.\n\n"
            + "\n".join(context)
        ),
        tool_name="propose_route",
        description="Return the drafted route stops for this trip, in visiting order.",
        input_schema={
            "type": "object",
            "properties": {
                "stops": {
                    "type": "array",
                    "minItems": 3,
                    "maxItems": 6,
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string", "description": "Short stop name, e.g. 'Explore Montmartre'"},
                            "notes": {"type": "string", "description": "One-sentence note about this stop"},
                        },
                        "required": ["name", "notes"],
                    },
                }
            },
            "required": ["stops"],
        },
    )
    stops = _extract_list_field(result, "stops")
    return [{"name": str(s["name"]), "notes": str(s["notes"])} for s in stops]


def _simulate_draft_route_stops(name: str, days: int, special_requests: Optional[str]) -> List[Dict[str, str]]:
    explore_notes = "Walkable highlights, no fixed plan"
    if special_requests:
        explore_notes = f"{explore_notes} — factoring in: {special_requests}"
    stops = [
        {"name": f"Arrive in {name}", "notes": "Settle in, get oriented"},
        {"name": f"Explore {name}'s center", "notes": explore_notes},
    ]
    if days > 2:
        stops.append({"name": f"Day trip beyond {name}", "notes": "Something outside the city center"})
    stops.append({"name": f"Depart from {name}", "notes": "Buffer time before departure"})
    return stops


# ---------------------------------------------------------------------------
# Catalog discovery
# ---------------------------------------------------------------------------

def discover_catalog(
    destination_key: str,
    raw: str,
    when_answer: Optional[str] = None,
    who_answer: Optional[str] = None,
    budget_answer: Optional[str] = None,
    pace_answer: Optional[str] = None,
    route_stop_names: Optional[List[str]] = None,
) -> List[Dict[str, object]]:
    name = destination_name(destination_key, raw)
    agent_destination = raw.strip() or name
    try:
        return _agent_discover_catalog(agent_destination, when_answer, who_answer, budget_answer, pace_answer, route_stop_names)
    except Exception as exc:
        logger.warning("Catalog discovery fell back to simulation: %s", exc)
        return _simulate_discover_catalog(destination_key, name)


def _agent_discover_catalog(
    name: str, when_answer: Optional[str], who_answer: Optional[str], budget_answer: Optional[str],
    pace_answer: Optional[str], route_stop_names: Optional[List[str]],
) -> List[Dict[str, object]]:
    context = [f"Destination: {name}"]
    if when_answer:
        context.append(f"When: {when_answer}")
    if who_answer:
        context.append(f"Who's coming: {who_answer}")
    if budget_answer:
        context.append(f"Budget vibe: {budget_answer}")
    if pace_answer:
        context.append(f"Pace: {pace_answer}")
    if route_stop_names:
        context.append("Planned route: " + ", ".join(route_stop_names))

    result = _call_tool(
        system=(
            "You are the trip-planning agent for TripBuggy. You surface flight, stay, and activity options. "
            "This is simulated inventory, not a live booking search — prioritize specific, appealing, "
            "destination-grounded titles over exact real-world pricing."
        ),
        user=(
            "Surface exactly 6 options to add to this itinerary: one outbound flight, one return flight, one "
            "stay, and three activities. Cost estimates should be plausible in USD and should reflect the "
            "stated budget vibe (Budget-friendly should feel noticeably cheaper than Treat yourself).\n\n"
            + "\n".join(context)
        ),
        tool_name="propose_options",
        description="Return the surfaced flight/stay/activity options.",
        input_schema={
            "type": "object",
            "properties": {
                "options": {
                    "type": "array",
                    "minItems": 6,
                    "maxItems": 6,
                    "items": {
                        "type": "object",
                        "properties": {
                            "item_type": {"type": "string", "enum": ["flight", "stay", "activity"]},
                            "title": {"type": "string"},
                            "cost_estimate": {"type": "number"},
                        },
                        "required": ["item_type", "title", "cost_estimate"],
                    },
                }
            },
            "required": ["options"],
        },
    )
    options = _extract_list_field(result, "options")
    return [
        {"item_type": str(o["item_type"]), "title": str(o["title"]), "cost_estimate": float(o["cost_estimate"])}
        for o in options
    ]


def _simulate_discover_catalog(destination_key: str, name: str) -> List[Dict[str, object]]:
    activities = ACTIVITY_POOL.get(destination_key, ACTIVITY_POOL["fallback"])
    return [
        {"item_type": "flight", "title": f"Flight to {name}", "cost_estimate": 420},
        {"item_type": "stay", "title": f"Boutique stay near the center of {name}", "cost_estimate": 640},
        {"item_type": "activity", "title": activities[0], "cost_estimate": 85},
        {"item_type": "activity", "title": activities[1], "cost_estimate": 60},
        {"item_type": "activity", "title": activities[2], "cost_estimate": 110},
        {"item_type": "flight", "title": f"Flight home from {name}", "cost_estimate": 390},
    ]


# ---------------------------------------------------------------------------
# On-the-road change interpretation
# ---------------------------------------------------------------------------

def interpret_change_request(prompt_text: str, booked_items: List[Dict[str, str]]) -> Optional[str]:
    """Returns the id of the booked item most likely affected by this change request, or None.
    booked_items: [{"id": ..., "title": ..., "item_type": ...}, ...]."""
    if not booked_items:
        return None
    try:
        return _agent_interpret_change(prompt_text, booked_items)
    except Exception as exc:
        logger.warning("Change-request interpretation fell back to a random pick: %s", exc)
        return random.choice(booked_items)["id"]


def _agent_interpret_change(prompt_text: str, booked_items: List[Dict[str, str]]) -> Optional[str]:
    listing = "\n".join(f"{i}: [{item['item_type']}] {item['title']}" for i, item in enumerate(booked_items))
    result = _call_tool(
        system="You are the trip-planning agent for TripBuggy, handling an on-the-road change request.",
        user=(
            f'A traveler on this trip just said: "{prompt_text}"\n\n'
            f"Currently booked items:\n{listing}\n\n"
            "Which single booked item, if any, is most likely affected by this? Respond with its index, "
            "or -1 if none of them are clearly affected."
        ),
        tool_name="pick_affected_item",
        description="Identify which booked item (by index) is affected by the traveler's message.",
        input_schema={
            "type": "object",
            "properties": {
                "item_index": {"type": "integer", "description": "Index of the affected item, or -1 if none"},
                "reasoning": {"type": "string"},
            },
            "required": ["item_index", "reasoning"],
        },
    )
    idx = result.get("item_index")
    if isinstance(idx, int) and 0 <= idx < len(booked_items):
        return booked_items[idx]["id"]
    return None


# ---------------------------------------------------------------------------
# In-app assistant — free-text Q&A about whatever's on screen, from the
# floating widget (frontend/src/components/AssistantWidget.tsx).
# ---------------------------------------------------------------------------

SCREEN_HELP: Dict[str, str] = {
    "home": "Type a destination and hit \"Plan my trip\" to start — or click \"Surprise me\" for a random pick.",
    "flow": "Answer each question by tapping a chip. Your answers shape the route and catalog the agent drafts later.",
    "summary": "Confirm your trip length and any special requests here. Traveling with others? Invite them by email and they'll get editor access.",
    "route": "This is the agent's drafted route. Reorder stops with the arrows, remove ones you don't want, or add your own at the bottom.",
    "discover": "The agent suggests flights, stays, and activities here. Click Add on anything you like, or use manual entry for something it missed.",
    "itinerary": "Items are placed on days and time slots — change either with the dropdowns. A banner warns you if you're over budget or double-booked.",
    "booking": "The autonomy dial controls how much the agent can book without asking: draft only, approve each item, or fully automatic.",
    "road": "Tell the agent about anything that changes mid-trip — it figures out which booking is affected and sends it back for approval.",
    "recap": "\"Save as template\" keeps this trip's destination, answers, and route so you can reuse them the next time you plan something similar.",
    "trips": "Trips you own or were invited to live here, along with any templates you've saved.",
}


def summarize_trip_for_assistant(trip) -> Dict[str, object]:
    """A compact snapshot of the current trip, used to ground the assistant's answer —
    not the full TripOut shape, just what's useful for a customer's question."""
    return {
        "destination": trip.destination_raw,
        "trip_status": trip.status,
        "days": trip.days,
        "when": trip.when_answer,
        "who": trip.who_answer,
        "budget_vibe": trip.budget_answer,
        "pace": trip.pace_answer,
        "is_international": trip.is_international,
        "autonomy_level": trip.autonomy_level,
        "item_count": len(trip.items),
        "budget_total": sum(i.cost_estimate for i in trip.items),
        "budget_cap": budget_cap_for(trip.budget_answer),
        "crew_count": len(trip.crew),
    }


def answer_assistant_question(question: str, screen: str, trip_context: Optional[Dict[str, object]]) -> str:
    try:
        return _agent_answer_assistant_question(question, screen, trip_context)
    except Exception as exc:
        logger.warning("Assistant Q&A fell back to a canned screen blurb: %s", exc)
        return SCREEN_HELP.get(screen, "I can't reach the assistant right now — please try again in a moment.")


def _agent_answer_assistant_question(question: str, screen: str, trip_context: Optional[Dict[str, object]]) -> str:
    client = _get_client()
    if client is None:
        raise RuntimeError("no ANTHROPIC_API_KEY configured")

    context_lines = [f"Current screen: {screen}"]
    if screen in SCREEN_HELP:
        context_lines.append(f"What this screen actually does: {SCREEN_HELP[screen]}")
    if trip_context:
        context_lines.append("Background — the trip currently open in the app (may not be relevant to this question):")
        for key, value in trip_context.items():
            if value is not None:
                context_lines.append(f"  {key}: {value}")

    response = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=300,
        system=(
            "You are the in-app help assistant for TripBuggy, a trip-planning app. A customer is looking at "
            "the app right now and has a question about what's on their screen or how something works. Answer "
            "briefly and conversationally — two or three sentences at most, no markdown or bullet lists. If "
            "their question isn't about the app, gently steer them back to trip planning.\n\n"
            "\"What this screen actually does\", when present below, is ground truth for the current screen — "
            "defer to it over any assumption you'd otherwise make about a control's behavior.\n\n"
            "The trip background below, when present, describes whatever trip happens to be open in the app "
            "right now — it is NOT necessarily what the question is about. Only bring it up if the question is "
            "actually about that specific trip's state (its budget, its answers, its autonomy setting, etc). "
            "A question about how a screen or control works in general (e.g. \"what does Surprise me do?\") "
            "should get a general answer about the app, not one bent around the open trip's details.\n\n"
            "You can only explain and inform — you have no ability to click anything, change any setting, or "
            "modify the trip yourself. If the customer asks you to do something (add an item, change the "
            "budget, book something, invite someone, anything), do not imply you did it or will do it. Tell "
            "them exactly which button or field on the page to use instead."
        ),
        messages=[{"role": "user", "content": "\n".join(context_lines) + f"\n\nQuestion: {question}"}],
    )
    text = "".join(block.text for block in response.content if block.type == "text").strip()
    if not text:
        raise RuntimeError("Claude response had no text content")
    return text
