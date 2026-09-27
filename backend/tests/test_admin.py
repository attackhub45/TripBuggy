"""Admin routes are an operator-only back door (see app/deps.py's require_admin), guarded
by a shared secret (ADMIN_TOKEN) rather than a user account — conftest.py sets a fixed
test value so these can exercise the real auth path instead of mocking it."""

ADMIN_HEADERS = {"X-Admin-Token": "test-admin-token"}


def _user_id(client, email):
    r = client.get("/api/v1/admin/users", headers=ADMIN_HEADERS)
    return next(u["id"] for u in r.json() if u["email"] == email)


def test_admin_routes_reject_a_missing_token(client, make_user):
    make_user()
    r = client.get("/api/v1/admin/users")
    assert r.status_code == 403


def test_admin_routes_reject_a_wrong_token(client, make_user):
    make_user()
    r = client.get("/api/v1/admin/users", headers={"X-Admin-Token": "not-the-right-token"})
    assert r.status_code == 403


def test_list_users_includes_trip_counts(client, make_user):
    _, email = make_user()
    headers, _ = make_user()
    r = client.post("/api/v1/trips", json={"destination": "Paris"}, headers=headers)
    assert r.status_code == 201, r.text

    r = client.get("/api/v1/admin/users", headers=ADMIN_HEADERS)
    assert r.status_code == 200
    by_email = {u["email"]: u for u in r.json()}
    assert by_email[email]["trip_count"] == 0


def test_reset_password_lets_the_user_log_in_with_the_new_password(client, make_user):
    _, email = make_user(password="old-password-123")
    user_id = _user_id(client, email)

    r = client.post(f"/api/v1/admin/users/{user_id}/reset-password", json={"new_password": "new-password-456"}, headers=ADMIN_HEADERS)
    assert r.status_code == 200, r.text

    assert client.post("/api/v1/auth/login", json={"email": email, "password": "old-password-123"}).status_code == 401
    assert client.post("/api/v1/auth/login", json={"email": email, "password": "new-password-456"}).status_code == 200


def test_delete_user_removes_their_trips_too(client, make_user):
    headers, email = make_user()
    r = client.post("/api/v1/trips", json={"destination": "Tokyo"}, headers=headers)
    trip_id = r.json()["id"]
    user_id = _user_id(client, email)

    r = client.delete(f"/api/v1/admin/users/{user_id}", headers=ADMIN_HEADERS)
    assert r.status_code == 204

    # The user's token is now orphaned — any authenticated call with it should 401.
    assert client.get(f"/api/v1/trips/{trip_id}", headers=headers).status_code == 401

    r = client.get("/api/v1/admin/users", headers=ADMIN_HEADERS)
    assert email not in {u["email"] for u in r.json()}


def test_update_user_changes_email_and_display_name(client, make_user):
    _, email = make_user()
    user_id = _user_id(client, email)

    r = client.patch(f"/api/v1/admin/users/{user_id}", json={"email": "renamed@example.com", "display_name": "New Name"}, headers=ADMIN_HEADERS)
    assert r.status_code == 200, r.text
    assert r.json()["email"] == "renamed@example.com"
    assert r.json()["display_name"] == "New Name"


def test_update_user_rejects_an_email_already_in_use(client, make_user):
    _, email_a = make_user()
    _, email_b = make_user()
    user_id = _user_id(client, email_a)

    r = client.patch(f"/api/v1/admin/users/{user_id}", json={"email": email_b}, headers=ADMIN_HEADERS)
    assert r.status_code == 400


def test_deactivate_blocks_login_and_invalidates_the_existing_token(client, make_user):
    headers, email = make_user(password="hunter2-hunter2")
    user_id = _user_id(client, email)

    r = client.post(f"/api/v1/admin/users/{user_id}/deactivate", headers=ADMIN_HEADERS)
    assert r.status_code == 200
    assert r.json()["is_active"] is False

    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401
    r = client.post("/api/v1/auth/login", json={"email": email, "password": "hunter2-hunter2"})
    assert r.status_code == 403


def test_activate_restores_access(client, make_user):
    headers, email = make_user(password="hunter2-hunter2")
    user_id = _user_id(client, email)
    client.post(f"/api/v1/admin/users/{user_id}/deactivate", headers=ADMIN_HEADERS)

    r = client.post(f"/api/v1/admin/users/{user_id}/activate", headers=ADMIN_HEADERS)
    assert r.status_code == 200
    assert r.json()["is_active"] is True

    r = client.post("/api/v1/auth/login", json={"email": email, "password": "hunter2-hunter2"})
    assert r.status_code == 200


def test_list_user_trips_and_admin_delete_trip(client, make_user):
    headers, email = make_user()
    r = client.post("/api/v1/trips", json={"destination": "Iceland"}, headers=headers)
    trip_id = r.json()["id"]
    user_id = _user_id(client, email)

    r = client.get(f"/api/v1/admin/users/{user_id}/trips", headers=ADMIN_HEADERS)
    assert r.status_code == 200
    assert [t["id"] for t in r.json()] == [trip_id]

    r = client.delete(f"/api/v1/admin/trips/{trip_id}", headers=ADMIN_HEADERS)
    assert r.status_code == 204
    # The account itself is untouched — just that one trip is gone.
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200
    assert client.get(f"/api/v1/admin/users/{user_id}/trips", headers=ADMIN_HEADERS).json() == []


def test_settings_round_trip(client):
    r = client.get("/api/v1/admin/settings", headers=ADMIN_HEADERS)
    assert r.status_code == 200
    assert r.json() == {"force_simulated_agent": False}

    r = client.patch("/api/v1/admin/settings", json={"force_simulated_agent": True}, headers=ADMIN_HEADERS)
    assert r.status_code == 200
    assert r.json() == {"force_simulated_agent": True}

    r = client.get("/api/v1/admin/settings", headers=ADMIN_HEADERS)
    assert r.json() == {"force_simulated_agent": True}

    # Flipping it back exercises the update path, not just the insert path.
    r = client.patch("/api/v1/admin/settings", json={"force_simulated_agent": False}, headers=ADMIN_HEADERS)
    assert r.json() == {"force_simulated_agent": False}
