import pytest
from httpx import AsyncClient

# Valid mock WebM header (EBML \x1a\x45\xdf\xa3 + padding)
MOCK_WEBM_BYTES = b"\x1a\x45\xdf\xa3" + b"\x00" * 64


@pytest.mark.asyncio
async def test_health_check(async_client: AsyncClient):
    response = await async_client.get("/healthz")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "gemini_model" in data


@pytest.mark.asyncio
async def test_stateless_evaluate_success(async_client: AsyncClient):
    files = {"audio": ("speech.webm", MOCK_WEBM_BYTES, "audio/webm")}
    data = {
        "duration_ms": 15000,
        "topic": "Social Media Regulation",
        "difficulty": "intermediate",
    }
    response = await async_client.post("/api/evaluate", files=files, data=data)
    assert response.status_code == 200
    res = response.json()
    assert res["turn_number"] == 1
    assert res["speech_detected"] is True
    assert "social media" in res["transcript"].lower()
    assert res["delivery"]["confidence_score"] == 78
    assert res["delivery"]["filler_total"] == 3  # 2 + 1
    assert res["delivery"]["words_per_minute"] > 0
    assert len(res["logic"]["fallacies"]) == 1
    assert len(res["coaching_tips"]) == 3
    assert len(res["rebuttal_text"]) > 20


@pytest.mark.asyncio
async def test_unsupported_audio_type(async_client: AsyncClient):
    files = {"audio": ("test.txt", b"plain text", "text/plain")}
    data = {"duration_ms": 15000}
    response = await async_client.post("/api/evaluate", files=files, data=data)
    assert response.status_code == 415
    assert "Unsupported audio type" in response.json()["detail"]


@pytest.mark.asyncio
async def test_invalid_duration(async_client: AsyncClient):
    files = {"audio": ("test.webm", MOCK_WEBM_BYTES, "audio/webm")}
    data = {"duration_ms": 1500}  # < 3 seconds
    response = await async_client.post("/api/evaluate", files=files, data=data)
    assert response.status_code == 400
    assert "between 3s and 125s" in response.json()["detail"]


@pytest.mark.asyncio
async def test_corrupt_audio_magic_bytes(async_client: AsyncClient):
    files = {"audio": ("test.webm", b"garbage_not_webm_data", "audio/webm")}
    data = {"duration_ms": 10000}
    response = await async_client.post("/api/evaluate", files=files, data=data)
    assert response.status_code == 400
    assert "empty or corrupted" in response.json()["detail"]


@pytest.mark.asyncio
async def test_mocked_audio_turn_cricket_motion_prompt_contains_motion_type_instructions():
    """
    Requirement 2: Mocked audio turn on the cricket motion contains motion-type
    classification (policy / value-comparative / factual), domain-generic counter-example rule,
    confident statistics rule, ban on policy models, and self-check instruction.
    """
    from unittest.mock import AsyncMock, MagicMock
    from app.services.gemini import GeminiEvaluator
    from app.schemas.evaluation import (
        DebateEvaluationResponse,
        DeliveryAnalysis,
        LogicAnalysis,
    )

    evaluator = GeminiEvaluator(api_key="mock_test_key_long_enough")
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_eval = DebateEvaluationResponse(
        speech_detected=True,
        transcript="Virat Kohli has dominated across cricket formats and broke Sachin's records.",
        delivery=DeliveryAnalysis(
            confidence_score=75,
            hesitation_index=20,
            filler_words=[],
            pacing="good",
            vocal_observations=[],
        ),
        logic=LogicAnalysis(
            argument_score=70,
            claim_summary="Kohli is the greatest cricket player.",
            premises=["Format dominance"],
            fallacies=[],
            strongest_point="Dominance",
            weakest_point="Era comparison",
            unaddressed_counterarguments=[],
        ),
        rebuttal_text="While Virat Kohli has dominated contemporary cricket, Don Bradman achieved an unmatched batting average of 99.94.",
        socratic_question="Does era dominance outweigh multi-format longevity?",
        coaching_tips=["Compare across eras"],
    )
    mock_response.parsed = mock_eval
    mock_client.aio.models.generate_content = AsyncMock(return_value=mock_response)
    evaluator.client = mock_client

    topic = "virat kholi is the goat in cricket"
    res = await evaluator.evaluate(
        audio=MOCK_WEBM_BYTES,
        mime_type="audio/webm",
        topic=topic,
        difficulty="intermediate",
        user_side="government",
        round_number=1,
    )

    assert res.speech_detected is True
    assert mock_client.aio.models.generate_content.called

    call_kwargs = mock_client.aio.models.generate_content.call_args.kwargs
    system_instruction = call_kwargs["config"].system_instruction
    context_content = call_kwargs["contents"][1]

    # Verification of all required prompt items
    assert "MOTION TYPE ADAPTATION:" in system_instruction
    assert "POLICY" in system_instruction
    assert "VALUE / COMPARATIVE" in system_instruction
    assert "FACTUAL / EMPIRICAL" in system_instruction
    assert "name relevant counter-examples from the motion's own domain" in system_instruction
    assert "Do not state specific statistics or records unless you are highly confident; otherwise speak qualitatively." in system_instruction
    assert "CRITICAL: Do NOT invent policy models, government regulations, statutory mandates, legal enforcement, or jurisdictional bureaucracy" in system_instruction
    assert f'SELF-CHECK INSTRUCTION: If your reply does not mention the motion\'s subject ("{topic}")' in system_instruction
    assert topic in context_content


@pytest.mark.asyncio
async def test_no_key_audio_turn_returns_spoken_turns_need_live_gemini_key_error(async_client: AsyncClient):
    """
    Requirement 2: With no valid key, an audio turn must return a clear error
    ("Spoken turns need a live Gemini key") and never fabricate a transcript.
    """
    from app.main import app
    from app.services.gemini import GeminiEvaluator, get_evaluator

    no_key_evaluator = GeminiEvaluator(api_key="")
    app.dependency_overrides[get_evaluator] = lambda: no_key_evaluator

    try:
        files = {"audio": ("turn.webm", MOCK_WEBM_BYTES, "audio/webm")}
        data = {"duration_ms": 10000, "topic": "virat kholi is the goat in cricket"}
        response = await async_client.post("/api/evaluate", files=files, data=data)

        assert response.status_code == 400
        assert "Spoken turns need a live Gemini key" in response.json()["detail"]
    finally:
        # Restore mock evaluator from conftest
        from tests.conftest import MockGeminiEvaluator
        app.dependency_overrides[get_evaluator] = lambda: MockGeminiEvaluator()

