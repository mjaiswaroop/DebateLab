import logging
import random
from typing import Any, Dict, List, Literal, Optional
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from app.prompts import (
    STOP_WORDS,
    build_text_debate_prompt,
    check_topical_guard,
    extract_speech_noun_phrases,
)
from app.services.gemini import (
    GeminiEvaluator,
    GeminiLiveError,
    plain_prose,
    build_generation_config,
    describe_live_failure,
    get_evaluator,
)
from app.services.quote_verifier import verify_and_align_quotes

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/debate", tags=["debate-game"])


class TurnFallacy(BaseModel):
    type: str = Field(..., description="The fallacy name, e.g. 'false_dilemma'.")
    quote: str = Field(..., description="Verbatim excerpt from the speaker's text containing the fallacy.")
    explanation: str = Field(..., description="One sentence on why it is fallacious.")
    severity: Literal["minor", "moderate", "critical"] = Field(..., description="How damaging the flaw is.")
    fix: str = Field(..., description="How the speaker could repair it.")


class TextTurnModelOutput(BaseModel):
    """Schema Gemini must fill for a text debate turn."""

    opponent_speech: str = Field(
        ...,
        description=(
            "The counter-rebuttal spoken by the opposing debater. 85-135 words of "
            "plain prose - no Markdown, no headings, no bullet points, no bold. "
            "Must name the specific claim it answers, explain why that claim fails "
            "or is insufficient (mechanism, incentive, counter-example or weighing), "
            "and state what the speaker would still need to prove. Must quote the "
            "speaker's actual words. Must not invent statistics, laws, institutions "
            "or citations."
        ),
    )
    opponent_poi: str = Field(
        ...,
        description="One piercing Point of Information question (a single sentence).",
    )
    user_argument_score: int = Field(
        ..., description="Argument score from 0-100, calibrated to the rubric."
    )
    user_premises: List[str] = Field(
        ..., description="1-3 premises extracted from the speaker's text."
    )
    fallacies_flagged: List[TurnFallacy] = Field(
        ..., description="Fallacies that are literally verifiable in the speaker's text, else an empty list."
    )
    coaching_tip: str = Field(
        ...,
        description=(
            "One actionable coaching tip in plain prose that references the "
            "speaker's actual words. No Markdown, no bullet points."
        ),
    )


class TextDebateTurnRequest(BaseModel):
    topic: str
    difficulty: str = "intermediate"
    user_side: str = "government"  # "government" or "opposition"
    round_number: int = 1
    user_text: str
    history: List[Dict[str, str]] = []


class FallacyItem(BaseModel):
    type: str
    quote: str
    explanation: str
    severity: str
    fix: str
    verified: bool = True
    start_char: Optional[int] = None
    end_char: Optional[int] = None


class TextDebateTurnResponse(BaseModel):
    turn_number: int
    opponent_speech: str
    opponent_poi: str
    user_argument_score: Optional[int] = None
    user_premises: List[str]
    fallacies_flagged: List[FallacyItem]
    verified_fallacy_count: int = 0
    total_fallacy_count: int = 0
    coaching_tip: str
    model: str = "gemini-3.8-flash"
    is_demo: bool = False
    demo_reason: Optional[str] = None


class ClashResultItem(BaseModel):
    clash_name: str
    winner: str  # "user" | "opponent" | "draw"
    analysis: str


class SkillBreakdown(BaseModel):
    soundness: int
    responsiveness: int
    warrants: int
    fallacy_discipline: int
    impact_calculus: int


class VerdictClashModel(BaseModel):
    clash_name: str = Field(..., description="Name of the clash that decided the round.")
    winner: Literal["user", "opponent", "draw"] = Field(..., description="Who won the clash.")
    analysis: str = Field(..., description="Why that clash was won, in 2-4 sentences.")


class VerdictSkillBreakdownModel(BaseModel):
    soundness: int = Field(..., description="0-100 argument soundness.")
    responsiveness: int = Field(..., description="0-100 responsiveness to the motion.")
    warrants: int = Field(..., description="0-100 quality of warrants.")
    fallacy_discipline: int = Field(..., description="0-100 fallacy discipline.")
    impact_calculus: int = Field(..., description="0-100 comparative impact weighing.")


