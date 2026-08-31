import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.request_context import RequestContextMiddleware
from app.routers.conversations import router as conversations_router
from app.routers.documents import router as documents_router
from app.routers.flashcards import router as flashcards_router
from app.routers.quizzes import router as quizzes_router
from app.routers.rag import router as rag_router
from app.routers.search import router as search_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

settings = get_settings()

app = FastAPI(
    title="Student AI Assistant API",
    description="Backend API for the Student AI Assistant application.",
    version="0.9.0",
)

# 1. Custom Middleware added FIRST (runs inside CORS)
app.add_middleware(RequestContextMiddleware)

if settings.rate_limit_enabled:
    app.add_middleware(RateLimitMiddleware)
origins = settings.allowed_origins
if isinstance(origins, str):
    origins_list = [o.strip() for o in origins.split(",") if o.strip()]
else:
    origins_list = list(origins)


origins_list.extend([
    "https://student-ai-rosy.vercel.app",
    "http://localhost:3000",
    ])
origins_list = list(set(origins_list))
# 2. CORS Middleware added LAST (runs OUTSIDE as the first layer for incoming requests)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins_list,
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods (PUT, PATCH, POST, OPTIONS, etc.)
    allow_headers=["*"],  # Allow all headers (including Supabase/Next.js client headers)
    expose_headers=[
        "X-Request-ID",
        "X-Response-Time-Ms",
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
        "Retry-After",
    ],
)

app.include_router(documents_router)
app.include_router(search_router)
app.include_router(rag_router)
app.include_router(conversations_router)
app.include_router(quizzes_router)
app.include_router(flashcards_router)


@app.get("/")
def read_root() -> dict[str, str]:
    return {"message": "Student AI Assistant API is running"}


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "student-ai-assistant-api"}
