"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import type {
  FormEvent,
} from "react";

import {
  createClient,
} from "@/lib/supabase/client";

import type {
  DueFlashcard,
  DueFlashcardsResponse,
  Flashcard,
  FlashcardDeckDetail,
  FlashcardDeckListResponse,
  FlashcardDeckSummary,
  FlashcardReviewResult,
  ReadyFlashcardDocument,
  ReviewRating,
} from "@/types/flashcard";


const API_URL =
  process.env.NEXT_PUBLIC_API_URL
  ?? "http://127.0.0.1:8000";

type FlashcardPanelProps = {
  documents: ReadyFlashcardDocument[];
};

type StudyCard =
  Flashcard & {
    deck_title?: string;
  };

type ApiErrorBody = {
  detail?: string;
};

type RatingOption = {
  rating: ReviewRating;
  label: string;
  nextReview: string;
};

const ratingOptions: RatingOption[] = [
  {
    rating: "again",
    label: "Again",
    nextReview: "10 minutes",
  },
  {
    rating: "hard",
    label: "Hard",
    nextReview: "About 1 day",
  },
  {
    rating: "good",
    label: "Good",
    nextReview: "About 2 days",
  },
  {
    rating: "easy",
    label: "Easy",
    nextReview: "About 4 days",
  },
];


