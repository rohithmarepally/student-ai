"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  FormEvent,
} from "react";

import {
  authenticatedApiFetch,
} from "@/lib/api/client";
import type {
  ConversationDetail,
  ConversationListResponse,
  ConversationMessage,
  ConversationSummary,
  MessageSource,
  RagResponse,
  ReadyDocumentOption,
} from "@/types/rag";

type RagChatPanelProps = {
  documents: ReadyDocumentOption[];
  documentLoadError: string | null;
};

function getErrorMessage(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : "An unexpected error occurred.";
}

function formatDate(
  value: string,
): string {
  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(new Date(value));
}

function CitationText({
  answer,
  messageId,
  sources,
}: {
  answer: string;
  messageId: string;
  sources: MessageSource[];
}) {
  const knownSourceIds = new Set(
    sources.map(
      (source) => source.source_id,
    ),
  );

  const parts = answer.split(
    /(\[S\d+\])/g,
  );

  return (
    <p className="whitespace-pre-wrap text-sm leading-7 text-slate-200">
      {parts.map((part, index) => {
        const match =
          /^\[(S\d+)\]$/.exec(part);

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
            href={
              `#source-${messageId}-${sourceId}`
            }
            className="mx-0.5 rounded bg-blue-500/15 px-1.5 py-0.5 font-semibold text-blue-300 transition hover:bg-blue-500/25 hover:text-blue-200"
            aria-label={
              `Go to source ${sourceId}`
            }
          >
            {part}
          </a>
        );
      })}
    </p>
  );
}

function SourceCard({
  messageId,
  source,
}: {
  messageId: string;
  source: MessageSource;
}) {
  const similarityPercentage =
    Math.round(
      source.similarity * 100,
    );

  return (
    <article
      id={
        `source-${messageId}-${source.source_id}`
      }
      className="scroll-mt-24 rounded-xl border border-slate-800 bg-slate-950 p-4"
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

      <h4 className="mt-3 text-sm font-semibold text-white">
        {source.original_name}
      </h4>

      <p className="mt-1 text-xs text-slate-500">
        Page {source.page_number}
        {" · "}
        Chunk {source.chunk_index + 1}
      </p>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-400">
        {source.content}
      </p>
    </article>
  );
}

function UserMessage({
  message,
}: {
  message: ConversationMessage;
}) {
  return (
    <article className="flex justify-end">
      <div className="max-w-2xl rounded-2xl rounded-br-md bg-blue-600 px-5 py-4 text-white">
        <p className="whitespace-pre-wrap text-sm leading-6">
          {message.content}
        </p>

        <p className="mt-2 text-right text-xs text-blue-200">
          {formatDate(message.created_at)}
        </p>
      </div>
    </article>
  );
}

function AssistantMessage({
  message,
}: {
  message: ConversationMessage;
}) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-white">
          Student AI Assistant
        </span>

        {message.insufficient_context ? (
          <span className="rounded-lg bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-300">
            Insufficient context
          </span>
        ) : (
          <span className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">
            Grounded
          </span>
        )}
      </div>

      <div className="mt-4">
        <CitationText
          answer={message.content}
          messageId={message.id}
          sources={message.sources}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>
          {formatDate(message.created_at)}
        </span>

        {message.model ? (
          <span>
            Model: {message.model}
          </span>
        ) : null}

        <span>
          Sources: {message.sources.length}
        </span>
      </div>

      {message.sources.length > 0 ? (
        <details className="mt-5">
          <summary className="cursor-pointer text-sm font-semibold text-blue-300">
            View retrieved sources
          </summary>

          <div className="mt-4 space-y-3">
            {message.sources.map(
              (source) => (
                <SourceCard
                  key={source.id}
                  messageId={message.id}
                  source={source}
                />
              ),
            )}
          </div>
        </details>
      ) : null}
    </article>
  );
}

