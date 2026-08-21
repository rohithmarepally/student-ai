export type ReadyDocumentOption = {
  id: string;
  original_name: string;
  page_count: number | null;
};

export type SemanticSearchMatch = {
  chunk_id: number;
  document_id: string;
  original_name: string;
  chunk_index: number;
  page_number: number;
  content: string;
  similarity: number;
};

export type SemanticSearchResponse = {
  question: string;
  match_count: number;
  matches: SemanticSearchMatch[];
};
