import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv


BACKEND_DIRECTORY = Path(__file__).resolve().parents[2]

ENV_FILE = BACKEND_DIRECTORY / ".env"

load_dotenv(ENV_FILE)


def require_environment_variable(name: str) -> str:
    value = os.getenv(name)

    if not value:
        raise RuntimeError(
            f"Required environment variable {name} is missing."
        )

    return value


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_publishable_key: str
    supabase_secret_key: str
    gemini_api_key: str


@lru_cache
def get_settings() -> Settings:
    return Settings(
        supabase_url=require_environment_variable(
            "SUPABASE_URL"
        ),
        supabase_publishable_key=require_environment_variable(
            "SUPABASE_PUBLISHABLE_KEY"
        ),
        supabase_secret_key=require_environment_variable(
            "SUPABASE_SECRET_KEY"
        ),
        gemini_api_key=require_environment_variable(
            "GEMINI_API_KEY"
        ),
    )
