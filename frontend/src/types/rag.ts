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
  conversation_id: string;
  user_message_id: string;
  assistant_message_id: string;
  question: string;
  retrieval_query: string;
  used_conversation_history: boolean;
  query_rewrite_model: string | null;
  answer: string;
  model: string | null;
  insufficient_context: boolean;
  retrieved_count: number;
  cited_source_ids: string[];
  sources: RagSource[];
};

export type ConversationSummary = {
  id: string;
  title: string;
  document_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ConversationListResponse = {
  conversations: ConversationSummary[];
};

export type MessageSource = {
  id: number;
  source_id: string;
  chunk_id: number | null;
  document_id: string | null;
  original_name: string;
  page_number: number;
  chunk_index: number;
  content: string;
  similarity: number;
  cited: boolean;
  created_at: string;
};

export type ConversationMessage = {
  id: string;
  sequence_number: number;
  role: "user" | "assistant";
  content: string;
  model: string | null;
  insufficient_context: boolean | null;
  created_at: string;
  sources: MessageSource[];
};

export type ConversationDetail = {
  conversation: ConversationSummary;
  messages: ConversationMessage[];
};
