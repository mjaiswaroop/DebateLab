import uuid
import pytest
from httpx import AsyncClient
from app.services.delta_calculator import compute_turn_delta

MOCK_WEBM_BYTES = b"\x1a\x45\xdf\xa3" + b"\x00" * 64


class MockTurnObj:
    def __init__(
        self,
        id=None,
        attempt_number=1,
        parent_turn_id=None,
        argument_score=70,
        confidence_score=75,
        filler_words_detected=None,
        words_per_minute=160.0,
        user_transcript="This is my initial argument with a claim and reasoning.",
        fallacies_flagged=None,
        raw_evaluation=None,
    ):
        self.id = id or uuid.uuid4()
        self.attempt_number = attempt_number
        self.parent_turn_id = parent_turn_id
        self.argument_score = argument_score
        self.confidence_score = confidence_score
        self.filler_words_detected = (
            filler_words_detected
            if filler_words_detected is not None
            else [{"word": "um", "count": 4}, {"word": "like", "count": 2}]
        )
        self.words_per_minute = words_per_minute
        self.user_transcript = user_transcript
        self.fallacies_flagged = fallacies_flagged or []
        self.raw_evaluation = raw_evaluation or {
            "logic": {"premises": ["Premise A: Initial assertion."]}
        }


def test_redo_delta_math():
    """Verifies calculation of soundness, filler count, WPM, fixed fallacies, and added warrants."""
    parent = MockTurnObj(
        attempt_number=1,
        argument_score=60,
        confidence_score=65,
        filler_words_detected=[{"word": "um", "count": 4}, {"word": "like", "count": 3}],  # 7 fillers
        words_per_minute=140.0,
        user_transcript="We must ban this because everyone knows it is dangerous and bad.",
        fallacies_flagged=[
            {
                "type": "ad_populum",
                "quote": "everyone knows it is dangerous and bad",
                "explanation": "Unwarranted appeal to common knowledge.",
            }
        ],
        raw_evaluation={"logic": {"premises": ["Premise 1: General assertion."]}},
    )

    redo = MockTurnObj(
        attempt_number=2,
        parent_turn_id=parent.id,
        argument_score=82,
        confidence_score=80,
        filler_words_detected=[{"word": "um", "count": 1}],  # 1 filler (reduction of 6)
        words_per_minute=162.5,
        user_transcript="We must regulate algorithmic feeds because audited audit reports prove a 23% rise in teenage depressive episodes, satisfying empirical solvency criteria.",
        fallacies_flagged=[],  # Clean redo!
        raw_evaluation={
            "logic": {
                "premises": [
                    "Premise 1: Clinical audit demonstrating depressive episodes.",
                    "Premise 2: Solvency mechanism through regulation.",
                    "Premise 3: Stakeholder incentive bounds.",
                ]
            }
        },
    )

    delta = compute_turn_delta(parent, redo)

    assert delta["is_demo"] is False
    assert delta["delta_available"] is True
    assert delta["parent_turn_id"] == str(parent.id)
    assert delta["attempt_number"] == 2
    assert delta["parent_attempt_number"] == 1

    # Soundness delta: 82 - 60 = +22
    assert delta["soundness_before"] == 60
    assert delta["soundness_after"] == 82
    assert delta["soundness_delta"] == 22.0

    # Confidence delta: 80 - 65 = +15
    assert delta["confidence_delta"] == 15.0

    # Filler delta: 1 - 7 = -6
    assert delta["filler_before"] == 7
    assert delta["filler_after"] == 1
    assert delta["filler_delta"] == -6

    # WPM delta: 162.5 - 140.0 = +22.5
    assert delta["wpm_delta"] == 22.5

    # Fallacies fixed: original quote "everyone knows it is dangerous and bad" is absent from redo
    assert delta["fallacies_fixed_count"] == 1
    assert len(delta["fallacies_fixed"]) == 1
    assert delta["fallacies_fixed"][0]["type"] == "ad_populum"
    assert "everyone knows" in delta["fallacies_fixed"][0]["quote"]

    # Warrants added: 3 premises - 1 premise = 2 warrants added
    assert delta["warrants_added"] == 2


