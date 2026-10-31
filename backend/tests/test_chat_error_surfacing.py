"""Regression tests for the chat endpoint.

Root cause being locked down: a failing live Gemini call was silently replaced
by the local heuristic coach, so the chatbot appeared to "repeat itself" and
the user could not tell that their API key was never reaching Gemini.
"""

import pytest
from httpx import AsyncClient

from app.main import app
from app.services.gemini import GeminiEvaluator, GeminiLiveError, get_evaluator


@pytest.mark.asyncio
async def test_chat_without_a_key_uses_the_heuristic_coach(async_client: AsyncClient):
    """No key at all is the documented offline mode - a heuristic reply is correct."""
    evaluator = MagicEvaluator()
    evaluator.client = None
    evaluator.live_failure = None
    app.dependency_overrides[get_evaluator] = lambda: evaluator
    try:
        res = await async_client.post(
            "/api/chat", json={"messages": [{"role": "user", "content": "hello"}]}
        )
        assert res.status_code == 200
        body = res.json()
        assert body["heuristic"] is True
        assert body["model"] == "adjudicator-heuristic"
        assert body["reply"]
    finally:
        app.dependency_overrides.pop(get_evaluator, None)


@pytest.mark.asyncio
async def test_chat_surfaces_live_failures_instead_of_repeating_a_canned_reply(
    async_client: AsyncClient,
):
    """With a key configured but Gemini failing, the error must reach the user."""
    evaluator = MagicEvaluator()
    evaluator.client = object()
    evaluator.live_failure = GeminiLiveError(
        "Gemini rejected your API key. Check that you copied the full key "
        "from Google AI Studio (it starts with 'AIza')."
    )
    app.dependency_overrides[get_evaluator] = lambda: evaluator
    try:
        res = await async_client.post(
            "/api/chat", json={"messages": [{"role": "user", "content": "hello"}]}
        )
        assert res.status_code == 502
        detail = res.json()["detail"]
        assert "API key" in detail
        # Critically: it must NOT be a generic heuristic reply.
        assert "Point of Information" not in detail
    finally:
        app.dependency_overrides.pop(get_evaluator, None)


class MagicEvaluator(GeminiEvaluator):
    """Minimal evaluator stub - no network, no real key."""

    def __init__(self) -> None:
        self.client = None
        self.model = "gemini-3.8-flash"
        self.live_failure = None

    def get_client(self, override_key=None):
        return self.client

    def active_model(self, client_key=None):
        return self.model

    async def chat_sparring(self, **kwargs):
        if self.live_failure is not None:
            raise self.live_failure
        return "heuristic reply"
