import logging
from typing import Annotated
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from pydantic import (
    BaseModel,
    field_validator,
)

from app.dependencies.auth import (
    AuthenticatedUser,
    get_current_user,
)
from app.services.answer_generation import (
    AnswerGenerationError,
    AnswerSource,
    get_answer_generation_service,
)
from app.services.chat_history import (
    ChatPersistenceError,
    ChatRetrievalError,
    ConversationDetail,
    ConversationNotFoundError,
    SourceSnapshotInput,
    get_chat_history_service,
)
from app.services.query_rewriting import (
    ConversationContextMessage,
    QueryRewriteError,
    QueryRewriteResult,
    get_query_rewrite_service,
)
from app.services.semantic_search import (
    ChunkRetrievalError,
    QueryEmbeddingError,
    RetrievedChunk,
    get_semantic_search_service,
)


logger = logging.getLogger(__name__)


router = APIRouter(
    prefix="/rag",
    tags=["rag"],
)


MIN_QUESTION_LENGTH = 3
MAX_QUESTION_LENGTH = 1000
RAG_MATCH_COUNT = 5
RAG_MATCH_THRESHOLD = 0.0

NO_CONTEXT_ANSWER = (
    "The provided study material does not "
    "contain enough information to answer "
    "this question."
)


class RagRequest(BaseModel):
    question: str

    document_id: UUID | None = None

    conversation_id: UUID | None = None

    @field_validator("question")
    @classmethod
    def validate_question(
        cls,
        question: str,
    ) -> str:
        cleaned_question = question.strip()

        if (
            len(cleaned_question)
            < MIN_QUESTION_LENGTH
        ):
            raise ValueError(
                "Question must contain at least "
                f"{MIN_QUESTION_LENGTH} characters."
            )

        if (
            len(cleaned_question)
            > MAX_QUESTION_LENGTH
        ):
            raise ValueError(
                "Question cannot contain more than "
                f"{MAX_QUESTION_LENGTH} characters."
            )

        return cleaned_question


class RagSource(BaseModel):
    source_id: str
    chunk_id: int
    document_id: UUID
    original_name: str
    chunk_index: int
    page_number: int
    content: str
    similarity: float
    cited: bool


class RagResponse(BaseModel):
    conversation_id: UUID
    user_message_id: UUID
    assistant_message_id: UUID
    question: str
    retrieval_query: str
    used_conversation_history: bool
    query_rewrite_model: str | None
    answer: str
    model: str | None
    insufficient_context: bool
    retrieved_count: int
    cited_source_ids: list[str]
    sources: list[RagSource]


