from datetime import (
    datetime,
    timezone,
)
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

from app.core.supabase import (
    get_admin_client,
)


ReviewRating = Literal[
    "again",
    "hard",
    "good",
    "easy",
]


class FlashcardNotFoundError(
    RuntimeError
):
    pass


class FlashcardDocumentNotFoundError(
    RuntimeError
):
    pass


class FlashcardDocumentNotReadyError(
    RuntimeError
):
    pass


class FlashcardPersistenceError(
    RuntimeError
):
    pass


class FlashcardDocument(BaseModel):
    id: UUID
    original_name: str
    status: str


class FlashcardToSave(BaseModel):
    front: str
    back: str
    source_id: str
    chunk_id: int
    similarity: float


class FlashcardItem(BaseModel):
    id: UUID
    deck_id: UUID
    position: int
    front: str
    back: str
    source_id: str
    source_chunk_id: int
    source_document_id: UUID
    source_original_name: str
    source_page_number: int
    source_content: str
    source_similarity: float
    due_at: datetime
    interval_days: int
    correct_streak: int
    review_count: int
    last_reviewed_at: (
        datetime | None
    )


class FlashcardDeckSummary(BaseModel):
    id: UUID
    document_id: UUID | None
    original_name: str
    title: str
    topic: str | None
    card_count: int
    created_at: datetime


class FlashcardDeckDetail(
    FlashcardDeckSummary
):
    cards: list[FlashcardItem]


class DueFlashcard(FlashcardItem):
    deck_title: str


class FlashcardReviewResult(BaseModel):
    card_id: UUID
    deck_id: UUID
    due_at: datetime
    interval_days: int
    review_count: int
    correct_streak: int


CARD_FIELDS = (
    "id,deck_id,position,front,back,"
    "source_id,source_chunk_id,"
    "source_document_id,"
    "source_original_name,"
    "source_page_number,"
    "source_content,"
    "source_similarity,due_at,"
    "interval_days,correct_streak,"
    "review_count,last_reviewed_at"
)

DECK_FIELDS = (
    "id,document_id,original_name,"
    "title,topic,card_count,created_at"
)


