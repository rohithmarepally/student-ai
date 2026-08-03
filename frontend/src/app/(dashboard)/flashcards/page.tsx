import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export default function FlashcardsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Revision"
        title="AI-generated flashcards"
        description="Convert important definitions, formulas and concepts into cards for quick revision."
        action={
          <button
            type="button"
            disabled
            title="Flashcard generation will be implemented later"
            className="cursor-not-allowed rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-500"
          >
            Create deck
          </button>
        }
      />

      <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <EmptyState
          symbol="F"
          title="No flashcard decks"
          description="Generated decks will appear here with their document name, card count and revision progress."
          nextStep="Flashcards will use the same document-processing pipeline as quizzes."
        />

        <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="font-semibold text-white">
            Planned revision features
          </h2>

          <ul className="mt-5 space-y-4 text-sm text-slate-400">
            <li>• Reveal answers after attempting recall</li>
            <li>• Mark cards as easy, medium or difficult</li>
            <li>• Review difficult cards more frequently</li>
            <li>• Track progress for every document</li>
          </ul>
        </aside>
      </section>
    </div>
  );
}