class VerdictModelOutput(BaseModel):
    """Schema Gemini must fill for the final ballot."""

    outcome: Literal["win", "loss", "close_split"]
    user_score: float = Field(..., description="The debater's total score, 0-100.")
    opponent_score: float = Field(..., description="The opponent's total score, 0-100.")
    speaker_rank: str = Field(..., description="Speaker rank and points, e.g. '1st Speaker - 84 points'.")
    rfd: str = Field(
        ...,
        description=(
            "Official Reason For Decision. Weigh the clashes against each other, "
            "state who carried which burden, and ground every claim in what was "
            "actually said. Do not invent statistics or citations."
        ),
    )
    clashes: List[VerdictClashModel] = Field(..., description="The decisive clashes of the round.")
    skill_breakdown: VerdictSkillBreakdownModel
    strongest_user_point: str = Field(..., description="The debater's strongest point.")
    opponent_best_blow: str = Field(..., description="The opponent's best argument.")
    key_coaching_advice: str = Field(..., description="The single most valuable coaching note.")


class DebateVerdictRequest(BaseModel):
    topic: str
    difficulty: str = "intermediate"
    user_side: str = "government"
    history: List[Dict[str, str]]


class DebateVerdictResponse(BaseModel):
    outcome: str  # "win" | "loss" | "close_split"
    user_score: float
    opponent_score: float
    speaker_rank: str
    rfd: str
    clashes: List[ClashResultItem]
    skill_breakdown: SkillBreakdown
    strongest_user_point: str
    opponent_best_blow: str
    key_coaching_advice: str
    model: str = "gemini-3.8-flash"
    is_demo: bool = False
    demo_reason: Optional[str] = None


def _extract_speech_noun_phrases(text: str) -> List[str]:
    return extract_speech_noun_phrases(text)


def _check_strong_topical_guard(reply: str, topic: str, user_text: str) -> tuple[bool, str]:
    return check_topical_guard(reply, topic, user_text)




def _heuristic_evaluate_text_turn(
    topic: str,
    user_side: str,
    round_num: int,
    user_text: str,
    reason: str = "No API key configured",
) -> TextDebateTurnResponse:
    """Topic-agnostic heuristic debate engine for offline or fallback turn evaluation.

    NEVER uses domain-specific jargon (e.g. regulatory, enforcement, jurisdiction).
    Always quotes/paraphrases the user's actual words and the exact motion string.
    Never invents scores: user_argument_score is set to None.
    Flags is_demo=True and sets demo_reason.
    """
    clean_user = user_text.strip()
    sentences = [s.strip() for s in clean_user.replace("\n", " ").split(".") if len(s.strip()) > 8]
    primary_claim = sentences[0] if sentences else (clean_user[:80] if clean_user else f"your stance on '{topic}'")
    if len(primary_claim) > 100:
        primary_claim = primary_claim[:97] + "..."

    opp_role = "Opposition" if user_side.lower() == "government" else "Government"

    if opp_role == "Opposition":
        opp_speech = (
            f"Regarding the motion '{topic}': you assert that \"{primary_claim}\", but simply making this assertion "
            f"does not establish why it proves '{topic}' or provide a comparative benchmark against competing criteria. "
            f"Without evidentiary backing or a clear comparative standard, your contention remains unverified."
        )
        opp_poi = (
            f"Point of Information: You claimed \"{primary_claim[:60]}\", but what concrete standard or comparative evidence "
            f"proves this over competing alternatives on '{topic}'?"
        )
        tip = (
            f"Your speech introduces a claim about \"{primary_claim[:50]}\", but lacks an empirical or comparative warrant. "
            f"In your next turn, define your criteria explicitly and explain why your evidence outweighs the opposing case."
        )
    else:
        opp_speech = (
            f"As the Government supporting '{topic}', we contest your assertion that \"{primary_claim}\". "
            f"You have not demonstrated why this objection outweighs the core principles of the motion. "
            f"What comparative standard proves that your position is superior?"
        )
        opp_poi = (
            f"Point of Information: Even granting your point that \"{primary_claim[:60]}\", why does that "
            f"decisively defeat the primary justification for '{topic}'?"
        )
        tip = (
            f"When opposing '{topic}', directly challenge the core metric of the affirmative case rather than making "
            f"isolated points. Provide comparative criteria in your next speech."
        )

    premises = [f"Stance on '{topic[:45]}'"]
    if sentences:
        premises = [s[:90] for s in sentences[:2]]

    return TextDebateTurnResponse(
        turn_number=round_num,
        opponent_speech=opp_speech,
        opponent_poi=opp_poi,
        user_argument_score=None,
        user_premises=premises,
        fallacies_flagged=[],
        verified_fallacy_count=0,
        total_fallacy_count=0,
        coaching_tip=tip,
        model="heuristic-demo",
        is_demo=True,
        demo_reason=reason,
    )


