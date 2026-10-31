"""Regression tests for the API key / Gemini model resolution fix.

Root cause being locked down:
  * The Gemini 2.5 family is closed to new API keys and was shut down on
    2026-10-20, so every call to `gemini-2.5-flash` fails with HTTP 404.
  * The frontend used to swallow that failure and report "key activated".
  * Gemini 3.x replaced `thinking_budget` with the `thinking_level` enum.
"""

import pytest
from google.genai import errors

from app.services.gemini import (
    GeminiEvaluator,
    _retry_after_seconds,
    build_generation_config,
    build_thinking_config,
    is_auth_failure,
    is_model_unavailable,
    is_usable_api_key,
    model_cooldown_seconds,
    normalize_api_key,
    uses_thinking_level,
)


def _client_error(code: int, status: str, message: str = "") -> errors.ClientError:
    err = errors.ClientError(code, {"status": status, "message": message})
    return err


# --------------------------------------------------------------------- keys


def test_placeholder_keys_are_rejected():
    assert not is_usable_api_key("your_gemini_api_key_here")
    assert not is_usable_api_key("placeholder")
    assert not is_usable_api_key("unset")
    assert not is_usable_api_key("")
    assert not is_usable_api_key("short")


def test_quoted_and_padded_keys_are_normalized():
    assert normalize_api_key('  "AIzaSyABC123"  ') == "AIzaSyABC123"
    assert normalize_api_key("'AIzaSyABC123'") == "AIzaSyABC123"
    assert is_usable_api_key('  "AIzaSyABC123"  ')


# ------------------------------------------------------------------- models


def test_thinking_level_is_used_for_gemini_3_and_4():
    assert uses_thinking_level("gemini-3.8-flash")
    assert uses_thinking_level("gemini-4-argon")
    assert not uses_thinking_level("gemini-2.5-flash")


def test_thinking_config_matches_model_family():
    modern = build_thinking_config("gemini-3.8-flash")
    assert modern.thinking_level is not None
    assert modern.thinking_budget is None

    legacy = build_thinking_config("gemini-2.5-flash")
    assert legacy.thinking_budget == 1024
    assert legacy.thinking_level is None


def test_temperature_is_dropped_for_modern_models():
    """Gemini 3.x ignores temperature and recommends thinking_level instead."""
    modern = build_generation_config("gemini-3.8-flash", temperature=0.4)
    assert modern.temperature is None
    assert modern.thinking_config.thinking_level is not None

    legacy = build_generation_config("gemini-2.5-flash", temperature=0.4)
    assert legacy.temperature == 0.4


# ------------------------------------------------------------ error triage


def test_model_unavailable_is_detected_on_404():
    assert is_model_unavailable(_client_error(404, "NOT_FOUND"))
    assert not is_model_unavailable(_client_error(400, "INVALID_ARGUMENT"))
    assert not is_model_unavailable(_client_error(429, "RESOURCE_EXHAUSTED"))


def test_auth_failure_is_detected_on_invalid_key_payload():
    invalid_key = _client_error(
        400,
        "INVALID_ARGUMENT",
        "API key not valid. Please pass a valid API key.",
    )
    assert is_auth_failure(invalid_key)
    assert not is_model_unavailable(invalid_key)

    assert is_auth_failure(_client_error(403, "PERMISSION_DENIED"))
    assert is_auth_failure(_client_error(401, "UNAUTHENTICATED"))


# ------------------------------------------------------- evaluator fallback


class _FakeResponse:
    def __init__(self, text: str = "PONG") -> None:
        self.text = text


class _FakeModels:
    def __init__(self, failures: dict) -> None:
        self.failures = failures
        self.calls: list[str] = []

    async def generate_content(self, *, model, contents, config=None):
        self.calls.append(model)
        failure = self.failures.get(model)
        if failure is not None:
            raise failure
        return _FakeResponse()


class _FakeAio:
    def __init__(self, failures: dict) -> None:
        self.models = _FakeModels(failures)


class _FakeClient:
    def __init__(self, failures: dict) -> None:
        self.aio = _FakeAio(failures)


@pytest.mark.asyncio
async def test_generate_falls_back_when_the_configured_model_is_retired():
    """A 404 on the primary model must transparently retry on a fallback."""
    evaluator = GeminiEvaluator(api_key="AIzaSyTESTKEY0123456789", model="gemini-2.5-flash")
    evaluator.fallback_models = ["gemini-3.8-flash"]
    evaluator._resolved_model.clear()

    client = _FakeClient({"gemini-2.5-flash": _client_error(404, "NOT_FOUND")})
    response = await evaluator.generate(
        client,
        contents="hi",
        config_factory=lambda model: build_generation_config(model),
        client_key="AIzaSyTESTKEY0123456789",
    )

    assert response.text == "PONG"
    assert client.aio.models.calls == ["gemini-2.5-flash", "gemini-3.8-flash"]
    # The working model is remembered for subsequent calls.
    assert evaluator.active_model("AIzaSyTESTKEY0123456789") == "gemini-3.8-flash"


