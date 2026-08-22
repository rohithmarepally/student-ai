from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

from app.core.supabase import (
    get_admin_client,
)


QuizDifficulty = Literal[
    "easy",
    "medium",
    "hard",
]


class QuizNotFoundError(RuntimeError):
    pass


class QuizDocumentNotFoundError(
    RuntimeError
):
    pass


class QuizDocumentNotReadyError(
    RuntimeError
):
    pass


class QuizPersistenceError(RuntimeError):
    pass


class QuizSubmissionError(RuntimeError):
    pass


class QuizDocument(BaseModel):
    id: UUID
    original_name: str
    status: str


class QuizSourceSnapshot(BaseModel):
    source_id: str
    chunk_id: int
    document_id: UUID
    original_name: str
    page_number: int
    content: str
    similarity: float


class QuizQuestionToSave(BaseModel):
    prompt: str
    options: list[str]
    correct_option_index: int
    explanation: str
    source_id: str
    chunk_id: int
    similarity: float


class StoredQuizQuestion(BaseModel):
    id: UUID
    position: int
    prompt: str
    options: list[str]
    correct_option_index: int
    explanation: str
    source: QuizSourceSnapshot


class QuizRecord(BaseModel):
    id: UUID
    document_id: UUID | None
    original_name: str
    title: str
    topic: str | None
    difficulty: QuizDifficulty
    question_count: int
    created_at: datetime
    questions: list[
        StoredQuizQuestion
    ]


class QuizSummary(BaseModel):
    id: UUID
    document_id: UUID | None
    original_name: str
    title: str
    topic: str | None
    difficulty: QuizDifficulty
    question_count: int
    created_at: datetime


class QuizQuestionForStudent(BaseModel):
    id: UUID
    position: int
    prompt: str
    options: list[str]


class QuizDetailForStudent(
    QuizSummary
):
    questions: list[
        QuizQuestionForStudent
    ]


class QuizAnswerSubmission(BaseModel):
    question_id: UUID
    selected_option_index: int


class QuizAnswerResult(BaseModel):
    question_id: UUID
    selected_option_index: int
    correct_option_index: int
    is_correct: bool
    explanation: str
    source: QuizSourceSnapshot


class QuizSubmissionResult(BaseModel):
    attempt_id: UUID
    quiz_id: UUID
    score: int
    total: int
    submitted_at: datetime
    answers: list[
        QuizAnswerResult
    ]