def _heuristic_generate_verdict(
    topic: str,
    user_side: str,
    history: List[Dict[str, str]],
    reason: str = "No API key configured",
) -> DebateVerdictResponse:
    """Generates a topic-agnostic Chief Adjudicator Reason For Decision (RFD) and ballot outcome."""
    user_turns = [h for h in history if h.get("speaker") in ("user", user_side.lower())]
    turns_count = len(user_turns)

    rfd = (
        f"Chief Adjudicator Ruling on '{topic}':\n\n"
        f"The round between the Government and the Opposition examined the motion '{topic}'. "
        f"Across {max(1, turns_count)} exchanges, the debaters contested core definitions, comparative standards, "
        f"and supporting evidence. In this simulated ballot evaluation, the decision hinges on which side established "
        f"clearer comparative weighing and substantiated claims against cross-examination."
    )

    clashes = [
        ClashResultItem(
            clash_name="Comparative Standards & Definitions",
            winner="user",
            analysis=f"You introduced clear criteria regarding '{topic[:40]}', though both sides needed deeper empirical proof.",
        ),
        ClashResultItem(
            clash_name="Evidentiary Substantiation & Warrants",
            winner="draw",
            analysis="A competitive clash: assertions were countered with requests for comparative benchmarks.",
        ),
        ClashResultItem(
            clash_name="Responsiveness to Points of Information (POI)",
            winner="user",
            analysis="You maintained engagement with cross-examination challenges throughout the round.",
        ),
    ]

    skills = SkillBreakdown(
        soundness=72,
        responsiveness=75,
        warrants=70,
        fallacy_discipline=80,
        impact_calculus=74,
    )

    strongest = (
        user_turns[-1].get("text", "")[:120] + "..."
        if user_turns
        else f"Core argument addressing '{topic[:40]}'."
    )

    return DebateVerdictResponse(
        outcome="close_split",
        user_score=75.0,
        opponent_score=74.0,
        speaker_rank="Varsity Debater",
        rfd=rfd,
        clashes=clashes,
        skill_breakdown=skills,
        strongest_user_point=strongest,
        opponent_best_blow="Opposition challenge on comparative benchmarks and lack of evidentiary warrants.",
        key_coaching_advice="Always substantiate claims with comparative metrics rather than standalone assertions.",
        model="heuristic-demo",
        is_demo=True,
        demo_reason=reason,
    )


TEXT_TURN_SYSTEM_INSTRUCTION = (
    "You are a collegiate parliamentary debater competing in an official round, "
    "and an expert adjudicator grading the speech you are answering. "
    "You argue the opposing side of the motion while you are speaking as that "
    "side, and you grade the other speaker honestly while you are adjudicating. "
    "You never flatter, never hedge, and never invent facts. "
    "Do not state statistics, studies, laws, agencies or citations that you have "
    "not been given. When you want evidence the speaker has not supplied, name "
    "the evidence gap instead. Every claim you make about the speaker must be "
    "checkable against the words they actually used."
)


VERDICT_SYSTEM_INSTRUCTION = (
    "You are the Chief Adjudicator of a National Parliamentary Debate "
    "Championship, awarding an official ballot. You weigh the clashes against "
    "each other and state who carried which burden. You never flatter, and you "
    "never invent statistics, studies, citations, laws or institutions that were "
    "not in the transcript. If a speaker failed to substantiate a claim, you say "
    "so. Every judgement you make must be traceable to what the speakers "
    "actually said."
)


def _parse_turn_payload(res: Any, text: str) -> Dict[str, Any]:
    """Reads the turn payload, preferring structured output over string surgery."""
    parsed = getattr(res, "parsed", None)
    if isinstance(parsed, BaseModel):
        return parsed.model_dump()

    import json

    json_body = _extract_json_block(text)
    return json.loads(json_body)


def _extract_json_block(text: str) -> str:
    """Extracts JSON substring safely from markdown fenced code blocks or raw response."""
    cleaned = text.strip()
    if "```" in cleaned:
        parts = cleaned.split("```")
        for part in parts:
            p = part.strip()
            if p.startswith("json"):
                p = p[4:].strip()
            if p.startswith("{") and p.endswith("}"):
                return p
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        return cleaned[start : end + 1]
    return cleaned


