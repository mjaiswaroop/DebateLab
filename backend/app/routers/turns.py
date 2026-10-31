import json
import uuid
import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from google.genai import errors as genai_errors

from app.auth import current_user
from app.config import settings
from app.db import get_db
from app.models import DebateSession, DebateTurn, User
from app.schemas.api import TurnResponse
from app.schemas.evaluation import Fallacy
from app.services.gemini import GeminiEvaluator, get_evaluator
from app.services.quote_verifier import verify_and_align_quotes
from app.services.delta_calculator import compute_turn_delta

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["turns"])

ALLOWED_MIME_TYPES = {
    "audio/webm",
    "audio/ogg",
    "audio/mp4",
    "audio/mpeg",
    "audio/wav",
    "audio/x-wav",
    "audio/flac",
    "audio/m4a",
    "audio/x-m4a",
}


def _sniff_ok(b: bytes, mime: str) -> bool:
    """Cheap magic-byte check to verify audio content before forwarding to Gemini."""
    if len(b) < 8:
        return False
    if mime == "audio/webm":
        return b[:4] == b"\x1a\x45\xdf\xa3"  # EBML header
    if mime == "audio/ogg":
        return b[:4] == b"OggS"
    if mime in ("audio/mp4", "audio/m4a", "audio/x-m4a"):
        return b[4:8] == b"ftyp"
    if mime in ("audio/wav", "audio/x-wav"):
        return b[:4] == b"RIFF"
    if mime == "audio/flac":
        return b[:4] == b"fLaC"
    if mime == "audio/mpeg":
        return b[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2") or b[:3] == b"ID3"
    return True


async def _read_capped(upload: UploadFile) -> bytes:
    """Reads uploaded audio stream in chunks up to max configured bytes."""
    buf = bytearray()
    while chunk := await upload.read(256 * 1024):
        buf.extend(chunk)
        if len(buf) > settings.max_audio_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Audio exceeds {settings.max_audio_bytes // (1024 * 1024)} MB limit.",
            )
    return bytes(buf)


def _clamp(val: Optional[int]) -> int:
    if val is None:
        return 0
    return max(0, min(100, int(val)))


@router.post("/evaluate", response_model=TurnResponse)
async def evaluate_stateless(
    audio: UploadFile = File(...),
    duration_ms: int = Form(...),
    topic: str = Form("General Parliamentary Debate"),
    difficulty: str = Form("intermediate"),
    thesis: Optional[str] = Form(None),
    pauses: Optional[str] = Form(None),
    x_gemini_api_key: Optional[str] = Header(None, alias="X-Gemini-Api-Key"),
    evaluator: GeminiEvaluator = Depends(get_evaluator),
):
    """Phase 1 Stateless evaluation endpoint: accepts audio and returns complete score & critique."""
    raw_content_type = audio.content_type or "audio/webm"
    mime = raw_content_type.split(";")[0].strip().lower()
    if mime not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported audio type '{mime}'. Allowed: {', '.join(sorted(ALLOWED_MIME_TYPES))}",
        )

    if not (settings.min_duration_ms <= duration_ms <= settings.max_duration_ms):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Recording must be between {settings.min_duration_ms // 1000}s and {settings.max_duration_ms // 1000}s.",
        )

    data = await _read_capped(audio)
    if not data or not _sniff_ok(data, mime):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Audio file is empty or corrupted.",
        )

    active_client = evaluator.get_client(x_gemini_api_key)
    if not active_client:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Spoken turns need a live Gemini key",
        )

    side_note = f"The speaker's opening thesis: {thesis}" if thesis else ""
    try:
        ev = await evaluator.evaluate(
            audio=data,
            mime_type=mime,
            topic=topic,
            difficulty=difficulty,
            side_note=side_note,
            history=[],
            thesis=thesis,
            override_key=x_gemini_api_key,
        )
    except ValueError as e:
        err_msg = str(e)
        if "Spoken turns need a live Gemini key" in err_msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Spoken turns need a live Gemini key",
            )
        if "Topical guard failed" in err_msg:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=err_msg,
            )
        logger.error(f"Adjudication evaluation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"The adjudication service failed: {err_msg}",
        ) from e
    except (genai_errors.APIError, TimeoutError) as e:
        logger.error(f"Adjudication evaluation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"The adjudication service failed: {str(e)}",
        ) from e

    if not ev.speech_detected or not ev.transcript.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No intelligible speech detected. Check your microphone and try again.",
        )


    words = len(ev.transcript.split())
    wpm = round(words / (max(1, duration_ms) / 60_000), 1)
    filler_total = sum(f.count for f in ev.delivery.filler_words)

    ev.delivery.confidence_score = _clamp(ev.delivery.confidence_score)
    ev.delivery.hesitation_index = _clamp(ev.delivery.hesitation_index)
    ev.logic.argument_score = _clamp(ev.logic.argument_score)

    overall_score = round(
        (ev.delivery.confidence_score + ev.logic.argument_score) / 2.0, 1
    )

    # Server-side quote verification: discard unverified fallacies and calculate offsets
    raw_fallacies = [f.model_dump(mode="json") for f in ev.logic.fallacies]
    verified_fallacies, verified_count, total_count = verify_and_align_quotes(
        ev.transcript, raw_fallacies
    )
    ev.logic.fallacies = [Fallacy(**vf) for vf in verified_fallacies]

    # Parse client-side measured pauses from AnalyserNode
    pauses_list = []
    if pauses:
        try:
            pauses_list = json.loads(pauses)
        except Exception:
            pauses_list = []

    return TurnResponse.from_evaluation(
        ev,
        turn_number=1,
        wpm=wpm,
        filler_total=filler_total,
        session_overall_score=overall_score,
        pauses_detected=pauses_list,
        verified_fallacy_count=verified_count,
        total_fallacy_count=total_count,
    )