def test_chained_redo_attempts():
    """Supports multiple attempts chained by parent_turn_id (Attempt 1 -> Attempt 2 -> Attempt 3)."""
    t1 = MockTurnObj(
        attempt_number=1,
        argument_score=50,
        filler_words_detected=[{"word": "um", "count": 6}],
        words_per_minute=120.0,
        user_transcript="Attempt 1: Bare assertion without proof.",
        fallacies_flagged=[{"type": "begging_the_question", "quote": "without proof"}],
    )

    t2 = MockTurnObj(
        attempt_number=2,
        parent_turn_id=t1.id,
        argument_score=68,
        filler_words_detected=[{"word": "um", "count": 3}],
        words_per_minute=145.0,
        user_transcript="Attempt 2: Adding factual statistics from 2024.",
        fallacies_flagged=[{"type": "false_dilemma", "quote": "factual statistics from 2024"}],
    )

    t3 = MockTurnObj(
        attempt_number=3,
        parent_turn_id=t2.id,
        argument_score=85,
        filler_words_detected=[],
        words_per_minute=168.0,
        user_transcript="Attempt 3: Complete comparative analysis with no fallacies and zero hesitation.",
        fallacies_flagged=[],
    )

    # Compare Attempt 2 to Attempt 1
    delta_2_1 = compute_turn_delta(t1, t2)
    assert delta_2_1["parent_turn_id"] == str(t1.id)
    assert delta_2_1["parent_attempt_number"] == 1
    assert delta_2_1["attempt_number"] == 2
    assert delta_2_1["soundness_delta"] == 18.0
    assert delta_2_1["filler_delta"] == -3
    assert delta_2_1["fallacies_fixed_count"] == 1  # "without proof" is absent in t2

    # Compare Attempt 3 to Attempt 2 (Chained redo!)
    delta_3_2 = compute_turn_delta(t2, t3)
    assert delta_3_2["parent_turn_id"] == str(t2.id)
    assert delta_3_2["parent_attempt_number"] == 2
    assert delta_3_2["attempt_number"] == 3
    assert delta_3_2["soundness_delta"] == 17.0
    assert delta_3_2["filler_delta"] == -3
    assert delta_3_2["fallacies_fixed_count"] == 1  # "factual statistics from 2024" is absent in t3


def test_demo_mode_redo():
    """In demo mode (scores null), delta is hidden with an informative explanation."""
    parent = MockTurnObj(
        attempt_number=1,
        argument_score=None,  # Demo mode: no score
        confidence_score=None,
        filler_words_detected=[],
        words_per_minute=None,
        user_transcript="Demo turn 1 text.",
    )

    redo = MockTurnObj(
        attempt_number=2,
        parent_turn_id=parent.id,
        argument_score=None,  # Demo mode: no score
        confidence_score=None,
        filler_words_detected=[],
        words_per_minute=None,
        user_transcript="Demo redo attempt 2 text.",
    )

    delta = compute_turn_delta(parent, redo)
    assert delta["is_demo"] is True
    assert delta["delta_available"] is False
    assert delta["soundness_delta"] is None
    assert delta["explanation"] is not None
    assert "Demo Mode" in delta["explanation"]
    assert delta["parent_turn_id"] == str(parent.id)
    assert delta["attempt_number"] == 2


@pytest.mark.asyncio
async def test_api_session_redo_turn_flow(async_client: AsyncClient):
    """Integration test: submit turn 1, then submit redo turn 2 referencing parent_turn_id."""
    # 1. Create Session
    create_res = await async_client.post(
        "/api/sessions",
        json={
            "topic": "Universal Basic Income",
            "difficulty": "intermediate",
            "initial_thesis": "Cash transfers provide direct liquidity.",
        },
    )
    assert create_res.status_code == 201
    session_id = create_res.json()["id"]

    # 2. Turn 1 (Original)
    files = {"audio": ("turn1.webm", MOCK_WEBM_BYTES, "audio/webm")}
    turn1_res = await async_client.post(
        f"/api/sessions/{session_id}/turn",
        files=files,
        data={"duration_ms": 12000},
    )
    assert turn1_res.status_code == 200
    turn1 = turn1_res.json()
    assert turn1["turn_number"] == 1
    assert turn1["attempt_number"] == 1

    # Get turn 1 DB id from session detail
    session_res = await async_client.get(f"/api/sessions/{session_id}")
    assert session_res.status_code == 200
    user_turn_1 = [t for t in session_res.json()["turns"] if t["speaker"] == "user"][0]
    turn1_id = user_turn_1["id"]

    # 3. Turn 1 Redo (Attempt 2 with parent_turn_id)
    redo_files = {"audio": ("turn1_redo.webm", MOCK_WEBM_BYTES, "audio/webm")}
    redo_res = await async_client.post(
        f"/api/sessions/{session_id}/turn",
        files=redo_files,
        data={
            "duration_ms": 12000,
            "parent_turn_id": turn1_id,
        },
    )
    assert redo_res.status_code == 200
    redo_data = redo_res.json()
    assert redo_data["turn_number"] == 1  # Keeps same round number
    assert redo_data["attempt_number"] == 2  # Increments attempt
    assert redo_data["parent_turn_id"] == turn1_id
    assert redo_data["redo_delta"] is not None
    assert redo_data["redo_delta"]["parent_turn_id"] == turn1_id
    assert redo_data["redo_delta"]["attempt_number"] == 2

    # 4. Read-time delta computation on get_session
    final_session_res = await async_client.get(f"/api/sessions/{session_id}")
    assert final_session_res.status_code == 200
    turns = final_session_res.json()["turns"]
    user_turns = [t for t in turns if t["speaker"] == "user"]
    assert len(user_turns) == 2
    attempt_2_turn = [t for t in user_turns if t["attempt_number"] == 2][0]
    assert attempt_2_turn["parent_turn_id"] == turn1_id
    assert attempt_2_turn["redo_delta"] is not None
    assert attempt_2_turn["redo_delta"]["delta_available"] is True


