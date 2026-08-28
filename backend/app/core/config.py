import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv


BACKEND_DIRECTORY = (
    Path(__file__).resolve().parents[2]
)

ENV_FILE = (
    BACKEND_DIRECTORY / ".env"
)

DEFAULT_ALLOWED_ORIGINS = (
    "http://localhost:3000,"
    "http://127.0.0.1:3000"
)

load_dotenv(ENV_FILE)


def require_environment_variable(
    name: str,
) -> str:
    value = os.getenv(name)

    if not value:
        raise RuntimeError(
            "Required environment variable "
            f"{name} is missing."
        )

    return value


def require_private_value(
    name: str,
    *,
    minimum_length: int,
) -> str:
    value = require_environment_variable(
        name
    )

    if len(value) < minimum_length:
        raise RuntimeError(
            f"{name} must contain at least "
            f"{minimum_length} characters."
        )

    return value


def parse_allowed_origins(
    value: str,
) -> tuple[str, ...]:
    origins = tuple(
        origin.strip().rstrip("/")
        for origin in value.split(",")
        if origin.strip()
    )

    if not origins:
        raise RuntimeError(
            "ALLOWED_ORIGINS must contain "
            "at least one origin."
        )

    if "*" in origins:
        raise RuntimeError(
            "Wildcard CORS origins are not "
            "allowed with credentials."
        )

    for origin in origins:
        parsed = urlparse(origin)

        if (
            parsed.scheme
            not in {"http", "https"}
            or not parsed.netloc
            or parsed.path
            not in {"", "/"}
            or parsed.params
            or parsed.query
            or parsed.fragment
        ):
            raise RuntimeError(
                "Invalid CORS origin: "
                f"{origin}"
            )

    return origins


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_publishable_key: str
    supabase_secret_key: str
    gemini_api_key: str
    allowed_origins: tuple[str, ...]
    rate_limit_hmac_key: str


@lru_cache
def get_settings() -> Settings:
    return Settings(
        supabase_url=(
            require_environment_variable(
                "SUPABASE_URL"
            )
        ),
        supabase_publishable_key=(
            require_environment_variable(
                "SUPABASE_PUBLISHABLE_KEY"
            )
        ),
        supabase_secret_key=(
            require_environment_variable(
                "SUPABASE_SECRET_KEY"
            )
        ),
        gemini_api_key=(
            require_environment_variable(
                "GEMINI_API_KEY"
            )
        ),
        allowed_origins=(
            parse_allowed_origins(
                os.getenv(
                    "ALLOWED_ORIGINS",
                    DEFAULT_ALLOWED_ORIGINS,
                )
            )
        ),
        rate_limit_hmac_key=(
            require_private_value(
                "RATE_LIMIT_HMAC_KEY",
                minimum_length=32,
            )
        ),
    )
