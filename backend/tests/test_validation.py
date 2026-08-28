from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.routers.flashcards import (
    GenerateFlashcardsRequest,
)
from app.routers.quizzes import (
    GenerateQuizRequest,
)
from app.routers.rag import RagRequest


def test_rag_question_is_cleaned(
) -> None:
    request = RagRequest(
        question=(
            "   What causes deadlock?   "
        )
    )

    assert request.question == (
        "What causes deadlock?"
    )


def test_empty_rag_question_is_rejected(
) -> None:
    with pytest.raises(
        ValidationError
    ):
        RagRequest(
            question=" "
        )


def test_quiz_count_is_limited(
) -> None:
    with pytest.raises(
        ValidationError
    ):
        GenerateQuizRequest(
            document_id=uuid4(),
            question_count=11,
        )


def test_flashcard_count_is_limited(
) -> None:
    with pytest.raises(
        ValidationError
    ):
        GenerateFlashcardsRequest(
            document_id=uuid4(),
            card_count=21,
        )


def test_blank_quiz_topic_becomes_none(
) -> None:
    request = GenerateQuizRequest(
        document_id=uuid4(),
        topic="   ",
    )

    assert request.topic is None


def test_blank_flashcard_topic_becomes_none(
) -> None:
    request = (
        GenerateFlashcardsRequest(
            document_id=uuid4(),
            topic="   ",
        )
    )

    assert request.topic is None
