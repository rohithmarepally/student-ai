import logging
from typing import (
    Annotated,
    Literal,
)
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Response,
    status,
)
from pydantic import (
    BaseModel,
    Field,
    field_validator,
)

from app.dependencies.auth import (
    AuthenticatedUser,
    get_current_user,
)
from app.services.flashcard_generation import (
    FlashcardGenerationError,
    FlashcardGenerationSource,
    get_flashcard_generation_service,
)
from app.services.flashcards import (
    DueFlashcard,
    FlashcardDeckDetail,
    FlashcardDeckSummary,
    FlashcardDocumentNotFoundError,
    FlashcardDocumentNotReadyError,
    FlashcardNotFoundError,
    FlashcardPersistenceError,
    FlashcardReviewResult,
    FlashcardToSave,
    get_flashcard_repository,
)
from app.services.semantic_search import (
    ChunkRetrievalError,
    QueryEmbeddingError,
    get_semantic_search_service,
)


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/flashcards",
    tags=["flashcards"],
)

ReviewRating = Literal[
    "again",
    "hard",
    "good",
    "easy",
]


class GenerateFlashcardsRequest(
    BaseModel
):
    document_id: UUID

    topic: str | None = Field(
        default=None,
        max_length=200,
    )

    card_count: int = Field(
        default=10,
        ge=5,
        le=20,
    )

    @field_validator("topic")
    @classmethod
    def clean_topic(
        cls,
        topic: str | None,
    ) -> str | None:
        if topic is None:
            return None

        return topic.strip() or None


class FlashcardDeckListResponse(
    BaseModel
):
    decks: list[
        FlashcardDeckSummary
    ]


class DueFlashcardsResponse(
    BaseModel
):
    cards: list[DueFlashcard]


class ReviewFlashcardRequest(
    BaseModel
):
    rating: ReviewRating


def build_retrieval_query(
    topic: str | None,
) -> str:
    if topic:
        return (
            "Important definitions, "
            "relationships, mechanisms, "
            "examples and exam facts about "
            f"{topic}."
        )

    return (
        "The most important definitions, "
        "concepts, mechanisms, examples "
        "and exam-relevant facts in this "
        "study document."
    )


@router.post(
    "/generate",
    response_model=FlashcardDeckDetail,
    status_code=(
        status.HTTP_201_CREATED
    ),
)
def generate_flashcards(
    request: GenerateFlashcardsRequest,
    current_user: Annotated[
        AuthenticatedUser,
        Depends(get_current_user),
    ],
) -> FlashcardDeckDetail:
    user_id = UUID(
        current_user.id
    )

    repository = (
        get_flashcard_repository()
    )

    try:
        repository.get_ready_document(
            document_id=(
                request.document_id
            ),
            user_id=user_id,
        )
    except (
        FlashcardDocumentNotFoundError
    ) as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail="Document not found.",
        ) from exc
    except (
        FlashcardDocumentNotReadyError
    ) as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=(
                "Process this document "
                "before generating "
                "flashcards."
            ),
        ) from exc
    except FlashcardPersistenceError as exc:
        logger.exception(
            "Flashcard document "
            "lookup failed."
        )

        raise HTTPException(
            status_code=(
                status
                .HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "The document could "
                "not be loaded."
            ),
        ) from exc

    retrieval_query = (
        build_retrieval_query(
            request.topic
        )
    )

    retrieval_count = min(
        20,
        max(
            10,
            request.card_count,
        ),
    )

    try:
        matches = (
            get_semantic_search_service()
            .search(
                question=(
                    retrieval_query
                ),
                user_id=(
                    current_user.id
                ),
                document_id=(
                    request.document_id
                ),
                match_count=(
                    retrieval_count
                ),
                match_threshold=0.0,
            )
        )
    except QueryEmbeddingError as exc:
        logger.exception(
            "Flashcard query "
            "embedding failed."
        )

        raise HTTPException(
            status_code=(
                status.HTTP_502_BAD_GATEWAY
            ),
            detail=(
                "The flashcard topic "
                "could not be embedded."
            ),
        ) from exc
    except ChunkRetrievalError as exc:
        logger.exception(
            "Flashcard source "
            "retrieval failed."
        )

        raise HTTPException(
            status_code=(
                status
                .HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Flashcard source material "
                "could not be retrieved."
            ),
        ) from exc

    if not matches:
        raise HTTPException(
            status_code=(
                status
                .HTTP_422_UNPROCESSABLE_CONTENT
            ),
            detail=(
                "No usable study material "
                "was found."
            ),
        )

    sources = [
        FlashcardGenerationSource(
            source_id=f"S{index}",
            chunk_id=(
                match.chunk_id
            ),
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
            similarity=(
                match.similarity
            ),
        )
        for index, match in enumerate(
            matches,
            start=1,
        )
    ]

    try:
        generated_deck = (
            get_flashcard_generation_service()
            .generate(
                topic=request.topic,
                card_count=(
                    request.card_count
                ),
                sources=sources,
            )
        )
    except FlashcardGenerationError as exc:
        logger.exception(
            "Flashcard generation failed."
        )

        raise HTTPException(
            status_code=(
                status.HTTP_502_BAD_GATEWAY
            ),
            detail=(
                "The AI could not generate "
                "a valid flashcard deck."
            ),
        ) from exc

    source_by_id = {
        source.source_id: source
        for source in sources
    }

    cards_to_save = [
        FlashcardToSave(
            front=card.front,
            back=card.back,
            source_id=(
                card.source_id
            ),
            chunk_id=(
                source_by_id[
                    card.source_id
                ].chunk_id
            ),
            similarity=(
                source_by_id[
                    card.source_id
                ].similarity
            ),
        )
        for card in (
            generated_deck.cards
        )
    ]

    try:
        return repository.save_deck(
            user_id=user_id,
            document_id=(
                request.document_id
            ),
            title=(
                generated_deck.title
            ),
            topic=request.topic,
            cards=cards_to_save,
        )
    except FlashcardPersistenceError as exc:
        logger.exception(
            "Flashcard deck "
            "persistence failed."
        )

        raise HTTPException(
            status_code=(
                status
                .HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "The flashcard deck "
                "could not be saved."
            ),
        ) from exc