def test_rewording_same_fallacy_not_counted_as_fixed():
    """
    Requirement 4b: An original fallacy counts as fixed only if the new evaluation's
    verified fallacies do not contain the same fallacy type. If the wording changed
    but the same type is still flagged, show it as 'reworded, still flagged'.
    Never infer fixed from the quote being absent.
    """
    parent = MockTurnObj(
        argument_score=60,
        user_transcript="Everyone in modern society becomes depressed because of screen addiction.",
        fallacies_flagged=[
            {
                "type": "hasty_generalization",
                "quote": "Everyone in modern society becomes depressed",
                "explanation": "Sweeping claim over generalized population.",
            }
        ],
    )

    redo = MockTurnObj(
        argument_score=64,
        user_transcript="All people inevitably succumb to despair when exposed to interactive social algorithms.",
        fallacies_flagged=[
            {
                "type": "hasty_generalization",
                "quote": "All people inevitably succumb to despair",
                "explanation": "Universal generalization remaining unbacked by demographic evidence.",
            }
        ],
    )

    delta = compute_turn_delta(parent, redo)

    # Must NOT count as fixed!
    assert delta["fallacies_fixed_count"] == 0
    assert len(delta["fallacies_fixed"]) == 0

    # Must show up in still flagged as 'reworded, still flagged'
    assert len(delta["fallacies_still_flagged"]) == 1
    flagged = delta["fallacies_still_flagged"][0]
    assert flagged["status"] == "reworded, still flagged"
    assert flagged["original_quote"] == "Everyone in modern society becomes depressed"
    assert flagged["new_quote"] == "All people inevitably succumb to despair"


def test_redo_with_identical_transcript_gives_near_zero_delta():
    """
    Requirement 4e(ii): A redo with an identical transcript and performance
    gives a zero/near-zero delta across all dimensions.
    """
    turn_transcript = "Carbon pricing creates economic incentives for industrial decarbonization while generating revenue."
    premises = ["Carbon prices internalize negative externalities.", "Firms substitute lower emissions alternatives."]

    parent = MockTurnObj(
        argument_score=75,
        confidence_score=78,
        filler_words_detected=[{"word": "um", "count": 2}],
        words_per_minute=155.0,
        user_transcript=turn_transcript,
        fallacies_flagged=[],
        raw_evaluation={"logic": {"premises": premises}},
    )

    redo = MockTurnObj(
        argument_score=75,
        confidence_score=78,
        filler_words_detected=[{"word": "um", "count": 2}],
        words_per_minute=155.0,
        user_transcript=turn_transcript,
        fallacies_flagged=[],
        raw_evaluation={"logic": {"premises": premises}},
    )

    delta = compute_turn_delta(parent, redo)

    assert delta["soundness_delta"] == 0.0
    assert delta["confidence_delta"] == 0.0
    assert delta["filler_delta"] == 0
    assert delta["wpm_delta"] == 0.0
    assert delta["premises_delta"] == 0
    assert delta["fallacies_fixed_count"] == 0
    assert delta["warrants_added"] == 0


def test_redo_prompt_contains_no_original_score_or_critique():
    """
    Requirement 4a & 4e(iii): Grade the redo blind. The evaluation prompt
    must NOT include the original scores or critique text.
    """
    from app.prompts import build_adjudicator_system_prompt, build_audio_turn_context

    system_prompt = build_adjudicator_system_prompt(difficulty="intermediate", topic="Carbon Tax Solvency")
    context = build_audio_turn_context(
        topic="Carbon Tax Solvency",
        difficulty="intermediate",
        user_side="government",
        round_number=1,
        history=[],
        thesis="Carbon taxes reduce emissions efficiently.",
    )

    full_evaluation_prompt = f"{system_prompt}\n\n{context}"

    # Verify no leaked scores or specific critique phrases
    forbidden_terms = [
        "original score",
        "previous score",
        "parent score",
        "critique from previous",
        "coaching tip:",
        "you scored",
        "soundness: 60",
        "confidence: 65",
    ]
    for term in forbidden_terms:
        assert term not in full_evaluation_prompt.lower(), f"Leaked critique/score term: {term}"

