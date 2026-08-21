"use client";

import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";

import { createClient } from "@/lib/supabase/client";
import type {
  ReadyDocumentOption,
  SemanticSearchResponse,
} from "@/types/search";


const API_URL =
  process.env.NEXT_PUBLIC_API_URL
  ?? "http://127.0.0.1:8000";


const exampleQuestions = [
  "What are the main concepts explained in these documents?",
  "Explain the most important definition in simple terms.",
  "What examples are provided for this topic?",
];


type SemanticSearchPanelProps = {
  readyDocuments: ReadyDocumentOption[];
};


function readErrorMessage(
  payload: unknown
): string | null {
  if (
    typeof payload !== "object"
    || payload === null
    || !("detail" in payload)
  ) {
    return null;
  }

  const detail = (
    payload as {
      detail?: unknown;
    }
  ).detail;

  return typeof detail === "string"
    ? detail
    : null;
}


function isSemanticSearchResponse(
  payload: unknown
): payload is SemanticSearchResponse {
  if (
    typeof payload !== "object"
    || payload === null
    || !("matches" in payload)
  ) {
    return false;
  }

  return Array.isArray(
    (
      payload as {
        matches?: unknown;
      }
    ).matches
  );
}


function formatSimilarity(
  similarity: number
): string {
  const percentage = Math.round(
    Math.max(
      0,
      Math.min(
        similarity,
        1
      )
    ) * 100
  );

  return `${percentage}% match`;
}


