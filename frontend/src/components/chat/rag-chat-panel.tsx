"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type {
  RagResponse,
  RagSource,
  ReadyDocumentOption,
} from "@/types/rag";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL
  ?? "http://127.0.0.1:8000"
).replace(/\/$/, "");

const EXAMPLE_QUESTIONS = [
  "What are the main ideas in these documents?",
  "Explain the most important concept in simple terms.",
  "What should I revise before an exam?",
];

type RagChatPanelProps = {
  documents: ReadyDocumentOption[];
  documentLoadError: string | null;
};

type ApiErrorPayload = {
  detail?: unknown;
};

async function getApiErrorMessage(
  response: Response,
): Promise<string> {
  const fallbackMessage =
    `The request failed with status ${response.status}.`;

  try {
    const payload =
      (await response.json()) as ApiErrorPayload;

    if (
      typeof payload.detail === "string"
      && payload.detail.trim()
    ) {
      return payload.detail;
    }
  } catch {
    return fallbackMessage;
  }

  return fallbackMessage;
}

function CitationAnswer({
  answer,
  sources,
}: {
  answer: string;
  sources: RagSource[];
}) {
  const knownSourceIds = new Set(
    sources.map((source) => source.source_id),
  );

  const parts = answer.split(/(\[S\d+\])/g);

  return (
    <p className="whitespace-pre-wrap text-sm leading-7 text-slate-200">
      {parts.map((part, index) => {
        const match = /^\[(S\d+)\]$/.exec(part);

        if (
          !match
          || !knownSourceIds.has(match[1])
        ) {
          return (
            <span key={`${part}-${index}`}>
              {part}
            </span>
          );
        }

        const sourceId = match[1];

        return (
          <a
            key={`${part}-${index}`}
            href={`#source-${sourceId}`}
            className="mx-0.5 rounded bg-blue-500/15 px-1.5 py-0.5 font-semibold text-blue-300 transition hover:bg-blue-500/25 hover:text-blue-200"
            aria-label={`Go to source ${sourceId}`}
          >
            {part}
          </a>
        );
      })}
    </p>
  );
}

function SourceCard({
  source,
}: {
  source: RagSource;
}) {
  const similarityPercentage = Math.round(
    source.similarity * 100,
  );

  return (
    <article
      id={`source-${source.source_id}`}
      className="scroll-mt-24 rounded-2xl border border-slate-800 bg-slate-950 p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-lg bg-blue-500/15 px-2.5 py-1 text-xs font-semibold text-blue-300">
          {source.source_id}
        </span>

        {source.cited ? (
          <span className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">
            Used in answer
          </span>
        ) : (
          <span className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-400">
            Retrieved context
          </span>
        )}

        <span className="text-xs text-slate-500">
          {similarityPercentage}% similarity
        </span>
      </div>

      <h4 className="mt-4 font-semibold text-white">
        {source.original_name}
      </h4>

      <p className="mt-1 text-xs text-slate-500">
        Page {source.page_number}
        {" · "}
        Chunk {source.chunk_index + 1}
      </p>

      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-400">
        {source.content}
      </p>
    </article>
  );
}