@router.post("/sessions/{session_id}/turn", response_model=TurnResponse)
async def submit_turn(
    session_id: uuid.UUID,
    audio: UploadFile = File(...),
    duration_ms: int = Form(...),
    pauses: Optional[str] = Form(None),
    parent_turn_id: Optional[uuid.UUID] = Form(None),
    x_gemini_api_key: Optional[str] = Header(None, alias="X-Gemini-Api-Key"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
    evaluator: GeminiEvaluator = Depends(get_evaluator),
):
    """Submits an audio turn for an existing debate session, saving evaluation and assistant rebuttal."""
    raw_content_type = audio.content_type or "audio/webm"
    mime = raw_content_type.split(";")[0].strip().lower()
    if mime not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported audio type '{mime}'. Allowed: {', '.join(sorted(ALLOWED_MIME_TYPES))}",
        )

    if not (settings.min_duration_ms <= duration_ms <= settings.max_duration_ms):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Recording must be between {settings.min_duration_ms // 1000}s and {settings.max_duration_ms // 1000}s.",
        )

    data = await _read_capped(audio)
    if not data or not _sniff_ok(data, mime):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Audio is empty or corrupt.",
        )

    active_client = evaluator.get_client(x_gemini_api_key)
    if not active_client:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Spoken turns need a live Gemini key",
        )

    # Load session and context (short read; no lock held during external Gemini call)
    result = await db.execute(
        select(DebateSession).where(
            DebateSession.id == session_id, DebateSession.user_id == user.id
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")
    if session.status != "active":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Session is {session.status}, not active.",
        )

    # Resolve parent turn and attempt number before calling evaluator
    parent_turn = None
    if parent_turn_id:
        parent_result = await db.execute(
            select(DebateTurn).where(
                DebateTurn.id == parent_turn_id,
                DebateTurn.session_id == session_id,
                DebateTurn.speaker == "user",
            )
        )
        parent_turn = parent_result.scalar_one_or_none()
        if parent_turn is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Parent turn {parent_turn_id} not found in this session.",
            )
        turn_number = parent_turn.turn_number
        attempt_number = (parent_turn.attempt_number or 1) + 1
    else:
        last_turn_result = await db.execute(
            select(func.coalesce(func.max(DebateTurn.turn_number), 0)).where(
                DebateTurn.session_id == session_id
            )
        )
        turn_number = last_turn_result.scalar_one() + 1
        attempt_number = 1

    # Blind redo grading: evaluation prompt must NOT include original scores or critique text.
    # If this is a redo, include only previous completed rounds (turn_number < current turn_number) in history.
    prior_query = select(DebateTurn).where(DebateTurn.session_id == session_id)
    if parent_turn_id:
        prior_query = prior_query.where(DebateTurn.turn_number < turn_number)
    prior_query = prior_query.order_by(DebateTurn.turn_number.desc(), DebateTurn.speaker.asc()).limit(6)

    prior_turns_result = await db.execute(prior_query)
    prior_turns = list(reversed(prior_turns_result.scalars().all()))
    history = [
        {
            "speaker": t.speaker,
            "text": (t.user_transcript if t.speaker == "user" else t.rebuttal_text) or "",
        }
        for t in prior_turns
    ]

    # Explicit user_side from session column (no parsing of initial_thesis to infer side)
    user_side = getattr(session, "user_side", "government") or "government"
    speaker_side = (
        "Opposition / Negative"
        if user_side.lower() == "opposition"
        else "Government / Affirmative"
    )
    thesis_part = f"\nThe speaker's opening thesis: {session.initial_thesis}" if session.initial_thesis else ""
    side_note = f"SPEAKER ROLE: {speaker_side}{thesis_part}"
    topic, difficulty = session.topic, session.difficulty

    # Call Gemini model
    try:
        ev = await evaluator.evaluate(
            audio=data,
            mime_type=mime,
            topic=topic,
            difficulty=difficulty,
            side_note=side_note,
            history=history,
            user_side=user_side,
            round_number=turn_number,
            thesis=session.initial_thesis,
            override_key=x_gemini_api_key,
        )
    except ValueError as e:
        err_msg = str(e)
        if "Spoken turns need a live Gemini key" in err_msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Spoken turns need a live Gemini key",
            )
        if "Topical guard failed" in err_msg:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=err_msg,
            )
        logger.error(f"Gemini adjudication failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"The adjudication service failed: {err_msg}",
        ) from e
    except (genai_errors.APIError, TimeoutError) as e:
        logger.error(f"Gemini adjudication failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The adjudication service failed. Please retry.",
        ) from e


    if not ev.speech_detected or not ev.transcript.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No intelligible speech detected. Check your microphone and try again.",
        )

    # Derive server-side metrics
    words = len(ev.transcript.split())
    wpm = round(words / (max(1, duration_ms) / 60_000), 1)
    filler_total = sum(f.count for f in ev.delivery.filler_words)

    ev.delivery.confidence_score = _clamp(ev.delivery.confidence_score)
    ev.delivery.hesitation_index = _clamp(ev.delivery.hesitation_index)
    ev.logic.argument_score = _clamp(ev.logic.argument_score)

    # Server-side quote verification: discard unverified fallacies and calculate offsets
    raw_fallacies = [f.model_dump(mode="json") for f in ev.logic.fallacies]
    verified_fallacies, verified_count, total_count = verify_and_align_quotes(
        ev.transcript, raw_fallacies
    )
    ev.logic.fallacies = [Fallacy(**vf) for vf in verified_fallacies]

    # Parse client-side measured pauses from AnalyserNode
    pauses_list = []
    if pauses:
        try:
            pauses_list = json.loads(pauses)
        except Exception:
            pauses_list = []

    # Persist turns and update overall score
    lock_stmt = select(DebateSession).where(DebateSession.id == session_id)
    bind_engine = db.bind or db.connection()
    if hasattr(bind_engine, "dialect") and bind_engine.dialect.name != "sqlite":
        lock_stmt = lock_stmt.with_for_update()

    locked_session = (await db.execute(lock_stmt)).scalar_one()

    redo_delta = None

    user_turn = DebateTurn(
        session_id=session_id,
        turn_number=turn_number,
        speaker="user",
        parent_turn_id=parent_turn_id,
        attempt_number=attempt_number,
        user_transcript=ev.transcript,
        filler_words_detected=[f.model_dump() for f in ev.delivery.filler_words],
        fallacies_flagged=[f.model_dump(mode="json") for f in ev.logic.fallacies],
        confidence_score=ev.delivery.confidence_score,
        argument_score=ev.logic.argument_score,
        hesitation_index=ev.delivery.hesitation_index,
        words_per_minute=wpm,
        duration_ms=duration_ms,
        pauses_detected=pauses_list,
        verified_fallacy_count=verified_count,
        total_fallacy_count=total_count,
        raw_evaluation=ev.model_dump(mode="json"),
    )

    if parent_turn_id and parent_turn:
        redo_delta = compute_turn_delta(parent_turn, user_turn)
    assistant_turn = DebateTurn(
        session_id=session_id,
        turn_number=turn_number,
        speaker="assistant",
        parent_turn_id=None,
        attempt_number=attempt_number,
        rebuttal_text=ev.rebuttal_text,
    )
    db.add_all([user_turn, assistant_turn])
    await db.flush()

    avg_score_result = await db.execute(
        select(
            func.avg((DebateTurn.confidence_score + DebateTurn.argument_score) / 2.0)
        ).where(DebateTurn.session_id == session_id, DebateTurn.speaker == "user")
    )
    calculated_avg = avg_score_result.scalar_one()
    locked_session.overall_score = calculated_avg
    await db.commit()

    return TurnResponse.from_evaluation(
        ev,
        turn_number=turn_number,
        attempt_number=attempt_number,
        parent_turn_id=parent_turn_id,
        wpm=wpm,
        filler_total=filler_total,
        session_overall_score=float(calculated_avg) if calculated_avg is not None else None,
        pauses_detected=pauses_list,
        verified_fallacy_count=verified_count,
        total_fallacy_count=total_count,
        redo_delta=redo_delta,
    )
