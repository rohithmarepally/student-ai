import hashlib
import hmac
import math
import re
from dataclasses import dataclass
from datetime import (
    datetime,
    timezone,
)

from fastapi import Request
from fastapi.responses import (
    JSONResponse,
)
from starlette.concurrency import (
    run_in_threadpool,
)
from starlette.middleware.base import (
    BaseHTTPMiddleware,
)
from starlette.responses import Response

from app.core.config import (
    get_settings,
)
from app.services.rate_limits import (
    RateLimitDecision,
    RateLimitServiceError,
    get_rate_limit_service,
)


@dataclass(frozen=True)
class RateLimitRule:
    action: str
    method: str
    path_pattern: re.Pattern[str]
    max_requests: int
    window_seconds: int


RATE_LIMIT_RULES = (
    RateLimitRule(
        action="semantic_search",
        method="POST",
        path_pattern=re.compile(
            r"^/search$"
        ),
        max_requests=60,
        window_seconds=60,
    ),
    RateLimitRule(
        action="rag_answer",
        method="POST",
        path_pattern=re.compile(
            r"^/rag$"
        ),
        max_requests=20,
        window_seconds=60,
    ),
    RateLimitRule(
        action="quiz_generation",
        method="POST",
        path_pattern=re.compile(
            r"^/quizzes/generate$"
        ),
        max_requests=5,
        window_seconds=3600,
    ),
    RateLimitRule(
        action="flashcard_generation",
        method="POST",
        path_pattern=re.compile(
            r"^/flashcards/generate$"
        ),
        max_requests=5,
        window_seconds=3600,
    ),
    RateLimitRule(
        action="document_processing",
        method="POST",
        path_pattern=re.compile(
            (
                r"^/documents/"
                r"[0-9a-fA-F-]+"
                r"/process$"
            )
        ),
        max_requests=10,
        window_seconds=3600,
    ),
)


def find_rule(
    request: Request,
) -> RateLimitRule | None:
    for rule in RATE_LIMIT_RULES:
        if (
            request.method == rule.method
            and rule.path_pattern.fullmatch(
                request.url.path
            )
        ):
            return rule

    return None


def build_actor_key(
    request: Request,
) -> str:
    authorization = (
        request.headers.get(
            "Authorization",
            "",
        )
    )

    if authorization.lower().startswith(
        "bearer "
    ):
        actor_source = authorization[7:]
    else:
        client_host = (
            request.client.host
            if request.client
            else "unknown"
        )

        user_agent = (
            request.headers.get(
                "User-Agent",
                "unknown",
            )
        )

        actor_source = (
            f"{client_host}|{user_agent}"
        )

    key = (
        get_settings()
        .rate_limit_hmac_key
        .encode("utf-8")
    )

    return hmac.new(
        key,
        actor_source.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def seconds_until(
    reset_at: datetime,
) -> int:
    now_value = datetime.now(
        timezone.utc
    )

    return max(
        1,
        math.ceil(
            (
                reset_at
                - now_value
            ).total_seconds()
        ),
    )


def add_rate_limit_headers(
    response: Response,
    decision: RateLimitDecision,
) -> None:
    response.headers[
        "X-RateLimit-Limit"
    ] = str(
        decision.request_limit
    )

    response.headers[
        "X-RateLimit-Remaining"
    ] = str(
        decision.remaining_requests
    )

    response.headers[
        "X-RateLimit-Reset"
    ] = decision.reset_at.isoformat()


class RateLimitMiddleware(
    BaseHTTPMiddleware
):
    async def dispatch(
        self,
        request: Request,
        call_next,
    ) -> Response:
        if request.method == "OPTIONS":
            return await call_next(request)
        rule = find_rule(request)

        if rule is None:
            return await call_next(
                request
            )

        actor_key = build_actor_key(
            request
        )

        try:
            decision = await run_in_threadpool(
                get_rate_limit_service().check,
                actor_key=actor_key,
                action=rule.action,
                max_requests=(
                    rule.max_requests
                ),
                window_seconds=(
                    rule.window_seconds
                ),
            )
        except RateLimitServiceError:
            request_id = getattr(
                request.state,
                "request_id",
                None,
            )

            return JSONResponse(
                status_code=503,
                content={
                    "detail": (
                        "Request protection "
                        "is temporarily unavailable."
                    ),
                    "request_id": request_id,
                },
            )

        if not decision.allowed:
            retry_after = seconds_until(
                decision.reset_at
            )

            response = JSONResponse(
                status_code=429,
                content={
                    "detail": (
                        "Too many requests. "
                        "Please try again later."
                    ),
                    "retry_after_seconds": (
                        retry_after
                    ),
                },
                headers={
                    "Retry-After": str(
                        retry_after
                    ),
                },
            )

            add_rate_limit_headers(
                response,
                decision,
            )

            return response

        response = await call_next(
            request
        )

        add_rate_limit_headers(
            response,
            decision,
        )

        return response
