import pytest


@pytest.fixture()
def owned_trip(client, make_user):
    owner_headers, owner_email = make_user(email="owner@example.com")
    r = client.post("/api/v1/trips", json={"destination": "Rome"}, headers=owner_headers)
    trip = r.json()
    client.patch(f"/api/v1/trips/{trip['id']}/details", json={"days": 3}, headers=owner_headers)
    return owner_headers, trip


def _invite(client, owner_headers, trip_id, email, role):
    r = client.post(f"/api/v1/trips/{trip_id}/crew", json={"email": email, "role": role}, headers=owner_headers)
    assert r.status_code == 200, r.text


def test_owner_role_on_own_trip(client, owned_trip):
    headers, trip = owned_trip
    r = client.get(f"/api/v1/trips/{trip['id']}", headers=headers)
    assert r.json()["my_role"] == "owner"


def test_non_member_gets_404_not_403(client, owned_trip, make_user):
    _, trip = owned_trip
    stranger_headers, _ = make_user(email="stranger@example.com")
    r = client.get(f"/api/v1/trips/{trip['id']}", headers=stranger_headers)
    assert r.status_code == 404


def test_viewer_can_read_but_not_write(client, owned_trip, make_user):
    owner_headers, trip = owned_trip
    viewer_headers, viewer_email = make_user(email="viewer@example.com")
    _invite(client, owner_headers, trip["id"], viewer_email, "viewer")

    r = client.get(f"/api/v1/trips/{trip['id']}", headers=viewer_headers)
    assert r.status_code == 200
    assert r.json()["my_role"] == "viewer"

    r = client.post(
        f"/api/v1/trips/{trip['id']}/itinerary-items",
        json={"item_type": "activity", "title": "Tour", "cost_estimate": 10, "source": "manual"},
        headers=viewer_headers,
    )
    assert r.status_code == 403


def test_editor_can_write_but_not_invite_crew(client, owned_trip, make_user):
    owner_headers, trip = owned_trip
    editor_headers, editor_email = make_user(email="editor@example.com")
    _invite(client, owner_headers, trip["id"], editor_email, "editor")

    r = client.post(
        f"/api/v1/trips/{trip['id']}/itinerary-items",
        json={"item_type": "activity", "title": "Tour", "cost_estimate": 10, "source": "manual"},
        headers=editor_headers,
    )
    assert r.status_code == 200

    r = client.post(
        f"/api/v1/trips/{trip['id']}/crew",
        json={"email": "someone-else@example.com", "role": "viewer"},
        headers=editor_headers,
    )
    assert r.status_code == 403


def test_crew_membership_is_matched_case_insensitively(client, owned_trip, make_user):
    owner_headers, trip = owned_trip
    _invite(client, owner_headers, trip["id"], "Mixed.Case@Example.com", "editor")
    editor_headers, _ = make_user(email="mixed.case@example.com")

    r = client.get(f"/api/v1/trips/{trip['id']}", headers=editor_headers)
    assert r.status_code == 200
    assert r.json()["my_role"] == "editor"


def test_list_trips_includes_crew_trips(client, owned_trip, make_user):
    owner_headers, trip = owned_trip
    viewer_headers, viewer_email = make_user(email="crewlist@example.com")
    _invite(client, owner_headers, trip["id"], viewer_email, "viewer")

    r = client.get("/api/v1/trips", headers=viewer_headers)
    assert r.status_code == 200
    ids = [t["id"] for t in r.json()]
    assert trip["id"] in ids
