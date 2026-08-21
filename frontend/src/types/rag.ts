export type ReadyDocumentOption = {
  id: string;
  original_name: string;
};

export type RagSource = {
  source_id: string;
  chunk_id: number;
  document_id: string;
  original_name: string;
  chunk_index: number;
  page_number: number;
  content: string;
  similarity: number;
  cited: boolean;
};

export type RagResponse = {
  question: string;
  answer: string;
  model: string | null;
  insufficient_context: boolean;
  retrieved_count: number;
  cited_source_ids: string[];
  sources: RagSource[];
};
