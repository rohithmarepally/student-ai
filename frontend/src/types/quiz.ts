export type QuizDifficulty =
  | "easy"
  | "medium"
  | "hard";

export type QuizSummary = {
  id: string;
  document_id: string | null;
  original_name: string;
  title: string;
  topic: string | null;
  difficulty: QuizDifficulty;
  question_count: number;
  created_at: string;
};

export type QuizListResponse = {
  quizzes: QuizSummary[];
};

export type QuizQuestion = {
  id: string;
  position: number;
  prompt: string;
  options: string[];
};

export type QuizDetail =
  QuizSummary & {
    questions: QuizQuestion[];
  };

export type QuizSource = {
  source_id: string;
  chunk_id: number;
  document_id: string;
  original_name: string;
  page_number: number;
  content: string;
  similarity: number;
};

export type QuizAnswerResult = {
  question_id: string;
  selected_option_index: number;
  correct_option_index: number;
  is_correct: boolean;
  explanation: string;
  source: QuizSource;
};

export type QuizSubmissionResult = {
  attempt_id: string;
  quiz_id: string;
  score: number;
  total: number;
  submitted_at: string;
  answers: QuizAnswerResult[];
};

export type ReadyQuizDocument = {
  id: string;
  original_name: string;
};
