import math
from dataclasses import dataclass
from functools import lru_cache
from typing import Final

from google import genai
from google.genai import errors, types

from app.core.config import get_settings


EMBEDDING_MODEL: Final = "gemini-embedding-001"

EMBEDDING_DIMENSIONS: Final = 1536

EMBEDDING_BATCH_SIZE: Final = 32

DOCUMENT_TASK_TYPE: Final = "RETRIEVAL_DOCUMENT"

QUERY_TASK_TYPE: Final = "RETRIEVAL_QUERY"


@dataclass(frozen=True)
class GeneratedEmbedding:
    vector: list[float]
    model: str


class EmbeddingServiceError(RuntimeError):
    """Raised when an embedding cannot be generated."""


def normalize_vector(
    vector: list[float],
) -> list[float]:
    magnitude = math.sqrt(
        sum(
            value * value
            for value in vector
        )
    )

    if magnitude == 0:
        raise EmbeddingServiceError(
            "The embedding provider returned "
            "a zero-length vector."
        )

    return [
        value / magnitude
        for value in vector
    ]


class EmbeddingService:
    def __init__(self) -> None:
        settings = get_settings()

        self.client = genai.Client(
            api_key=settings.gemini_api_key,
        )

    def embed_documents(
        self,
        texts: list[str],
    ) -> list[GeneratedEmbedding]:
        return self._embed_texts(
            texts=texts,
            task_type=DOCUMENT_TASK_TYPE,
        )

    def embed_query(
        self,
        text: str,
    ) -> GeneratedEmbedding:
        embeddings = self._embed_texts(
            texts=[text],
            task_type=QUERY_TASK_TYPE,
        )

        return embeddings[0]

    def _embed_texts(
        self,
        texts: list[str],
        task_type: str,
    ) -> list[GeneratedEmbedding]:
        if not texts:
            return []

        cleaned_texts = [
            text.strip()
            for text in texts
        ]

        if any(
            not text
            for text in cleaned_texts
        ):
            raise ValueError(
                "Embedding input cannot be empty."
            )

        generated_embeddings: list[
            GeneratedEmbedding
        ] = []

        for start_index in range(
            0,
            len(cleaned_texts),
            EMBEDDING_BATCH_SIZE,
        ):
            batch = cleaned_texts[
                start_index:
                start_index
                + EMBEDDING_BATCH_SIZE
            ]

            try:
                response = (
                    self.client.models.embed_content(
                        model=EMBEDDING_MODEL,
                        contents=batch,
                        config=types.EmbedContentConfig(
                            task_type=task_type,
                            output_dimensionality=(
                                EMBEDDING_DIMENSIONS
                            ),
                        ),
                    )
                )
            except errors.APIError as exc:
                raise EmbeddingServiceError(
                    "The Gemini embedding "
                    "request failed."
                ) from exc
            except Exception as exc:
                raise EmbeddingServiceError(
                    "Could not communicate with "
                    "the embedding provider."
                ) from exc

            response_embeddings = (
                response.embeddings
                or []
            )

            if len(response_embeddings) != len(batch):
                raise EmbeddingServiceError(
                    "The embedding provider returned "
                    "an unexpected number of vectors."
                )

            for response_embedding in (
                response_embeddings
            ):
                raw_values = (
                    response_embedding.values
                    or []
                )

                vector = [
                    float(value)
                    for value in raw_values
                ]

                if (
                    len(vector)
                    != EMBEDDING_DIMENSIONS
                ):
                    raise EmbeddingServiceError(
                        "The embedding provider returned "
                        "an unexpected vector dimension."
                    )

                generated_embeddings.append(
                    GeneratedEmbedding(
                        vector=normalize_vector(
                            vector
                        ),
                        model=EMBEDDING_MODEL,
                    )
                )

        return generated_embeddings


@lru_cache
def get_embedding_service() -> EmbeddingService:
    return EmbeddingService()