@router.post("/text-turn", response_model=TextDebateTurnResponse)
async def submit_text_debate_turn(
    req: TextDebateTurnRequest,
    x_gemini_api_key: Optional[str] = Header(None, alias="X-Gemini-Api-Key"),
    evaluator: GeminiEvaluator = Depends(get_evaluator),
):
    """Processes a text debate turn, providing adversarial opposition rebuttal and logic diagnostics."""
    client = evaluator.get_client(x_gemini_api_key)
    if not client:
        logger.info(
            "Debate turn processed: path=fallback, reason=no key, motion=%s, round=%d, difficulty=%s",
            req.topic,
            req.round_number,
            req.difficulty,
        )
        return _heuristic_evaluate_text_turn(
            topic=req.topic,
            user_side=req.user_side,
            round_num=req.round_number,
            user_text=req.user_text,
            reason="No API key configured",
        )

    # Live Gemini Evaluation
    user_role = "Government" if req.user_side.lower() == "government" else "Opposition"
    opp_role = "Opposition" if req.user_side.lower() == "government" else "Government"

    prompt = build_text_debate_prompt(
        topic=req.topic,
        difficulty=req.difficulty,
        user_side=req.user_side,
        round_number=req.round_number,
        user_text=req.user_text,
        history=req.history,
    )


    attempts = 0
    max_attempts = 2
    current_prompt = prompt

    while attempts < max_attempts:
        attempts += 1
        try:
            res = await evaluator.generate(
                client,
                contents=current_prompt,
                config_factory=lambda model: build_generation_config(
                    model,
                    system_instruction=TEXT_TURN_SYSTEM_INSTRUCTION,
                    response_mime_type="application/json",
                    response_schema=TextTurnModelOutput,
                ),
                client_key=x_gemini_api_key,
            )
            text = res.text or ""
            if not text.strip():
                if attempts < max_attempts:
                    current_prompt = "CRITICAL: Response was empty. " + prompt
                    continue
                logger.info(
                    "Debate turn processed: path=fallback, reason=empty response, motion=%s, round=%d, difficulty=%s",
                    req.topic, req.round_number, req.difficulty
                )
                return _heuristic_evaluate_text_turn(
                    topic=req.topic,
                    user_side=req.user_side,
                    round_num=req.round_number,
                    user_text=req.user_text,
                    reason="Empty response from Gemini",
                )

            data = _parse_turn_payload(res, text)

            opponent_speech = data.get("opponent_speech", "").strip()
            if not opponent_speech:
                if attempts < max_attempts:
                    continue
                logger.info(
                    "Debate turn processed: path=fallback, reason=schema validation failure, motion=%s, round=%d, difficulty=%s",
                    req.topic, req.round_number, req.difficulty
                )
                return _heuristic_evaluate_text_turn(
                    topic=req.topic,
                    user_side=req.user_side,
                    round_num=req.round_number,
                    user_text=req.user_text,
                    reason="Schema validation failure",
                )

            # Server-side stronger guard: motion overlap AND user speech noun phrase overlap
            guard_passed, guard_reason = _check_strong_topical_guard(opponent_speech, req.topic, req.user_text)
            if not guard_passed:
                logger.warning(
                    "Topical guard failed on attempt %d: %s for motion: '%s'. Retrying with strict grounding.",
                    attempts, guard_reason, req.topic
                )
                if attempts < max_attempts:
                    current_prompt = (
                        f"CRITICAL GROUNDING ERROR: Your previous response failed the topical guard: {guard_reason}.\n"
                        f"You MUST directly reference the motion '{req.topic}' AND address the user's specific claims/noun phrases.\n\n"
                        + prompt
                    )
                    continue
                else:
                    logger.error(
                        "Topical guard rejected the reply (%s) (motion=%s, round=%d)",
                        guard_reason,
                        req.topic,
                        req.round_number,
                    )
                    raise HTTPException(
                        status_code=502,
                        detail=(
                            "The adjudicator's reply did not engage the motion or the "
                            f"speaker's argument ({guard_reason}). Please try again."
                        ),
                    )

            # Success with live Gemini
            raw_fallacies = data.get("fallacies_flagged", [])
            verified_fallacies, verified_count, total_count = verify_and_align_quotes(
                req.user_text, raw_fallacies
            )

            raw_score = data.get("user_argument_score")
            parsed_score: Optional[int] = None
            if raw_score is not None:
                try:
                    parsed_score = int(raw_score)
                except (ValueError, TypeError):
                    parsed_score = 45

            logger.info(
                "Debate turn processed: path=gemini, reason=none, motion=%s, round=%d, difficulty=%s",
                req.topic, req.round_number, req.difficulty
            )

            return TextDebateTurnResponse(
                turn_number=req.round_number,
                opponent_speech=plain_prose(opponent_speech),
                opponent_poi=plain_prose(
                    data.get("opponent_poi", f"How do you justify this standard on '{req.topic}'?")
                ),
                user_argument_score=parsed_score,
                user_premises=[plain_prose(p) for p in data.get("user_premises", [f"Claim regarding '{req.topic[:40]}'"])],
                fallacies_flagged=[FallacyItem(**vf) for vf in verified_fallacies],
                verified_fallacy_count=verified_count,
                total_fallacy_count=total_count,
                coaching_tip=plain_prose(
                    data.get("coaching_tip", "Deepen evidentiary warrants to substantiate claims.")
                ),
                model=evaluator.active_model(x_gemini_api_key),
                is_demo=False,
                demo_reason=None,
            )
        except Exception as e:
            if attempts < max_attempts:
                logger.warning(f"Live Gemini attempt {attempts} failed: {e}. Retrying...")
                continue
            # A key IS configured but Gemini failed. Serving the generic
            # heuristic here made a broken connection look like a real
            # (but nonsensical) reply, so surface the actual reason instead.
            logger.error("Live Gemini text-turn failed: %s", e, exc_info=True)
            raise HTTPException(
                status_code=502,
                detail=describe_live_failure(e),
            ) from e


