"""Regression tests for chat prompt structure and quality settings.

The chatbot used to flatten the whole conversation into a single user-role
string, ran the model at LOW thinking level, and capped output at 600 tokens
(so thinking tokens truncated the visible answer). Those three things are what
made replies read as illogical and off-topic.
"""

import pytest
from google.genai import types

from app.services.gemini import GeminiEvaluator, build_generation_config


class _RecordingModels:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    async def generate_content(self, *, model, contents, config=None):
        self.calls.append({"model": model, "contents": contents, "config": config})
        response = types.GenerateContentResponse(
            candidates=[
                types.Candidate(
                    content=types.Content(role="model", parts=[types.Part.from_text(text="ok")]),
                    finish_reason="STOP",
                )
            ]
        )
        return response


class _RecordingAio:
    def __init__(self) -> None:
        self.models = _RecordingModels()


class _RecordingClient:
    def __init__(self) -> None:
        self.aio = _RecordingAio()


def _texts(contents):
    """Flattens a Content list into [(role, text), ...]."""
    out = []
    for c in contents:
        for part in (c.parts or []):
            out.append((c.role, getattr(part, "text", "")))
    return out


@pytest.mark.asyncio
async def test_chat_builds_a_real_multi_turn_conversation(monkeypatch):
    evaluator = GeminiEvaluator(api_key="AIzaSyTESTKEY0123456789", model="gemini-3.8-flash")
    client = _RecordingClient()
    monkeypatch.setattr(evaluator, "get_client", lambda override_key=None: client)

    await evaluator.chat_sparring(
        messages=[
            {"role": "user", "content": "How do I rebut their fiscal point?"},
            {"role": "assistant", "content": "Demand the counterfactual."},
            {"role": "user", "content": "And if they say there is no budget?"},
        ],
        topic="This House would raise the inheritance tax",
        thesis="We need progressive taxation",
        override_key="AIzaSyTESTKEY0123456789",
    )

    call = client.aio.models.calls[0]
    turns = _texts(call["contents"])

    roles = [role for role, _ in turns]
    assert roles[0] == "user", "context must open the conversation"
    assert "user" in roles and "model" in roles, "turns must use real roles"
    # The previous bug: every turn collapsed into one user string.
    assert roles.count("model") == 1
    assert "DEBATER:" not in turns[1][1], "no more fake role prefixes"

    # The last turn must be the user's, so the model answers the right thing.
    assert roles[-1] == "user"
    assert turns[-1][1] == "And if they say there is no budget?"

    # The adjudicator's own prior reply is preserved as a model turn.
    model_texts = [t for role, t in turns if role == "model"]
    assert "Demand the counterfactual." in model_texts[0]

    # The debate context is present.
    assert "This House would raise the inheritance tax" in turns[0][1]


@pytest.mark.asyncio
async def test_chat_uses_system_instruction_and_a_real_token_budget(monkeypatch):
    evaluator = GeminiEvaluator(api_key="AIzaSyTESTKEY0123456789", model="gemini-3.8-flash")
    client = _RecordingClient()
    monkeypatch.setattr(evaluator, "get_client", lambda override_key=None: client)

    await evaluator.chat_sparring(
        messages=[{"role": "user", "content": "hello"}],
        override_key="AIzaSyTESTKEY0123456789",
    )

    config = client.aio.models.calls[0]["config"]
    assert config.system_instruction, "persona belongs in system_instruction"
    assert "Chief Parliamentary Adjudicator" in config.system_instruction

    # 600 was too small once thinking tokens counted against the budget.
    assert config.max_output_tokens == 2048

    # MEDIUM is the minimum that gives the adjudicator real reasoning budget.
    assert config.thinking_config.thinking_level == types.ThinkingLevel.MEDIUM


@pytest.mark.asyncio
async def test_chat_appends_a_prompt_when_the_last_turn_is_the_models(monkeypatch):
    evaluator = GeminiEvaluator(api_key="AIzaSyTESTKEY0123456789", model="gemini-3.8-flash")
    client = _RecordingClient()
    monkeypatch.setattr(evaluator, "get_client", lambda override_key=None: client)

    await evaluator.chat_sparring(
        messages=[{"role": "assistant", "content": "Something I said earlier."}],
        override_key="AIzaSyTESTKEY0123456789",
    )

    turns = _texts(client.aio.models.calls[0]["contents"])
    assert turns[-1][0] == "user"
    assert turns[-1][1] == "Please continue."


def test_thinking_level_is_configurable_and_defaults_to_medium(monkeypatch):
    from app.config import settings

    original = settings.gemini_thinking_level
    try:
        settings.gemini_thinking_level = "HIGH"
        cfg = build_generation_config("gemini-3.8-flash")
        assert cfg.thinking_config.thinking_level == types.ThinkingLevel.HIGH

        settings.gemini_thinking_level = "NOT_A_LEVEL"
        cfg = build_generation_config("gemini-3.8-flash")
        assert cfg.thinking_config.thinking_level == types.ThinkingLevel.MEDIUM
    finally:
        settings.gemini_thinking_level = original