class QuizRepository:
    def get_ready_document(
        self,
        *,
        document_id: UUID,
        user_id: UUID,
    ) -> QuizDocument:
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
            raise QuizPersistenceError(
                "The document could not "
                "be loaded."
            ) from exc

        if not response.data:
            raise QuizDocumentNotFoundError(
                "Document not found."
            )

        document = (
            QuizDocument.model_validate(
                response.data[0]
            )
        )

        if document.status != "ready":
            raise QuizDocumentNotReadyError(
                "Document is not ready."
            )

        return document

    def save_generated_quiz(
        self,
        *,
        user_id: UUID,
        document_id: UUID,
        title: str,
        topic: str | None,
        difficulty: QuizDifficulty,
        questions: list[
            QuizQuestionToSave
        ],
    ) -> QuizDetailForStudent:
        rpc_questions = [
            question.model_dump(
                mode="json"
            )
            for question in questions
        ]

        try:
            response = (
                get_admin_client()
                .rpc(
                    "save_generated_quiz",
                    {
                        "p_user_id": (
                            str(user_id)
                        ),
                        "p_document_id": (
                            str(document_id)
                        ),
                        "p_title": title,
                        "p_topic": topic,
                        "p_difficulty": (
                            difficulty
                        ),
                        "p_questions": (
                            rpc_questions
                        ),
                    },
                )
                .execute()
            )
        except Exception as exc:
            raise QuizPersistenceError(
                "The generated quiz could "
                "not be saved."
            ) from exc

        if not response.data:
            raise QuizPersistenceError(
                "The quiz save operation "
                "returned no ID."
            )

        quiz_id = UUID(
            response.data[0][
                "saved_quiz_id"
            ]
        )

        return self.get_quiz(
            quiz_id=quiz_id,
            user_id=user_id,
        )

    def list_quizzes(
        self,
        *,
        user_id: UUID,
    ) -> list[QuizSummary]:
        try:
            response = (
                get_admin_client()
                .table("quizzes")
                .select(
                    (
                        "id,document_id,"
                        "original_name,title,"
                        "topic,difficulty,"
                        "question_count,"
                        "created_at"
                    )
                )
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
            raise QuizPersistenceError(
                "Saved quizzes could not "
                "be loaded."
            ) from exc

        return [
            QuizSummary.model_validate(
                row
            )
            for row in (
                response.data
                or []
            )
        ]

    def _get_record(
        self,
        *,
        quiz_id: UUID,
        user_id: UUID,
    ) -> QuizRecord:
        try:
            response = (
                get_admin_client()
                .table("quizzes")
                .select(
                    (
                        "id,document_id,"
                        "original_name,title,"
                        "topic,difficulty,"
                        "question_count,"
                        "created_at,questions"
                    )
                )
                .eq(
                    "id",
                    str(quiz_id),
                )
                .eq(
                    "user_id",
                    str(user_id),
                )
                .limit(1)
                .execute()
            )
        except Exception as exc:
            raise QuizPersistenceError(
                "The quiz could not be loaded."
            ) from exc

        if not response.data:
            raise QuizNotFoundError(
                "Quiz not found."
            )

        return QuizRecord.model_validate(
            response.data[0]
        )

    def get_quiz(
        self,
        *,
        quiz_id: UUID,
        user_id: UUID,
    ) -> QuizDetailForStudent:
        record = self._get_record(
            quiz_id=quiz_id,
            user_id=user_id,
        )

        return QuizDetailForStudent(
            id=record.id,
            document_id=(
                record.document_id
            ),
            original_name=(
                record.original_name
            ),
            title=record.title,
            topic=record.topic,
            difficulty=(
                record.difficulty
            ),
            question_count=(
                record.question_count
            ),
            created_at=(
                record.created_at
            ),
            questions=[
                QuizQuestionForStudent(
                    id=question.id,
                    position=(
                        question.position
                    ),
                    prompt=question.prompt,
                    options=question.options,
                )
                for question
                in record.questions
            ],
        )

    def submit_quiz(
        self,
        *,
        quiz_id: UUID,
        user_id: UUID,
        answers: list[
            QuizAnswerSubmission
        ],
    ) -> QuizSubmissionResult:
        record = self._get_record(
            quiz_id=quiz_id,
            user_id=user_id,
        )

        expected_question_ids = {
            question.id
            for question in record.questions
        }

        submitted_question_ids = {
            answer.question_id
            for answer in answers
        }

        if (
            len(answers)
            != record.question_count
            or submitted_question_ids
            != expected_question_ids
        ):
            raise QuizSubmissionError(
                "Every quiz question must "
                "be answered exactly once."
            )

        rpc_answers = [
            answer.model_dump(
                mode="json"
            )
            for answer in answers
        ]

        try:
            response = (
                get_admin_client()
                .rpc(
                    "submit_quiz_attempt",
                    {
                        "p_user_id": (
                            str(user_id)
                        ),
                        "p_quiz_id": (
                            str(quiz_id)
                        ),
                        "p_answers": (
                            rpc_answers
                        ),
                    },
                )
                .execute()
            )
        except Exception as exc:
            raise QuizSubmissionError(
                "The quiz could not be scored."
            ) from exc

        if not response.data:
            raise QuizSubmissionError(
                "The scoring operation "
                "returned no result."
            )

        saved_attempt = response.data[0]

        selection_by_question = {
            answer.question_id: (
                answer
                .selected_option_index
            )
            for answer in answers
        }

        answer_results = [
            QuizAnswerResult(
                question_id=question.id,
                selected_option_index=(
                    selection_by_question[
                        question.id
                    ]
                ),
                correct_option_index=(
                    question
                    .correct_option_index
                ),
                is_correct=(
                    selection_by_question[
                        question.id
                    ]
                    ==
                    question
                    .correct_option_index
                ),
                explanation=(
                    question.explanation
                ),
                source=question.source,
            )
            for question in record.questions
        ]

        return QuizSubmissionResult(
            attempt_id=UUID(
                saved_attempt[
                    "saved_attempt_id"
                ]
            ),
            quiz_id=quiz_id,
            score=saved_attempt[
                "saved_score"
            ],
            total=saved_attempt[
                "saved_total"
            ],
            submitted_at=(
                saved_attempt[
                    "saved_submitted_at"
                ]
            ),
            answers=answer_results,
        )

    def delete_quiz(
        self,
        *,
        quiz_id: UUID,
        user_id: UUID,
    ) -> None:
        self._get_record(
            quiz_id=quiz_id,
            user_id=user_id,
        )

        try:
            (
                get_admin_client()
                .table("quizzes")
                .delete()
                .eq(
                    "id",
                    str(quiz_id),
                )
                .eq(
                    "user_id",
                    str(user_id),
                )
                .execute()
            )
        except Exception as exc:
            raise QuizPersistenceError(
                "The quiz could not be deleted."
            ) from exc


def get_quiz_repository(
) -> QuizRepository:
    return QuizRepository()
