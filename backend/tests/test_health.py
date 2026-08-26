from fastapi.testclient import (
    TestClient,
)

from app.main import app


client = TestClient(app)


def test_health_check() -> None:
    response = client.get("/health")

    assert response.status_code == 200

    assert response.json() == {
        "status": "ok",
        "service": (
            "student-ai-assistant-api"
        ),
    }

    assert (
        response.headers.get(
            "X-Request-ID"
        )
        is not None
    )

    assert (
        response.headers.get(
            "X-Response-Time-Ms"
        )
        is not None
    )


def test_api_version() -> None:
    assert app.version == "0.9.0"
