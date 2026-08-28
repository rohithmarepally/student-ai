from app.main import app


def test_important_routes_exist(
) -> None:
    paths = app.openapi()["paths"]

    expected_paths = {
        (
            "/documents/"
            "{document_id}/process"
        ),
        "/search",
        "/rag",
        "/quizzes/generate",
        "/quizzes/{quiz_id}/submit",
        "/flashcards/generate",
        (
            "/flashcards/cards/"
            "{card_id}/review"
        ),
    }

    assert expected_paths.issubset(
        paths.keys()
    )


def test_quiz_answer_is_hidden_before_submission(
) -> None:
    schemas = (
        app.openapi()[
            "components"
        ]["schemas"]
    )

    properties = schemas[
        "QuizQuestionForStudent"
    ]["properties"]

    assert (
        "correct_option_index"
        not in properties
    )

    assert (
        "explanation"
        not in properties
    )


def test_authenticated_routes_have_security(
) -> None:
    paths = app.openapi()["paths"]

    protected_operations = [
        paths["/rag"]["post"],
        paths[
            "/quizzes/generate"
        ]["post"],
        paths[
            "/flashcards/generate"
        ]["post"],
    ]

    for operation in protected_operations:
        assert operation.get(
            "security"
        )
