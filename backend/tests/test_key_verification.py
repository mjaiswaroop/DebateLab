"""Regression tests for key verification tracking.

The UI used to show "Active" next to a key that had just failed validation,
because the status endpoint only checked the *format* of a key and the
frontend additionally OR-ed in "a key exists in localStorage".
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.services.gemini import GeminiEvaluator, get_evaluator


@pytest.mark.asyncio
async def test_rejected_key_is_not_reported_as_configured():
    """A key Gemini refused must never come back as 'configured'."""
    evaluator = GeminiEvaluator(api_key="")
    bad_key = "AIzaSyDEFINITELY_NOT_A_VALID_KEY_9999"

    evaluator.mark_rejected(bad_key)

    assert not evaluator.is_key_usable(bad_key)
    assert not evaluator.is_key_verified(bad_key)

    app.dependency_overrides[get_evaluator] = lambda: evaluator
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get(
                "/api/config/status", headers={"X-Gemini-Api-Key": bad_key}
            )
        body = res.json()
        assert body["gemini_configured"] is False
        assert body["gemini_verified"] is False
    finally:
        app.dependency_overrides.pop(get_evaluator, None)


@pytest.mark.asyncio
async def test_verified_key_is_reported_as_configured_and_verified():
    evaluator = GeminiEvaluator(api_key="")
    good_key = "AIzaSyARealLookingKeyForTests1234567890"

    evaluator.mark_verified(good_key, "gemini-3.8-flash")

    assert evaluator.is_key_usable(good_key)
    assert evaluator.is_key_verified(good_key)

    app.dependency_overrides[get_evaluator] = lambda: evaluator
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get(
                "/api/config/status", headers={"X-Gemini-Api-Key": good_key}
            )
        body = res.json()
        assert body["gemini_configured"] is True
        assert body["gemini_verified"] is True
        assert body["source"] == "client"
    finally:
        app.dependency_overrides.pop(get_evaluator, None)


def test_explicit_empty_key_does_not_fall_back_to_the_server_key():
    """api_key='' must mean 'no key', not 'use whatever is in .env'."""
    evaluator = GeminiEvaluator(api_key="")
    assert evaluator.api_key == ""
    assert evaluator.client is None
    assert not evaluator.is_key_usable("")


def test_quota_and_overload_errors_count_as_unusable_models():
    from google.genai import errors

    from app.services.gemini import is_model_unusable_now

    assert is_model_unusable_now(errors.ClientError(404, {"status": "NOT_FOUND"}))
    assert is_model_unusable_now(errors.ClientError(429, {"status": "RESOURCE_EXHAUSTED"}))
    assert is_model_unusable_now(errors.ServerError(503, {"status": "UNAVAILABLE"}))
    # A bad key is NOT a model problem.
    assert not is_model_unusable_now(
        errors.ClientError(400, {"status": "INVALID_ARGUMENT", "message": "API key not valid."})
    )


def test_evaluation_schema_has_no_nullable_unions():
    """Gemini 3.8 rejects `anyOf: [T, null]` in a response schema."""
    from app.schemas.evaluation import GeminiEvaluationResponse

    blob = str(GeminiEvaluationResponse.model_json_schema())
    assert "anyOf" not in blob