export function RagChatPanel({
  documents,
  documentLoadError,
}: RagChatPanelProps) {
  const [
    conversations,
    setConversations,
  ] = useState<ConversationSummary[]>(
    [],
  );

  const [
    activeConversation,
    setActiveConversation,
  ] = useState<
    ConversationSummary | null
  >(null);

  const [
    messages,
    setMessages,
  ] = useState<ConversationMessage[]>(
    [],
  );

  const [
    selectedDocumentId,
    setSelectedDocumentId,
  ] = useState("");

  const [question, setQuestion] =
    useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    documentLoadError,
  );

  const [
    isLoadingHistory,
    setIsLoadingHistory,
  ] = useState(true);

  const [
    isLoadingConversation,
    setIsLoadingConversation,
  ] = useState(false);

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    deletingConversationId,
    setDeletingConversationId,
  ] = useState<string | null>(
    null,
  );

  const messagesEndRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const hasReadyDocuments =
    documents.length > 0;

  const loadConversationList =
    useCallback(
      async (): Promise<void> => {
        setIsLoadingHistory(true);

        try {
          const response =
            await authenticatedApiFetch<
              ConversationListResponse
            >("/conversations");

          setConversations(
            response.conversations,
          );
        } catch (error) {
          setErrorMessage(
            getErrorMessage(error),
          );
        } finally {
          setIsLoadingHistory(false);
        }
      },
      [],
    );

  useEffect(() => {
    void loadConversationList();
  }, [loadConversationList]);

  useEffect(() => {
    messagesEndRef.current
      ?.scrollIntoView({
        behavior: "smooth",
      });
  }, [messages]);

  function startNewConversation() {
    setActiveConversation(null);
    setMessages([]);
    setSelectedDocumentId("");
    setQuestion("");
    setErrorMessage(
      documentLoadError,
    );
  }

  async function openConversation(
    conversationId: string,
  ) {
    setIsLoadingConversation(true);
    setErrorMessage(null);

    try {
      const detail =
        await authenticatedApiFetch<
          ConversationDetail
        >(
          `/conversations/${conversationId}`,
        );

      setActiveConversation(
        detail.conversation,
      );

      setSelectedDocumentId(
        detail.conversation.document_id
        ?? "",
      );

      setMessages(detail.messages);
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error),
      );
    } finally {
      setIsLoadingConversation(false);
    }
  }

  async function deleteConversation(
    conversation: ConversationSummary,
  ) {
    const shouldDelete = window.confirm(
      `Delete "${conversation.title}"?`,
    );

    if (!shouldDelete) {
      return;
    }

    setDeletingConversationId(
      conversation.id,
    );

    setErrorMessage(null);

    try {
      await authenticatedApiFetch<void>(
        `/conversations/${conversation.id}`,
        {
          method: "DELETE",
        },
      );

      if (
        activeConversation?.id
        === conversation.id
      ) {
        startNewConversation();
      }

      await loadConversationList();
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error),
      );
    } finally {
      setDeletingConversationId(
        null,
      );
    }
  }

  async function submitQuestion(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const cleanedQuestion =
      question.trim();

    if (cleanedQuestion.length < 3) {
      setErrorMessage(
        "Enter a question containing "
        + "at least 3 characters.",
      );
      return;
    }

    if (!hasReadyDocuments) {
      setErrorMessage(
        "Process at least one PDF "
        + "before asking a question.",
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response =
        await authenticatedApiFetch<
          RagResponse
        >(
          "/rag",
          {
            method: "POST",
            body: JSON.stringify({
              question:
                cleanedQuestion,
              document_id:
                selectedDocumentId
                || null,
              conversation_id:
                activeConversation?.id
                ?? null,
            }),
          },
        );

      setQuestion("");

      const detail =
        await authenticatedApiFetch<
          ConversationDetail
        >(
          `/conversations/${response.conversation_id}`,
        );

      setActiveConversation(
        detail.conversation,
      );

      setSelectedDocumentId(
        detail.conversation.document_id
        ?? "",
      );

      setMessages(detail.messages);

      await loadConversationList();
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedDocumentName =
    documents.find(
      (document) =>
        document.id
        === selectedDocumentId,
    )?.original_name;

  return (
    <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 p-4">
          <button
            type="button"
            onClick={startNewConversation}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            New conversation
          </button>
        </div>

        <div className="p-4">
          <h2 className="text-sm font-semibold text-white">
            Conversation history
          </h2>

          {isLoadingHistory ? (
            <p className="mt-4 text-sm text-slate-500">
              Loading conversations…
            </p>
          ) : null}

          {!isLoadingHistory
          && conversations.length === 0 ? (
            <p className="mt-4 text-sm leading-6 text-slate-500">
              Your saved conversations will
              appear here.
            </p>
          ) : null}

          <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto">
            {conversations.map(
              (conversation) => {
                const isActive =
                  activeConversation?.id
                  === conversation.id;

                const isDeleting =
                  deletingConversationId
                  === conversation.id;

                return (
                  <div
                    key={conversation.id}
                    className={
                      isActive
                        ? "rounded-xl border border-blue-500/40 bg-blue-500/10 p-2"
                        : "rounded-xl border border-slate-800 bg-slate-950 p-2"
                    }
                  >
                    <button
                      type="button"
                      onClick={() => {
                        void openConversation(
                          conversation.id,
                        );
                      }}
                      disabled={
                        isDeleting
                        || isLoadingConversation
                      }
                      className="w-full rounded-lg p-2 text-left disabled:cursor-not-allowed"
                    >
                      <span className="block truncate text-sm font-medium text-slate-200">
                        {conversation.title}
                      </span>

                      <span className="mt-1 block text-xs text-slate-500">
                        {formatDate(
                          conversation.updated_at,
                        )}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        void deleteConversation(
                          conversation,
                        );
                      }}
                      disabled={isDeleting}
                      className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-xs font-medium text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:text-slate-600"
                    >
                      {isDeleting
                        ? "Deleting…"
                        : "Delete"}
                    </button>
                  </div>
                );
              },
            )}
          </div>
        </div>
      </aside>

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <header className="border-b border-slate-800 px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-white">
                {activeConversation
                  ? activeConversation.title
                  : "New conversation"}
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                {activeConversation
                  ? "Messages and citation snapshots are saved."
                  : "Choose the document scope before the first question."}
              </p>
            </div>

            {activeConversation ? (
              <span className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                Saved
              </span>
            ) : (
              <span className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-400">
                Not saved yet
              </span>
            )}
          </div>

          <div className="mt-5">
            <label
              htmlFor="document"
              className="block text-sm font-medium text-slate-300"
            >
              Document scope
            </label>

            <select
              id="document"
              value={selectedDocumentId}
              onChange={(event) => {
                setSelectedDocumentId(
                  event.target.value,
                );
              }}
              disabled={
                Boolean(activeConversation)
                || isSubmitting
                || !hasReadyDocuments
              }
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:text-slate-500"
            >
              <option value="">
                All ready documents
              </option>

              {documents.map(
                (document) => (
                  <option
                    key={document.id}
                    value={document.id}
                  >
                    {document.original_name}
                  </option>
                ),
              )}
            </select>

            <p className="mt-2 text-xs leading-5 text-slate-500">
              {activeConversation
                ? (
                    selectedDocumentName
                    ?? "All ready documents"
                  )
                  + " is locked for this conversation. Start a new conversation to change it."
                : "The selected scope becomes locked after the first saved question."}
            </p>
          </div>
        </header>

        <div
          aria-live="polite"
          className="max-h-[680px] min-h-[420px] overflow-y-auto bg-slate-950/40 p-6"
        >
          {errorMessage ? (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
            >
              {errorMessage}
            </div>
          ) : null}

          {isLoadingConversation ? (
            <div className="flex min-h-[320px] items-center justify-center text-center">
              <div>
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-blue-400" />

                <p className="mt-4 text-sm text-slate-400">
                  Loading conversation…
                </p>
              </div>
            </div>
          ) : null}

          {!isLoadingConversation
          && messages.length === 0 ? (
            <div className="flex min-h-[320px] items-center justify-center text-center">
              <div className="max-w-md">
                <span
                  aria-hidden="true"
                  className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700 bg-slate-950 font-bold text-blue-300"
                >
                  AI
                </span>

                <h3 className="mt-5 text-lg font-semibold text-white">
                  Ask your first question
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  The question, grounded answer,
                  page citations, and source
                  snapshots will be saved.
                </p>
              </div>
            </div>
          ) : null}

          {!isLoadingConversation
          && messages.length > 0 ? (
            <div className="space-y-5">
              {messages.map((message) =>
                message.role === "user" ? (
                  <UserMessage
                    key={message.id}
                    message={message}
                  />
                ) : (
                  <AssistantMessage
                    key={message.id}
                    message={message}
                  />
                ),
              )}

              {isSubmitting ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-700 border-t-blue-400" />

                    <p className="text-sm text-slate-400">
                      Retrieving evidence and
                      generating an answer…
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div ref={messagesEndRef} />
        </div>

        <form
          onSubmit={submitQuestion}
          className="border-t border-slate-800 p-5"
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
              setQuestion(
                event.target.value,
              );
            }}
            rows={3}
            minLength={3}
            maxLength={1000}
            disabled={
              isSubmitting
              || isLoadingConversation
              || !hasReadyDocuments
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
                || isLoadingConversation
                || !hasReadyDocuments
                || question.trim().length < 3
              }
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
            >
              {isSubmitting
                ? "Generating…"
                : "Send"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
