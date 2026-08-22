"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/client";

import type {
  QuizDetail,
  QuizDifficulty,
  QuizListResponse,
  QuizSubmissionResult,
  QuizSummary,
  ReadyQuizDocument,
} from "@/types/quiz";


const API_URL =
  process.env.NEXT_PUBLIC_API_URL
  ?? "http://127.0.0.1:8000";

type QuizPanelProps = {
  documents: ReadyQuizDocument[];
};

type ApiErrorBody = {
  detail?: string;
};

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
      "Your session has expired. Please log in again.",
    );
  }

  const response = await fetch(
    `${API_URL}${path}`,
    {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: (
          `Bearer ${session.access_token}`
        ),
        ...init?.headers,
      },
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

function formatDate(
  dateValue: string,
): string {
  return new Intl.DateTimeFormat(
    "en",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(
    new Date(dateValue),
  );
}

function difficultyClasses(
  difficulty: QuizDifficulty,
): string {
  if (difficulty === "easy") {
    return (
      "border-emerald-800 "
      + "bg-emerald-950/50 "
      + "text-emerald-300"
    );
  }

  if (difficulty === "hard") {
    return (
      "border-rose-800 "
      + "bg-rose-950/50 "
      + "text-rose-300"
    );
  }

  return (
    "border-amber-800 "
    + "bg-amber-950/50 "
    + "text-amber-300"
  );
}

export function QuizPanel({
  documents,
}: QuizPanelProps) {
  const [
    quizzes,
    setQuizzes,
  ] = useState<QuizSummary[]>([]);

  const [
    activeQuiz,
    setActiveQuiz,
  ] = useState<QuizDetail | null>(
    null,
  );

  const [
    submission,
    setSubmission,
  ] = useState<
    QuizSubmissionResult | null
  >(null);

  const [
    selectedAnswers,
    setSelectedAnswers,
  ] = useState<
    Record<string, number>
  >({});

  const [
    documentId,
    setDocumentId,
  ] = useState(
    documents[0]?.id
    ?? "",
  );

  const [
    topic,
    setTopic,
  ] = useState("");

  const [
    difficulty,
    setDifficulty,
  ] = useState<QuizDifficulty>(
    "medium",
  );

  const [
    questionCount,
    setQuestionCount,
  ] = useState(5);

  const [
    isGenerating,
    setIsGenerating,
  ] = useState(false);

  const [
    isLoadingQuiz,
    setIsLoadingQuiz,
  ] = useState(false);

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    deletingQuizId,
    setDeletingQuizId,
  ] = useState<string | null>(
    null,
  );

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null,
  );

  const loadQuizList =
    useCallback(async () => {
      const response =
        await authenticatedApiFetch<
          QuizListResponse
        >("/quizzes");

      setQuizzes(response.quizzes);
    }, []);

  useEffect(() => {
    let cancelled = false;

    authenticatedApiFetch<
      QuizListResponse
    >("/quizzes")
      .then((response) => {
        if (!cancelled) {
          setQuizzes(
            response.quizzes,
          );
        }
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

  const answeredCount = useMemo(
    () => (
      Object.keys(
        selectedAnswers,
      ).length
    ),
    [selectedAnswers],
  );

  const resultByQuestion =
    useMemo(
      () => new Map(
        submission?.answers.map(
          (answer) => [
            answer.question_id,
            answer,
          ],
        )
        ?? [],
      ),
      [submission],
    );

  async function handleGenerate(
    event: React.FormEvent<
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
      const quiz =
        await authenticatedApiFetch<
          QuizDetail
        >(
          "/quizzes/generate",
          {
            method: "POST",
            body: JSON.stringify({
              document_id: documentId,
              topic: (
                topic.trim()
                || null
              ),
              difficulty,
              question_count: (
                questionCount
              ),
            }),
          },
        );

      setActiveQuiz(quiz);
      setSubmission(null);
      setSelectedAnswers({});

      await loadQuizList();
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : (
              "The quiz could not "
              + "be generated."
            ),
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleOpenQuiz(
    quizId: string,
  ) {
    setErrorMessage(null);
    setIsLoadingQuiz(true);

    try {
      const quiz =
        await authenticatedApiFetch<
          QuizDetail
        >(`/quizzes/${quizId}`);

      setActiveQuiz(quiz);
      setSubmission(null);
      setSelectedAnswers({});
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : (
              "The quiz could not "
              + "be opened."
            ),
      );
    } finally {
      setIsLoadingQuiz(false);
    }
  }

  async function handleSubmit() {
    if (!activeQuiz) {
      return;
    }

    if (
      answeredCount
      !== activeQuiz.question_count
    ) {
      setErrorMessage(
        "Answer every question "
        + "before submitting.",
      );

      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const result =
        await authenticatedApiFetch<
          QuizSubmissionResult
        >(
          (
            `/quizzes/${activeQuiz.id}`
            + "/submit"
          ),
          {
            method: "POST",
            body: JSON.stringify({
              answers:
                activeQuiz.questions.map(
                  (question) => ({
                    question_id:
                      question.id,
                    selected_option_index:
                      selectedAnswers[
                        question.id
                      ],
                  }),
                ),
            }),
          },
        );

      setSubmission(result);
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : (
              "The quiz could not "
              + "be submitted."
            ),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteQuiz(
    quizId: string,
  ) {
    const confirmed = window.confirm(
      "Delete this quiz and all of "
      + "its attempts?",
    );

    if (!confirmed) {
      return;
    }

    setErrorMessage(null);
    setDeletingQuizId(quizId);

    try {
      await authenticatedApiFetch<void>(
        `/quizzes/${quizId}`,
        {
          method: "DELETE",
        },
      );

      if (
        activeQuiz?.id
        === quizId
      ) {
        setActiveQuiz(null);
        setSubmission(null);
        setSelectedAnswers({});
      }

      await loadQuizList();
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : (
              "The quiz could not "
              + "be deleted."
            ),
      );
    } finally {
      setDeletingQuizId(null);
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
            + "px-5 py-4 text-sm "
            + "text-rose-200"
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
              Generate a quiz
            </h2>

            <p
              className={
                "mt-2 text-sm "
                + "leading-6 "
                + "text-slate-400"
              }
            >
              Questions will be grounded
              in one processed PDF.
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
                  placeholder={
                    "Example: deadlocks"
                  }
                  disabled={isGenerating}
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
                  Difficulty
                </span>

                <select
                  value={difficulty}
                                    onChange={(event) => {
                    setDifficulty(
                      event.target.value as QuizDifficulty,
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
                  <option value="easy">
                    Easy
                  </option>
                  <option value="medium">
                    Medium
                  </option>
                  <option value="hard">
                    Hard
                  </option>
                </select>
              </label>

              <label className="block">
                <span
                  className={
                    "text-sm font-medium "
                    + "text-slate-200"
                  }
                >
                  Number of questions
                </span>

                <select
                  value={questionCount}
                  onChange={(event) => {
                    setQuestionCount(
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
                  {[3, 4, 5, 6, 7, 8, 9, 10]
                    .map((count) => (
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
                + "rounded-xl "
                + "bg-blue-600 "
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
                ? "Generating quiz..."
                : "Generate quiz"}
            </button>

            <p
              className={
                "mt-3 text-xs "
                + "leading-5 "
                + "text-slate-500"
              }
            >
              Generation uses one embedding
              request and one Gemini request.
            </p>
          </form>

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
              Saved quizzes
            </h2>

            {quizzes.length === 0 ? (
              <p
                className={
                  "mt-4 text-sm "
                  + "leading-6 "
                  + "text-slate-500"
                }
              >
                Generated quizzes will
                appear here.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {quizzes.map((quiz) => (
                  <article
                    key={quiz.id}
                    className={
                      "rounded-xl border "
                      + "border-slate-800 "
                      + "bg-slate-950 p-4"
                    }
                  >
                    <button
                      type="button"
                      onClick={() => {
                        void handleOpenQuiz(
                          quiz.id,
                        );
                      }}
                      disabled={
                        isLoadingQuiz
                      }
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
                        {quiz.title}
                      </p>

                      <p
                        className={
                          "mt-1 truncate "
                          + "text-xs "
                          + "text-slate-500"
                        }
                      >
                        {quiz.original_name}
                      </p>

                      <div
                        className={
                          "mt-3 flex "
                          + "flex-wrap "
                          + "items-center gap-2"
                        }
                      >
                        <span
                          className={
                            "rounded-full "
                            + "border px-2 py-1 "
                            + "text-xs capitalize "
                            + difficultyClasses(
                              quiz.difficulty,
                            )
                          }
                        >
                          {quiz.difficulty}
                        </span>

                        <span
                          className={
                            "text-xs "
                            + "text-slate-500"
                          }
                        >
                          {
                            quiz
                              .question_count
                          }{" "}
                          questions
                        </span>
                      </div>

                      <p
                        className={
                          "mt-3 text-xs "
                          + "text-slate-600"
                        }
                      >
                        {formatDate(
                          quiz.created_at,
                        )}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        void handleDeleteQuiz(
                          quiz.id,
                        );
                      }}
                      disabled={
                        deletingQuizId
                        === quiz.id
                      }
                      className={
                        "mt-3 text-xs "
                        + "font-medium "
                        + "text-rose-400 "
                        + "hover:text-rose-300 "
                        + "disabled:text-slate-600"
                      }
                    >
                      {deletingQuizId
                        === quiz.id
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
            "min-h-[600px] "
            + "rounded-2xl border "
            + "border-slate-800 "
            + "bg-slate-900 p-6 "
            + "sm:p-8"
          }
        >
          {!activeQuiz ? (
            <div
              className={
                "flex min-h-[520px] "
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
                  Q
                </div>

                <h2
                  className={
                    "mt-5 text-xl "
                    + "font-semibold "
                    + "text-white"
                  }
                >
                  Test your understanding
                </h2>

                <p
                  className={
                    "mt-2 text-sm "
                    + "leading-6 "
                    + "text-slate-400"
                  }
                >
                  Generate a grounded quiz
                  or open a saved quiz.
                </p>
              </div>
            </div>
          ) : (
            <div>
              <div
                className={
                  "border-b "
                  + "border-slate-800 "
                  + "pb-6"
                }
              >
                <div
                  className={
                    "flex flex-wrap "
                    + "items-start "
                    + "justify-between gap-4"
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
                      Grounded quiz
                    </p>

                    <h2
                      className={
                        "mt-2 text-2xl "
                        + "font-bold "
                        + "text-white"
                      }
                    >
                      {activeQuiz.title}
                    </h2>

                    <p
                      className={
                        "mt-2 text-sm "
                        + "text-slate-400"
                      }
                    >
                      {
                        activeQuiz
                          .original_name
                      }
                      {activeQuiz.topic
                        ? (
                            ` · ${activeQuiz.topic}`
                          )
                        : ""}
                    </p>
                  </div>

                  <span
                    className={
                      "rounded-full border "
                      + "px-3 py-1 "
                      + "text-xs capitalize "
                      + difficultyClasses(
                        activeQuiz.difficulty,
                      )
                    }
                  >
                    {activeQuiz.difficulty}
                  </span>
                </div>
              </div>

              {submission ? (
                <div
                  className={
                    "mt-6 rounded-2xl "
                    + "border "
                    + "border-blue-800 "
                    + "bg-blue-950/30 "
                    + "p-6"
                  }
                >
                  <p
                    className={
                      "text-sm font-medium "
                      + "text-blue-300"
                    }
                  >
                    Quiz completed
                  </p>

                  <p
                    className={
                      "mt-2 text-3xl "
                      + "font-bold text-white"
                    }
                  >
                    {submission.score}
                    {" / "}
                    {submission.total}
                  </p>

                  <p
                    className={
                      "mt-2 text-sm "
                      + "text-slate-400"
                    }
                  >
                    Review each answer and
                    its PDF citation below.
                  </p>
                </div>
              ) : null}

              <div className="mt-8 space-y-8">
                {activeQuiz.questions.map(
                  (question) => {
                    const answerResult =
                      resultByQuestion.get(
                        question.id,
                      );

                    return (
                      <fieldset
                        key={question.id}
                        disabled={
                          submission !== null
                        }
                        className={
                          "rounded-2xl border "
                          + "border-slate-800 "
                          + "bg-slate-950 "
                          + "p-5 sm:p-6"
                        }
                      >
                        <legend
                          className={
                            "px-2 text-sm "
                            + "font-semibold "
                            + "text-blue-300"
                          }
                        >
                          Question{" "}
                          {question.position}
                        </legend>

                        <p
                          className={
                            "text-base "
                            + "font-medium "
                            + "leading-7 "
                            + "text-slate-100"
                          }
                        >
                          {question.prompt}
                        </p>

                        <div
                          className={
                            "mt-5 space-y-3"
                          }
                        >
                          {question.options.map(
                            (
                              option,
                              optionIndex,
                            ) => {
                              const selected =
                                selectedAnswers[
                                  question.id
                                ]
                                === optionIndex;

                              const isCorrect =
                                answerResult
                                  ?.correct_option_index
                                === optionIndex;

                              const isWrongSelection =
                                Boolean(
                                  answerResult
                                  && selected
                                  && !isCorrect,
                                );

                              let optionClasses =
                                "border-slate-700 "
                                + "bg-slate-900 "
                                + "text-slate-300";

                              if (
                                answerResult
                                && isCorrect
                              ) {
                                optionClasses =
                                  "border-emerald-700 "
                                  + "bg-emerald-950/40 "
                                  + "text-emerald-200";
                              } else if (
                                isWrongSelection
                              ) {
                                optionClasses =
                                  "border-rose-700 "
                                  + "bg-rose-950/40 "
                                  + "text-rose-200";
                              } else if (
                                selected
                              ) {
                                optionClasses =
                                  "border-blue-600 "
                                  + "bg-blue-950/40 "
                                  + "text-blue-200";
                              }

                              return (
                                <label
                                  key={
                                    `${question.id}-`
                                    + optionIndex
                                  }
                                  className={
                                    "flex cursor-pointer "
                                    + "gap-3 rounded-xl "
                                    + "border px-4 py-3 "
                                    + "text-sm "
                                    + "leading-6 "
                                    + optionClasses
                                  }
                                >
                                  <input
                                    type="radio"
                                    name={
                                      question.id
                                    }
                                    value={
                                      optionIndex
                                    }
                                    checked={
                                      selected
                                    }
                                    onChange={() => {
                                      setSelectedAnswers(
                                        (
                                          current,
                                        ) => ({
                                          ...current,
                                          [
                                            question.id
                                          ]:
                                            optionIndex,
                                        }),
                                      );
                                    }}
                                    className="mt-1"
                                  />

                                  <span>
                                    {option}
                                  </span>
                                </label>
                              );
                            },
                          )}
                        </div>

                        {answerResult ? (
                          <div
                            className={
                              "mt-5 rounded-xl "
                              + "border "
                              + (
                                answerResult
                                  .is_correct
                                  ? (
                                      "border-emerald-800 "
                                      + "bg-emerald-950/30"
                                    )
                                  : (
                                      "border-rose-800 "
                                      + "bg-rose-950/30"
                                    )
                              )
                              + " p-4"
                            }
                          >
                            <p
                              className={
                                "font-semibold "
                                + (
                                  answerResult
                                    .is_correct
                                    ? "text-emerald-300"
                                    : "text-rose-300"
                                )
                              }
                            >
                              {answerResult
                                .is_correct
                                ? "Correct"
                                : "Incorrect"}
                            </p>

                            <p
                              className={
                                "mt-2 text-sm "
                                + "leading-6 "
                                + "text-slate-300"
                              }
                            >
                              {
                                answerResult
                                  .explanation
                              }
                            </p>

                            <div
                              className={
                                "mt-4 rounded-lg "
                                + "border "
                                + "border-slate-700 "
                                + "bg-slate-950 "
                                + "p-4"
                              }
                            >
                              <p
                                className={
                                  "text-xs "
                                  + "font-semibold "
                                  + "uppercase "
                                  + "tracking-wide "
                                  + "text-blue-300"
                                }
                              >
                                Source ·{" "}
                                {
                                  answerResult
                                    .source
                                    .original_name
                                }{" "}
                                · page{" "}
                                {
                                  answerResult
                                    .source
                                    .page_number
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
                                  answerResult
                                    .source
                                    .content
                                }
                              </p>
                            </div>
                          </div>
                        ) : null}
                      </fieldset>
                    );
                  },
                )}
              </div>

              {!submission ? (
                <div
                  className={
                    "sticky bottom-4 "
                    + "mt-8 flex "
                    + "flex-wrap "
                    + "items-center "
                    + "justify-between "
                    + "gap-4 rounded-2xl "
                    + "border "
                    + "border-slate-700 "
                    + "bg-slate-900/95 "
                    + "p-4 shadow-xl "
                    + "backdrop-blur"
                  }
                >
                  <p
                    className={
                      "text-sm "
                      + "text-slate-400"
                    }
                  >
                    {answeredCount}
                    {" / "}
                    {
                      activeQuiz
                        .question_count
                    }{" "}
                    answered
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      void handleSubmit();
                    }}
                    disabled={
                      isSubmitting
                      || answeredCount
                        !== activeQuiz
                          .question_count
                    }
                    className={
                      "rounded-xl "
                      + "bg-blue-600 "
                      + "px-6 py-3 "
                      + "text-sm "
                      + "font-semibold "
                      + "text-white "
                      + "hover:bg-blue-500 "
                      + "disabled:"
                      + "cursor-not-allowed "
                      + "disabled:bg-slate-700 "
                      + "disabled:text-slate-400"
                    }
                  >
                    {isSubmitting
                      ? "Scoring..."
                      : "Submit quiz"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSubmission(null);
                    setSelectedAnswers({});
                    setErrorMessage(null);
                  }}
                  className={
                    "mt-8 rounded-xl "
                    + "border "
                    + "border-slate-700 "
                    + "px-5 py-3 "
                    + "text-sm "
                    + "font-semibold "
                    + "text-slate-200 "
                    + "hover:border-blue-500 "
                    + "hover:text-blue-300"
                  }
                >
                  Retake quiz
                </button>
              )}
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