export function RagChatPanel({
  documents,
  documentLoadError,
}: RagChatPanelProps) {
  const [question, setQuestion] = useState("");
  const [
    selectedDocumentId,
    setSelectedDocumentId,
  ] = useState("");
  const [result, setResult] =
    useState<RagResponse | null>(null);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(documentLoadError);
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const hasReadyDocuments = documents.length > 0;

  async function submitQuestion(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const cleanedQuestion = question.trim();

    if (cleanedQuestion.length < 3) {
      setErrorMessage(
        "Enter a question containing at least 3 characters.",
      );
      return;
    }

    if (!hasReadyDocuments) {
      setErrorMessage(
        "Process at least one PDF before asking a question.",
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setResult(null);

    try {
      const supabase = createClient();

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        throw new Error(
          "Your session is unavailable. Please log in again.",
        );
      }

      const response = await fetch(`${API_URL}/rag`, {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: cleanedQuestion,
          document_id:
            selectedDocumentId || null,
        }),
      });

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(response),
        );
      }

      const responseData =
        (await response.json()) as RagResponse;

      setResult(responseData);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <aside className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="font-semibold text-white">
            Search scope
          </h2>

          <label
            htmlFor="document"
            className="mt-5 block text-sm font-medium text-slate-300"
          >
            Document
          </label>

          <select
            id="document"
            value={selectedDocumentId}
            onChange={(event) => {
              setSelectedDocumentId(
                event.target.value,
              );
            }}
            disabled={!hasReadyDocuments}
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:text-slate-600"
          >
            <option value="">
              All ready documents
            </option>

            {documents.map((document) => (
              <option
                key={document.id}
                value={document.id}
              >
                {document.original_name}
              </option>
            ))}
          </select>

          <p className="mt-3 text-xs leading-5 text-slate-500">
            Selecting one PDF limits retrieval to that
            document. Otherwise, all your ready PDFs are
            searched.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="font-semibold text-white">
            Example questions
          </h2>

          <div className="mt-5 space-y-3">
            {EXAMPLE_QUESTIONS.map(
              (exampleQuestion) => (
                <button
                  key={exampleQuestion}
                  type="button"
                  onClick={() => {
                    setQuestion(exampleQuestion);
                  }}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 p-4 text-left text-sm leading-6 text-slate-400 transition hover:border-slate-700 hover:text-slate-200"
                >
                  {exampleQuestion}
                </button>
              ),
            )}
          </div>
        </section>
      </aside>

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 px-6 py-5">
          <h2 className="font-semibold text-white">
            Ask your documents
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            The answer must be supported by retrieved PDF
            chunks and citations.
          </p>
        </div>

        <form
          onSubmit={submitQuestion}
          className="border-b border-slate-800 p-5"
        >
          <label
            htmlFor="question"
            className="sr-only"
          >
            Question
          </label>

          <textarea
            id="question"
            value={question}
            onChange={(event) => {
              setQuestion(event.target.value);
            }}
            rows={3}
            minLength={3}
            maxLength={1000}
            disabled={
              isSubmitting || !hasReadyDocuments
            }
            placeholder={
              hasReadyDocuments
                ? "Ask a question about your study material..."
                : "Process a PDF before asking a question..."
            }
            className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-blue-500 disabled:cursor-not-allowed"
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              {question.length}/1000 characters
            </span>

            <button
              type="submit"
              disabled={
                isSubmitting
                || !hasReadyDocuments
                || question.trim().length < 3
              }
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
            >
              {isSubmitting
                ? "Finding evidence..."
                : "Generate answer"}
            </button>
          </div>
        </form>

        <div
          aria-live="polite"
          className="min-h-[340px] p-6"
        >
          {errorMessage ? (
            <div
              role="alert"
              className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
            >
              {errorMessage}
            </div>
          ) : null}

          {isSubmitting ? (
            <div className="flex min-h-[280px] items-center justify-center text-center">
              <div>
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-blue-400" />

                <p className="mt-4 text-sm text-slate-400">
                  Retrieving chunks and generating a
                  grounded answer…
                </p>
              </div>
            </div>
          ) : null}

          {!isSubmitting
          && !result
          && !errorMessage ? (
            <div className="flex min-h-[280px] items-center justify-center text-center">
              <div className="max-w-md">
                <span
                  aria-hidden="true"
                  className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700 bg-slate-950 font-bold text-blue-300"
                >
                  AI
                </span>

                <h3 className="mt-5 text-lg font-semibold text-white">
                  Your grounded answer will appear here
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  The assistant retrieves relevant chunks
                  first, then generates an answer that cites
                  those chunks.
                </p>
              </div>
            </div>
          ) : null}

          {result ? (
            <div className="space-y-8">
              <section>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-white">
                    Answer
                  </h3>

                  {result.insufficient_context ? (
                    <span className="rounded-lg bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-300">
                      Insufficient context
                    </span>
                  ) : (
                    <span className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                      Grounded
                    </span>
                  )}
                </div>

                <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950 p-5">
                  <CitationAnswer
                    answer={result.answer}
                    sources={result.sources}
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>
                    Retrieved: {result.retrieved_count}
                  </span>

                  <span>
                    Citations:{" "}
                    {result.cited_source_ids.length}
                  </span>

                  {result.model ? (
                    <span>
                      Model: {result.model}
                    </span>
                  ) : null}
                </div>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-white">
                  Retrieved sources
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Green labels identify chunks directly cited
                  in the answer.
                </p>

                {result.sources.length > 0 ? (
                  <div className="mt-4 space-y-4">
                    {result.sources.map((source) => (
                      <SourceCard
                        key={source.source_id}
                        source={source}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
                    No relevant chunks were found.
                  </div>
                )}
              </section>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
