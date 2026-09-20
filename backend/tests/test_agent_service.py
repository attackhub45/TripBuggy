"""
Pure-logic and fallback-path tests for the agent layer. conftest forces
ANTHROPIC_API_KEY empty, so draft_route_stops/discover_catalog/interpret_change_request
here always take the deterministic _simulate_* path — no network calls. The real-agent
path (_agent_*, _call_tool) is exercised separately with a fake Anthropic client, per
docs/TRD.md's "mock the Anthropic client" testing strategy.
"""

import pytest

from app import agent_service as svc


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "raw,expected",
    [("Paris", "paris"), ("france", "paris"), ("Tokyo, Japan", "tokyo"), ("NYC", "newyork"), ("", "fallback"), ("Ulaanbaatar", "fallback")],
)
def test_match_destination(raw, expected):
    assert svc.match_destination(raw) == expected


def test_destination_name_uses_raw_for_fallback():
    assert svc.destination_name("fallback", "Ulaanbaatar") == "Ulaanbaatar"
    assert svc.destination_name("paris", "france") == "Paris"


def test_budget_cap_for_known_and_unknown_answers():
    assert svc.budget_cap_for("Budget-friendly") == 1200
    assert svc.budget_cap_for("Treat yourself") == 6000
    assert svc.budget_cap_for(None) == 2800
    assert svc.budget_cap_for("not a real answer") == 2800


def test_next_day_slot_rotates_through_slots_and_caps_at_trip_length():
    assert svc.next_day_slot(0, 5) == (1, "morning")
    assert svc.next_day_slot(1, 5) == (1, "afternoon")
    assert svc.next_day_slot(3, 5) == (2, "morning")
    assert svc.next_day_slot(100, 3) == (3, "afternoon")  # day never exceeds trip_days


# ---------------------------------------------------------------------------
# _extract_list_field — the fix for Claude's double-encoded tool-input quirk
# ---------------------------------------------------------------------------

def test_extract_list_field_accepts_a_native_list():
    assert svc._extract_list_field({"stops": [1, 2]}, "stops") == [1, 2]


def test_extract_list_field_unwraps_a_json_encoded_list_string():
    assert svc._extract_list_field({"stops": "[1, 2, 3]"}, "stops") == [1, 2, 3]


def test_extract_list_field_unwraps_a_json_encoded_object_string():
    assert svc._extract_list_field({"stops": '{"stops": [1, 2]}'}, "stops") == [1, 2]


def test_extract_list_field_raises_on_garbage():
    with pytest.raises(RuntimeError):
        svc._extract_list_field({"stops": "not json"}, "stops")
    with pytest.raises(RuntimeError):
        svc._extract_list_field({}, "stops")


# ---------------------------------------------------------------------------
# Fallback paths (no API key configured in the test environment)
# ---------------------------------------------------------------------------

def test_draft_route_stops_falls_back_to_simulation():
    stops = svc.draft_route_stops("paris", "Paris", days=4, special_requests="vegetarian meals")
    assert 3 <= len(stops) <= 5
    assert stops[0]["name"] == "Arrive in Paris"
    assert "vegetarian meals" in stops[1]["notes"]


def test_draft_route_stops_short_trip_skips_the_day_trip_stop():
    stops = svc.draft_route_stops("paris", "Paris", days=2)
    names = [s["name"] for s in stops]
    assert not any("Day trip" in n for n in names)


def test_discover_catalog_falls_back_to_six_simulated_items():
    options = svc.discover_catalog("tokyo", "Tokyo")
    assert len(options) == 6
    assert options[0]["item_type"] == "flight"
    assert options[0]["booking_url"] is None  # simulated flights don't get a link


def test_discover_catalog_simulated_stay_gets_an_airbnb_link():
    options = svc.discover_catalog("tokyo", "Tokyo")
    stay = next(o for o in options if o["item_type"] == "stay")
    assert stay["platform"] == "airbnb"
    assert stay["booking_url"] == "https://www.airbnb.com/s/Tokyo/homes"


# ---------------------------------------------------------------------------
# Booking-link validation — never surface an unvalidated model-generated URL
# ---------------------------------------------------------------------------

def test_validate_booking_url_allows_a_known_domain():
    url = "https://www.airbnb.com/s/Bangalore/homes"
    assert svc._validate_booking_url(url) == url


def test_validate_booking_url_rejects_an_unknown_domain():
    assert svc._validate_booking_url("https://www.yelp.com/search?find=Bangalore") is None


def test_validate_booking_url_rejects_non_https():
    assert svc._validate_booking_url("http://www.airbnb.com/s/Bangalore/homes") is None


def test_validate_booking_url_rejects_garbage():
    assert svc._validate_booking_url(None) is None
    assert svc._validate_booking_url(123) is None
    assert svc._validate_booking_url("") is None
    assert svc._validate_booking_url("not a url at all") is None


def test_interpret_change_request_with_no_booked_items_returns_none():
    assert svc.interpret_change_request("my flight is delayed", []) is None


def test_interpret_change_request_falls_back_to_one_of_the_booked_items():
    booked = [{"id": "a", "title": "Flight", "item_type": "flight"}]
    assert svc.interpret_change_request("my flight is delayed", booked) == "a"


# ---------------------------------------------------------------------------
# Real-agent path, with a fake Anthropic client (no network calls)
# ---------------------------------------------------------------------------

class _FakeToolUseBlock:
    type = "tool_use"

    def __init__(self, name, input_):
        self.name = name
        self.input = input_


class _FakeResponse:
    def __init__(self, content, stop_reason="end_turn"):
        self.content = content
        self.stop_reason = stop_reason


