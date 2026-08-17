export type DocumentStatus =
  | "uploaded"
  | "processing"
  | "ready"
  | "failed";

export type DocumentRecord = {
  id: string;
  original_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  status: DocumentStatus;
  created_at: string;
};
