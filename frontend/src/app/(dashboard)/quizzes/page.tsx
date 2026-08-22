import {
  QuizPanel,
} from "@/components/quizzes/quiz-panel";

import {
  PageHeader,
} from "@/components/ui/page-header";

import {
  createClient,
} from "@/lib/supabase/server";

import type {
  ReadyQuizDocument,
} from "@/types/quiz";


export default async function QuizzesPage() {
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
      "Ready documents could not be loaded.",
    );
  }

  const documents: ReadyQuizDocument[] =
    data ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Active recall"
        title="AI quizzes"
        description={
          "Generate grounded multiple-choice "
          + "quizzes from your processed PDFs, "
          + "submit answers securely, and review "
          + "page-backed explanations."
        }
      />

      <QuizPanel
        documents={documents}
      />
    </div>
  );
}
