from dataclasses import dataclass
from datetime import datetime

from app.core.supabase import (
    get_admin_client,
)


class RateLimitServiceError(
    RuntimeError
):
    pass


@dataclass(frozen=True)
class RateLimitDecision:
    allowed: bool
    current_count: int
    request_limit: int
    remaining_requests: int
    reset_at: datetime


class RateLimitService:
    def check(
        self,
        *,
        actor_key: str,
        action: str,
        max_requests: int,
        window_seconds: int,
    ) -> RateLimitDecision:
        try:
            response = (
                get_admin_client()
                .rpc(
                    "check_api_rate_limit",
                    {
                        "p_actor_key": (
                            actor_key
                        ),
                        "p_action": action,
                        "p_max_requests": (
                            max_requests
                        ),
                        "p_window_seconds": (
                            window_seconds
                        ),
                    },
                )
                .execute()
            )
        except Exception as exc:
            raise RateLimitServiceError(
                "The rate-limit database "
                "operation failed."
            ) from exc

        if not response.data:
            raise RateLimitServiceError(
                "The rate limiter returned "
                "no decision."
            )

        row = response.data[0]

        return RateLimitDecision(
            allowed=row["allowed"],
            current_count=(
                row["current_count"]
            ),
            request_limit=(
                row["request_limit"]
            ),
            remaining_requests=(
                row["remaining_requests"]
            ),
            reset_at=datetime.fromisoformat(
                row["reset_at"].replace(
                    "Z",
                    "+00:00",
                )
            ),
        )


def get_rate_limit_service(
) -> RateLimitService:
    return RateLimitService()
