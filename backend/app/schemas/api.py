import uuid
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.evaluation import (
    DebateEvaluationResponse,
    DeliveryAnalysis,
    FillerWord,
    LogicAnalysis,
)


class ExtendedDeliveryAnalysis(BaseModel):
    confidence_score: int
    hesitation_index: int
    filler_words: List[FillerWord]
    filler_total: int
    words_per_minute: float
    pacing: Literal["too_slow", "slightly_slow", "good", "slightly_fast", "too_fast"]
    vocal_observations: List[str]


class TurnResponse(BaseModel):
    turn_number: int
    attempt_number: int = 1
    parent_turn_id: Optional[uuid.UUID] = None
    speech_detected: bool
    transcript: str
    delivery: ExtendedDeliveryAnalysis
    logic: LogicAnalysis
    rebuttal_text: str
    socratic_question: str
    coaching_tips: List[str]
    session_overall_score: Optional[float] = None
    pauses_detected: List[Dict[str, Any]] = Field(default_factory=list)
    verified_fallacy_count: int = 0
    total_fallacy_count: int = 0
    redo_delta: Optional[Dict[str, Any]] = None

    @classmethod
    def from_evaluation(
        cls,
        ev: DebateEvaluationResponse,
        turn_number: int,
        wpm: float,
        filler_total: int,
        session_overall_score: Optional[float] = None,
        attempt_number: int = 1,
        parent_turn_id: Optional[uuid.UUID] = None,
        pauses_detected: Optional[List[Dict[str, Any]]] = None,
        verified_fallacy_count: int = 0,
        total_fallacy_count: int = 0,
        redo_delta: Optional[Dict[str, Any]] = None,
    ) -> "TurnResponse":
        extended_delivery = ExtendedDeliveryAnalysis(
            confidence_score=ev.delivery.confidence_score,
            hesitation_index=ev.delivery.hesitation_index,
            filler_words=ev.delivery.filler_words,
            filler_total=filler_total,
            words_per_minute=wpm,
            pacing=ev.delivery.pacing,
            vocal_observations=ev.delivery.vocal_observations,
        )
        return cls(
            turn_number=turn_number,
            attempt_number=attempt_number,
            parent_turn_id=parent_turn_id,
            speech_detected=ev.speech_detected,
            transcript=ev.transcript,
            delivery=extended_delivery,
            logic=ev.logic,
            rebuttal_text=ev.rebuttal_text,
            socratic_question=ev.socratic_question,
            coaching_tips=ev.coaching_tips,
            session_overall_score=session_overall_score,
            pauses_detected=pauses_detected or [],
            verified_fallacy_count=verified_fallacy_count,
            total_fallacy_count=total_fallacy_count,
            redo_delta=redo_delta,
        )


class SessionCreate(BaseModel):
    topic: str = Field(..., min_length=3, max_length=500)
    user_side: Literal["government", "opposition"] = "government"
    difficulty: Literal["novice", "intermediate", "advanced"] = "intermediate"
    format: str = "parliamentary"
    target_wpm_min: Optional[int] = 140
    target_wpm_max: Optional[int] = 180
    initial_thesis: Optional[str] = Field(None, max_length=1000)


class SessionResponse(BaseModel):
    id: uuid.UUID
    topic: str
    user_side: str = "government"
    format: str = "parliamentary"
    target_wpm_min: int = 140
    target_wpm_max: int = 180
    initial_thesis: Optional[str] = None
    difficulty: str
    status: str
    overall_score: Optional[float] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)



class TrendPoint(BaseModel):
    turn_number: int
    confidence: Optional[int] = None
    argument: Optional[int] = None
    hesitation: Optional[int] = None
    filler_total: int = 0
    wpm: Optional[float] = None


class TurnHistoryItem(BaseModel):
    id: uuid.UUID
    turn_number: int
    attempt_number: int = 1
    parent_turn_id: Optional[uuid.UUID] = None
    speaker: str
    user_transcript: Optional[str] = None
    rebuttal_text: Optional[str] = None
    confidence_score: Optional[int] = None
    argument_score: Optional[int] = None
    hesitation_index: Optional[int] = None
    words_per_minute: Optional[float] = None
    duration_ms: Optional[int] = None
    filler_words_detected: List[Any] = []
    fallacies_flagged: List[Any] = []
    pauses_detected: List[Any] = []
    verified_fallacy_count: int = 0
    total_fallacy_count: int = 0
    redo_delta: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SessionDetailResponse(SessionResponse):
    turns: List[TurnHistoryItem] = []
    trend: List[TrendPoint] = []
