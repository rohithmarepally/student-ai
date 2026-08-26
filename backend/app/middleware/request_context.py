import logging
import time
from uuid import uuid4

from fastapi import Request
from fastapi.responses import (
    JSONResponse,
)
from starlette.middleware.base import (
    BaseHTTPMiddleware,
)
from starlette.responses import Response


logger = logging.getLogger(__name__)


class RequestContextMiddleware(
    BaseHTTPMiddleware
):
    async def dispatch(
        self,
        request: Request,
        call_next,
    ) -> Response:
        request_id = str(uuid4())

        request.state.request_id = (
            request_id
        )

        started_at = time.perf_counter()

        try:
            response = await call_next(
                request
            )
        except Exception:
            logger.exception(
                (
                    "Unhandled request error "
                    "request_id=%s method=%s "
                    "path=%s"
                ),
                request_id,
                request.method,
                request.url.path,
            )

            response = JSONResponse(
                status_code=500,
                content={
                    "detail": (
                        "An unexpected server "
                        "error occurred."
                    ),
                    "request_id": request_id,
                },
            )

        duration_ms = (
            time.perf_counter()
            - started_at
        ) * 1000

        response.headers[
            "X-Request-ID"
        ] = request_id

        response.headers[
            "X-Response-Time-Ms"
        ] = f"{duration_ms:.2f}"

        return response