def get_authenticated_user_id(
    current_user: AuthenticatedUser,
) -> UUID:
    try:
        return UUID(
            current_user.id
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


def build_answer_sources(
    matches: list[RetrievedChunk],
) -> list[AnswerSource]:
    return [
        AnswerSource(
            source_id=f"S{index}",
            document_id=str(
                match.document_id
            ),
            original_name=(
                match.original_name
            ),
            page_number=(
                match.page_number
            ),
            content=match.content,
            similarity=match.similarity,
        )
        for index, match in enumerate(
            matches,
            start=1,
        )
    ]


def build_response_sources(
    matches: list[RetrievedChunk],
    answer_sources: list[AnswerSource],
    cited_source_ids: set[str],
) -> list[RagSource]:
    return [
        RagSource(
            source_id=(
                answer_source.source_id
            ),
            chunk_id=match.chunk_id,
            document_id=match.document_id,
            original_name=(
                match.original_name
            ),
            chunk_index=(
                match.chunk_index
            ),
            page_number=(
                match.page_number
            ),
            content=match.content,
            similarity=match.similarity,
            cited=(
                answer_source.source_id
                in cited_source_ids
            ),
        )
        for match, answer_source in zip(
            matches,
            answer_sources,
            strict=True,
        )
    ]


def load_existing_conversation(
    *,
    user_id: UUID,
    conversation_id: UUID | None,
    document_id: UUID | None,
) -> ConversationDetail | None:
    if conversation_id is None:
        return None

    try:
        conversation_detail = (
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
        logger.exception(
            "Conversation validation failed."
        )

        raise HTTPException(
            status_code=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
            detail=(
                "The conversation could not "
                "be validated."
            ),
        ) from exc

    if (
        conversation_detail
        .conversation
        .document_id
        != document_id
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "The selected document does not "
                "match this conversation."
            ),
        )

    return conversation_detail


def build_conversation_context(
    conversation_detail: (
        ConversationDetail | None
    ),
) -> list[
    ConversationContextMessage
]:
    if conversation_detail is None:
        return []

    return [
        ConversationContextMessage(
            role=message.role,
            content=message.content,
        )
        for message in (
            conversation_detail.messages
        )
    ]


def rewrite_retrieval_query(
    *,
    question: str,
    conversation_detail: (
        ConversationDetail | None
    ),
) -> QueryRewriteResult:
    history = (
        build_conversation_context(
            conversation_detail
        )
    )

    try:
        return (
            get_query_rewrite_service()
            .rewrite(
                question=question,
                history=history,
            )
        )
    except QueryRewriteError as exc:
        logger.exception(
            "Conversational query "
            "rewriting failed."
        )

        raise HTTPException(
            status_code=(
                status.HTTP_502_BAD_GATEWAY
            ),
            detail=(
                "The follow-up question could "
                "not be understood. "
                "Please try again."
            ),
        ) from exc


@router.post(
    "",
    response_model=RagResponse,
)
def generate_rag_answer(
    request: RagRequest,
    current_user: Annotated[
        AuthenticatedUser,
        Depends(get_current_user),
    ],
) -> RagResponse:
    user_id = get_authenticated_user_id(
        current_user
    )

    conversation_detail = (
        load_existing_conversation(
            user_id=user_id,
            conversation_id=(
                request.conversation_id
            ),
            document_id=(
                request.document_id
            ),
        )
    )

    rewrite_result = (
        rewrite_retrieval_query(
            question=request.question,
            conversation_detail=(
                conversation_detail
            ),
        )
    )

    try:
        matches = (
            get_semantic_search_service()
            .search(
                question=(
                    rewrite_result
                    .retrieval_query
                ),
                user_id=str(user_id),
                document_id=(
                    request.document_id
                ),
                match_count=(
                    RAG_MATCH_COUNT
                ),
                match_threshold=(
                    RAG_MATCH_THRESHOLD
                ),
            )
        )
    except QueryEmbeddingError as exc:
        logger.exception(
            "RAG question embedding failed."
        )

        raise HTTPException(
            status_code=(
                status.HTTP_502_BAD_GATEWAY
            ),
            detail=(
                "The question could not be "
                "embedded. Please try again."
            ),
        ) from exc
    except ChunkRetrievalError as exc:
        logger.exception(
            "RAG chunk retrieval failed."
        )

        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Relevant document chunks "
                "could not be retrieved."
            ),
        ) from exc

    if not matches:
        answer = NO_CONTEXT_ANSWER
        model = None
        insufficient_context = True
        cited_source_ids: list[str] = []
        response_sources: list[RagSource] = []
    else:
        answer_sources = build_answer_sources(
            matches
        )

        try:
            generated_answer = (
                get_answer_generation_service()
                .generate_answer(
                    question=(
                        rewrite_result
                        .retrieval_query
                    ),
                    sources=answer_sources,
                )
            )
        except AnswerGenerationError as exc:
            logger.exception(
                "Grounded answer generation "
                "failed."
            )

            raise HTTPException(
                status_code=(
                    status.HTTP_502_BAD_GATEWAY
                ),
                detail=(
                    "A grounded answer could "
                    "not be generated. "
                    "Please try again."
                ),
            ) from exc

        answer = generated_answer.answer
        model = generated_answer.model

        insufficient_context = (
            generated_answer
            .insufficient_context
        )

        cited_source_ids = (
            generated_answer
            .cited_source_ids
        )

        response_sources = (
            build_response_sources(
                matches=matches,
                answer_sources=(
                    answer_sources
                ),
                cited_source_ids=set(
                    cited_source_ids
                ),
            )
        )

    source_snapshots = [
        SourceSnapshotInput(
            source_id=source.source_id,
            chunk_id=source.chunk_id,
            document_id=(
                source.document_id
            ),
            similarity=source.similarity,
            cited=source.cited,
        )
        for source in response_sources
    ]

    try:
        saved_exchange = (
            get_chat_history_service()
            .save_exchange(
                user_id=user_id,
                conversation_id=(
                    request.conversation_id
                ),
                document_id=(
                    request.document_id
                ),
                question=request.question,
                answer=answer,
                model=model,
                insufficient_context=(
                    insufficient_context
                ),
                sources=source_snapshots,
            )
        )
    except ChatPersistenceError as exc:
        logger.exception(
            "RAG exchange persistence failed."
        )

        raise HTTPException(
            status_code=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
            detail=(
                "The answer could not be saved. "
                "Please try again."
            ),
        ) from exc

    return RagResponse(
        conversation_id=(
            saved_exchange
            .saved_conversation_id
        ),
        user_message_id=(
            saved_exchange
            .saved_user_message_id
        ),
        assistant_message_id=(
            saved_exchange
            .saved_assistant_message_id
        ),
        question=request.question,
        retrieval_query=(
            rewrite_result.retrieval_query
        ),
        used_conversation_history=(
            rewrite_result.used_history
        ),
        query_rewrite_model=(
            rewrite_result.model
        ),
        answer=answer,
        model=model,
        insufficient_context=(
            insufficient_context
        ),
        retrieved_count=len(matches),
        cited_source_ids=(
            cited_source_ids
        ),
        sources=response_sources,
    )
