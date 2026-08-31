"""
Simulated agent layer.

Every function here stands in for a real Claude tool call (see docs/TRD.md §5).
The logic is ported directly from frontend/src/state/tripStore.ts so the two
stay in sync — when this gets wired to the real Anthropic API, these are the
functions to replace; nothing above them (the routers) should need to change.
"""

import random
from typing import Dict, List, Optional

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


def draft_route_stops(destination_key: str, raw: str) -> List[Dict[str, str]]:
    """TODO(agent): replace with a Claude tool call — draft_route(destination, answers)."""
    name = destination_name(destination_key, raw)
    return [
        {"name": f"Arrive in {name}", "notes": "Settle in, get oriented"},
        {"name": f"Explore {name}'s center", "notes": "Walkable highlights, no fixed plan"},
        {"name": f"Day trip beyond {name}", "notes": "Something outside the city center"},
        {"name": f"Depart from {name}", "notes": "Buffer time before departure"},
    ]


def discover_catalog(destination_key: str, raw: str) -> List[Dict[str, object]]:
    """TODO(agent): replace with a real flights/stays/activities search API — search_catalog(criteria)."""
    name = destination_name(destination_key, raw)
    activities = ACTIVITY_POOL.get(destination_key, ACTIVITY_POOL["fallback"])
    return [
        {"item_type": "flight", "title": f"Flight to {name}", "cost_estimate": 420},
        {"item_type": "stay", "title": f"Boutique stay near the center of {name}", "cost_estimate": 640},
        {"item_type": "activity", "title": activities[0], "cost_estimate": 85},
        {"item_type": "activity", "title": activities[1], "cost_estimate": 60},
        {"item_type": "activity", "title": activities[2], "cost_estimate": 110},
        {"item_type": "flight", "title": f"Flight home from {name}", "cost_estimate": 390},
    ]


def budget_cap_for(budget_answer: Optional[str]) -> float:
    return BUDGET_CAPS.get(budget_answer or "", 2800)


def next_day_slot(existing_item_count: int):
    day = existing_item_count // 3 + 1
    slot = SLOTS[existing_item_count % 3]
    return day, slot


def pick_random(items: list):
    return random.choice(items) if items else None
