import os
import logging
from typing import Dict, Optional
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.services.gemini import (
    GeminiEvaluator,
    get_evaluator,
    is_usable_api_key,
    normalize_api_key,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/config", tags=["config"])


class ConfigStatusResponse(BaseModel):
    gemini_configured: bool
    # True once the key has actually been proven to work against the Gemini API.
    gemini_verified: bool = False
    model: str
    environment: str
    active_model: Optional[str] = None
    source: str = "none"  # "server" | "client" | "none"


class SetApiKeyRequest(BaseModel):
    api_key: str


class SetApiKeyResponse(BaseModel):
    success: bool
    message: str
    gemini_configured: bool
    model: Optional[str] = None


class TestApiKeyRequest(BaseModel):
    api_key: str


class TestApiKeyResponse(BaseModel):
    valid: bool
    message: str
    error: Optional[str] = None
    model: str = "gemini-3.8-flash"
    auth_error: bool = False
    model_error: bool = False


def _env_path() -> str:
    """Absolute path to the backend .env file."""
    backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(backend_root, ".env")


def _persist_env(values: Dict[str, str]) -> None:
    """Upserts key/value pairs into backend/.env without duplicating entries."""
    env_path = _env_path()
    if not os.path.exists(env_path):
        return
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        remaining = dict(values)
        updated: list[str] = []
        for line in lines:
            stripped = line.strip()
            key = stripped.split("=", 1)[0].strip() if "=" in stripped else None
            if key in remaining:
                if key not in [u.split("=", 1)[0].strip() for u in updated]:
                    updated.append(f"{key}={remaining.pop(key)}\n")
                # Drop any further duplicates of the same key.
                continue
            updated.append(line)

        # Append keys that were not present in the file.
        for key, value in remaining.items():
            updated.append(f"{key}={value}\n")

        with open(env_path, "w", encoding="utf-8") as f:
            f.writelines(updated)
        logger.info("Updated %s in .env file: %s", ", ".join(values.keys()), env_path)
    except Exception as e:
        logger.warning(f"Could not persist values to .env: {e}")


@router.get("/status", response_model=ConfigStatusResponse)
async def get_config_status(
    x_gemini_api_key: Optional[str] = Header(None, alias="X-Gemini-Api-Key"),
    evaluator: GeminiEvaluator = Depends(get_evaluator),
):
    """Returns the current backend configuration status for Gemini.

    A key supplied by the browser (`X-Gemini-Api-Key`) counts as configured even
    when the server has no key of its own, because every adjudication endpoint
    forwards that override key to Gemini.

    A key that Gemini has already rejected is never reported as configured -
    otherwise the UI would show "Active" next to a key that cannot work.
    """
    server_key = normalize_api_key(settings.gemini_api_key)
    client_key = normalize_api_key(x_gemini_api_key)

    # The browser's key wins: every request it makes overrides the server key,
    # so the status must describe the key that will actually be used.
    if client_key:
        source = "client"
        configured = evaluator.is_key_usable(client_key)
        verified = evaluator.is_key_verified(client_key)
        active_model = evaluator.active_model(client_key)
    elif evaluator.is_key_usable(server_key):
        source = "server"
        configured = True
        verified = evaluator.is_key_verified(server_key)
        active_model = evaluator.active_model(server_key)
    else:
        source = "none"
        configured = False
        verified = False
        active_model = evaluator.active_model()

    return ConfigStatusResponse(
        gemini_configured=configured,
        gemini_verified=verified,
        model=settings.gemini_model,
        environment=settings.environment,
        active_model=active_model,
        source=source,
    )


@router.post("/test-key", response_model=TestApiKeyResponse)
async def test_gemini_api_key(
    payload: TestApiKeyRequest,
    evaluator: GeminiEvaluator = Depends(get_evaluator),
):
    """Makes a fast minimal call to verify an API key without modifying active backend state."""
    result = await evaluator.validate_key(payload.api_key)

    if result["valid"]:
        return TestApiKeyResponse(
            valid=True,
            message=f"Key verified successfully! Gemini {result['model']} responded.",
            model=result["model"],
        )

    if result.get("model_error"):
        return TestApiKeyResponse(
            valid=False,
            message=(
                "The API key authenticated, but the configured model is not served for it. "
                "The backend will fall back to an available model."
            ),
            error=result.get("error"),
            model=settings.gemini_model,
            model_error=True,
        )

    return TestApiKeyResponse(
        valid=False,
        message="Gemini API validation failed.",
        error=result.get("error"),
        model=settings.gemini_model,
        auth_error=bool(result.get("auth_error")),
    )


@router.post("/key", response_model=SetApiKeyResponse)
async def set_gemini_api_key(
    payload: SetApiKeyRequest,
    evaluator: GeminiEvaluator = Depends(get_evaluator),
):
    """Dynamically set and test a Gemini API key at runtime."""
    raw_key = normalize_api_key(payload.api_key)
    if not is_usable_api_key(raw_key):
        raise HTTPException(status_code=400, detail="Invalid API key format or placeholder detected.")

    # Test the API key with a fast validation call. This distinguishes an
    # invalid key from a retired model, which are very different problems.
    result = await evaluator.validate_key(raw_key)
    if not result["valid"]:
        if result.get("model_error"):
            raise HTTPException(
                status_code=400,
                detail=(
                    "The API key authenticated, but model "
                    f"'{settings.gemini_model}' is not served for it. "
                    "Update GEMINI_MODEL to a currently supported model."
                ),
            )
        raise HTTPException(
            status_code=400,
            detail=f"Gemini API key validation failed: {result.get('error')}",
        )

    # Key is valid, update runtime settings and evaluator
    settings.gemini_api_key = raw_key
    evaluator.set_api_key(raw_key)
    resolved_model = result.get("model") or evaluator.active_model(raw_key)

    # `set_api_key` clears the verification flag (a new key has not been proven
    # yet) - but this key *was* just proven, so restore it.
    evaluator.mark_verified(raw_key, resolved_model)

    # If the configured model is retired we switch to the one that actually
    # works so the very next request (and the next restart) behaves the same.
    if resolved_model and resolved_model != settings.gemini_model:
        logger.warning(
            "Model '%s' is not served for this key; switching GEMINI_MODEL to '%s'.",
            settings.gemini_model,
            resolved_model,
        )
        settings.gemini_model = resolved_model
        evaluator.model = resolved_model

    # Persist into .env so the key survives a backend restart.
    _persist_env({"GEMINI_API_KEY": raw_key, "GEMINI_MODEL": settings.gemini_model})

    return SetApiKeyResponse(
        success=True,
        message=f"Gemini API key validated and activated successfully on {settings.gemini_model}.",
        gemini_configured=True,
        model=settings.gemini_model,
    )
