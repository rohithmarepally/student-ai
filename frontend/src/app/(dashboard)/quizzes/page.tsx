import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export default function QuizzesPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Active recall"
        title="AI-generated quizzes"
        description="Generate questions from your study material and use quiz results to identify weak topics."
        action={
          <button
            type="button"
            disabled
            title="Quiz generation will be implemented later"
            className="cursor-not-allowed rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-500"
          >
            Generate quiz
          </button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["0", "Quizzes completed"],
          ["0", "Questions answered"],
          ["0%", "Average score"],
        ].map(([value, label]) => (
          <article
            key={label}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
          >
            <p className="text-3xl font-bold text-white">{value}</p>
            <p className="mt-2 text-sm text-slate-400">{label}</p>
          </article>
        ))}
      </section>

      <EmptyState
        symbol="Q"
        title="No quizzes generated"
        description="You will be able to choose a document, difficulty level and number of questions before generating a quiz."
        nextStep="Quiz generation will be added after the RAG pipeline."
      />
    </div>
  );
}
