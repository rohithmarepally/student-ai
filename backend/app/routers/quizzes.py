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
    Response,
    status,
)
from pydantic import (
    BaseModel,
    Field,
    field_validator,
    model_validator,
)

from app.dependencies.auth import (
    AuthenticatedUser,
    get_current_user,
)
from app.services.quiz_generation import (
    QuizGenerationError,
    QuizGenerationSource,
    get_quiz_generation_service,
)
from app.services.quizzes import (
    QuizAnswerSubmission,
    QuizDetailForStudent,
    QuizDocumentNotFoundError,
    QuizDocumentNotReadyError,
    QuizNotFoundError,
    QuizPersistenceError,
    QuizQuestionToSave,
    QuizSubmissionError,
    QuizSubmissionResult,
    QuizSummary,
    get_quiz_repository,
)
from app.services.semantic_search import (
    ChunkRetrievalError,
    QueryEmbeddingError,
    get_semantic_search_service,
)


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/quizzes",
    tags=["quizzes"],
)

QuizDifficulty = Literal[
    "easy",
    "medium",
    "hard",
]

MIN_QUESTIONS = 3
MAX_QUESTIONS = 10
MAX_TOPIC_LENGTH = 200
MAX_RETRIEVAL_MATCHES = 16


class GenerateQuizRequest(BaseModel):
    document_id: UUID

    topic: str | None = Field(
        default=None,
        max_length=MAX_TOPIC_LENGTH,
    )

    difficulty: QuizDifficulty = (
        "medium"
    )

    question_count: int = Field(
        default=5,
        ge=MIN_QUESTIONS,
        le=MAX_QUESTIONS,
    )

    @field_validator("topic")
    @classmethod
    def clean_topic(
        cls,
        topic: str | None,
    ) -> str | None:
        if topic is None:
            return None

        cleaned_topic = topic.strip()

        return cleaned_topic or None


class QuizListResponse(BaseModel):
    quizzes: list[QuizSummary]


class SubmitQuizAnswer(BaseModel):
    question_id: UUID

    selected_option_index: int = Field(
        ge=0,
        le=3,
    )


class SubmitQuizRequest(BaseModel):
    answers: list[
        SubmitQuizAnswer
    ] = Field(
        min_length=MIN_QUESTIONS,
        max_length=MAX_QUESTIONS,
    )

    @model_validator(mode="after")
    def validate_unique_questions(
        self,
    ) -> "SubmitQuizRequest":
        question_ids = {
            answer.question_id
            for answer in self.answers
        }

        if (
            len(question_ids)
            != len(self.answers)
        ):
            raise ValueError(
                "Each question can only "
                "be answered once."
            )

        return self


def build_retrieval_query(
    *,
    topic: str | None,
) -> str:
    if topic:
        return (
            "Important definitions, concepts, "
            "relationships, examples and "
            "exam-relevant facts about "
            f"{topic}."
        )

    return (
        "The main definitions, concepts, "
        "relationships, mechanisms, examples "
        "and exam-relevant facts in this "
        "study document."
    )


