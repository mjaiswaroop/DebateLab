import json
from unittest.mock import AsyncMock, MagicMock
import pytest
from httpx import AsyncClient

from app.main import app
from app.services.gemini import get_evaluator


POLICY_JARGON_TERMS = [
    "enforcement",
    "displacement",
    "regulatory",
    "jurisdiction",
    "mandate",
    "status quo",
    "statutory",
    "corporate",
    "black-market",
    "fiduciary",
    "capital flight",
]


@pytest.mark.asyncio
async def test_fallback_for_cricket_motion_has_no_policy_jargon(async_client: AsyncClient):
    """Assert fallback output for 'virat kholi is the goat in cricket' contains no policy/regulation vocabulary."""
    payload = {
        "topic": "virat kholi is the goat in cricket",
        "difficulty": "intermediate",
        "user_side": "government",
        "round_number": 1,
        "user_text": "he has dominated all the formats, stayed top 1 in all the format, broke sachin's record for most no of centuries in odi",
        "history": [],
    }

    # Override evaluator to return None client (simulating no API key)
    mock_evaluator = MagicMock()
    mock_evaluator.get_client.return_value = None
    app.dependency_overrides[get_evaluator] = lambda: mock_evaluator

    try:
        res = await async_client.post("/api/debate/text-turn", json=payload)
        assert res.status_code == 200
        data = res.json()

        combined_text = (
            f"{data.get('opponent_speech', '')} {data.get('opponent_poi', '')} {data.get('coaching_tip', '')}"
        ).lower()

        # Assert no policy/regulation vocabulary
        for jargon in POLICY_JARGON_TERMS:
            assert jargon not in combined_text, f"Found forbidden policy jargon '{jargon}' in fallback response"

        # Assert topic or user quote is referenced
        assert "virat kholi is the goat in cricket" in combined_text or "dominated" in combined_text
    finally:
        app.dependency_overrides.pop(get_evaluator, None)


@pytest.mark.asyncio
async def test_fallback_returns_demo_badge_and_null_score(async_client: AsyncClient):
    """Assert Demo badge flag is returned and score is null when fallback is used."""
    payload = {
        "topic": "virat kholi is the goat in cricket",
        "difficulty": "intermediate",
        "user_side": "government",
        "round_number": 1,
        "user_text": "virat kohli has won matches single handedly in high pressure chases",
        "history": [],
    }

    mock_evaluator = MagicMock()
    mock_evaluator.get_client.return_value = None
    app.dependency_overrides[get_evaluator] = lambda: mock_evaluator

    try:
        res = await async_client.post("/api/debate/text-turn", json=payload)
        assert res.status_code == 200
        data = res.json()

        assert data["is_demo"] is True
        assert data["demo_reason"] == "No API key configured"
        assert data["user_argument_score"] is None
        assert data["model"] == "heuristic-demo"
    finally:
        app.dependency_overrides.pop(get_evaluator, None)


