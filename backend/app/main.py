import logging
import subprocess
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import init_db
from app.routers import (
    sessions_router,
    turns_router,
    chat_router,
    config_router,
    debate_game_router,
    profile_router,
)
from app.routers.auth import router as auth_router
from app.services.gemini import is_usable_api_key

PROMPT_VERSION = "2.2.0"
STARTED_AT = datetime.now(timezone.utc).isoformat()


def get_git_commit() -> str:
    try:
        out = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            stderr=subprocess.DEVNULL,
            timeout=2,
            text=True,
        ).strip()
        return out if out else "202d270"
    except Exception:
        return "202d270"


GIT_COMMIT = get_git_commit()

logging.basicConfig(
    level=logging.INFO if settings.environment == "production" else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("cross_ex")


@asynccontextmanager
async def lifespan(app: FastAPI):
    has_valid_key = is_usable_api_key(settings.gemini_api_key)
    mode = "live" if has_valid_key else "demo"

    # Log git commit, mode, and stale-server detection info at startup
    logger.info(
        "CrossEx API startup: commit=%s, started_at=%s, gemini_mode=%s, model=%s, prompt_version=%s",
        GIT_COMMIT,
        STARTED_AT,
        mode,
        settings.gemini_model,
        PROMPT_VERSION,
    )

    # Initialize DB tables on startup (especially handy for SQLite dev)
    logger.info("Initializing CrossEx Database tables...")
    try:
        await init_db()
        logger.info("Database initialized successfully.")
    except Exception as e:
        logger.warning(f"Database initialization deferred or failed: {e}")

    # Structured Startup Logging for Gemini Status
    if mode == "demo":
        logger.info("Gemini: demo (no valid API key configured; placeholder detected)")
    else:
        logger.info("Gemini: live (model: %s)", settings.gemini_model)
    logger.info(
        "Gemini model fallbacks: %s",
        ", ".join(settings.gemini_model_fallbacks) or "(none)",
    )

    yield
    logger.info("Shutting down CrossEx backend...")


app = FastAPI(
    title="CrossEx / DebateLab API",
    description="Multimodal Speech & Logic Adjudication Engine powered by Gemini 2.5",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware with local development regex support
origins = settings.cors_origins
if isinstance(origins, str):
    origins = [origins]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else [],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers
app.include_router(sessions_router)
app.include_router(turns_router)
app.include_router(chat_router)
app.include_router(config_router)
app.include_router(debate_game_router)
app.include_router(profile_router)
app.include_router(auth_router)


@app.get("/healthz", tags=["system"])
async def health_check():
    """Health check endpoint for liveness and stale-server detection."""
    has_valid_key = is_usable_api_key(settings.gemini_api_key)
    mode = "live" if has_valid_key else "demo"
    return {
        "status": "healthy",
        "service": "CrossEx Adjudication API",
        "git_commit": GIT_COMMIT,
        "started_at": STARTED_AT,
        "gemini_mode": mode,
        "prompt_version": PROMPT_VERSION,
        "gemini_model": settings.gemini_model,
        "gemini_model_fallbacks": list(settings.gemini_model_fallbacks),
        "environment": settings.environment,
    }


@app.get("/", tags=["system"])
async def root():
    """Root info endpoint."""
    return {
        "name": "CrossEx / DebateLab API",
        "version": "0.1.0",
        "docs_url": "/docs",
        "health": "/healthz",
    }
