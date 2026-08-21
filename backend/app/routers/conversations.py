from typing import Annotated
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Response,
    status,
)
from pydantic import BaseModel

from app.dependencies.auth import (
    AuthenticatedUser,
    get_current_user,
)
from app.services.chat_history import (
    ChatDeletionError,
    ChatRetrievalError,
    ConversationDetail,
    ConversationNotFoundError,
    ConversationSummary,
    get_chat_history_service,
)


router = APIRouter(
    prefix="/conversations",
    tags=["conversations"],
)


CurrentUser = Annotated[
    AuthenticatedUser,
    Depends(get_current_user),
]


class ConversationListResponse(BaseModel):
    conversations: list[ConversationSummary]


def get_authenticated_user_id(
    current_user: AuthenticatedUser,
) -> UUID:
    try:
        return UUID(
            str(current_user.id)
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "The authenticated user ID "
                "is invalid."
            ),
        ) from exc


@router.get(
    "",
    response_model=ConversationListResponse,
)
def list_conversations(
    current_user: CurrentUser,
) -> ConversationListResponse:
    user_id = get_authenticated_user_id(
        current_user
    )

    try:
        conversations = (
            get_chat_history_service()
            .list_conversations(
                user_id=user_id,
            )
        )
    except ChatRetrievalError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
            detail=(
                "Conversation history is "
                "temporarily unavailable."
            ),
        ) from exc

    return ConversationListResponse(
        conversations=conversations,
    )


@router.get(
    "/{conversation_id}",
    response_model=ConversationDetail,
)
def get_conversation(
    conversation_id: UUID,
    current_user: CurrentUser,
) -> ConversationDetail:
    user_id = get_authenticated_user_id(
        current_user
    )

    try:
        return (
            get_chat_history_service()
            .get_conversation(
                user_id=user_id,
                conversation_id=(
                    conversation_id
                ),
            )
        )
    except ConversationNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        ) from exc
    except ChatRetrievalError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
            detail=(
                "The conversation is "
                "temporarily unavailable."
            ),
        ) from exc


@router.delete(
    "/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_conversation(
    conversation_id: UUID,
    current_user: CurrentUser,
) -> Response:
    user_id = get_authenticated_user_id(
        current_user
    )

    try:
        (
            get_chat_history_service()
            .delete_conversation(
                user_id=user_id,
                conversation_id=(
                    conversation_id
                ),
            )
        )
    except ConversationNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        ) from exc
    except ChatDeletionError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
            detail=(
                "The conversation could "
                "not be deleted."
            ),
        ) from exc

    return Response(
        status_code=status.HTTP_204_NO_CONTENT
    )