@pytest.mark.asyncio
async def test_gemini_prompt_contains_custom_motion_on_turns_1_2_3(async_client: AsyncClient):
    """Mock Gemini and assert the prompt contains the custom motion on turn 1, 2 and 3."""
    custom_motion = "virat kholi is the goat in cricket"
    captured_prompts = []

    mock_client = MagicMock()
    mock_aio = MagicMock()
    mock_models = MagicMock()

    async def mock_generate_content(*args, **kwargs):
        prompt_content = kwargs.get("contents") or (args[0] if args else "")
        captured_prompts.append(prompt_content)
        turn_num = len(captured_prompts)

        if turn_num == 1:
            reply = "While Kohli has dominated across formats in cricket, Tendulkar faced tougher bowling eras in cricket."
        elif turn_num == 2:
            reply = "While his chase master statistics in ODI cricket are impressive, Michael Bevan also excelled in chases."
        else:
            reply = "While the 2016 T20 World Cup innings was historic in cricket, Bradman's Test record remains unassailable."

        mock_response = MagicMock()
        mock_response.text = json.dumps({
            "opponent_speech": reply,
            "opponent_poi": "How does Kohli's average compare to Don Bradman's record in cricket?",
            "user_argument_score": 42,
            "user_premises": ["Kohli dominated across formats"],
            "fallacies_flagged": [],
            "coaching_tip": "Back up your claims about format dominance with specific cricket batting averages."
        })
        return mock_response

    mock_models.generate_content = AsyncMock(side_effect=mock_generate_content)
    mock_aio.models = mock_models
    mock_client.aio = mock_aio

    mock_evaluator = MagicMock()
    mock_evaluator.model = "gemini-2.5-flash"
    mock_evaluator.get_client.return_value = mock_client
    mock_evaluator.active_model.return_value = "gemini-2.5-flash"

    async def mock_evaluator_generate(*args, **kwargs):
        """Forward the evaluator-level generate() call to the mocked client."""
        return await mock_client.aio.models.generate_content(
            model=kwargs.get("model"),
            contents=kwargs.get("contents"),
        )

    mock_evaluator.generate = AsyncMock(side_effect=mock_evaluator_generate)
    app.dependency_overrides[get_evaluator] = lambda: mock_evaluator

    try:
        # Turn 1
        t1_payload = {
            "topic": custom_motion,
            "difficulty": "intermediate",
            "user_side": "government",
            "round_number": 1,
            "user_text": "Kohli has dominated all formats and broken batting records in cricket.",
            "history": [],
        }
        res1 = await async_client.post("/api/debate/text-turn", json=t1_payload)
        assert res1.status_code == 200
        assert res1.json()["is_demo"] is False
        assert res1.json()["user_argument_score"] == 42

        # Turn 2
        t2_payload = {
            "topic": custom_motion,
            "difficulty": "intermediate",
            "user_side": "government",
            "round_number": 2,
            "user_text": "His chase master statistics in ODI cricket are unmatched by anyone.",
            "history": [
                {"speaker": "government", "text": t1_payload["user_text"]},
                {"speaker": "opposition", "text": "Sachin played in a tougher era."},
            ],
        }
        res2 = await async_client.post("/api/debate/text-turn", json=t2_payload)
        assert res2.status_code == 200

        # Turn 3
        t3_payload = {
            "topic": custom_motion,
            "difficulty": "intermediate",
            "user_side": "government",
            "round_number": 3,
            "user_text": "Look at the 2016 T20 World Cup and 2022 MCG innings.",
            "history": [
                {"speaker": "government", "text": t1_payload["user_text"]},
                {"speaker": "opposition", "text": "Sachin played in a tougher era."},
                {"speaker": "government", "text": t2_payload["user_text"]},
                {"speaker": "opposition", "text": "Bradman averaged 99.94."},
            ],
        }
        res3 = await async_client.post("/api/debate/text-turn", json=t3_payload)
        assert res3.status_code == 200

        # Assert all 3 prompts captured contain the exact custom motion
        assert len(captured_prompts) == 3
        for idx, prompt_text in enumerate(captured_prompts, start=1):
            assert custom_motion in prompt_text, f"Turn {idx} prompt missing custom motion: {prompt_text}"
            assert "DEBATE MOTION: virat kholi is the goat in cricket" in prompt_text
            assert "VALUE / COMPARATIVE" in prompt_text
            assert "CRITICAL: Do NOT invent policy models" in prompt_text

        # Assert Turn 2 and Turn 3 prompts contain previous turn text in history
        assert t1_payload["user_text"] in captured_prompts[1]
        assert t2_payload["user_text"] in captured_prompts[2]
    finally:
        app.dependency_overrides.pop(get_evaluator, None)


# -----------------------------------------------------------------------------
# 6 MOTIONS TEST SET: Parametrized Mock Suite and Optional Live Suite
# 1. Policy motion
# 2. Value/GOAT motion 1 (Sports)
# 3. Value/GOAT motion 2 (Music/Arts)
# 4. Factual motion
# 5. Very short motion
# 6. Motion with a typo
# -----------------------------------------------------------------------------

