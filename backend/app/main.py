import logging

from fastapi import FastAPI
from fastapi.middleware.cors import (
    CORSMiddleware,
)

from app.core.config import (
    get_settings,
)
from app.middleware.rate_limit import (
    RateLimitMiddleware,
)
from app.middleware.request_context import (
    RequestContextMiddleware,
)
from app.routers.conversations import (
    router as conversations_router,
)
from app.routers.documents import (
    router as documents_router,
)
from app.routers.flashcards import (
    router as flashcards_router,
)
from app.routers.quizzes import (
    router as quizzes_router,
)
from app.routers.rag import (
    router as rag_router,
)
from app.routers.search import (
    router as search_router,
)


logging.basicConfig(
    level=logging.INFO,
    format=(
        "%(asctime)s %(levelname)s "
        "%(name)s %(message)s"
    ),
)

settings = get_settings()

app = FastAPI(
    title="Student AI Assistant API",
    description=(
        "Backend API for the "
        "Student AI Assistant application."
    ),
    version="0.9.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(
        settings.allowed_origins
    ),"https://student-ai-rosy.vercel.app",
    allow_credentials=True,
    allow_methods=[
        "GET",
        "POST",
        "DELETE",
        "OPTIONS",
    ],
    allow_headers=[
        "Authorization",
        "Content-Type",
    ],
    expose_headers=[
        "X-Request-ID",
        "X-Response-Time-Ms",
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
        "Retry-After",
    ],
)

if settings.rate_limit_enabled:
    app.add_middleware(
        RateLimitMiddleware
    )

app.add_middleware(
    RequestContextMiddleware
)

app.include_router(
    documents_router
)

app.include_router(
    search_router
)

app.include_router(
    rag_router
)

app.include_router(
    conversations_router
)

app.include_router(
    quizzes_router
)

app.include_router(
    flashcards_router
)


@app.get("/")
def read_root() -> dict[str, str]:
    return {
        "message": (
            "Student AI Assistant API "
            "is running"
        )
    }


@app.get("/health")
def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "service": (
            "student-ai-assistant-api"
        ),
    }
