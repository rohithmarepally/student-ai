from functools import lru_cache
from uuid import UUID

from pydantic import BaseModel

from app.core.supabase import (
    get_admin_client,
)
from app.services.embeddings import (
    EmbeddingServiceError,
    get_embedding_service,
)


class RetrievedChunk(BaseModel):
    chunk_id: int
    document_id: UUID
    original_name: str
    chunk_index: int
    page_number: int
    content: str
    similarity: float


class SemanticSearchServiceError(
    RuntimeError
):
    """Base error for semantic retrieval."""


class QueryEmbeddingError(
    SemanticSearchServiceError
):
    """Raised when a question cannot be embedded."""


class ChunkRetrievalError(
    SemanticSearchServiceError
):
    """Raised when matching chunks cannot be loaded."""


class SemanticSearchService:
    def search(
        self,
        question: str,
        user_id: str,
        document_id: UUID | None = None,
        match_count: int = 5,
        match_threshold: float = 0.0,
    ) -> list[RetrievedChunk]:
        try:
            query_embedding = (
                get_embedding_service()
                .embed_query(
                    question
                )
            )
        except EmbeddingServiceError as exc:
            raise QueryEmbeddingError(
                "The question could not "
                "be embedded."
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
                        "p_user_id": user_id,
                        "p_match_count": (
                            match_count
                        ),
                        "p_match_threshold": (
                            match_threshold
                        ),
                        "p_document_id": (
                            str(document_id)
                            if document_id
                            else None
                        ),
                    },
                )
                .execute()
            )

            return [
                RetrievedChunk.model_validate(
                    row
                )
                for row in (
                    rpc_response.data
                    or []
                )
            ]
        except Exception as exc:
            raise ChunkRetrievalError(
                "Relevant document chunks "
                "could not be retrieved."
            ) from exc


@lru_cache
def get_semantic_search_service(
) -> SemanticSearchService:
    return SemanticSearchService()
