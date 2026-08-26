export type ReviewRating =
  | "again"
  | "hard"
  | "good"
  | "easy";

export type FlashcardDeckSummary = {
  id: string;
  document_id: string | null;
  original_name: string;
  title: string;
  topic: string | null;
  card_count: number;
  created_at: string;
};

export type Flashcard = {
  id: string;
  deck_id: string;
  position: number;
  front: string;
  back: string;
  source_id: string;
  source_chunk_id: number;
  source_document_id: string;
  source_original_name: string;
  source_page_number: number;
  source_content: string;
  source_similarity: number;
  due_at: string;
  interval_days: number;
  correct_streak: number;
  review_count: number;
  last_reviewed_at: string | null;
};

export type DueFlashcard =
  Flashcard & {
    deck_title: string;
  };

export type FlashcardDeckDetail =
  FlashcardDeckSummary & {
    cards: Flashcard[];
  };

export type FlashcardDeckListResponse = {
  decks: FlashcardDeckSummary[];
};

export type DueFlashcardsResponse = {
  cards: DueFlashcard[];
};

export type FlashcardReviewResult = {
  card_id: string;
  deck_id: string;
  due_at: string;
  interval_days: number;
  review_count: number;
  correct_streak: number;
};

export type ReadyFlashcardDocument = {
  id: string;
  original_name: string;
};