@router.post(
    "/generate",
    response_model=QuizDetailForStudent,
    status_code=(
        status.HTTP_201_CREATED
    ),
)
def generate_quiz(
    request: GenerateQuizRequest,
    current_user: Annotated[
        AuthenticatedUser,
        Depends(get_current_user),
    ],
) -> QuizDetailForStudent:
    user_id = UUID(current_user.id)

    repository = (
        get_quiz_repository()
    )

    try:
        repository.get_ready_document(
            document_id=request.document_id,
            user_id=user_id,
        )
    except QuizDocumentNotFoundError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail="Document not found.",
        ) from exc
    except QuizDocumentNotReadyError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Process this document before "
                "generating a quiz."
            ),
        ) from exc
    except QuizPersistenceError as exc:
        logger.exception(
            "Quiz document lookup failed."
        )
        raise HTTPException(
            status_code=(
                status
                .HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "The document could not "
                "be loaded."
            ),
        ) from exc

    retrieval_query = (
        build_retrieval_query(
            topic=request.topic
        )
    )

    retrieval_count = min(
        MAX_RETRIEVAL_MATCHES,
        max(
            8,
            request.question_count * 2,
        ),
    )

    try:
        matches = (
            get_semantic_search_service()
            .search(
                question=retrieval_query,
                user_id=current_user.id,
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
            "Quiz retrieval embedding failed."
        )
        raise HTTPException(
            status_code=(
                status.HTTP_502_BAD_GATEWAY
            ),
            detail=(
                "The quiz topic could not "
                "be embedded. Try again."
            ),
        ) from exc
    except ChunkRetrievalError as exc:
        logger.exception(
            "Quiz source retrieval failed."
        )
        raise HTTPException(
            status_code=(
                status
                .HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Quiz source material could "
                "not be retrieved."
            ),
        ) from exc

    if not matches:
        raise HTTPException(
            status_code=(
                status
                .HTTP_422_UNPROCESSABLE_CONTENT
            ),
            detail=(
                "No usable study material was "
                "found for this quiz."
            ),
        )

    generation_sources = [
        QuizGenerationSource(
            source_id=f"S{index}",
            chunk_id=match.chunk_id,
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
        generated_quiz = (
            get_quiz_generation_service()
            .generate_quiz(
                topic=request.topic,
                difficulty=(
                    request.difficulty
                ),
                question_count=(
                    request.question_count
                ),
                sources=(
                    generation_sources
                ),
            )
        )
    except QuizGenerationError as exc:
        logger.exception(
            "Quiz generation failed."
        )
        raise HTTPException(
            status_code=(
                status.HTTP_502_BAD_GATEWAY
            ),
            detail=(
                "The AI could not generate "
                "a valid quiz. Try again."
            ),
        ) from exc

    source_by_id = {
        source.source_id: source
        for source in generation_sources
    }

    questions_to_save = [
        QuizQuestionToSave(
            prompt=question.prompt,
            options=question.options,
            correct_option_index=(
                question
                .correct_option_index
            ),
            explanation=(
                question.explanation
            ),
            source_id=(
                question.source_id
            ),
            chunk_id=(
                source_by_id[
                    question.source_id
                ].chunk_id
            ),
            similarity=(
                source_by_id[
                    question.source_id
                ].similarity
            ),
        )
        for question
        in generated_quiz.questions
    ]

    try:
        return (
            repository
            .save_generated_quiz(
                user_id=user_id,
                document_id=(
                    request.document_id
                ),
                title=generated_quiz.title,
                topic=request.topic,
                difficulty=(
                    request.difficulty
                ),
                questions=(
                    questions_to_save
                ),
            )
        )
    except QuizPersistenceError as exc:
        logger.exception(
            "Generated quiz persistence failed."
        )
        raise HTTPException(
            status_code=(
                status
                .HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "The generated quiz could "
                "not be saved."
            ),
        ) from exc


@router.get(
    "",
    response_model=QuizListResponse,
)
def list_quizzes(
    current_user: Annotated[
        AuthenticatedUser,
        Depends(get_current_user),
    ],
) -> QuizListResponse:
    try:
        quizzes = (
            get_quiz_repository()
            .list_quizzes(
                user_id=UUID(
                    current_user.id
                )
            )
        )
    except QuizPersistenceError as exc:
        logger.exception(
            "Quiz listing failed."
        )
        raise HTTPException(
            status_code=(
                status
                .HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Saved quizzes could not "
                "be loaded."
            ),
        ) from exc

    return QuizListResponse(
        quizzes=quizzes
    )


@router.get(
    "/{quiz_id}",
    response_model=QuizDetailForStudent,
)
def get_quiz(
    quiz_id: UUID,
    current_user: Annotated[
        AuthenticatedUser,
        Depends(get_current_user),
    ],
) -> QuizDetailForStudent:
    try:
        return (
            get_quiz_repository()
            .get_quiz(
                quiz_id=quiz_id,
                user_id=UUID(
                    current_user.id
                ),
            )
        )
    except QuizNotFoundError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail="Quiz not found.",
        ) from exc
    except QuizPersistenceError as exc:
        logger.exception(
            "Quiz loading failed."
        )
        raise HTTPException(
            status_code=(
                status
                .HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "The quiz could not be loaded."
            ),
        ) from exc


@router.post(
    "/{quiz_id}/submit",
    response_model=QuizSubmissionResult,
)
def submit_quiz(
    quiz_id: UUID,
    request: SubmitQuizRequest,
    current_user: Annotated[
        AuthenticatedUser,
        Depends(get_current_user),
    ],
) -> QuizSubmissionResult:
    answers = [
        QuizAnswerSubmission(
            question_id=(
                answer.question_id
            ),
            selected_option_index=(
                answer
                .selected_option_index
            ),
        )
        for answer in request.answers
    ]

    try:
        return (
            get_quiz_repository()
            .submit_quiz(
                quiz_id=quiz_id,
                user_id=UUID(
                    current_user.id
                ),
                answers=answers,
            )
        )
    except QuizNotFoundError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail="Quiz not found.",
        ) from exc
    except QuizSubmissionError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=str(exc),
        ) from exc
    except QuizPersistenceError as exc:
        logger.exception(
            "Quiz submission failed."
        )
        raise HTTPException(
            status_code=(
                status
                .HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "The quiz could not be submitted."
            ),
        ) from exc


@router.delete(
    "/{quiz_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_quiz(
    quiz_id: UUID,
    current_user: Annotated[
        AuthenticatedUser,
        Depends(get_current_user),
    ],
) -> Response:
    try:
        (
            get_quiz_repository()
            .delete_quiz(
                quiz_id=quiz_id,
                user_id=UUID(
                    current_user.id
                ),
            )
        )
    except QuizNotFoundError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail="Quiz not found.",
        ) from exc
    except QuizPersistenceError as exc:
        logger.exception(
            "Quiz deletion failed."
        )
        raise HTTPException(
            status_code=(
                status
                .HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "The quiz could not be deleted."
            ),
        ) from exc

    return Response(
        status_code=(
            status.HTTP_204_NO_CONTENT
        )
    )