async function authenticatedApiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const supabase = createClient();

  const {
    data: {
      session,
    },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error(
      "Your session has expired. "
      + "Please log in again.",
    );
  }

  const headers = new Headers(
    init?.headers,
  );

  headers.set(
    "Content-Type",
    "application/json",
  );

  headers.set(
    "Authorization",
    `Bearer ${session.access_token}`,
  );

  const response = await fetch(
    `${API_URL}${path}`,
    {
      ...init,
      headers,
    },
  );

  if (!response.ok) {
    let message =
      "The request could not be completed.";

    try {
      const body = (
        await response.json()
      ) as ApiErrorBody;

      if (body.detail) {
        message = body.detail;
      }
    } catch {
      // The API did not return JSON.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}


function ratingClasses(
  rating: ReviewRating,
): string {
  if (rating === "again") {
    return (
      "border-rose-700 "
      + "text-rose-300 "
      + "hover:bg-rose-950/50"
    );
  }

  if (rating === "hard") {
    return (
      "border-amber-700 "
      + "text-amber-300 "
      + "hover:bg-amber-950/50"
    );
  }

  if (rating === "easy") {
    return (
      "border-blue-700 "
      + "text-blue-300 "
      + "hover:bg-blue-950/50"
    );
  }

  return (
    "border-emerald-700 "
    + "text-emerald-300 "
    + "hover:bg-emerald-950/50"
  );
}


export function FlashcardPanel({
  documents,
}: FlashcardPanelProps) {
  const [
    decks,
    setDecks,
  ] = useState<
    FlashcardDeckSummary[]
  >([]);

  const [
    dueCards,
    setDueCards,
  ] = useState<DueFlashcard[]>([]);

  const [
    studyCards,
    setStudyCards,
  ] = useState<StudyCard[]>([]);

  const [
    currentIndex,
    setCurrentIndex,
  ] = useState(0);

  const [
    isFlipped,
    setIsFlipped,
  ] = useState(false);

  const [
    sessionTitle,
    setSessionTitle,
  ] = useState<string | null>(
    null,
  );

  const [
    documentId,
    setDocumentId,
  ] = useState(
    documents[0]?.id ?? "",
  );

  const [
    topic,
    setTopic,
  ] = useState("");

  const [
    cardCount,
    setCardCount,
  ] = useState(10);

  const [
    isGenerating,
    setIsGenerating,
  ] = useState(false);

  const [
    isLoading,
    setIsLoading,
  ] = useState(false);

  const [
    isReviewing,
    setIsReviewing,
  ] = useState(false);

  const [
    deletingDeckId,
    setDeletingDeckId,
  ] = useState<string | null>(
    null,
  );

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null,
  );

  const currentCard =
    studyCards[currentIndex]
    ?? null;

  const loadDashboard =
    useCallback(async () => {
      const [
        deckResponse,
        dueResponse,
      ] = await Promise.all([
        authenticatedApiFetch<
          FlashcardDeckListResponse
        >("/flashcards"),

        authenticatedApiFetch<
          DueFlashcardsResponse
        >(
          "/flashcards/due?limit=100",
        ),
      ]);

      setDecks(
        deckResponse.decks,
      );

      setDueCards(
        dueResponse.cards,
      );
    }, []);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      authenticatedApiFetch<
        FlashcardDeckListResponse
      >("/flashcards"),

      authenticatedApiFetch<
        DueFlashcardsResponse
      >(
        "/flashcards/due?limit=100",
      ),
    ])
      .then(([
        deckResponse,
        dueResponse,
      ]) => {
        if (cancelled) {
          return;
        }

        setDecks(
          deckResponse.decks,
        );

        setDueCards(
          dueResponse.cards,
        );
      })
      .catch((error: unknown) => {
        if (
          !cancelled
          && error instanceof Error
        ) {
          setErrorMessage(
            error.message,
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleGenerate(
    event: FormEvent<
      HTMLFormElement
    >,
  ) {
    event.preventDefault();

    if (!documentId) {
      setErrorMessage(
        "Choose a processed PDF first.",
      );

      return;
    }

    setErrorMessage(null);
    setIsGenerating(true);

    try {
      const deck = (
        await authenticatedApiFetch<
          FlashcardDeckDetail
        >(
          "/flashcards/generate",
          {
            method: "POST",
            body: JSON.stringify({
              document_id: documentId,
              topic: (
                topic.trim()
                || null
              ),
              card_count: cardCount,
            }),
          },
        )
      );

      setStudyCards(
        deck.cards,
      );

      setCurrentIndex(0);
      setIsFlipped(false);
      setSessionTitle(deck.title);

      await loadDashboard();
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : (
              "The flashcards could "
              + "not be generated."
            ),
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleOpenDeck(
    deckId: string,
  ) {
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const deck = (
        await authenticatedApiFetch<
          FlashcardDeckDetail
        >(`/flashcards/${deckId}`)
      );

      setStudyCards(
        deck.cards,
      );

      setCurrentIndex(0);
      setIsFlipped(false);
      setSessionTitle(deck.title);
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : (
              "The flashcard deck "
              + "could not be opened."
            ),
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleStartDueReview() {
    setStudyCards(dueCards);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionTitle(
      "Cards due now",
    );
    setErrorMessage(null);
  }

  async function handleReview(
    rating: ReviewRating,
  ) {
    if (
      !currentCard
      || !isFlipped
    ) {
      return;
    }

    setErrorMessage(null);
    setIsReviewing(true);

    try {
      await authenticatedApiFetch<
        FlashcardReviewResult
      >(
        (
          "/flashcards/cards/"
          + currentCard.id
          + "/review"
        ),
        {
          method: "POST",
          body: JSON.stringify({
            rating,
          }),
        },
      );

      if (
        currentIndex
        < studyCards.length - 1
      ) {
        setCurrentIndex(
          (index) => index + 1,
        );

        setIsFlipped(false);
      } else {
        setStudyCards([]);
        setCurrentIndex(0);
        setIsFlipped(false);
        setSessionTitle(
          "Review complete",
        );
      }

      await loadDashboard();
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : (
              "The review could "
              + "not be saved."
            ),
      );
    } finally {
      setIsReviewing(false);
    }
  }

  async function handleDeleteDeck(
    deckId: string,
  ) {
    const confirmed = window.confirm(
      "Delete this deck and all "
      + "of its review history?",
    );

    if (!confirmed) {
      return;
    }

    setDeletingDeckId(deckId);
    setErrorMessage(null);

    try {
      await authenticatedApiFetch<void>(
        `/flashcards/${deckId}`,
        {
          method: "DELETE",
        },
      );

      if (
        currentCard?.deck_id
        === deckId
      ) {
        setStudyCards([]);
        setCurrentIndex(0);
        setIsFlipped(false);
        setSessionTitle(null);
      }

      await loadDashboard();
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : (
              "The deck could "
              + "not be deleted."
            ),
      );
    } finally {
      setDeletingDeckId(null);
    }
  }

  return (
    <div className="space-y-8">
      {errorMessage ? (
        <div
          role="alert"
          className={
            "rounded-2xl border "
            + "border-rose-800 "
            + "bg-rose-950/40 "
            + "px-5 py-4 "
            + "text-sm text-rose-200"
          }
        >
          {errorMessage}
        </div>
      ) : null}

      <section
        className={
          "grid gap-6 "
          + "xl:grid-cols-[360px_1fr]"
        }
      >
        <div className="space-y-6">
          <form
            onSubmit={handleGenerate}
            className={
              "rounded-2xl border "
              + "border-slate-800 "
              + "bg-slate-900 p-6"
            }
          >
            <h2
              className={
                "text-lg font-semibold "
                + "text-white"
              }
            >
              Generate flashcards
            </h2>

            <p
              className={
                "mt-2 text-sm "
                + "leading-6 "
                + "text-slate-400"
              }
            >
              Create source-backed cards
              from one processed PDF.
            </p>

            <div className="mt-6 space-y-5">
              <label className="block">
                <span
                  className={
                    "text-sm font-medium "
                    + "text-slate-200"
                  }
                >
                  Study document
                </span>

                <select
                  value={documentId}
                  onChange={(event) => {
                    setDocumentId(
                      event.target.value,
                    );
                  }}
                  disabled={
                    documents.length === 0
                    || isGenerating
                  }
                  className={
                    "mt-2 w-full "
                    + "rounded-xl border "
                    + "border-slate-700 "
                    + "bg-slate-950 "
                    + "px-4 py-3 "
                    + "text-sm text-white "
                    + "outline-none "
                    + "focus:border-blue-500"
                  }
                >
                  {documents.length === 0 ? (
                    <option value="">
                      No ready PDFs
                    </option>
                  ) : null}

                  {documents.map(
                    (document) => (
                      <option
                        key={document.id}
                        value={document.id}
                      >
                        {
                          document
                            .original_name
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="block">
                <span
                  className={
                    "text-sm font-medium "
                    + "text-slate-200"
                  }
                >
                  Topic (optional)
                </span>

                <input
                  value={topic}
                  onChange={(event) => {
                    setTopic(
                      event.target.value,
                    );
                  }}
                  maxLength={200}
                  disabled={isGenerating}
                  placeholder={
                    "Example: deadlocks"
                  }
                  className={
                    "mt-2 w-full "
                    + "rounded-xl border "
                    + "border-slate-700 "
                    + "bg-slate-950 "
                    + "px-4 py-3 "
                    + "text-sm text-white "
                    + "outline-none "
                    + "placeholder:text-slate-600 "
                    + "focus:border-blue-500"
                  }
                />
              </label>

              <label className="block">
                <span
                  className={
                    "text-sm font-medium "
                    + "text-slate-200"
                  }
                >
                  Number of cards
                </span>

                <select
                  value={cardCount}
                  onChange={(event) => {
                    setCardCount(
                      Number(
                        event.target.value,
                      ),
                    );
                  }}
                  disabled={isGenerating}
                  className={
                    "mt-2 w-full "
                    + "rounded-xl border "
                    + "border-slate-700 "
                    + "bg-slate-950 "
                    + "px-4 py-3 "
                    + "text-sm text-white "
                    + "outline-none "
                    + "focus:border-blue-500"
                  }
                >
                  {[
                    5,
                    8,
                    10,
                    12,
                    15,
                    20,
                  ].map((count) => (
                    <option
                      key={count}
                      value={count}
                    >
                      {count}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button
              type="submit"
              disabled={
                !documentId
                || isGenerating
              }
              className={
                "mt-6 w-full "
                + "rounded-xl bg-blue-600 "
                + "px-4 py-3 "
                + "text-sm font-semibold "
                + "text-white "
                + "transition "
                + "hover:bg-blue-500 "
                + "disabled:cursor-not-allowed "
                + "disabled:bg-slate-700 "
                + "disabled:text-slate-400"
              }
            >
              {isGenerating
                ? "Generating..."
                : "Generate flashcards"}
            </button>
          </form>

          <section
            className={
              "rounded-2xl border "
              + "border-slate-800 "
              + "bg-slate-900 p-6"
            }
          >
            <div
              className={
                "flex items-center "
                + "justify-between gap-4"
              }
            >
              <div>
                <h2
                  className={
                    "font-semibold "
                    + "text-white"
                  }
                >
                  Due cards
                </h2>

                <p
                  className={
                    "mt-1 text-sm "
                    + "text-slate-400"
                  }
                >
                  {dueCards.length}
                  {" ready to review"}
                </p>
              </div>

              <button
                type="button"
                onClick={
                  handleStartDueReview
                }
                disabled={
                  dueCards.length === 0
                }
                className={
                  "rounded-lg bg-blue-600 "
                  + "px-3 py-2 "
                  + "text-xs font-semibold "
                  + "text-white "
                  + "hover:bg-blue-500 "
                  + "disabled:cursor-not-allowed "
                  + "disabled:bg-slate-700"
                }
              >
                Review
              </button>
            </div>
          </section>

          <section
            className={
              "rounded-2xl border "
              + "border-slate-800 "
              + "bg-slate-900 p-6"
            }
          >
            <h2
              className={
                "font-semibold text-white"
              }
            >
              Saved decks
            </h2>

            {decks.length === 0 ? (
              <p
                className={
                  "mt-4 text-sm "
                  + "text-slate-500"
                }
              >
                No decks generated yet.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {decks.map((deck) => (
                  <article
                    key={deck.id}
                    className={
                      "rounded-xl border "
                      + "border-slate-800 "
                      + "bg-slate-950 p-4"
                    }
                  >
                    <button
                      type="button"
                      onClick={() => {
                        void handleOpenDeck(
                          deck.id,
                        );
                      }}
                      disabled={isLoading}
                      className={
                        "w-full text-left"
                      }
                    >
                      <p
                        className={
                          "font-medium "
                          + "text-slate-100 "
                          + "hover:text-blue-300"
                        }
                      >
                        {deck.title}
                      </p>

                      <p
                        className={
                          "mt-1 truncate "
                          + "text-xs "
                          + "text-slate-500"
                        }
                      >
                        {deck.original_name}
                      </p>

                      <p
                        className={
                          "mt-2 text-xs "
                          + "text-slate-400"
                        }
                      >
                        {deck.card_count}
                        {" cards"}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        void handleDeleteDeck(
                          deck.id,
                        );
                      }}
                      disabled={
                        deletingDeckId
                        === deck.id
                      }
                      className={
                        "mt-3 text-xs "
                        + "font-medium "
                        + "text-rose-400 "
                        + "hover:text-rose-300 "
                        + "disabled:text-slate-600"
                      }
                    >
                      {deletingDeckId
                        === deck.id
                        ? "Deleting..."
                        : "Delete"}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <section
          className={
            "min-h-[640px] "
            + "rounded-2xl border "
            + "border-slate-800 "
            + "bg-slate-900 p-6 "
            + "sm:p-8"
          }
        >
          {!currentCard ? (
            <div
              className={
                "flex min-h-[540px] "
                + "items-center "
                + "justify-center "
                + "text-center"
              }
            >
              <div className="max-w-md">
                <div
                  aria-hidden="true"
                  className={
                    "mx-auto flex h-14 "
                    + "w-14 items-center "
                    + "justify-center "
                    + "rounded-2xl border "
                    + "border-slate-700 "
                    + "bg-slate-950 "
                    + "font-bold "
                    + "text-blue-300"
                  }
                >
                  F
                </div>

                <h2
                  className={
                    "mt-5 text-xl "
                    + "font-semibold "
                    + "text-white"
                  }
                >
                  {sessionTitle
                    ?? "Start studying"}
                </h2>

                <p
                  className={
                    "mt-2 text-sm "
                    + "leading-6 "
                    + "text-slate-400"
                  }
                >
                  Generate a deck, open a
                  saved deck, or review cards
                  that are currently due.
                </p>
              </div>
            </div>
          ) : (
            <div>
              <div
                className={
                  "flex flex-wrap "
                  + "items-center "
                  + "justify-between gap-3"
                }
              >
                <div>
                  <p
                    className={
                      "text-xs font-semibold "
                      + "uppercase "
                      + "tracking-[0.2em] "
                      + "text-blue-400"
                    }
                  >
                    {
                      currentCard.deck_title
                      ?? sessionTitle
                      ?? "Flashcards"
                    }
                  </p>

                  <p
                    className={
                      "mt-2 text-sm "
                      + "text-slate-400"
                    }
                  >
                    Card{" "}
                    {currentIndex + 1}
                    {" of "}
                    {studyCards.length}
                  </p>
                </div>

                <p
                  className={
                    "text-xs text-slate-500"
                  }
                >
                  Reviews:{" "}
                  {currentCard.review_count}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsFlipped(
                    (value) => !value,
                  );
                }}
                className={
                  "mt-8 flex min-h-[360px] "
                  + "w-full items-center "
                  + "justify-center "
                  + "rounded-3xl border p-8 "
                  + "text-center transition "
                  + "hover:border-blue-500 "
                  + (
                    isFlipped
                      ? (
                          "border-blue-700 "
                          + "bg-blue-950/30"
                        )
                      : (
                          "border-slate-700 "
                          + "bg-slate-950"
                        )
                  )
                }
              >
                <div className="max-w-2xl">
                  <p
                    className={
                      "text-xs font-semibold "
                      + "uppercase "
                      + "tracking-[0.2em] "
                      + (
                        isFlipped
                          ? "text-blue-300"
                          : "text-slate-500"
                      )
                    }
                  >
                    {isFlipped
                      ? "Answer"
                      : "Question"}
                  </p>

                  <p
                    className={
                      "mt-5 text-xl "
                      + "font-semibold "
                      + "leading-9 text-white "
                      + "sm:text-2xl"
                    }
                  >
                    {isFlipped
                      ? currentCard.back
                      : currentCard.front}
                  </p>

                  {!isFlipped ? (
                    <p
                      className={
                        "mt-6 text-sm "
                        + "text-slate-500"
                      }
                    >
                      Think of the answer,
                      then click to reveal it.
                    </p>
                  ) : null}
                </div>
              </button>

              {isFlipped ? (
                <>
                  <div
                    className={
                      "mt-5 rounded-xl "
                      + "border "
                      + "border-slate-800 "
                      + "bg-slate-950 p-4"
                    }
                  >
                    <p
                      className={
                        "text-xs font-semibold "
                        + "uppercase "
                        + "tracking-wide "
                        + "text-blue-300"
                      }
                    >
                      Source ·{" "}
                      {
                        currentCard
                          .source_original_name
                      }
                      {" · page "}
                      {
                        currentCard
                          .source_page_number
                      }
                    </p>

                    <p
                      className={
                        "mt-2 text-sm "
                        + "leading-6 "
                        + "text-slate-400"
                      }
                    >
                      {
                        currentCard
                          .source_content
                      }
                    </p>
                  </div>

                  <div
                    className={
                      "mt-6 grid gap-3 "
                      + "sm:grid-cols-4"
                    }
                  >
                    {ratingOptions.map(
                      (option) => (
                        <button
                          key={
                            option.rating
                          }
                          type="button"
                          onClick={() => {
                            void handleReview(
                              option.rating,
                            );
                          }}
                          disabled={
                            isReviewing
                          }
                          className={
                            "rounded-xl border "
                            + "bg-slate-950 "
                            + "px-3 py-3 "
                            + "text-sm "
                            + "font-semibold "
                            + ratingClasses(
                              option.rating,
                            )
                            + " disabled:"
                            + "cursor-not-allowed "
                            + "disabled:opacity-50"
                          }
                        >
                          <span className="block">
                            {option.label}
                          </span>

                          <span
                            className={
                              "mt-1 block "
                              + "text-xs "
                              + "font-normal "
                              + "text-slate-500"
                            }
                          >
                            {
                              option
                                .nextReview
                            }
                          </span>
                        </button>
                      ),
                    )}
                  </div>
                </>
              ) : null}
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
