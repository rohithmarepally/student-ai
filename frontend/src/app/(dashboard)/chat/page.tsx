import { redirect } from "next/navigation";

import { SemanticSearchPanel } from "@/components/search/semantic-search-panel";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import type {
  ReadyDocumentOption,
} from "@/types/search";


export default async function ChatPage() {
  const supabase =
    await createClient();

  const {
    data: claimsData,
    error: claimsError,
  } =
    await supabase.auth.getClaims();

  const userId =
    claimsData?.claims?.sub;

  if (
    claimsError
    || !userId
  ) {
    redirect("/login");
  }

  const {
    data,
    error: documentsError,
  } =
    await supabase
      .from("documents")
      .select(
        "id, original_name, page_count"
      )
      .eq(
        "user_id",
        userId
      )
      .eq(
        "status",
        "ready"
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      );

  if (documentsError) {
    console.error(
      "Could not load searchable documents:",
      documentsError
    );
  }

  const readyDocuments =
    (
      data
      ?? []
    ) as ReadyDocumentOption[];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Document intelligence"
        title="Semantic document search"
        description="Ask a question and retrieve the most relevant passages from your processed PDFs, including document names and page numbers."
      />

      {documentsError ? (
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
        >
          Your searchable documents could not be loaded.
        </div>
      ) : null}

      <SemanticSearchPanel
        readyDocuments={
          readyDocuments
        }
      />
    </div>
  );
}
