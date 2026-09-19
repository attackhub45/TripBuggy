"""
Shared test fixtures. Every test gets its own DB transaction that's rolled back at
teardown (a SAVEPOINT nested inside it survives app-level commit() calls) — so tests
can run against a real Postgres database (the same one you use for local dev, by
default) without leaving any data behind. CI points TEST_DATABASE_URL at a disposable
Postgres service container instead. ANTHROPIC_API_KEY is forced empty so the agent
layer always takes its simulated fallback path — no live LLM calls in tests, matching
docs/TRD.md's "mock the Anthropic client" testing strategy.
"""

import os
from typing import Optional

os.environ["ANTHROPIC_API_KEY"] = ""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session

from app.config import settings
from app.db import Base
from app.deps import get_db
from app.main import app

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", settings.database_url)
engine = create_engine(TEST_DATABASE_URL)


@pytest.fixture(scope="session", autouse=True)
def _schema():
    Base.metadata.create_all(engine)
    yield


@pytest.fixture()
def db_session():
    connection = engine.connect()
    outer = connection.begin()
    session = Session(bind=connection)
    session.begin_nested()

    @event.listens_for(session, "after_transaction_end")
    def _restart_savepoint(sess, transaction):
        if transaction.nested and not transaction._parent.nested:
            sess.begin_nested()

    yield session

    session.close()
    outer.rollback()
    connection.close()


@pytest.fixture()
def client(db_session):
    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def make_user(client):
    """Signs up a user and returns (auth headers, email)."""
    counter = {"n": 0}

    def _make(email: Optional[str] = None, password: str = "hunter2-hunter2"):
        counter["n"] += 1
        email = email or f"user{counter['n']}@example.com"
        r = client.post("/api/v1/auth/signup", json={"email": email, "password": password, "display_name": None})
        assert r.status_code == 201, r.text
        token = r.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}, email

    return _make
