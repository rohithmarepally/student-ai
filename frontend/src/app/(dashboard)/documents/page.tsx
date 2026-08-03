import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export default function DocumentsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Knowledge library"
        title="Study documents"
        description="This page will manage the PDF notes, textbooks and learning material used by your AI assistant."
        action={
          <button
            type="button"
            disabled
            title="Document upload will be implemented in Milestone 4"
            className="cursor-not-allowed rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-500"
          >
            Upload PDF
          </button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <EmptyState
          symbol="D"
          title="No documents uploaded"
          description="Your uploaded PDF files will appear here with their processing status, size and creation date."
          nextStep="Document upload will be implemented in Milestone 4."
        />

        <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="font-semibold text-white">Planned document flow</h2>

          <ol className="mt-5 space-y-4 text-sm text-slate-400">
            <li className="flex gap-3">
              <span className="font-bold text-blue-300">1.</span>
              Select a PDF from your computer.
            </li>

            <li className="flex gap-3">
              <span className="font-bold text-blue-300">2.</span>
              Upload it to secure file storage.
            </li>

            <li className="flex gap-3">
              <span className="font-bold text-blue-300">3.</span>
              Extract and divide its text into chunks.
            </li>

            <li className="flex gap-3">
              <span className="font-bold text-blue-300">4.</span>
              Generate searchable vector embeddings.
            </li>
          </ol>
        </aside>
      </div>
    </div>
  );
}
