"""Rate limiting is disabled everywhere else in the suite (see conftest.py's
DISABLE_RATE_LIMIT) since the 79 other tests reuse one process/IP across many calls to
the same endpoints. This is the one place it's turned on, to verify the limit itself
actually fires — then turned back off so it doesn't affect any other test."""

import pytest

from app.rate_limit import limiter


@pytest.fixture()
def rate_limiting_enabled():
    limiter.enabled = True
    yield
    limiter.enabled = False
    limiter.reset()


def test_signup_is_rate_limited_after_five_per_hour(client, rate_limiting_enabled):
    statuses = [
        client.post("/api/v1/auth/signup", json={"email": f"ratelimit-{i}@test.com", "password": "hunter2-hunter2"}).status_code
        for i in range(6)
    ]
    assert statuses[:5] == [201] * 5
    assert statuses[5] == 429