TEST_MOTIONS_DATA = [
    (
        "policy",
        "This House Would Ban Targeted Political Advertising on Digital Platforms",
        "Targeted political advertising polarizes electorates and exploits algorithmic echo chambers.",
        "While digital platforms utilize targeting algorithms and political advertising, banning them infringes on democracy.",
        ["targeted", "political", "advertising"],
        ["advertising", "algorithms"],
    ),
    (
        "value_sports",
        "virat kholi is the goat in cricket",
        "Kohli has dominated across all formats and has the greatest record in high pressure run chases.",
        "While Kohli has dominated across cricket formats with strong batting statistics, Don Bradman faced tougher eras.",
        ["virat", "kholi", "cricket"],
        ["formats", "dominated"],
    ),
    (
        "value_arts",
        "beethoven is the greatest composer in human history",
        "Beethoven transformed the symphony and expressed profound emotional depth through innovative musical structures.",
        "While Beethoven transformed the symphony, Mozart and Bach achieved equal architectural mastery in composer history.",
        ["beethoven", "composer"],
        ["symphony", "transformed"],
    ),
    (
        "factual",
        "remote work reduces commercial real estate property valuation",
        "Higher office vacancy rates directly lower rental yields and deflate commercial property valuations.",
        "Although office vacancy rates impact commercial real estate property valuation, adaptive reuse and remote work hubs stabilize markets.",
        ["remote", "commercial", "real estate", "valuation"],
        ["vacancy", "property"],
    ),
    (
        "very_short",
        "ban zoos",
        "Keeping wild animals in confinement for public entertainment causes severe psychological distress and deprivation.",
        "While animal confinement raises ethical questions, accredited zoos that ban mistreatment protect species from extinction.",
        ["ban", "zoos"],
        ["confinement", "distress"],
    ),
    (
        "typo",
        "artifical inteligence will destory human creative jobs",
        "Generative AI models automate commercial copywriting and digital illustration faster and cheaper than human artists.",
        "Even as artifical inteligence will destory routine commercial copywriting, authentic human creative artists remain essential.",
        ["artifical", "inteligence", "creative"],
        ["copywriting", "artists"],
    ),
]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "motion_type,motion,user_claim,opp_reply,expected_topic_terms,expected_claim_terms",
    TEST_MOTIONS_DATA,
)
async def test_mocked_gemini_prompt_contains_exact_motion_for_all_six_types(
    async_client: AsyncClient,
    motion_type: str,
    motion: str,
    user_claim: str,
    opp_reply: str,
    expected_topic_terms: list,
    expected_claim_terms: list,
):
    """
    Parametrized test for 6 distinct motion types:
    Asserts:
    1. The prompt constructed and sent to Gemini contains the EXACT motion string (preserving typos/casing).
    2. The live output matches the topical guard requiring motion keywords AND user noun phrase overlap.
    """
    captured_prompts = []

    mock_client = MagicMock()
    mock_aio = MagicMock()
    mock_models = MagicMock()

    async def mock_generate_content(*args, **kwargs):
        prompt_content = kwargs.get("contents") or (args[0] if args else "")
        captured_prompts.append(prompt_content)
        mock_response = MagicMock()
        mock_response.text = json.dumps({
            "opponent_speech": opp_reply,
            "opponent_poi": f"How do you justify your stance on {motion}?",
            "user_argument_score": 45,
            "user_premises": [user_claim[:60]],
            "fallacies_flagged": [],
            "coaching_tip": "Provide clearer comparative warrants."
        })
        return mock_response

    mock_models.generate_content = AsyncMock(side_effect=mock_generate_content)
    mock_aio.models = mock_models
    mock_client.aio = mock_aio

    mock_evaluator = MagicMock()
    mock_evaluator.model = "gemini-2.5-flash"
    mock_evaluator.get_client.return_value = mock_client
    mock_evaluator.active_model.return_value = "gemini-2.5-flash"

    async def mock_evaluator_generate(*args, **kwargs):
        """Forward the evaluator-level generate() call to the mocked client."""
        return await mock_client.aio.models.generate_content(
            model=kwargs.get("model"),
            contents=kwargs.get("contents"),
        )

    mock_evaluator.generate = AsyncMock(side_effect=mock_evaluator_generate)
    app.dependency_overrides[get_evaluator] = lambda: mock_evaluator

    try:
        payload = {
            "topic": motion,
            "difficulty": "intermediate",
            "user_side": "government",
            "round_number": 1,
            "user_text": user_claim,
            "history": [],
        }
        res = await async_client.post("/api/debate/text-turn", json=payload)
        assert res.status_code == 200
        data = res.json()

        # 1. Assert prompt contains the EXACT motion string as typed
        assert len(captured_prompts) == 1
        prompt = captured_prompts[0]
        assert f"DEBATE MOTION: {motion}" in prompt, f"Prompt did not contain exact motion string '{motion}'"
        assert motion in prompt

        # 2. Assert successful live path (not fallback demo)
        assert data["is_demo"] is False
        assert data["user_argument_score"] == 45
        assert len(data["opponent_speech"]) > 20

        # 3. Assert reply shares meaningful terms with both the motion and user claim
        reply_lower = data["opponent_speech"].lower()
        has_topic_term = any(term.lower() in reply_lower for term in expected_topic_terms)
        has_claim_term = any(term.lower() in reply_lower for term in expected_claim_terms)
        assert has_topic_term, f"Opponent reply did not contain any topic terms {expected_topic_terms}: '{reply_lower}'"
        assert has_claim_term, f"Opponent reply did not contain any claim terms {expected_claim_terms}: '{reply_lower}'"

    finally:
        app.dependency_overrides.pop(get_evaluator, None)


