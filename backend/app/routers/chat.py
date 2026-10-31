import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from app.services.gemini import GeminiEvaluator, GeminiLiveError, get_evaluator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatMessage(BaseModel):
    role: str = Field(..., description="'user' or 'assistant'")
    content: str = Field(..., description="Message text")


class DebateChatRequest(BaseModel):
    messages: List[ChatMessage]
    topic: Optional[str] = None
    thesis: Optional[str] = None
    current_transcript: Optional[str] = None
    fallacies: Optional[List[Dict[str, Any]]] = None
    rebuttal_text: Optional[str] = None


class DebateChatResponse(BaseModel):
    reply: str
    model: str = "gemini-3.8-flash"
    # True when the reply came from the local heuristic coach rather than Gemini.
    heuristic: bool = False


@router.post("", response_model=DebateChatResponse)
async def chat_with_adjudicator(
    req: DebateChatRequest,
    x_gemini_api_key: Optional[str] = Header(None, alias="X-Gemini-Api-Key"),
    evaluator: GeminiEvaluator = Depends(get_evaluator),
):
    """Interactive sparring and Socratic Q&A with the Gemini Adjudicator.

    When no API key is configured at all this runs on the local heuristic coach.
    When a key IS configured but the live call fails, the failure is returned as
    an error instead of being hidden behind a canned reply - otherwise a dead
    key looks exactly like a working one.
    """
    has_live_key = bool(
        evaluator.get_client(x_gemini_api_key)
    )
    try:
        reply_text = await evaluator.chat_sparring(
            messages=[{"role": m.role, "content": m.content} for m in req.messages],
            topic=req.topic,
            thesis=req.thesis,
            current_turn_transcript=req.current_transcript,
            fallacies=req.fallacies,
            rebuttal_text=req.rebuttal_text,
            override_key=x_gemini_api_key,
            raise_on_error=has_live_key,
        )
        if not has_live_key:
            return DebateChatResponse(
                reply=reply_text,
                model="adjudicator-heuristic",
                heuristic=True,
            )
        return DebateChatResponse(
            reply=reply_text,
            model=evaluator.active_model(x_gemini_api_key),
            heuristic=False,
        )
    except GeminiLiveError as exc:
        logger.error("Chat sparring live failure: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Chat sparring error: %s", exc, exc_info=True)
        if has_live_key:
            raise HTTPException(
                status_code=502,
                detail=f"Live Gemini call failed: {exc}",
            ) from exc
        topic_name = req.topic or "this debate"
        fallback_reply = (
            f"Regarding {topic_name}: when facing strict parliamentary adjudication, "
            "ensure every premise links directly to stakeholder impacts rather than moral assertions. "
            "How does your policy or position incentivize actors to change their status-quo behavior?"
        )
        return DebateChatResponse(
            reply=fallback_reply,
            model="fallback-rules",
            heuristic=True,
        )
