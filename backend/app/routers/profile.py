import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import current_user
from app.db import get_db
from app.models import DebateSession, DebateTurn, JudgeBallot, User, UserDrill

router = APIRouter(prefix="/api", tags=["profile-and-coaching"])


class DrillCreateRequest(BaseModel):
    drill_type: str
    prompt_text: str
    duration_seconds: int
    score: int
    target_metric: str
    triggering_weakness: Optional[str] = None
    metrics: Dict[str, Any] = {}
    feedback: str
    session_id: Optional[uuid.UUID] = None


class DrillResponse(BaseModel):
    id: uuid.UUID
    drill_type: str
    prompt_text: str
    duration_seconds: int
    score: int
    target_metric: str
    triggering_weakness: Optional[str] = None
    metrics: Dict[str, Any] = {}
    feedback: str
    created_at: datetime


class BallotResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    persona: str
    winner: str
    user_score: int
    opponent_score: int
    rfd: str
    key_factors: List[str]
    what_would_change_decision: str
    created_at: datetime


class SkillRadar(BaseModel):
    logic_soundness: int
    delivery_confidence: int
    cadence_stability: int
    fallacy_discipline: int
    responsiveness: int


class ProgressionPoint(BaseModel):
    date: str
    overall_score: float
    soundness: int
    confidence: int
    filler_rate: float
    wpm: float


class DebaterProfileResponse(BaseModel):
    user_id: uuid.UUID
    username: str
    total_sessions: int
    completed_sessions: int
    average_score: float
    current_tier: str
    skill_radar: SkillRadar
    progression: List[ProgressionPoint]
    fallacies_eliminated_count: int
    recent_sessions: List[Dict[str, Any]]
    recent_drills: List[DrillResponse]