@pytest.mark.live
@pytest.mark.asyncio
@pytest.mark.parametrize(
    "motion_type,motion,user_claim,opp_reply,expected_topic_terms,expected_claim_terms",
    TEST_MOTIONS_DATA,
)
async def test_live_gemini_suite_all_six_motions(
    async_client: AsyncClient,
    motion_type: str,
    motion: str,
    user_claim: str,
    opp_reply: str,
    expected_topic_terms: list,
    expected_claim_terms: list,
):
    """
    Live Gemini test suite across all 6 motion types.
    Requires a valid Gemini API key in environment or X-Gemini-Api-Key.
    Asserts:
    1. Reply is generated by live Gemini model (is_demo is False).
    2. Reply shares meaningful terms with both the motion and the user's last claim.
    """
    import os
    from app.services.gemini import get_evaluator as real_get_evaluator

    evaluator = real_get_evaluator()
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key or api_key.strip() in ("your_gemini_api_key_here", "placeholder", "unset") or len(api_key.strip()) < 15:
        pytest.skip("Skipping live test: No valid live GEMINI_API_KEY available in environment")
    client = evaluator.get_client(api_key)
    if not client:
        pytest.skip("Skipping live test: No valid live GEMINI_API_KEY available in environment")


    headers = {}
    if api_key:
        headers["X-Gemini-Api-Key"] = api_key

    payload = {
        "topic": motion,
        "difficulty": "intermediate",
        "user_side": "government",
        "round_number": 1,
        "user_text": user_claim,
        "history": [],
    }

    res = await async_client.post("/api/debate/text-turn", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["is_demo"] is False, f"Expected live response, but got fallback: {data.get('demo_reason')}"
    reply_lower = (data.get("opponent_speech", "") + " " + data.get("opponent_poi", "")).lower()

    # Meaningful terms overlap with motion
    motion_words = [w.lower().strip(".,!?:;\"'") for w in motion.split() if len(w) >= 4 and w.lower() not in {"this", "would", "that", "with", "from"}]
    has_motion_term = any(w in reply_lower for w in motion_words)
    assert has_motion_term, f"Live reply '{reply_lower}' does not share meaningful terms with motion '{motion}' (terms: {motion_words})"

    # Meaningful terms overlap with user's last claim
    user_words = [w.lower().strip(".,!?:;\"'") for w in user_claim.split() if len(w) >= 4 and w.lower() not in {"this", "that", "have", "more", "than", "will"}]
    has_claim_term = any(w in reply_lower for w in user_words)
    assert has_claim_term, f"Live reply '{reply_lower}' does not share meaningful terms with user claim '{user_claim}' (terms: {user_words})"



