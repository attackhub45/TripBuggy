def test_signup_creates_user_and_returns_token(client):
    r = client.post("/api/v1/auth/signup", json={"email": "new@example.com", "password": "hunter2-hunter2"})
    assert r.status_code == 201
    assert r.json()["access_token"]


def test_signup_rejects_duplicate_email(client, make_user):
    _, email = make_user(email="dupe@example.com")
    r = client.post("/api/v1/auth/signup", json={"email": email, "password": "another-password"})
    assert r.status_code == 400


def test_login_succeeds_with_correct_password(client, make_user):
    _, email = make_user(email="login@example.com", password="correct-horse-battery")
    r = client.post("/api/v1/auth/login", json={"email": email, "password": "correct-horse-battery"})
    assert r.status_code == 200
    assert r.json()["access_token"]


def test_login_rejects_wrong_password(client, make_user):
    _, email = make_user(email="wrongpw@example.com", password="correct-horse-battery")
    r = client.post("/api/v1/auth/login", json={"email": email, "password": "not-the-password"})
    assert r.status_code == 401


def test_login_rejects_unknown_email(client):
    r = client.post("/api/v1/auth/login", json={"email": "nobody@example.com", "password": "whatever"})
    assert r.status_code == 401


def test_me_requires_a_token(client):
    r = client.get("/api/v1/auth/me")
    assert r.status_code in (401, 403)  # HTTPBearer returns 403 when the header is missing entirely


def test_me_returns_the_authenticated_user(client, make_user):
    headers, email = make_user(email="me@example.com")
    r = client.get("/api/v1/auth/me", headers=headers)
    assert r.status_code == 200
    assert r.json()["email"] == email


def test_me_rejects_a_garbage_token(client):
    r = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert r.status_code == 401
