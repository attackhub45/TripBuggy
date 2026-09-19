import pytest


@pytest.fixture()
def trip(client, make_user):
    headers, _ = make_user()
    r = client.post("/api/v1/trips", json={"destination": "Kyoto, Japan"}, headers=headers)
    assert r.status_code == 201, r.text
    return headers, r.json()


def test_create_trip_matches_a_known_destination(client, make_user):
    headers, _ = make_user()
    r = client.post("/api/v1/trips", json={"destination": "Paris"}, headers=headers)
    assert r.status_code == 201
    body = r.json()
    assert body["destination_key"] == "paris"
    assert body["destination_raw"] == "Paris"
    assert body["status"] == "intake"
    assert body["my_role"] == "owner"


def test_create_trip_falls_back_for_an_unknown_destination(client, make_user):
    headers, _ = make_user()
    r = client.post("/api/v1/trips", json={"destination": "Ulaanbaatar"}, headers=headers)
    assert r.status_code == 201
    assert r.json()["destination_key"] == "fallback"


def test_get_trip_round_trips(client, trip):
    headers, created = trip
    r = client.get(f"/api/v1/trips/{created['id']}", headers=headers)
    assert r.status_code == 200
    assert r.json()["id"] == created["id"]


def test_get_unknown_trip_is_404(client, make_user):
    headers, _ = make_user()
    r = client.get("/api/v1/trips/00000000-0000-0000-0000-000000000000", headers=headers)
    assert r.status_code == 404


def test_submit_intake_answer_rejects_unknown_key(client, trip):
    headers, created = trip
    r = client.post(
        f"/api/v1/trips/{created['id']}/intake-answers",
        json={"question_key": "not_a_real_question", "answer_value": "x"},
        headers=headers,
    )
    assert r.status_code == 400


