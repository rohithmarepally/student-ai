import logging
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from pydantic import BaseModel

from app.core.supabase import (
    get_admin_client,
)
from app.dependencies.auth import (
    AuthenticatedUser,
    get_current_user,
)
from app.services.pdf_processing import (
    ProcessedPdf,
    process_pdf_bytes,
)


logger = logging.getLogger(__name__)


router = APIRouter(
    prefix="/documents",
    tags=["documents"],
)


BUCKET_NAME = "study-documents"

INSERT_BATCH_SIZE = 200


class ProcessDocumentResponse(BaseModel):
    document_id: str
    status: str
    page_count: int
    chunk_count: int
    character_count: int


def mark_document_failed(
    document_id: str,
    error_message: str,
) -> None:
    try:
        admin = get_admin_client()

        (
            admin
            .table("documents")
            .update(
                {
                    "status": "failed",
                    "processing_error": (
                        error_message[:1000]
                    ),
                }
            )
            .eq(
                "id",
                document_id,
            )
            .execute()
        )
    except Exception:
        logger.exception(
            "Could not mark document %s as failed.",
            document_id,
        )


def insert_chunks(
    processed_pdf: ProcessedPdf,
    document_id: str,
    user_id: str,
) -> None:
    admin = get_admin_client()

    rows = [
        {
            "document_id": document_id,
            "user_id": user_id,
            "chunk_index": chunk.chunk_index,
            "page_number": chunk.page_number,
            "content": chunk.content,
            "char_count": chunk.char_count,
        }
        for chunk in processed_pdf.chunks
    ]

    for start in range(
        0,
        len(rows),
        INSERT_BATCH_SIZE,
    ):
        batch = rows[
            start:
            start + INSERT_BATCH_SIZE
        ]

        (
            admin
            .table("document_chunks")
            .insert(batch)
            .execute()
        )


@router.post(
    "/{document_id}/process",
    response_model=ProcessDocumentResponse,
)
def process_document(
    document_id: UUID,
    current_user: Annotated[
        AuthenticatedUser,
        Depends(get_current_user),
    ],
) -> ProcessDocumentResponse:
    admin = get_admin_client()

    document_id_string = str(
        document_id
    )

    try:
        document_response = (
            admin
            .table("documents")
            .select(
                "id, user_id, original_name, "
                "storage_path, status"
            )
            .eq(
                "id",
                document_id_string,
            )
            .eq(
                "user_id",
                current_user.id,
            )
            .limit(1)
            .execute()
        )
    except Exception as exc:
        logger.exception(
            "Document lookup failed."
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Document metadata could not be loaded.",
        ) from exc

    if not document_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document was not found.",
        )

    document = (
        document_response.data[0]
    )

    if document["status"] == "processing":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This document is already being processed.",
        )

    try:
        (
            admin
            .table("documents")
            .update(
                {
                    "status": "processing",
                    "processing_error": None,
                    "processed_at": None,
                    "page_count": None,
                    "character_count": None,
                }
            )
            .eq(
                "id",
                document_id_string,
            )
            .eq(
                "user_id",
                current_user.id,
            )
            .execute()
        )

        (
            admin
            .table("document_chunks")
            .delete()
            .eq(
                "document_id",
                document_id_string,
            )
            .execute()
        )

        pdf_bytes = (
            admin
            .storage
            .from_(BUCKET_NAME)
            .download(
                document[
                    "storage_path"
                ]
            )
        )

        processed_pdf = (
            process_pdf_bytes(
                pdf_bytes
            )
        )

        insert_chunks(
            processed_pdf=processed_pdf,
            document_id=document_id_string,
            user_id=current_user.id,
        )

        processed_at = datetime.now(
            timezone.utc
        ).isoformat()

        (
            admin
            .table("documents")
            .update(
                {
                    "status": "ready",
                    "page_count": (
                        processed_pdf.page_count
                    ),
                    "character_count": (
                        processed_pdf.character_count
                    ),
                    "processed_at": processed_at,
                    "processing_error": None,
                }
            )
            .eq(
                "id",
                document_id_string,
            )
            .eq(
                "user_id",
                current_user.id,
            )
            .execute()
        )

        return ProcessDocumentResponse(
            document_id=document_id_string,
            status="ready",
            page_count=processed_pdf.page_count,
            chunk_count=len(
                processed_pdf.chunks
            ),
            character_count=(
                processed_pdf.character_count
            ),
        )

    except ValueError as exc:
        mark_document_failed(
            document_id_string,
            str(exc),
        )

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        logger.exception(
            "Unexpected processing failure "
            "for document %s.",
            document_id_string,
        )

        mark_document_failed(
            document_id_string,
            "Unexpected document processing error.",
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Document processing failed.",
        ) from exc
