import {
  RagChatPanel,
} from "@/components/chat/rag-chat-panel";
import {
  PageHeader,
} from "@/components/ui/page-header";
import {
  createClient,
} from "@/lib/supabase/server";
import type {
  ReadyDocumentOption,
} from "@/types/rag";

export default async function ChatPage() {
  const supabase = await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("documents")
    .select("id, original_name")
    .eq("status", "ready")
    .order(
      "created_at",
      {
        ascending: false,
      },
    );

  const documents: ReadyDocumentOption[] = (
    data ?? []
  ).map((document) => ({
    id: document.id,
    original_name: document.original_name,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Conversational RAG"
        title="AI document chat"
        description="Ask questions and contextual follow-ups. Answers remain grounded in your processed PDFs and linked to supporting chunks."
      />

      <RagChatPanel
        documents={documents}
        documentLoadError={
          error
            ? "Your ready documents could not be loaded."
            : null
        }
      />
    </div>
  );
}