@router.get(
    "",
    response_model=(
        FlashcardDeckListResponse
    ),
)
def list_flashcard_decks(
    current_user: Annotated[
        AuthenticatedUser,
        Depends(get_current_user),
    ],
) -> FlashcardDeckListResponse:
    try:
        decks = (
            get_flashcard_repository()
            .list_decks(
                user_id=UUID(
                    current_user.id
                )
            )
        )
    except FlashcardPersistenceError as exc:
        logger.exception(
            "Flashcard deck listing failed."
        )

        raise HTTPException(
            status_code=(
                status
                .HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Flashcard decks could "
                "not be loaded."
            ),
        ) from exc

    return FlashcardDeckListResponse(
        decks=decks
    )


@router.get(
    "/due",
    response_model=DueFlashcardsResponse,
)
def list_due_flashcards(
    current_user: Annotated[
        AuthenticatedUser,
        Depends(get_current_user),
    ],
    limit: Annotated[
        int,
        Query(
            ge=1,
            le=100,
        ),
    ] = 50,
) -> DueFlashcardsResponse:
    try:
        cards = (
            get_flashcard_repository()
            .list_due_cards(
                user_id=UUID(
                    current_user.id
                ),
                limit=limit,
            )
        )
    except FlashcardPersistenceError as exc:
        logger.exception(
            "Due flashcard listing failed."
        )

        raise HTTPException(
            status_code=(
                status
                .HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Due flashcards could "
                "not be loaded."
            ),
        ) from exc

    return DueFlashcardsResponse(
        cards=cards
    )


@router.get(
    "/{deck_id}",
    response_model=FlashcardDeckDetail,
)
def get_flashcard_deck(
    deck_id: UUID,
    current_user: Annotated[
        AuthenticatedUser,
        Depends(get_current_user),
    ],
) -> FlashcardDeckDetail:
    try:
        return (
            get_flashcard_repository()
            .get_deck(
                deck_id=deck_id,
                user_id=UUID(
                    current_user.id
                ),
            )
        )
    except FlashcardNotFoundError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail=(
                "Flashcard deck not found."
            ),
        ) from exc
    except FlashcardPersistenceError as exc:
        logger.exception(
            "Flashcard deck loading failed."
        )

        raise HTTPException(
            status_code=(
                status
                .HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "The flashcard deck "
                "could not be loaded."
            ),
        ) from exc


@router.post(
    "/cards/{card_id}/review",
    response_model=FlashcardReviewResult,
)
def review_flashcard(
    card_id: UUID,
    request: ReviewFlashcardRequest,
    current_user: Annotated[
        AuthenticatedUser,
        Depends(get_current_user),
    ],
) -> FlashcardReviewResult:
    try:
        return (
            get_flashcard_repository()
            .review_card(
                card_id=card_id,
                user_id=UUID(
                    current_user.id
                ),
                rating=request.rating,
            )
        )
    except FlashcardNotFoundError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail="Flashcard not found.",
        ) from exc
    except FlashcardPersistenceError as exc:
        logger.exception(
            "Flashcard review failed."
        )

        raise HTTPException(
            status_code=(
                status
                .HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "The flashcard review "
                "could not be saved."
            ),
        ) from exc


@router.delete(
    "/{deck_id}",
    status_code=(
        status.HTTP_204_NO_CONTENT
    ),
)
def delete_flashcard_deck(
    deck_id: UUID,
    current_user: Annotated[
        AuthenticatedUser,
        Depends(get_current_user),
    ],
) -> Response:
    try:
        (
            get_flashcard_repository()
            .delete_deck(
                deck_id=deck_id,
                user_id=UUID(
                    current_user.id
                ),
            )
        )
    except FlashcardNotFoundError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail=(
                "Flashcard deck not found."
            ),
        ) from exc
    except FlashcardPersistenceError as exc:
        logger.exception(
            "Flashcard deck deletion failed."
        )

        raise HTTPException(
            status_code=(
                status
                .HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "The flashcard deck "
                "could not be deleted."
            ),
        ) from exc

    return Response(
        status_code=(
            status.HTTP_204_NO_CONTENT
        )
    )