class FlashcardRepository:
    def get_ready_document(
        self,
        *,
        document_id: UUID,
        user_id: UUID,
    ) -> FlashcardDocument:
        try:
            response = (
                get_admin_client()
                .table("documents")
                .select(
                    "id,original_name,status"
                )
                .eq(
                    "id",
                    str(document_id),
                )
                .eq(
                    "user_id",
                    str(user_id),
                )
                .limit(1)
                .execute()
            )
        except Exception as exc:
            raise FlashcardPersistenceError(
                "The document could not "
                "be loaded."
            ) from exc

        if not response.data:
            raise (
                FlashcardDocumentNotFoundError(
                    "Document not found."
                )
            )

        document = (
            FlashcardDocument
            .model_validate(
                response.data[0]
            )
        )

        if document.status != "ready":
            raise (
                FlashcardDocumentNotReadyError(
                    "Document is not ready."
                )
            )

        return document

    def save_deck(
        self,
        *,
        user_id: UUID,
        document_id: UUID,
        title: str,
        topic: str | None,
        cards: list[FlashcardToSave],
    ) -> FlashcardDeckDetail:
        try:
            response = (
                get_admin_client()
                .rpc(
                    (
                        "save_generated_"
                        "flashcard_deck"
                    ),
                    {
                        "p_user_id": (
                            str(user_id)
                        ),
                        "p_document_id": (
                            str(document_id)
                        ),
                        "p_title": title,
                        "p_topic": topic,
                        "p_cards": [
                            card.model_dump(
                                mode="json"
                            )
                            for card in cards
                        ],
                    },
                )
                .execute()
            )
        except Exception as exc:
            raise FlashcardPersistenceError(
                "The flashcard deck could "
                "not be saved."
            ) from exc

        if not response.data:
            raise FlashcardPersistenceError(
                "The deck save operation "
                "returned no ID."
            )

        deck_id = UUID(
            response.data[0][
                "saved_deck_id"
            ]
        )

        return self.get_deck(
            deck_id=deck_id,
            user_id=user_id,
        )

    def list_decks(
        self,
        *,
        user_id: UUID,
    ) -> list[
        FlashcardDeckSummary
    ]:
        try:
            response = (
                get_admin_client()
                .table(
                    "flashcard_decks"
                )
                .select(DECK_FIELDS)
                .eq(
                    "user_id",
                    str(user_id),
                )
                .order(
                    "created_at",
                    desc=True,
                )
                .execute()
            )
        except Exception as exc:
            raise FlashcardPersistenceError(
                "Flashcard decks could "
                "not be loaded."
            ) from exc

        return [
            FlashcardDeckSummary
            .model_validate(row)
            for row in (
                response.data or []
            )
        ]

    def get_deck(
        self,
        *,
        deck_id: UUID,
        user_id: UUID,
    ) -> FlashcardDeckDetail:
        try:
            deck_response = (
                get_admin_client()
                .table(
                    "flashcard_decks"
                )
                .select(DECK_FIELDS)
                .eq(
                    "id",
                    str(deck_id),
                )
                .eq(
                    "user_id",
                    str(user_id),
                )
                .limit(1)
                .execute()
            )

            card_response = (
                get_admin_client()
                .table("flashcards")
                .select(CARD_FIELDS)
                .eq(
                    "deck_id",
                    str(deck_id),
                )
                .eq(
                    "user_id",
                    str(user_id),
                )
                .order("position")
                .execute()
            )
        except Exception as exc:
            raise FlashcardPersistenceError(
                "The flashcard deck could "
                "not be loaded."
            ) from exc

        if not deck_response.data:
            raise FlashcardNotFoundError(
                "Flashcard deck not found."
            )

        summary = (
            FlashcardDeckSummary
            .model_validate(
                deck_response.data[0]
            )
        )

        return FlashcardDeckDetail(
            **summary.model_dump(),
            cards=[
                FlashcardItem
                .model_validate(row)
                for row in (
                    card_response.data
                    or []
                )
            ],
        )

    def list_due_cards(
        self,
        *,
        user_id: UUID,
        limit: int,
    ) -> list[DueFlashcard]:
        now_value = (
            datetime.now(timezone.utc)
            .isoformat()
        )

        try:
            card_response = (
                get_admin_client()
                .table("flashcards")
                .select(CARD_FIELDS)
                .eq(
                    "user_id",
                    str(user_id),
                )
                .lte(
                    "due_at",
                    now_value,
                )
                .order("due_at")
                .limit(limit)
                .execute()
            )
        except Exception as exc:
            raise FlashcardPersistenceError(
                "Due flashcards could "
                "not be loaded."
            ) from exc

        card_rows = (
            card_response.data or []
        )

        if not card_rows:
            return []

        deck_ids = list({
            row["deck_id"]
            for row in card_rows
        })

        try:
            deck_response = (
                get_admin_client()
                .table(
                    "flashcard_decks"
                )
                .select("id,title")
                .eq(
                    "user_id",
                    str(user_id),
                )
                .in_(
                    "id",
                    deck_ids,
                )
                .execute()
            )
        except Exception as exc:
            raise FlashcardPersistenceError(
                "Deck names could not "
                "be loaded."
            ) from exc

        deck_title_by_id = {
            row["id"]: row["title"]
            for row in (
                deck_response.data or []
            )
        }

        return [
            DueFlashcard(
                **row,
                deck_title=(
                    deck_title_by_id.get(
                        row["deck_id"],
                        "Flashcard deck",
                    )
                ),
            )
            for row in card_rows
        ]

    def review_card(
        self,
        *,
        card_id: UUID,
        user_id: UUID,
        rating: ReviewRating,
    ) -> FlashcardReviewResult:
        try:
            response = (
                get_admin_client()
                .rpc(
                    "review_flashcard",
                    {
                        "p_user_id": (
                            str(user_id)
                        ),
                        "p_card_id": (
                            str(card_id)
                        ),
                        "p_rating": rating,
                    },
                )
                .execute()
            )
        except Exception as exc:
            raise FlashcardPersistenceError(
                "The flashcard review "
                "could not be saved."
            ) from exc

        if not response.data:
            raise FlashcardNotFoundError(
                "Flashcard not found."
            )

        result = response.data[0]

        return FlashcardReviewResult(
            card_id=result[
                "reviewed_card_id"
            ],
            deck_id=result[
                "reviewed_deck_id"
            ],
            due_at=result[
                "new_due_at"
            ],
            interval_days=result[
                "new_interval_days"
            ],
            review_count=result[
                "new_review_count"
            ],
            correct_streak=result[
                "new_correct_streak"
            ],
        )

    def delete_deck(
        self,
        *,
        deck_id: UUID,
        user_id: UUID,
    ) -> None:
        self.get_deck(
            deck_id=deck_id,
            user_id=user_id,
        )

        try:
            (
                get_admin_client()
                .table(
                    "flashcard_decks"
                )
                .delete()
                .eq(
                    "id",
                    str(deck_id),
                )
                .eq(
                    "user_id",
                    str(user_id),
                )
                .execute()
            )
        except Exception as exc:
            raise FlashcardPersistenceError(
                "The flashcard deck could "
                "not be deleted."
            ) from exc


def get_flashcard_repository(
) -> FlashcardRepository:
    return FlashcardRepository()
