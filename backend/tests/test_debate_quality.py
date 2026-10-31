"""Regression tests for text-debate answer quality.

Covers the problems that made the arena chatbot read as illogical / inaccurate:
  * no structured output (the model hand-rolled JSON inside prose)
  * no grounding rule (it invented statistics and institutions)
  * live Gemini failures silently served the generic heuristic template, so a
    broken connection looked like a (nonsensical) answer.
"""

import pytest
from fastapi import HTTPException

from app.prompts import MANDATORY_REBUTTAL_RULES, build_text_debate_prompt
from app.routers.debate_game import (
    TEXT_TURN_SYSTEM_INSTRUCTION,
    TextTurnModelOutput,
    router as debate_router,
)


def test_prompt_contains_the_grounding_rule():
    prompt = build_text_debate_prompt(
        topic="This House would raise the inheritance tax",
        difficulty="intermediate",
        user_side="government",
        round_number=1,
        user_text="We need progressive taxation to fund public services.",
    )
    rules = MANDATORY_REBUTTAL_RULES.format(topic="This House would raise the inheritance tax")

    # No invented facts, for any motion type.
    assert "NEVER invent facts" in rules
    assert "APPLIES TO EVERY MOTION TYPE" in rules
    assert "EVIDENCE GAP" in rules.upper()

    # The rebuttal must actually advance the debate.
    assert "ADVANCE the debate" in rules
    assert "strawman" in rules

    assert "This House would raise the inheritance tax" in prompt


def test_turn_output_schema_requires_every_field():
    required = set(TextTurnModelOutput.model_json_schema()["required"])
    assert required == {
        "opponent_speech",
        "opponent_poi",
        "user_argument_score",
        "user_premises",
        "fallacies_flagged",
        "coaching_tip",
    }


def test_system_instruction_forbids_inventing_evidence():
    assert "never invent facts" in TEXT_TURN_SYSTEM_INSTRUCTION.lower()
    assert "statistics" in TEXT_TURN_SYSTEM_INSTRUCTION.lower()


@pytest.mark.asyncio
async def test_live_failure_raises_instead_of_serving_the_generic_template():
    """A broken Gemini call must not masquerade as a debate reply."""
    from app.services.gemini import GeminiEvaluator, GeminiLiveError

    class FailingEvaluator(GeminiEvaluator):
        def __init__(self) -> None:
            self.client = object()
            self.model = "gemini-3.8-flash"

        def get_client(self, override_key=None):
            return self.client

        async def generate(self, *args, **kwargs):
            raise GeminiLiveError(
                "Gemini rejected your API key. Check that you copied the full key."
            )

    from app.main import app
    from app.services.gemini import get_evaluator

    app.dependency_overrides[get_evaluator] = lambda: FailingEvaluator()
    try:
        from httpx import AsyncClient
        from httpx import ASGITransport

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.post(
                "/api/debate/text-turn",
                json={
                    "topic": "This House would raise the inheritance tax",
                    "difficulty": "intermediate",
                    "user_side": "government",
                    "round_number": 1,
                    "user_text": "We need progressive taxation.",
                },
            )
        assert res.status_code == 502
        detail = res.json()["detail"]
        assert "API key" in detail
        # The generic template must not be served as if it were an answer.
        assert "comparative benchmark validates this position" not in detail
    finally:
        app.dependency_overrides.pop(get_evaluator, None)
