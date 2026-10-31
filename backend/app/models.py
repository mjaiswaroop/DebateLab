import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import (
    ForeignKey,
    String,
    Text,
    Integer,
    SmallInteger,
    Numeric,
    DateTime,
    CheckConstraint,
    UniqueConstraint,
    Index,
    func,
    JSON,
    Uuid,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

# Use JSON with PostgreSQL JSONB variant for compatibility across PostgreSQL and SQLite
JSON_TYPE = JSON().with_variant(JSONB, "postgresql")


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    sessions: Mapped[List["DebateSession"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    drills: Mapped[List["UserDrill"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class DebateSession(Base):
    __tablename__ = "debate_sessions"
    __table_args__ = (Index("ix_sessions_user_created", "user_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    topic: Mapped[str] = mapped_column(Text)
    user_side: Mapped[str] = mapped_column(
        String(12), default="government", server_default="government", nullable=False
    )
    initial_thesis: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    difficulty: Mapped[str] = mapped_column(String(12), default="intermediate")

    format: Mapped[str] = mapped_column(String(24), default="parliamentary")  # parliamentary, public_forum, lincoln_douglas
    target_wpm_min: Mapped[int] = mapped_column(SmallInteger, default=160)
    target_wpm_max: Mapped[int] = mapped_column(SmallInteger, default=200)
    overall_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
    status: Mapped[str] = mapped_column(String(12), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped[User] = relationship(back_populates="sessions")
    turns: Mapped[List["DebateTurn"]] = relationship(
        back_populates="session",
        order_by="DebateTurn.turn_number, DebateTurn.speaker.desc(), DebateTurn.attempt_number.asc()",
        cascade="all, delete-orphan",
    )
    ballots: Mapped[List["JudgeBallot"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
    )


class DebateTurn(Base):
    __tablename__ = "debate_turns"
    __table_args__ = (
        UniqueConstraint("session_id", "turn_number", "speaker", "attempt_number"),
        CheckConstraint("speaker IN ('user','assistant')"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("debate_sessions.id", ondelete="CASCADE"))
    parent_turn_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("debate_turns.id", ondelete="SET NULL"), nullable=True)
    turn_number: Mapped[int] = mapped_column(Integer)
    attempt_number: Mapped[int] = mapped_column(SmallInteger, default=1)
    speaker: Mapped[str] = mapped_column(String(10))
    user_transcript: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    filler_words_detected: Mapped[list] = mapped_column(JSON_TYPE, default=list)
    fallacies_flagged: Mapped[list] = mapped_column(JSON_TYPE, default=list)
    pauses_detected: Mapped[list] = mapped_column(JSON_TYPE, default=list)
    verified_fallacy_count: Mapped[Optional[int]] = mapped_column(SmallInteger, default=0, nullable=True)
    total_fallacy_count: Mapped[Optional[int]] = mapped_column(SmallInteger, default=0, nullable=True)
    confidence_score: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    argument_score: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    hesitation_index: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    words_per_minute: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 1), nullable=True)
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    rebuttal_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    raw_evaluation: Mapped[Optional[dict]] = mapped_column(JSON_TYPE, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped[DebateSession] = relationship(back_populates="turns")
    parent_turn: Mapped[Optional["DebateTurn"]] = relationship("DebateTurn", remote_side=[id], backref="redos")


class UserDrill(Base):
    __tablename__ = "user_drills"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    session_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("debate_sessions.id", ondelete="SET NULL"), nullable=True)
    drill_type: Mapped[str] = mapped_column(String(30))  # filler_free_60, fallacy_repair, impact_sprint, poi_reflex
    prompt_text: Mapped[str] = mapped_column(Text)
    duration_seconds: Mapped[int] = mapped_column(Integer)
    score: Mapped[int] = mapped_column(SmallInteger)
    target_metric: Mapped[str] = mapped_column(String(30))  # fillers, fallacy, impact, responsiveness
    triggering_weakness: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    metrics: Mapped[dict] = mapped_column(JSON_TYPE, default=dict)
    feedback: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[User] = relationship(back_populates="drills")


class JudgeBallot(Base):
    __tablename__ = "judge_ballots"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("debate_sessions.id", ondelete="CASCADE"))
    persona: Mapped[str] = mapped_column(String(20))  # 'lay', 'flow', 'technical'
    winner: Mapped[str] = mapped_column(String(20))
    user_score: Mapped[int] = mapped_column(SmallInteger)
    opponent_score: Mapped[int] = mapped_column(SmallInteger)
    rfd: Mapped[str] = mapped_column(Text)
    key_factors: Mapped[list] = mapped_column(JSON_TYPE, default=list)
    what_would_change_decision: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped[DebateSession] = relationship(back_populates="ballots")