export function SemanticSearchPanel({
  readyDocuments,
}: SemanticSearchPanelProps) {
  const [question, setQuestion] =
    useState("");

  const [
    selectedDocumentId,
    setSelectedDocumentId,
  ] = useState("");

  const [
    searchResult,
    setSearchResult,
  ] =
    useState<SemanticSearchResponse | null>(
      null
    );

  const [isSearching, setIsSearching] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState<string | null>(null);


  const hasReadyDocuments =
    readyDocuments.length > 0;


  async function handleSearch(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();

    const cleanedQuestion =
      question.trim();

    if (cleanedQuestion.length < 3) {
      setErrorMessage(
        "Enter a question containing at least 3 characters."
      );

      return;
    }

    setIsSearching(true);
    setErrorMessage(null);
    setSearchResult(null);

    try {
      const supabase = createClient();

      const {
        data: {
          session,
        },
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (
        sessionError
        || !session
      ) {
        throw new Error(
          "Your session has expired. Log in again."
        );
      }

      const response = await fetch(
        `${API_URL}/search`,
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${session.access_token}`,
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(
            {
              question: cleanedQuestion,
              document_id:
                selectedDocumentId
                || null,
              match_count: 5,
              match_threshold: 0,
            }
          ),
        }
      );

      const payload: unknown =
        await response
          .json()
          .catch(
            () => null
          );

      if (!response.ok) {
        throw new Error(
          readErrorMessage(payload)
          ?? "Semantic search failed."
        );
      }

      if (
        !isSemanticSearchResponse(
          payload
        )
      ) {
        throw new Error(
          "The search API returned an invalid response."
        );
      }

      setSearchResult(payload);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Semantic search failed.";

      setErrorMessage(message);
    } finally {
      setIsSearching(false);
    }
  }


  return (
    <section className="grid gap-6 lg:grid-cols-[0.8fr_2fr]">
      <aside className="space-y-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="font-semibold text-white">
            Search scope
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Search every ready document or restrict retrieval to one PDF.
          </p>

          <label
            htmlFor="document-scope"
            className="mt-5 block text-sm font-medium text-slate-300"
          >
            Document
          </label>

          <select
            id="document-scope"
            value={selectedDocumentId}
            onChange={(event) => {
              setSelectedDocumentId(
                event.target.value
              );
            }}
            disabled={!hasReadyDocuments}
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:text-slate-600"
          >
            <option value="">
              All ready documents
            </option>

            {readyDocuments.map(
              (document) => (
                <option
                  key={document.id}
                  value={document.id}
                >
                  {document.original_name}
                </option>
              )
            )}
          </select>

          <p className="mt-3 text-xs leading-5 text-slate-500">
            {readyDocuments.length === 1
              ? "1 ready document is searchable."
              : `${readyDocuments.length} ready documents are searchable.`}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="font-semibold text-white">
            Example questions
          </h2>

          <div className="mt-4 space-y-3">
            {exampleQuestions.map(
              (exampleQuestion) => (
                <button
                  key={exampleQuestion}
                  type="button"
                  onClick={() => {
                    setQuestion(
                      exampleQuestion
                    );
                    setErrorMessage(null);
                  }}
                  disabled={!hasReadyDocuments}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 p-4 text-left text-sm leading-6 text-slate-400 transition hover:border-blue-500/40 hover:text-slate-200 disabled:cursor-not-allowed disabled:hover:border-slate-800 disabled:hover:text-slate-400"
                >
                  {exampleQuestion}
                </button>
              )
            )}
          </div>
        </div>
      </aside>

      <section className="flex min-h-[560px] flex-col rounded-2xl border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 px-6 py-5">
          <h2 className="font-semibold text-white">
            Retrieved study passages
          </h2>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            This shows semantic-search results only. No AI answer is generated yet.
          </p>
        </div>

        <form
          onSubmit={handleSearch}
          className="border-b border-slate-800 p-5"
        >
          <label
            htmlFor="semantic-question"
            className="block text-sm font-medium text-slate-300"
          >
            Question
          </label>

          <textarea
            id="semantic-question"
            value={question}
            onChange={(event) => {
              setQuestion(
                event.target.value
              );
            }}
            disabled={
              !hasReadyDocuments
              || isSearching
            }
            required
            minLength={3}
            maxLength={1000}
            rows={3}
            placeholder="For example: What causes a deadlock?"
            className="mt-2 min-h-24 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500 disabled:cursor-not-allowed disabled:text-slate-600"
          />

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              {question.length.toLocaleString()} / 1,000 characters
            </p>

            <button
              type="submit"
              disabled={
                !hasReadyDocuments
                || isSearching
              }
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
            >
              {isSearching
                ? "Searching..."
                : "Find relevant chunks"}
            </button>
          </div>
        </form>

        <div
          aria-live="polite"
          className="flex-1 p-5"
        >
          {!hasReadyDocuments ? (
            <div className="flex h-full min-h-72 items-center justify-center text-center">
              <div className="max-w-md">
                <span
                  aria-hidden="true"
                  className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700 bg-slate-950 font-bold text-blue-300"
                >
                  D
                </span>

                <h3 className="mt-5 text-lg font-semibold text-white">
                  No searchable documents
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Upload and process a text-based PDF before using semantic search.
                </p>

                <Link
                  href="/documents"
                  className="mt-5 inline-flex rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/20"
                >
                  Go to documents
                </Link>
              </div>
            </div>
          ) : errorMessage ? (
            <div
              role="alert"
              className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm leading-6 text-red-300"
            >
              {errorMessage}
            </div>
          ) : isSearching ? (
            <div className="flex min-h-72 items-center justify-center text-center">
              <div>
                <span
                  aria-hidden="true"
                  className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-blue-400"
                />

                <p className="mt-4 text-sm text-slate-400">
                  Embedding your question and searching your document chunks...
                </p>
              </div>
            </div>
          ) : searchResult ? (
            <div>
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
                    Search completed
                  </p>

                  <h3 className="mt-2 text-lg font-semibold text-white">
                    {searchResult.match_count === 1
                      ? "1 relevant chunk"
                      : `${searchResult.match_count} relevant chunks`}
                  </h3>
                </div>

                <p className="max-w-xl text-sm text-slate-400">
                  “{searchResult.question}”
                </p>
              </div>

              {searchResult.matches.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-center">
                  <h3 className="font-semibold text-white">
                    No relevant chunks found
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Try different wording or search across all ready documents.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {searchResult.matches.map(
                    (
                      match,
                      index
                    ) => (
                      <article
                        key={match.chunk_id}
                        className="rounded-xl border border-slate-800 bg-slate-950 p-5"
                      >
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-full bg-blue-500/10 px-3 py-1 font-semibold text-blue-300">
                            Result {index + 1}
                          </span>

                          <span className="rounded-full border border-slate-700 px-3 py-1 text-slate-300">
                            Page {match.page_number}
                          </span>

                          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-semibold text-emerald-300">
                            {formatSimilarity(
                              match.similarity
                            )}
                          </span>
                        </div>

                        <h4 className="mt-4 break-all text-sm font-semibold text-white">
                          {match.original_name}
                        </h4>

                        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-300">
                          {match.content}
                        </p>
                      </article>
                    )
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex min-h-72 items-center justify-center text-center">
              <div className="max-w-md">
                <span
                  aria-hidden="true"
                  className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700 bg-slate-950 font-bold text-blue-300"
                >
                  S
                </span>

                <h3 className="mt-5 text-lg font-semibold text-white">
                  Ask about your study material
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Your most semantically relevant PDF passages will appear here with their page numbers.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
