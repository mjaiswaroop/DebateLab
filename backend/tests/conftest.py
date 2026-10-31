import uuid
from typing import AsyncGenerator, Optional
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.auth import current_user
from app.db import get_db
from app.main import app
from app.models import Base, User
from app.schemas.evaluation import (
    DebateEvaluationResponse,
    DeliveryAnalysis,
    Fallacy,
    FallacyType,
    FillerWord,
    LogicAnalysis,
)
from app.services.gemini import GeminiEvaluator, get_evaluator

# In-memory SQLite for high-speed test isolation
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

TestingSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestingSessionLocal() as session:
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> User:
    user = User(
        id=uuid.uuid4(),
        username="tester",
        email="tester@debatelab.test",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


from unittest.mock import MagicMock

class MockGeminiEvaluator(GeminiEvaluator):
    def __init__(self) -> None:
        self.api_key = "mock_key_for_testing"
        self.model = "gemini-2.5-flash"
        self.client = MagicMock()

    def get_client(self, override_key: Optional[str] = None):
        return self.client

    async def evaluate(self, **kwargs) -> DebateEvaluationResponse:

        return DebateEvaluationResponse(
            speech_detected=True,
            transcript="I firmly believe that social media algorithms inherently optimize for moral outrage, degrade public discourse, and everyone on these platforms becomes polarized.",
            delivery=DeliveryAnalysis(
                confidence_score=78,
                hesitation_index=22,
                filler_words=[
                    FillerWord(word="um", count=2),
                    FillerWord(word="like", count=1),
                ],
                pacing="good",
                vocal_observations=[
                    "Strong pacing during opening thesis.",
                    "Slight pitch uptick when concluding.",
                ],
            ),
            logic=LogicAnalysis(
                argument_score=82,
                claim_summary="Social media algorithms optimize for outrage, harming civil discourse.",
                premises=[
                    "Algorithmic incentives prioritize engagement over accuracy.",
                    "Outrage generates the highest engagement metrics.",
                ],
                fallacies=[
                    Fallacy(
                        type=FallacyType.hasty_generalization,
                        quote="everyone on these platforms becomes polarized",
                        explanation="Sweeping generalization about entire user bases without empirical qualification.",
                        severity="minor",
                        fix="Qualify with 'statistically significant segments of users'.",
                    )
                ],
                strongest_point="Causal connection between engagement metrics and viral polarization.",
                weakest_point="Underestimation of positive community formation online.",
                unaddressed_counterarguments=[
                    "Community-driven moderation and user-directed curation mechanisms."
                ],
            ),
            rebuttal_text="While engagement algorithms do amplify polarizing sentiments, attributing total societal degradation to recommendation engines overlooks pre-existing societal fissures and user self-selection.",
            socratic_question="If algorithms merely reflect human engagement, is the flaw in the machine or the audience?",
            coaching_tips=[
                "Ground your premise on user polarization with peer-reviewed research.",
                "Maintain steady volume on terminal clauses.",
                "Avoid universal generalizations like 'everyone'.",
            ],
        )


@pytest_asyncio.fixture
async def async_client(
    db_session: AsyncSession, test_user: User
) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db():
        yield db_session

    def override_evaluator():
        return MockGeminiEvaluator()

    async def override_current_user():
        return test_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_evaluator] = override_evaluator
    app.dependency_overrides[current_user] = override_current_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()
