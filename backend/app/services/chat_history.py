from datetime import datetime
from functools import lru_cache
from typing import Literal
from uuid import UUID

from postgrest.exceptions import APIError
from pydantic import (
    BaseModel,
    Field,
    ValidationError,
)

from app.core.supabase import get_admin_client


MAX_CONVERSATIONS = 50


class ChatHistoryServiceError(RuntimeError):
    """Base error for chat-history operations."""


class ChatPersistenceError(
    ChatHistoryServiceError
):
    """Raised when a RAG exchange cannot be saved."""


class ChatRetrievalError(
    ChatHistoryServiceError
):
    """Raised when chat history cannot be loaded."""


class ChatDeletionError(
    ChatHistoryServiceError
):
    """Raised when a conversation cannot be deleted."""


class ConversationNotFoundError(
    ChatHistoryServiceError
):
    """Raised when a conversation is missing or unowned."""


class SourceSnapshotInput(BaseModel):
    source_id: str = Field(
        min_length=2,
        max_length=20,
        pattern=r"^S[1-9][0-9]*$",
    )

    chunk_id: int = Field(
        gt=0,
    )

    document_id: UUID

    similarity: float = Field(
        ge=0,
        le=1,
    )

    cited: bool


class SavedExchange(BaseModel):
    saved_conversation_id: UUID
    saved_user_message_id: UUID
    saved_assistant_message_id: UUID


class ConversationSummary(BaseModel):
    id: UUID

    title: str = Field(
        min_length=1,
        max_length=120,
    )

    document_id: UUID | None

    created_at: datetime

    updated_at: datetime


class MessageSource(BaseModel):
    id: int

    source_id: str = Field(
        min_length=2,
        max_length=20,
        pattern=r"^S[1-9][0-9]*$",
    )

    chunk_id: int | None

    document_id: UUID | None

    original_name: str = Field(
        min_length=1,
        max_length=255,
    )

    page_number: int = Field(
        gt=0,
    )

    chunk_index: int = Field(
        ge=0,
    )

    content: str = Field(
        min_length=1,
        max_length=4000,
    )

    similarity: float = Field(
        ge=0,
        le=1,
    )

    cited: bool

    created_at: datetime


class MessageSourceRecord(
    MessageSource
):
    message_id: UUID


class ConversationMessage(BaseModel):
    id: UUID

    sequence_number: int = Field(
        gt=0,
    )

    role: Literal[
        "user",
        "assistant",
    ]

    content: str = Field(
        min_length=1,
        max_length=8000,
    )

    model: str | None = Field(
        default=None,
        max_length=100,
    )

    insufficient_context: bool | None

    created_at: datetime

    sources: list[MessageSource] = Field(
        default_factory=list,
    )


class ConversationDetail(BaseModel):
    conversation: ConversationSummary

    messages: list[ConversationMessage]


