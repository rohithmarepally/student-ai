import pytest

from app.core.config import (
    parse_allowed_origins,
)


def test_local_origins_are_accepted(
) -> None:
    origins = parse_allowed_origins(
        (
            "http://localhost:3000,"
            "http://127.0.0.1:3000"
        )
    )

    assert origins == (
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    )


def test_trailing_slash_is_removed(
) -> None:
    origins = parse_allowed_origins(
        "https://example.com/"
    )

    assert origins == (
        "https://example.com",
    )


def test_wildcard_origin_is_rejected(
) -> None:
    with pytest.raises(
        RuntimeError
    ):
        parse_allowed_origins("*")


def test_origin_with_path_is_rejected(
) -> None:
    with pytest.raises(
        RuntimeError
    ):
        parse_allowed_origins(
            "https://example.com/path"
        )


def test_empty_origin_list_is_rejected(
) -> None:
    with pytest.raises(
        RuntimeError
    ):
        parse_allowed_origins(
            " , "
        )
