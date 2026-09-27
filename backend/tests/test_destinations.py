def test_verify_requires_auth(client):
    r = client.post("/api/v1/destinations/verify", json={"raw": "pariss"})
    assert r.status_code in (401, 403)


def test_verify_returns_the_corrected_name(client, make_user, monkeypatch):
    headers, _ = make_user()
    monkeypatch.setattr(
        "app.routers.destinations.agent_service.verify_destination",
        lambda raw: {"is_real_place": True, "corrected_name": "Paris", "suggestions": []},
    )
    r = client.post("/api/v1/destinations/verify", json={"raw": "pariss"}, headers=headers)
    assert r.status_code == 200
    assert r.json() == {"is_real_place": True, "corrected_name": "Paris", "suggestions": []}


def test_verify_surfaces_suggestions_for_an_unreal_place(client, make_user, monkeypatch):
    headers, _ = make_user()
    monkeypatch.setattr(
        "app.routers.destinations.agent_service.verify_destination",
        lambda raw: {"is_real_place": False, "corrected_name": raw, "suggestions": ["Paris", "Praze"]},
    )
    r = client.post("/api/v1/destinations/verify", json={"raw": "Xyzzyplace"}, headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["is_real_place"] is False
    assert body["suggestions"] == ["Paris", "Praze"]
