"""conftest forces ANTHROPIC_API_KEY empty, so /assistant/ask always exercises the
canned SCREEN_HELP fallback here — the real-agent text path is covered directly
against a fake Anthropic client, same pattern as test_agent_service.py."""

from app import agent_service as svc


def test_ask_requires_auth(client):
    r = client.post("/api/v1/assistant/ask", json={"question": "what do I do here?", "screen": "home"})
    assert r.status_code in (401, 403)


def test_ask_falls_back_to_screen_help(client, make_user):
    headers, _ = make_user()
    r = client.post(
        "/api/v1/assistant/ask",
        json={"question": "what do I do here?", "screen": "route"},
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["answer"] == svc.SCREEN_HELP["route"]


def test_ask_with_unknown_screen_gets_a_generic_fallback(client, make_user):
    headers, _ = make_user()
    r = client.post(
        "/api/v1/assistant/ask",
        json={"question": "hello?", "screen": "not-a-real-screen"},
        headers=headers,
    )
    assert r.status_code == 200
    assert "assistant" in r.json()["answer"].lower()


def test_ask_with_a_trip_id_for_a_trip_you_can_t_see_still_answers(client, make_user):
    """Trip context is best-effort — a bad/inaccessible trip_id shouldn't break the ask."""
    headers, _ = make_user()
    r = client.post(
        "/api/v1/assistant/ask",
        json={"question": "what's my budget?", "screen": "itinerary", "trip_id": "00000000-0000-0000-0000-000000000000"},
        headers=headers,
    )
    assert r.status_code == 200


def test_ask_with_a_trip_you_own_includes_context(client, make_user, monkeypatch):
    """Verifies summarize_trip_for_assistant actually gets built and passed through,
    by capturing what answer_assistant_question receives."""
    headers, _ = make_user()
    r = client.post("/api/v1/trips", json={"destination": "Paris"}, headers=headers)
    trip_id = r.json()["id"]

    captured = {}

    def fake_answer(question, screen, trip_context):
        captured["question"] = question
        captured["screen"] = screen
        captured["trip_context"] = trip_context
        return "fake answer"

    monkeypatch.setattr("app.routers.assistant.agent_service.answer_assistant_question", fake_answer)

    r = client.post(
        "/api/v1/assistant/ask",
        json={"question": "what's my budget?", "screen": "itinerary", "trip_id": trip_id},
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["answer"] == "fake answer"
    assert captured["trip_context"]["destination"] == "Paris"


class _FakeTextBlock:
    type = "text"

    def __init__(self, text):
        self.text = text


class _FakeResponse:
    def __init__(self, content):
        self.content = content


class _FakeMessages:
    def __init__(self, response):
        self._response = response

    def create(self, **kwargs):
        return self._response


class _FakeAnthropicClient:
    def __init__(self, response):
        self.messages = _FakeMessages(response)


def test_agent_answer_assistant_question_uses_the_real_client(monkeypatch):
    fake_client = _FakeAnthropicClient(_FakeResponse([_FakeTextBlock("The autonomy dial controls booking.")]))
    monkeypatch.setattr(svc, "_get_client", lambda: fake_client)

    answer = svc.answer_assistant_question("what does the dial do?", "booking", {"destination": "Rome"})
    assert answer == "The autonomy dial controls booking."


def test_agent_answer_assistant_question_falls_back_on_empty_response(monkeypatch):
    fake_client = _FakeAnthropicClient(_FakeResponse([]))
    monkeypatch.setattr(svc, "_get_client", lambda: fake_client)

    answer = svc.answer_assistant_question("hello?", "booking", None)
    assert answer == svc.SCREEN_HELP["booking"]
