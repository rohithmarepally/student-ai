from datetime import (
    datetime,
    timedelta,
    timezone,
)
import importlib

from fastapi import FastAPI
from fastapi.testclient import (
    TestClient,
)

from app.middleware.rate_limit import (
    RateLimitMiddleware,
)
from app.middleware.request_context import (
    RequestContextMiddleware,
)
from app.services.rate_limits import (
    RateLimitDecision,
)


rate_limit_module = (
    importlib.import_module(
        "app.middleware.rate_limit"
    )
)


class BlockedRateLimitService:
    def check(
        self,
        **_kwargs,
    ) -> RateLimitDecision:
        return RateLimitDecision(
            allowed=False,
            current_count=6,
            request_limit=5,
            remaining_requests=0,
            reset_at=(
                datetime.now(
                    timezone.utc
                )
                + timedelta(minutes=5)
            ),
        )


class AllowedRateLimitService:
    def check(
        self,
        **_kwargs,
    ) -> RateLimitDecision:
        return RateLimitDecision(
            allowed=True,
            current_count=1,
            request_limit=5,
            remaining_requests=4,
            reset_at=(
                datetime.now(
                    timezone.utc
                )
                + timedelta(hours=1)
            ),
        )


def test_rate_limit_returns_429(
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        rate_limit_module,
        "get_rate_limit_service",
        lambda: (
            BlockedRateLimitService()
        ),
    )

    test_app = FastAPI()

    test_app.add_middleware(
        RateLimitMiddleware
    )

    test_app.add_middleware(
        RequestContextMiddleware
    )

    @test_app.post(
        "/quizzes/generate"
    )
    def generate_quiz(
    ) -> dict[str, bool]:
        return {
            "generated": True
        }

    client = TestClient(test_app)

    response = client.post(
        "/quizzes/generate",
        headers={
            "Authorization": (
                "Bearer test-token"
            )
        },
    )

    assert response.status_code == 429

    assert response.json()[
        "detail"
    ] == (
        "Too many requests. "
        "Please try again later."
    )

    assert (
        response.headers[
            "X-RateLimit-Remaining"
        ]
        == "0"
    )

    assert (
        response.headers.get(
            "Retry-After"
        )
        is not None
    )

    assert (
        response.headers.get(
            "X-Request-ID"
        )
        is not None
    )


def test_allowed_request_receives_headers(
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        rate_limit_module,
        "get_rate_limit_service",
        lambda: (
            AllowedRateLimitService()
        ),
    )

    test_app = FastAPI()

    test_app.add_middleware(
        RateLimitMiddleware
    )

    test_app.add_middleware(
        RequestContextMiddleware
    )

    @test_app.post("/rag")
    def rag_route(
    ) -> dict[str, bool]:
        return {
            "answered": True
        }

    client = TestClient(test_app)

    response = client.post(
        "/rag",
        headers={
            "Authorization": (
                "Bearer test-token"
            )
        },
    )

    assert response.status_code == 200

    assert (
        response.headers[
            "X-RateLimit-Limit"
        ]
        == "5"
    )

    assert (
        response.headers[
            "X-RateLimit-Remaining"
        ]
        == "4"
    )


def test_unexpected_error_is_sanitized(
) -> None:
    test_app = FastAPI()

    test_app.add_middleware(
        RequestContextMiddleware
    )

    @test_app.get("/broken")
    def broken_route() -> None:
        raise RuntimeError(
            "private internal details"
        )

    client = TestClient(
        test_app,
        raise_server_exceptions=False,
    )

    response = client.get(
        "/broken"
    )

    assert response.status_code == 500

    body = response.json()

    assert body["detail"] == (
        "An unexpected server "
        "error occurred."
    )

    assert (
        "private internal details"
        not in response.text
    )

    assert body["request_id"] == (
        response.headers[
            "X-Request-ID"
        ]
    )
