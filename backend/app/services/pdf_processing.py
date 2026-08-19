import re
from dataclasses import dataclass
from io import BytesIO

from pypdf import PdfReader
from pypdf.errors import PdfReadError


MAX_PAGES = 300

MAX_CHUNK_CHARACTERS = 1800

CHUNK_OVERLAP_CHARACTERS = 250


@dataclass(frozen=True)
class ExtractedChunk:
    chunk_index: int
    page_number: int
    content: str
    char_count: int


@dataclass(frozen=True)
class ProcessedPdf:
    page_count: int
    character_count: int
    chunks: list[ExtractedChunk]


def normalize_text(text: str) -> str:
    text = text.replace("\x00", " ")

    text = re.sub(
        r"[ \t]+",
        " ",
        text,
    )

    lines = [
        line.strip()
        for line in text.splitlines()
    ]

    cleaned_lines = [
        line
        for line in lines
        if line
    ]

    return "\n".join(cleaned_lines).strip()


def build_overlap_words(
    words: list[str],
) -> list[str]:
    overlap_words: list[str] = []

    overlap_size = 0

    for word in reversed(words):
        additional_size = (
            len(word)
            + (
                1
                if overlap_words
                else 0
            )
        )

        if (
            overlap_size
            + additional_size
            > CHUNK_OVERLAP_CHARACTERS
        ):
            break

        overlap_words.append(word)

        overlap_size += additional_size

    overlap_words.reverse()

    return overlap_words


def chunk_text(
    text: str,
) -> list[str]:
    words = text.split()

    if not words:
        return []

    chunks: list[str] = []

    current_words: list[str] = []

    current_size = 0

    for word in words:
        additional_size = (
            len(word)
            + (
                1
                if current_words
                else 0
            )
        )

        if (
            current_words
            and current_size
            + additional_size
            > MAX_CHUNK_CHARACTERS
        ):
            chunks.append(
                " ".join(current_words)
            )

            current_words = (
                build_overlap_words(
                    current_words
                )
            )

            current_size = len(
                " ".join(current_words)
            )

        if current_words:
            current_size += 1

        current_words.append(word)

        current_size += len(word)

    if current_words:
        chunks.append(
            " ".join(current_words)
        )

    return chunks


def process_pdf_bytes(
    pdf_bytes: bytes,
) -> ProcessedPdf:
    try:
        reader = PdfReader(
            BytesIO(pdf_bytes)
        )
    except PdfReadError as exc:
        raise ValueError(
            "The uploaded file is not a readable PDF."
        ) from exc

    if reader.is_encrypted:
        try:
            decrypt_result = reader.decrypt("")
        except Exception as exc:
            raise ValueError(
                "Encrypted PDFs are not supported."
            ) from exc

        if decrypt_result == 0:
            raise ValueError(
                "Password-protected PDFs are not supported."
            )

    page_count = len(reader.pages)

    if page_count == 0:
        raise ValueError(
            "The PDF does not contain any pages."
        )

    if page_count > MAX_PAGES:
        raise ValueError(
            f"PDFs with more than {MAX_PAGES} pages "
            "are not supported yet."
        )

    extracted_chunks: list[ExtractedChunk] = []

    total_characters = 0

    next_chunk_index = 0

    for page_number, page in enumerate(
        reader.pages,
        start=1,
    ):
        try:
            raw_text = (
                page.extract_text()
                or ""
            )
        except Exception as exc:
            raise ValueError(
                f"Text could not be extracted "
                f"from page {page_number}."
            ) from exc

        page_text = normalize_text(
            raw_text
        )

        if not page_text:
            continue

        total_characters += len(
            page_text
        )

        page_chunks = chunk_text(
            page_text
        )

        for content in page_chunks:
            extracted_chunks.append(
                ExtractedChunk(
                    chunk_index=next_chunk_index,
                    page_number=page_number,
                    content=content,
                    char_count=len(content),
                )
            )

            next_chunk_index += 1

    if not extracted_chunks:
        raise ValueError(
            "No extractable text was found. "
            "The PDF may contain scanned images "
            "and require OCR."
        )

    return ProcessedPdf(
        page_count=page_count,
        character_count=total_characters,
        chunks=extracted_chunks,
    )