class ChatHistoryService:
    def __init__(self) -> None:
        self.client = get_admin_client()

    def save_exchange(
        self,
        *,
        user_id: UUID,
        conversation_id: UUID | None,
        document_id: UUID | None,
        question: str,
        answer: str,
        model: str | None,
        insufficient_context: bool,
        sources: list[SourceSnapshotInput],
    ) -> SavedExchange:
        parameters = {
            "p_user_id": str(user_id),
            "p_conversation_id": (
                str(conversation_id)
                if conversation_id
                else None
            ),
            "p_document_id": (
                str(document_id)
                if document_id
                else None
            ),
            "p_question": question,
            "p_answer": answer,
            "p_model": model,
            "p_insufficient_context": (
                insufficient_context
            ),
            "p_sources": [
                source.model_dump(
                    mode="json"
                )
                for source in sources
            ],
        }

        try:
            response = (
                self.client.rpc(
                    "save_rag_exchange",
                    parameters,
                )
                .execute()
            )

            rows = response.data or []

            if (
                not isinstance(rows, list)
                or len(rows) != 1
            ):
                raise ValueError(
                    "The save function returned "
                    "an unexpected result."
                )

            return SavedExchange.model_validate(
                rows[0]
            )
        except (
            APIError,
            ValidationError,
            TypeError,
            ValueError,
        ) as exc:
            raise ChatPersistenceError(
                "The conversation exchange "
                "could not be saved."
            ) from exc

    def list_conversations(
        self,
        *,
        user_id: UUID,
        limit: int = MAX_CONVERSATIONS,
    ) -> list[ConversationSummary]:
        if limit < 1 or limit > MAX_CONVERSATIONS:
            raise ValueError(
                "Conversation limit must be "
                f"between 1 and {MAX_CONVERSATIONS}."
            )

        try:
            response = (
                self.client.table(
                    "chat_conversations"
                )
                .select(
                    (
                        "id,title,document_id,"
                        "created_at,updated_at"
                    )
                )
                .eq(
                    "user_id",
                    str(user_id),
                )
                .order(
                    "updated_at",
                    desc=True,
                )
                .limit(limit)
                .execute()
            )

            rows = response.data or []

            if not isinstance(rows, list):
                raise TypeError(
                    "Conversation rows were "
                    "not returned as a list."
                )

            return [
                ConversationSummary.model_validate(
                    row
                )
                for row in rows
            ]
        except (
            APIError,
            ValidationError,
            TypeError,
        ) as exc:
            raise ChatRetrievalError(
                "Conversations could not be loaded."
            ) from exc

    def get_conversation(
        self,
        *,
        user_id: UUID,
        conversation_id: UUID,
    ) -> ConversationDetail:
        try:
            conversation_response = (
                self.client.table(
                    "chat_conversations"
                )
                .select(
                    (
                        "id,title,document_id,"
                        "created_at,updated_at"
                    )
                )
                .eq(
                    "id",
                    str(conversation_id),
                )
                .eq(
                    "user_id",
                    str(user_id),
                )
                .limit(1)
                .execute()
            )

            conversation_rows = (
                conversation_response.data
                or []
            )

            if not conversation_rows:
                raise ConversationNotFoundError(
                    "The conversation was not found."
                )

            conversation = (
                ConversationSummary.model_validate(
                    conversation_rows[0]
                )
            )

            messages_response = (
                self.client.table(
                    "chat_messages"
                )
                .select(
                    (
                        "id,sequence_number,role,"
                        "content,model,"
                        "insufficient_context,"
                        "created_at"
                    )
                )
                .eq(
                    "conversation_id",
                    str(conversation_id),
                )
                .eq(
                    "user_id",
                    str(user_id),
                )
                .order(
                    "sequence_number",
                )
                .execute()
            )

            message_rows = (
                messages_response.data
                or []
            )

            if not isinstance(
                message_rows,
                list,
            ):
                raise TypeError(
                    "Message rows were not "
                    "returned as a list."
                )

            message_ids = [
                row["id"]
                for row in message_rows
            ]

            source_records: list[
                MessageSourceRecord
            ] = []

            if message_ids:
                sources_response = (
                    self.client.table(
                        "chat_message_sources"
                    )
                    .select(
                        (
                            "id,message_id,"
                            "source_id,chunk_id,"
                            "document_id,"
                            "original_name,"
                            "page_number,"
                            "chunk_index,content,"
                            "similarity,cited,"
                            "created_at"
                        )
                    )
                    .eq(
                        "user_id",
                        str(user_id),
                    )
                    .in_(
                        "message_id",
                        message_ids,
                    )
                    .order(
                        "source_id",
                    )
                    .execute()
                )

                source_rows = (
                    sources_response.data
                    or []
                )

                if not isinstance(
                    source_rows,
                    list,
                ):
                    raise TypeError(
                        "Source rows were not "
                        "returned as a list."
                    )

                source_records = [
                    MessageSourceRecord
                    .model_validate(row)
                    for row in source_rows
                ]

            sources_by_message: dict[
                UUID,
                list[MessageSource],
            ] = {}

            for source_record in source_records:
                message_sources = (
                    sources_by_message.setdefault(
                        source_record.message_id,
                        [],
                    )
                )

                message_sources.append(
                    MessageSource(
                        **source_record.model_dump(
                            exclude={
                                "message_id",
                            }
                        )
                    )
                )

            messages = [
                ConversationMessage(
                    **row,
                    sources=sources_by_message.get(
                        UUID(row["id"]),
                        [],
                    ),
                )
                for row in message_rows
            ]

            return ConversationDetail(
                conversation=conversation,
                messages=messages,
            )
        except ConversationNotFoundError:
            raise
        except (
            APIError,
            ValidationError,
            KeyError,
            TypeError,
            ValueError,
        ) as exc:
            raise ChatRetrievalError(
                "The conversation could not be loaded."
            ) from exc

    def delete_conversation(
        self,
        *,
        user_id: UUID,
        conversation_id: UUID,
    ) -> None:
        try:
            ownership_response = (
                self.client.table(
                    "chat_conversations"
                )
                .select("id")
                .eq(
                    "id",
                    str(conversation_id),
                )
                .eq(
                    "user_id",
                    str(user_id),
                )
                .limit(1)
                .execute()
            )

            if not (
                ownership_response.data
                or []
            ):
                raise ConversationNotFoundError(
                    "The conversation was not found."
                )

            (
                self.client.table(
                    "chat_conversations"
                )
                .delete()
                .eq(
                    "id",
                    str(conversation_id),
                )
                .eq(
                    "user_id",
                    str(user_id),
                )
                .execute()
            )
        except ConversationNotFoundError:
            raise
        except APIError as exc:
            raise ChatDeletionError(
                "The conversation could not be deleted."
            ) from exc


@lru_cache
def get_chat_history_service() -> (
    ChatHistoryService
):
    return ChatHistoryService()