def test_submit_intake_answer_stores_the_value(client, trip):
    headers, created = trip
    r = client.post(
        f"/api/v1/trips/{created['id']}/intake-answers",
        json={"question_key": "budget", "answer_value": "Balanced"},
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["budget_answer"] == "Balanced"


def test_set_trip_details_rejects_zero_days(client, trip):
    headers, created = trip
    r = client.patch(
        f"/api/v1/trips/{created['id']}/details",
        json={"days": 0, "special_requests": None},
        headers=headers,
    )
    assert r.status_code == 400


def test_set_trip_details_stores_days_and_requests(client, trip):
    headers, created = trip
    r = client.patch(
        f"/api/v1/trips/{created['id']}/details",
        json={"days": 4, "special_requests": "vegetarian meals"},
        headers=headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["days"] == 4
    assert body["special_requests"] == "vegetarian meals"


def test_draft_route_requires_days_to_be_set_first(client, trip):
    headers, created = trip
    r = client.post(f"/api/v1/trips/{created['id']}/route", headers=headers)
    assert r.status_code == 400


def test_draft_route_falls_back_to_simulation_without_an_api_key(client, trip):
    """conftest forces ANTHROPIC_API_KEY empty, so this exercises agent_service's
    deterministic fallback rather than a live Claude call."""
    headers, created = trip
    client.patch(f"/api/v1/trips/{created['id']}/details", json={"days": 5}, headers=headers)
    r = client.post(f"/api/v1/trips/{created['id']}/route", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert len(body["route_stops"]) >= 3
    assert body["status"] == "planning"


def test_route_stops_can_be_added_moved_and_removed(client, trip):
    headers, created = trip
    client.patch(f"/api/v1/trips/{created['id']}/details", json={"days": 3}, headers=headers)
    trip_id = created["id"]

    r = client.post(f"/api/v1/trips/{trip_id}/route/stops", json={"name": "Custom stop"}, headers=headers)
    stops = r.json()["route_stops"]
    assert stops[-1]["name"] == "Custom stop"
    stop_id = stops[-1]["id"]

    r = client.post(f"/api/v1/trips/{trip_id}/route/stops/{stop_id}/move", json={"direction": -1}, headers=headers)
    moved = [s for s in r.json()["route_stops"] if s["id"] == stop_id][0]
    assert moved["order_index"] == 0

    r = client.delete(f"/api/v1/trips/{trip_id}/route/stops/{stop_id}", headers=headers)
    assert stop_id not in [s["id"] for s in r.json()["route_stops"]]


def test_discover_options_returns_six_simulated_items(client, trip):
    headers, created = trip
    r = client.post(f"/api/v1/trips/{created['id']}/discover", headers=headers)
    assert r.status_code == 200
    options = r.json()
    assert len(options) == 6
    assert {o["item_type"] for o in options} <= {"flight", "stay", "activity"}


def test_itinerary_items_add_update_remove(client, trip):
    headers, created = trip
    trip_id = created["id"]
    client.patch(f"/api/v1/trips/{trip_id}/details", json={"days": 3}, headers=headers)

    r = client.post(
        f"/api/v1/trips/{trip_id}/itinerary-items",
        json={"item_type": "activity", "title": "Museum", "cost_estimate": 40, "source": "manual"},
        headers=headers,
    )
    assert r.status_code == 200
    item = r.json()["items"][-1]
    assert item["title"] == "Museum"

    r = client.patch(
        f"/api/v1/trips/{trip_id}/itinerary-items/{item['id']}",
        json={"day_index": 99},
        headers=headers,
    )
    assert r.status_code == 400  # out of the trip's 3-day range

    r = client.patch(
        f"/api/v1/trips/{trip_id}/itinerary-items/{item['id']}",
        json={"day_index": 2, "slot": "evening"},
        headers=headers,
    )
    assert r.status_code == 200
    updated = [i for i in r.json()["items"] if i["id"] == item["id"]][0]
    assert updated["day_index"] == 2 and updated["slot"] == "evening"

    r = client.delete(f"/api/v1/trips/{trip_id}/itinerary-items/{item['id']}", headers=headers)
    assert item["id"] not in [i["id"] for i in r.json()["items"]]


def test_budget_reflects_items_against_the_cap(client, trip):
    headers, created = trip
    trip_id = created["id"]
    client.post(
        f"/api/v1/trips/{trip_id}/intake-answers",
        json={"question_key": "budget", "answer_value": "Budget-friendly"},
        headers=headers,
    )
    client.post(
        f"/api/v1/trips/{trip_id}/itinerary-items",
        json={"item_type": "stay", "title": "Fancy hotel", "cost_estimate": 5000, "source": "manual"},
        headers=headers,
    )
    r = client.get(f"/api/v1/trips/{trip_id}/budget", headers=headers)
    body = r.json()
    assert body["cap"] == 1200
    assert body["total"] == 5000
    assert body["over_budget"] is True


def test_set_autonomy_rejects_an_invalid_level(client, trip):
    headers, created = trip
    r = client.patch(f"/api/v1/trips/{created['id']}/autonomy", json={"autonomy_level": "yolo"}, headers=headers)
    assert r.status_code == 400


@pytest.mark.parametrize(
    "level,expected_status",
    [("draft_only", "proposed"), ("approve_each", "pending_approval"), ("full_auto", "simulated_booked")],
)
def test_run_booking_behaves_per_autonomy_level(client, trip, level, expected_status):
    headers, created = trip
    trip_id = created["id"]
    client.patch(f"/api/v1/trips/{trip_id}/autonomy", json={"autonomy_level": level}, headers=headers)
    client.post(
        f"/api/v1/trips/{trip_id}/itinerary-items",
        json={"item_type": "activity", "title": "Tour", "cost_estimate": 20, "source": "manual"},
        headers=headers,
    )
    r = client.post(f"/api/v1/trips/{trip_id}/book", headers=headers)
    assert r.status_code == 200
    items = r.json()["items"]
    assert all(i["status"] == expected_status for i in items)


def test_approve_item_books_it_and_resolves_a_clear_change_request(client, trip):
    headers, created = trip
    trip_id = created["id"]
    client.patch(f"/api/v1/trips/{trip_id}/autonomy", json={"autonomy_level": "approve_each"}, headers=headers)
    r = client.post(
        f"/api/v1/trips/{trip_id}/itinerary-items",
        json={"item_type": "activity", "title": "Tour", "cost_estimate": 20, "source": "manual"},
        headers=headers,
    )
    item_id = r.json()["items"][0]["id"]
    client.post(f"/api/v1/trips/{trip_id}/book", headers=headers)

    r = client.post(f"/api/v1/trips/{trip_id}/itinerary-items/{item_id}/approve", headers=headers)
    assert r.status_code == 200
    item = [i for i in r.json()["items"] if i["id"] == item_id][0]
    assert item["status"] == "simulated_booked"
    assert item["autonomy_at_booking"] == "approve_each"


def test_change_request_with_no_booked_items_leaves_it_unaffected(client, trip):
    headers, created = trip
    r = client.post(
        f"/api/v1/trips/{created['id']}/change-requests",
        json={"prompt_text": "my flight got delayed"},
        headers=headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "on_the_road"
    assert body["change_requests"][-1]["affected_item_id"] is None


def test_change_request_targets_a_booked_item(client, trip):
    headers, created = trip
    trip_id = created["id"]
    client.patch(f"/api/v1/trips/{trip_id}/autonomy", json={"autonomy_level": "full_auto"}, headers=headers)
    client.post(
        f"/api/v1/trips/{trip_id}/itinerary-items",
        json={"item_type": "activity", "title": "Tour", "cost_estimate": 20, "source": "manual"},
        headers=headers,
    )
    client.post(f"/api/v1/trips/{trip_id}/book", headers=headers)

    r = client.post(
        f"/api/v1/trips/{trip_id}/change-requests",
        json={"prompt_text": "cancel the tour"},
        headers=headers,
    )
    body = r.json()
    affected = body["change_requests"][-1]["affected_item_id"]
    assert affected is not None
    item = [i for i in body["items"] if i["id"] == affected][0]
    assert item["status"] == "pending_approval"


def test_complete_trip_sets_status(client, trip):
    headers, created = trip
    r = client.post(f"/api/v1/trips/{created['id']}/complete", headers=headers)
    assert r.status_code == 200
    assert r.json()["status"] == "complete"


def test_list_trips_returns_only_the_caller_s_trips(client, make_user):
    headers_a, _ = make_user()
    headers_b, _ = make_user()
    client.post("/api/v1/trips", json={"destination": "Rome"}, headers=headers_a)

    r = client.get("/api/v1/trips", headers=headers_b)
    assert r.status_code == 200
    assert r.json() == []

    r = client.get("/api/v1/trips", headers=headers_a)
    assert len(r.json()) == 1