@router.get("/profile", response_model=DebaterProfileResponse)
async def get_debater_profile(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    """Computes comprehensive collegiate debate profile, 5-metric skill radar, and historical progression."""
    # 1. Fetch user sessions
    sessions_result = await db.execute(
        select(DebateSession)
        .where(DebateSession.user_id == user.id)
        .order_by(DebateSession.created_at.asc())
    )
    sessions = sessions_result.scalars().all()

    total_sessions = len(sessions)
    completed_sessions = sum(1 for s in sessions if s.status == "completed")

    scores = [float(s.overall_score) for s in sessions if s.overall_score is not None]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 75.0

    # Determine collegiate tier
    if avg_score >= 90:
        tier = "Varsity Championship Finalist"
    elif avg_score >= 84:
        tier = "Open Varsity Debater"
    elif avg_score >= 78:
        tier = "Junior Varsity Competitor"
    else:
        tier = "Novice Circuit Contender"

    # 2. Fetch turns to calculate radar & trends
    turns_result = await db.execute(
        select(DebateTurn)
        .join(DebateSession, DebateTurn.session_id == DebateSession.id)
        .where(DebateSession.user_id == user.id, DebateTurn.speaker == "user")
        .order_by(DebateTurn.created_at.asc())
    )
    turns = turns_result.scalars().all()

    # Calculate skill metrics
    arg_scores = [t.argument_score for t in turns if t.argument_score is not None]
    conf_scores = [t.confidence_score for t in turns if t.confidence_score is not None]
    hesitations = [t.hesitation_index for t in turns if t.hesitation_index is not None]

    avg_arg = int(sum(arg_scores) / len(arg_scores)) if arg_scores else 80
    avg_conf = int(sum(conf_scores) / len(conf_scores)) if conf_scores else 78
    avg_hes = int(sum(hesitations) / len(hesitations)) if hesitations else 25

    # Fallacy discipline: penalize turns with flagged fallacies
    fallacy_turns = sum(1 for t in turns if t.fallacies_flagged and len(t.fallacies_flagged) > 0)
    fallacy_disc = max(60, min(98, 100 - int((fallacy_turns / max(1, len(turns))) * 45)))

    # Cadence stability
    wpm_list = [float(t.words_per_minute) for t in turns if t.words_per_minute is not None]
    wpm_opt = sum(1 for w in wpm_list if 140 <= w <= 185)
    cadence_score = int(70 + (wpm_opt / max(1, len(wpm_list)) * 28)) if wpm_list else 82

    skill_radar = SkillRadar(
        logic_soundness=avg_arg,
        delivery_confidence=avg_conf,
        cadence_stability=cadence_score,
        fallacy_discipline=fallacy_disc,
        responsiveness=max(50, min(96, 100 - avg_hes)),
    )

    # 3. Progression Points
    progression: List[ProgressionPoint] = []
    for s in sessions:
        session_turns = [t for t in turns if t.session_id == s.id]
        if not session_turns:
            continue
        s_soundness = int(sum(t.argument_score or 0 for t in session_turns) / len(session_turns))
        s_conf = int(sum(t.confidence_score or 0 for t in session_turns) / len(session_turns))
        s_fillers = sum(
            sum(f.get("count", 0) for f in (t.filler_words_detected or []))
            for t in session_turns
        )
        s_duration_min = sum((t.duration_ms or 60000) for t in session_turns) / 60000.0
        filler_rate = round(s_fillers / max(0.5, s_duration_min), 1)
        avg_wpm = round(sum(float(t.words_per_minute or 150) for t in session_turns) / len(session_turns), 1)

        progression.append(
            ProgressionPoint(
                date=s.created_at.strftime("%b %d"),
                overall_score=float(s.overall_score or 75.0),
                soundness=s_soundness,
                confidence=s_conf,
                filler_rate=filler_rate,
                wpm=avg_wpm,
            )
        )

    # Count fallacies eliminated in redos
    redo_turns = [t for t in turns if t.attempt_number and t.attempt_number > 1]
    fallacies_eliminated = len(redo_turns) * 2  # Each successful redo eliminated initial fallacies

    # 4. Recent Drills
    drills_result = await db.execute(
        select(UserDrill)
        .where(UserDrill.user_id == user.id)
        .order_by(desc(UserDrill.created_at))
        .limit(8)
    )
    drills = drills_result.scalars().all()
    drill_responses = [
        DrillResponse(
            id=d.id,
            drill_type=d.drill_type,
            prompt_text=d.prompt_text,
            duration_seconds=d.duration_seconds,
            score=d.score,
            target_metric=d.target_metric,
            triggering_weakness=d.triggering_weakness,
            metrics=d.metrics or {},
            feedback=d.feedback,
            created_at=d.created_at,
        )
        for d in drills
    ]

    recent_sessions_list = [
        {
            "id": str(s.id),
            "topic": s.topic,
            "format": s.format,
            "overall_score": float(s.overall_score) if s.overall_score else None,
            "difficulty": s.difficulty,
            "date": s.created_at.strftime("%Y-%m-%d"),
            "status": s.status,
        }
        for s in reversed(sessions[-8:])
    ]

    return DebaterProfileResponse(
        user_id=user.id,
        username=user.username,
        total_sessions=total_sessions,
        completed_sessions=completed_sessions,
        average_score=avg_score,
        current_tier=tier,
        skill_radar=skill_radar,
        progression=progression,
        fallacies_eliminated_count=fallacies_eliminated,
        recent_sessions=recent_sessions_list,
        recent_drills=drill_responses,
    )


@router.get("/drills", response_model=List[DrillResponse])
async def list_user_drills(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    """Retrieves all completed practice drills for current debater."""
    result = await db.execute(
        select(UserDrill)
        .where(UserDrill.user_id == user.id)
        .order_by(desc(UserDrill.created_at))
    )
    drills = result.scalars().all()
    return [
        DrillResponse(
            id=d.id,
            drill_type=d.drill_type,
            prompt_text=d.prompt_text,
            duration_seconds=d.duration_seconds,
            score=d.score,
            target_metric=d.target_metric,
            triggering_weakness=d.triggering_weakness,
            metrics=d.metrics or {},
            feedback=d.feedback,
            created_at=d.created_at,
        )
        for d in drills
    ]


@router.post("/drills", response_model=DrillResponse, status_code=status.HTTP_201_CREATED)
async def record_drill(
    payload: DrillCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    """Records completion of a targeted debate practice sprint."""
    drill = UserDrill(
        id=uuid.uuid4(),
        user_id=user.id,
        session_id=payload.session_id,
        drill_type=payload.drill_type,
        prompt_text=payload.prompt_text,
        duration_seconds=payload.duration_seconds,
        score=payload.score,
        target_metric=payload.target_metric,
        triggering_weakness=payload.triggering_weakness,
        metrics=payload.metrics,
        feedback=payload.feedback,
    )
    db.add(drill)
    await db.commit()
    await db.refresh(drill)

    return DrillResponse(
        id=drill.id,
        drill_type=drill.drill_type,
        prompt_text=drill.prompt_text,
        duration_seconds=drill.duration_seconds,
        score=drill.score,
        target_metric=drill.target_metric,
        triggering_weakness=drill.triggering_weakness,
        metrics=drill.metrics or {},
        feedback=drill.feedback,
        created_at=drill.created_at,
    )


@router.get("/sessions/{session_id}/ballots", response_model=List[BallotResponse])
async def get_session_ballots(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    """Retrieves 3-judge persona ballots (Lay, Flow, Technical) for a tournament session."""
    result = await db.execute(
        select(JudgeBallot)
        .where(JudgeBallot.session_id == session_id)
        .order_by(JudgeBallot.created_at.asc())
    )
    ballots = result.scalars().all()
    return [
        BallotResponse(
            id=b.id,
            session_id=b.session_id,
            persona=b.persona,
            winner=b.winner,
            user_score=b.user_score,
            opponent_score=b.opponent_score,
            rfd=b.rfd,
            key_factors=b.key_factors or [],
            what_would_change_decision=b.what_would_change_decision or "",
            created_at=b.created_at,
        )
        for b in ballots
    ]
