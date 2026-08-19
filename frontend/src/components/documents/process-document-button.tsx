"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import type {
  DocumentStatus,
} from "@/types/document";


const API_URL =
  process.env.NEXT_PUBLIC_API_URL
  ?? "http://127.0.0.1:8000";


type ProcessDocumentButtonProps = {
  documentId: string;
  status: DocumentStatus;
};


export function ProcessDocumentButton({
  documentId,
  status,
}: ProcessDocumentButtonProps) {
  const router = useRouter();

  const [isProcessing, setIsProcessing] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);


  async function handleProcess(): Promise<void> {
    setIsProcessing(true);

    setErrorMessage(null);

    try {
      const supabase = createClient();

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (
        sessionError
        || !session
      ) {
        throw new Error(
          "Your session has expired. Log in again."
        );
      }

      const response = await fetch(
        `${API_URL}/documents/${documentId}/process`,
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${session.access_token}`,
          },
        }
      );

      const payload = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          payload?.detail
          ?? "Document processing failed."
        );
      }

      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Document processing failed.";

      setErrorMessage(message);
    } finally {
      setIsProcessing(false);
    }
  }


  const isAlreadyProcessing =
    status === "processing";


  return (
    <div>
      <button
        type="button"
        onClick={handleProcess}
        disabled={
          isProcessing
          || isAlreadyProcessing
        }
        className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500"
      >
        {isProcessing
          ? "Processing..."
          : isAlreadyProcessing
            ? "Processing"
            : status === "ready"
              ? "Reprocess"
              : "Process PDF"}
      </button>

      {errorMessage ? (
        <p className="mt-2 max-w-xs text-xs leading-5 text-red-300">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
