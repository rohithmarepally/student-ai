from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.documents import (
    router as documents_router,
)
from app.routers.rag import (
    router as rag_router,
)
from app.routers.search import (
    router as search_router,
)


app = FastAPI(
    title="Student AI Assistant API",
    description=(
        "Backend API for the "
        "Student AI Assistant application."
    ),
    version="0.4.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
