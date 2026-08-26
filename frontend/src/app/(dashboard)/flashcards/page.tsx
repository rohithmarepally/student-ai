import {
  FlashcardPanel,
} from "@/components/flashcards/flashcard-panel";

import {
  PageHeader,
} from "@/components/ui/page-header";

import {
  createClient,
} from "@/lib/supabase/server";

import type {
  ReadyFlashcardDocument,
} from "@/types/flashcard";


export default async function FlashcardsPage() {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("documents")
    .select(
      "id,original_name",
    )
    .eq(
      "status",
      "ready",
    )
    .order(
      "created_at",
      {
        ascending: false,
      },
    );

  if (error) {
    throw new Error(
      "Ready documents could "
      + "not be loaded.",
    );
  }

  const documents:
    ReadyFlashcardDocument[] =
      data ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Spaced repetition"
        title="AI flashcards"
        description={
          "Generate source-backed "
          + "flashcards from processed PDFs "
          + "and schedule future reviews "
          + "based on how well you remember "
          + "each answer."
        }
      />

      <FlashcardPanel
        documents={documents}
      />
    </div>
  );
}
