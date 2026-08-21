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
    question: str
    answer: str
    model: str | None
    insufficient_context: bool
    retrieved_count: int
    cited_source_ids: list[str]
    sources: list[RagSource]


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
    try:
        matches = (
            get_semantic_search_service()
            .search(
                question=request.question,
                user_id=current_user.id,
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
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "The question could not be embedded. "
                "Please try again."
            ),
        ) from exc
    except ChunkRetrievalError as exc:
        logger.exception(
            "RAG chunk retrieval failed."
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Relevant document chunks "
                "could not be retrieved."
            ),
        ) from exc

    if not matches:
        return RagResponse(
            question=request.question,
            answer=NO_CONTEXT_ANSWER,
            model=None,
            insufficient_context=True,
            retrieved_count=0,
            cited_source_ids=[],
            sources=[],
        )

    answer_sources = (
        build_answer_sources(
            matches
        )
    )

    try:
        generated_answer = (
            get_answer_generation_service()
            .generate_answer(
                question=request.question,
                sources=answer_sources,
            )
        )
    except AnswerGenerationError as exc:
        logger.exception(
            "Grounded answer generation failed."
        )

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "A grounded answer could not "
                "be generated. Please try again."
            ),
        ) from exc

    cited_source_id_set = set(
        generated_answer.cited_source_ids
    )

    response_sources = (
        build_response_sources(
            matches=matches,
            answer_sources=answer_sources,
            cited_source_ids=(
                cited_source_id_set
            ),
        )
    )

    return RagResponse(
        question=request.question,
        answer=generated_answer.answer,
        model=generated_answer.model,
        insufficient_context=(
            generated_answer
            .insufficient_context
        ),
        retrieved_count=len(matches),
        cited_source_ids=(
            generated_answer
            .cited_source_ids
        ),
        sources=response_sources,
    )
