import json
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    gemini_api_key: str = ""
    # NOTE: the Gemini 2.5 family is closed to new API keys and reached its
    # shutdown date on 2026-10-20. New projects must use a 3.x model.
    gemini_model: str = "gemini-3.8-flash"
    # Ordered fallbacks used when the configured model is retired or is not
    # available for the current API key (HTTP 404 from the Gemini API).
    gemini_model_fallbacks: Union[List[str], str] = [
        "gemini-3.6-flash",
        "gemini-3.5-flash-lite",
    ]
    # Reasoning effort for Gemini 3.x+ models (LOW | MEDIUM | HIGH).
    # MEDIUM is Google's default and the minimum that gives the adjudicator
    # enough reasoning budget to actually weigh premises against each other.
    gemini_thinking_level: str = "MEDIUM"
    database_url: str = "sqlite+aiosqlite:///./debatelab.db"
    secret_key: str = "cross_ex_super_secret_development_key_2026_xyz"
    environment: str = "development"
    cors_origins: Union[List[str], str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ]
    max_audio_bytes: int = 10 * 1024 * 1024  # 10 MB limit
    min_duration_ms: int = 3_000             # 3 seconds
    max_duration_ms: int = 125_000           # 125 seconds (hard cap 120s with grace window)

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return parsed
            except Exception:
                return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @field_validator("gemini_model_fallbacks", mode="before")
    @classmethod
    def parse_model_fallbacks(cls, v):
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return parsed
            except Exception:
                return [m.strip() for m in v.split(",") if m.strip()]
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
