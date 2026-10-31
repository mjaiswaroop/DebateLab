import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import current_user
from app.db import get_db
from app.models import DebateSession, DebateTurn, User
from app.schemas.api import (
    SessionCreate,
    SessionDetailResponse,
    SessionResponse,
    TrendPoint,
    TurnHistoryItem,
)
from app.services.delta_calculator import compute_turn_delta

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    payload: SessionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    """Creates a new debate session for the current user."""
    session = DebateSession(
        user_id=user.id,
        topic=payload.topic,
        user_side=payload.user_side or "government",
        initial_thesis=payload.initial_thesis,
        difficulty=payload.difficulty,
        format=payload.format or "parliamentary",
        target_wpm_min=payload.target_wpm_min or 140,
        target_wpm_max=payload.target_wpm_max or 180,
        status="active",
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session



@router.get("", response_model=List[SessionResponse])
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    """Retrieves all debate sessions belonging to the current user."""
    result = await db.execute(
        select(DebateSession)
        .where(DebateSession.user_id == user.id)
        .order_by(desc(DebateSession.created_at))
    )
    return result.scalars().all()


@router.get("/{session_id}", response_model=SessionDetailResponse)
async def get_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    """Retrieves session details, chronological turns, and derived metric trends."""
    result = await db.execute(
        select(DebateSession).where(
            DebateSession.id == session_id, DebateSession.user_id == user.id
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Session not found."
        )

    turns_result = await db.execute(
        select(DebateTurn)
        .where(DebateTurn.session_id == session_id)
        .order_by(DebateTurn.turn_number.asc(), DebateTurn.speaker.desc())
    )
    turns = turns_result.scalars().all()

    # Calculate trends per user turn
    trend: List[TrendPoint] = []
    user_turns = [t for t in turns if t.speaker == "user"]
    for ut in user_turns:
        filler_total = sum(
            f.get("count", 0) for f in (ut.filler_words_detected or [])
        )
        trend.append(
            TrendPoint(
                turn_number=ut.turn_number,
                confidence=ut.confidence_score,
                argument=ut.argument_score,
                hesitation=ut.hesitation_index,
                filler_total=filler_total,
                wpm=float(ut.words_per_minute) if ut.words_per_minute is not None else None,
            )
        )

    turns_by_id = {t.id: t for t in turns}
    turn_items = []
    for t in turns:
        item = TurnHistoryItem.model_validate(t)
        if t.parent_turn_id and t.parent_turn_id in turns_by_id:
            parent = turns_by_id[t.parent_turn_id]
            item.redo_delta = compute_turn_delta(parent, t)
        turn_items.append(item)

    return SessionDetailResponse(
        id=session.id,
        topic=session.topic,
        format=session.format or "parliamentary",
        target_wpm_min=session.target_wpm_min or 140,
        target_wpm_max=session.target_wpm_max or 180,
        initial_thesis=session.initial_thesis,
        difficulty=session.difficulty,
        status=session.status,
        overall_score=float(session.overall_score) if session.overall_score is not None else None,
        created_at=session.created_at,
        updated_at=session.updated_at,
        completed_at=session.completed_at,
        turns=turn_items,
        trend=trend,
    )


@router.patch("/{session_id}/complete", response_model=SessionResponse)
async def complete_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    """Marks an active debate session as completed."""
    result = await db.execute(
        select(DebateSession).where(
            DebateSession.id == session_id, DebateSession.user_id == user.id
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    session.status = "completed"
    session.completed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(session)
    return session