@router.post("/verdict", response_model=DebateVerdictResponse)
async def generate_debate_verdict(
    req: DebateVerdictRequest,
    x_gemini_api_key: Optional[str] = Header(None, alias="X-Gemini-Api-Key"),
    evaluator: GeminiEvaluator = Depends(get_evaluator),
):
    """Synthesizes the entire text debate into an official collegiate Chief Adjudicator ballot."""
    client = evaluator.get_client(x_gemini_api_key)
    if not client:
        return _heuristic_generate_verdict(
            topic=req.topic,
            user_side=req.user_side,
            history=req.history,
            reason="No API key configured",
        )

    prompt = (
        f"You are the Chief Adjudicator of a National Parliamentary Debate Championship.\n"
        f"DEBATE MOTION: {req.topic}\n"
        f"DEBATER SIDE: {req.user_side}\n"
        f"FULL MATCH TRANSCRIPT:\n"
        + "\n".join(f"[{h.get('speaker', '').upper()}]: {h.get('text', '')}" for h in req.history)
        + "\n\nSynthesize the complete debate into an official judicial ruling.\n"
        "Return ONLY a JSON object with:\n"
        "{\n"
        '  "outcome": "win" or "loss" or "close_split",\n'
        '  "user_score": 85.5,\n'
        '  "opponent_score": 81.0,\n'
        '  "speaker_rank": "1st Speaker • High Speaker Points",\n'
        '  "rfd": "Official Chief Adjudicator Reason For Decision analyzing clash and comparative burdens...",\n'
        '  "clashes": [\n'
        '    {"clash_name": "...", "winner": "user"|"opponent"|"draw", "analysis": "..."}\n'
        '  ],\n'
        '  "skill_breakdown": {\n'
        '    "soundness": 88,\n'
        '    "responsiveness": 84,\n'
        '    "warrants": 86,\n'
        '    "fallacy_discipline": 90,\n'
        '    "impact_calculus": 87\n'
        '  },\n'
        '  "strongest_user_point": "...",\n'
        '  "opponent_best_blow": "...",\n'
        '  "key_coaching_advice": "..."\n'
        "}"
    )

    try:
        res = await evaluator.generate(
            client,
            contents=prompt,
            config_factory=lambda model: build_generation_config(
                model,
                system_instruction=VERDICT_SYSTEM_INSTRUCTION,
                response_mime_type="application/json",
                response_schema=VerdictModelOutput,
            ),
            client_key=x_gemini_api_key,
        )
        parsed = getattr(res, "parsed", None)
        if isinstance(parsed, BaseModel):
            data = parsed.model_dump()
        else:
            import json

            text = res.text or ""
            data = json.loads(_extract_json_block(text))

        return DebateVerdictResponse(
            outcome=data.get("outcome", "win"),
            user_score=float(data.get("user_score", 0)),
            opponent_score=float(data.get("opponent_score", 0)),
            speaker_rank=data.get("speaker_rank", "1st Speaker"),
            rfd=data.get("rfd", ""),
            clashes=[
                ClashResultItem(**c)
                for c in data.get("clashes", [])
            ],
            skill_breakdown=SkillBreakdown(**data["skill_breakdown"]),
            strongest_user_point=data.get("strongest_user_point", ""),
            opponent_best_blow=data.get("opponent_best_blow", ""),
            key_coaching_advice=data.get("key_coaching_advice", ""),
            model=evaluator.active_model(x_gemini_api_key),
            is_demo=False,
            demo_reason=None,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Live Gemini verdict generation failed: %s", e, exc_info=True)
        raise HTTPException(
            status_code=502,
            detail=describe_live_failure(e),
        ) from e