class _FakeMessages:
    def __init__(self, response):
        self._response = response

    def create(self, **kwargs):
        return self._response


class _FakeAnthropicClient:
    def __init__(self, response):
        self.messages = _FakeMessages(response)


class _FakeTextBlock:
    type = "text"

    def __init__(self, text):
        self.text = text


class _SequencedFakeMessages:
    """Returns one canned response per call, in order — for flows (like catalog
    discovery) that make more than one messages.create() call."""

    def __init__(self, responses):
        self._responses = list(responses)

    def create(self, **kwargs):
        return self._responses.pop(0)


class _SequencedFakeClient:
    def __init__(self, responses):
        self.messages = _SequencedFakeMessages(responses)


def test_call_tool_extracts_the_matching_tool_use_block(monkeypatch):
    fake_input = {"stops": [{"name": "Arrive", "notes": "settle in"}]}
    fake_client = _FakeAnthropicClient(_FakeResponse([_FakeToolUseBlock("propose_route", fake_input)]))
    monkeypatch.setattr(svc, "_get_client", lambda: fake_client)

    result = svc._call_tool(system="sys", user="usr", tool_name="propose_route", description="d", input_schema={})
    assert result == fake_input


def test_draft_route_stops_uses_the_real_agent_when_a_client_is_configured(monkeypatch):
    fake_input = {"stops": [
        {"name": "Explore Marrakech medina", "notes": "wander the souks"},
        {"name": "Atlas Mountains day trip", "notes": "Berber villages"},
        {"name": "Relax at a riad", "notes": "hammam and mint tea"},
    ]}
    fake_client = _FakeAnthropicClient(_FakeResponse([_FakeToolUseBlock("propose_route", fake_input)]))
    monkeypatch.setattr(svc, "_get_client", lambda: fake_client)

    stops = svc.draft_route_stops("fallback", "Marrakech, Morocco", days=5)
    assert stops[0]["name"] == "Explore Marrakech medina"


def test_draft_route_stops_falls_back_when_the_agent_response_is_malformed(monkeypatch):
    fake_client = _FakeAnthropicClient(_FakeResponse([]))  # no tool_use block at all
    monkeypatch.setattr(svc, "_get_client", lambda: fake_client)

    stops = svc.draft_route_stops("paris", "Paris", days=3)
    assert stops[0]["name"] == "Arrive in Paris"  # simulated fallback, not a crash


def test_discover_catalog_researches_then_structures_with_booking_links(monkeypatch):
    """Catalog discovery is two calls: a web-search-enabled research pass (plain text
    out), then a forced-tool pass that structures it — including validating each
    booking_url against the domain allowlist."""
    research_response = _FakeResponse([_FakeTextBlock("Found a great nonstop on momondo and a flat on airbnb...")])
    structured_input = {"options": [
        {"item_type": "flight", "title": "JFK-BLR nonstop", "cost_estimate": 900, "platform": "momondo", "booking_url": "https://www.momondo.ca/flight-search"},
        {"item_type": "flight", "title": "BLR-JFK nonstop", "cost_estimate": 900, "platform": "momondo", "booking_url": "https://www.momondo.ca/flight-search"},
        {"item_type": "stay", "title": "Koramangala flat", "cost_estimate": 120, "platform": "airbnb", "booking_url": "https://www.airbnb.com/s/Bangalore/homes"},
        {"item_type": "activity", "title": "Nandi Hills sunrise tour", "cost_estimate": 40, "platform": "viator", "booking_url": "https://www.viator.com/search/Bangalore"},
        {"item_type": "activity", "title": "Cubbon Park walk", "cost_estimate": 0},
        {"item_type": "activity", "title": "Craft brewery hop", "cost_estimate": 30, "platform": "yelp", "booking_url": "https://www.yelp.com/not-an-allowed-domain"},
    ]}
    tool_response = _FakeResponse([_FakeToolUseBlock("propose_options", structured_input)])
    fake_client = _SequencedFakeClient([research_response, tool_response])
    monkeypatch.setattr(svc, "_get_client", lambda: fake_client)

    options = svc.discover_catalog("fallback", "Bangalore, India")
    assert len(options) == 6
    assert options[0]["booking_url"] == "https://www.momondo.ca/flight-search"
    assert options[4]["booking_url"] is None  # no platform/url offered — left blank, not guessed
    assert options[5]["booking_url"] is None  # yelp.com isn't an allowed domain — dropped


def test_discover_catalog_falls_back_when_research_produces_no_summary(monkeypatch):
    fake_client = _SequencedFakeClient([_FakeResponse([])])  # empty research response
    monkeypatch.setattr(svc, "_get_client", lambda: fake_client)

    options = svc.discover_catalog("paris", "Paris")
    assert len(options) == 6
    assert options[0]["title"] == "Flight to Paris"  # simulated fallback, not a crash


def test_discover_catalog_falls_back_when_research_gets_truncated(monkeypatch):
    """Regression test: too many web searches once filled the research call's token
    budget before it could write a summary (stop_reason="max_tokens", found live — see
    docs/ROADMAP.md). A truncated response must not be treated as usable research."""
    truncated = _FakeResponse([_FakeTextBlock("Found a flight on mo")], stop_reason="max_tokens")
    fake_client = _SequencedFakeClient([truncated])
    monkeypatch.setattr(svc, "_get_client", lambda: fake_client)

    options = svc.discover_catalog("paris", "Paris")
    assert len(options) == 6
    assert options[0]["title"] == "Flight to Paris"  # simulated fallback, not garbled truncated text
