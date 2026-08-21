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
    Field,
    field_validator,
)

from app.core.supabase import (
    get_admin_client,
)
from app.dependencies.auth import (
    AuthenticatedUser,
    get_current_user,
)
from app.services.embeddings import (
    EmbeddingServiceError,
    get_embedding_service,
)


logger = logging.getLogger(__name__)


router = APIRouter(
    prefix="/search",
    tags=["search"],
)


MIN_QUESTION_LENGTH = 3

MAX_QUESTION_LENGTH = 1000


class SemanticSearchRequest(BaseModel):
    question: str

    document_id: UUID | None = None

    match_count: int = Field(
        default=5,
        ge=1,
        le=10,
    )

    match_threshold: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
    )

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


class SemanticSearchMatch(BaseModel):
    chunk_id: int
    document_id: UUID
    original_name: str
    chunk_index: int
    page_number: int
    content: str
    similarity: float


class SemanticSearchResponse(BaseModel):
    question: str
    match_count: int
    matches: list[SemanticSearchMatch]


@router.post(
    "",
    response_model=SemanticSearchResponse,
)
def semantic_search(
    request: SemanticSearchRequest,
    current_user: Annotated[
        AuthenticatedUser,
        Depends(get_current_user),
    ],
) -> SemanticSearchResponse:
    try:
        query_embedding = (
            get_embedding_service()
            .embed_query(
                request.question
            )
        )
    except EmbeddingServiceError as exc:
        logger.exception(
            "Question embedding generation failed."
        )

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "The question could not be embedded. "
                "Please try again."
            ),
        ) from exc

    try:
        admin = get_admin_client()

        rpc_response = (
            admin
            .rpc(
                "match_document_chunks",
                {
                    "p_query_embedding": (
                        query_embedding.vector
                    ),
                    "p_user_id": current_user.id,
                    "p_match_count": (
                        request.match_count
                    ),
                    "p_match_threshold": (
                        request.match_threshold
                    ),
                    "p_document_id": (
                        str(request.document_id)
                        if request.document_id
                        else None
                    ),
                },
            )
            .execute()
        )

        matches = [
            SemanticSearchMatch.model_validate(
                row
            )
            for row in (
                rpc_response.data
                or []
            )
        ]
    except Exception as exc:
        logger.exception(
            "Semantic chunk search failed."
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Relevant document chunks "
                "could not be retrieved."
            ),
        ) from exc

    return SemanticSearchResponse(
        question=request.question,
        match_count=len(matches),
        matches=matches,
    )
