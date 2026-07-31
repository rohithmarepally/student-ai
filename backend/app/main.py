from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI(
    title="Student AI Assistant API",
    description="Backend API for the Student AI Assistant application.",
    version="0.1.0",
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


@app.get("/")
def read_root() -> dict[str, str]:
    """Return basic information about the API."""
    return {
        "message": "Student AI Assistant API is running"
    }


@app.get("/health")
def health_check() -> dict[str, str]:
    """Return the current health of the API."""
    return {
        "status": "ok",
        "service": "student-ai-assistant-api",
    }