@pytest.mark.asyncio
async def test_generate_does_not_swallow_non_model_errors():
    """An auth failure must surface, not be mistaken for a retired model."""
    evaluator = GeminiEvaluator(api_key="AIzaSyTESTKEY0123456789", model="gemini-2.5-flash")
    evaluator.fallback_models = ["gemini-3.8-flash"]

    client = _FakeClient(
        {"gemini-2.5-flash": _client_error(400, "INVALID_ARGUMENT", "API key not valid.")}
    )

    with pytest.raises(errors.ClientError):
        await evaluator.generate(
            client,
            contents="hi",
            config_factory=lambda model: build_generation_config(model),
            client_key="AIzaSyTESTKEY0123456789",
        )

    assert client.aio.models.calls == ["gemini-2.5-flash"]


@pytest.mark.asyncio
async def test_validate_key_reports_auth_failure_separately_from_model_failure():
    evaluator = GeminiEvaluator(api_key="", model="gemini-2.5-flash")
    evaluator.fallback_models = []

    invalid = _client_error(400, "INVALID_ARGUMENT", "API key not valid. Please pass a valid API key.")

    # Patch the genai client factory so no network call is made.
    import app.services.gemini as gemini_module

    class _StubClient:
        def __init__(self, *args, **kwargs) -> None:
            self.aio = _FakeAio({"gemini-2.5-flash": invalid})

    original_client = gemini_module.genai.Client
    gemini_module.genai.Client = _StubClient
    try:
        result = await evaluator.validate_key("AIzaSyTESTKEY0123456789")
    finally:
        gemini_module.genai.Client = original_client

    assert result["valid"] is False
    assert result["auth_error"] is True
    assert result["model_error"] is False
    assert "not valid" in result["error"]


# ------------------------------------------------------- quota-aware cooling


def test_retry_hint_is_parsed_from_the_quota_error_body():
    """Gemini reports exactly how long until the quota window resets."""
    exc = _client_error(
        429,
        "RESOURCE_EXHAUSTED",
        "Quota exceeded for metric: generate_content_free_tier_requests, limit: 20, "
        "model: gemini-3.6-flash\nPlease retry in 17h2m56.785936604s.",
    )
    assert _retry_after_seconds(exc) == pytest.approx(17 * 3600 + 2 * 60 + 56.785936604)


def test_cooldown_for_a_retired_model_is_long():
    """A 404 model id never comes back, so do not keep asking for it."""
    assert model_cooldown_seconds(_client_error(404, "NOT_FOUND")) == 24 * 60 * 60


def test_cooldown_for_a_quota_error_uses_the_server_retry_hint():
    """A free-tier key is capped per model per day; honour the reset window."""
    exc = _client_error(
        429,
        "RESOURCE_EXHAUSTED",
        "Please retry in 17h2m56.785936604s.",
    )
    assert model_cooldown_seconds(exc) == pytest.approx(17 * 3600 + 2 * 60 + 56.785936604)


def test_cooldown_for_an_overloaded_model_is_short():
    """HTTP 503 is transient - usually clear again within seconds."""
    overloaded = errors.ServerError(
        503, {"status": "UNAVAILABLE", "message": "high demand"}
    )
    assert model_cooldown_seconds(overloaded) == 30.0


# ------------------------------------------------- server key is tracked too


def test_effective_key_prefers_the_browser_override():
    evaluator = GeminiEvaluator(api_key="AIzaSySERVERKEY0123456789", model="gemini-3.6-flash")
    assert evaluator.effective_key() == "AIzaSySERVERKEY0123456789"
    assert evaluator.effective_key("  AIzaSyBROWSERKEY1234567890 ") == "AIzaSyBROWSERKEY1234567890"


@pytest.mark.asyncio
async def test_quota_exhausted_primary_is_skipped_on_the_next_call():
    """Regression: the server's own key must be tracked, not just browser keys.

    Per-model state (which model worked, which are blocked) used to be keyed
    only on the browser override. With the key from .env every turn retried a
    model that was already known to be out of quota.
    """
    evaluator = GeminiEvaluator(api_key="AIzaSySERVERKEY0123456789", model="gemini-3.6-flash")
    evaluator.fallback_models = ["gemini-3-flash-preview"]

    quota_error = _client_error(
        429,
        "RESOURCE_EXHAUSTED",
        "Quota exceeded for metric: generate_content_free_tier_requests, limit: 20, "
        "model: gemini-3.6-flash\nPlease retry in 17h2m56.785936604s.",
    )
    client = _FakeClient({"gemini-3.6-flash": quota_error})

    response = await evaluator.generate(
        client,
        contents="hi",
        config_factory=lambda model: build_generation_config(model),
        client_key=evaluator.effective_key(),
    )
    assert response.text == "PONG"
    assert client.aio.models.calls == ["gemini-3.6-flash", "gemini-3-flash-preview"]

    # Second call: the exhausted model is not asked again.
    client.aio.models.calls.clear()
    await evaluator.generate(
        client,
        contents="hi again",
        config_factory=lambda model: build_generation_config(model),
        client_key=evaluator.effective_key(),
    )
    assert client.aio.models.calls == ["gemini-3-flash-preview"]
