from .sessions import router as sessions_router
from .turns import router as turns_router
from .chat import router as chat_router
from .config import router as config_router
from .debate_game import router as debate_game_router
from .profile import router as profile_router
from .auth import router as auth_router

__all__ = [
    "sessions_router",
    "turns_router",
    "chat_router",
    "config_router",
    "debate_game_router",
    "profile_router",
    "auth_router",
]

