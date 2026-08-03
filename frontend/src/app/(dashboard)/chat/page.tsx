import { PageHeader } from "@/components/ui/page-header";

const exampleQuestions = [
  "Summarise chapter one in simple terms.",
  "What are the most important exam topics?",
  "Create an example for this concept.",
];

export default function ChatPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Document intelligence"
        title="AI document chat"
        description="Ask questions and receive answers grounded in your uploaded study material."
      />

      <section className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="font-semibold text-white">Example questions</h2>

          <div className="mt-5 space-y-3">
            {exampleQuestions.map((question) => (
              <div
                key={question}
                className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm leading-6 text-slate-400"
              >
                {question}
              </div>
            ))}
          </div>
        </aside>

        <section className="flex min-h-[520px] flex-col rounded-2xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 px-6 py-4">
            <h2 className="font-semibold text-white">New conversation</h2>

            <p className="mt-1 text-xs text-slate-500">
              Select a document before asking a question.
            </p>
          </div>

          <div className="flex flex-1 items-center justify-center p-6 text-center">
            <div className="max-w-md">
              <span
                aria-hidden="true"
                className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700 bg-slate-950 font-bold text-blue-300"
              >
                C
              </span>

              <h3 className="mt-5 text-lg font-semibold text-white">
                Your conversation will appear here
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                RAG retrieval and AI responses will be implemented after
                document processing and vector search.
              </p>
            </div>
          </div>

          <div className="border-t border-slate-800 p-4">
            <div className="flex gap-3">
              <textarea
                disabled
                rows={2}
                placeholder="Upload a document before asking a question..."
                className="min-h-14 flex-1 resize-none rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-500 outline-none"
              />

              <button
                type="button"
                disabled
                className="cursor-not-allowed rounded-xl bg-slate-800 px-5 text-sm font-semibold text-slate-500"
              >
                Send
              </button>
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}
