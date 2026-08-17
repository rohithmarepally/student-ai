import { redirect } from "next/navigation";

import { DocumentUploadForm } from "@/components/documents/document-upload-form";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import type {
  DocumentRecord,
  DocumentStatus,
} from "@/types/document";

import { deleteDocument } from "./actions";

type DocumentsPageProps = {
  searchParams: Promise<{
    message?: string;
    error?: string;
  }>;
};

const statusStyles: Record<
  DocumentStatus,
  string
> = {
  uploaded:
    "border-blue-500/30 bg-blue-500/10 text-blue-300",
  processing:
    "border-amber-500/30 bg-amber-500/10 text-amber-300",
  ready:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  failed:
    "border-red-500/30 bg-red-500/10 text-red-300",
};

function formatFileSize(bytes: number): string {
  const kilobytes = bytes / 1024;

  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(1)} KB`;
  }

  const megabytes = kilobytes / 1024;

  return `${megabytes.toFixed(2)} MB`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function DocumentsPage({
  searchParams,
}: DocumentsPageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    redirect("/login");
  }

  const {
    data,
    error: documentsError,
  } = await supabase
    .from("documents")
    .select(
  "id, original_name, storage_path, mime_type, size_bytes, status, created_at"
)
    .eq("user_id", userId)
    .order("created_at", {
      ascending: false,
    });

  if (documentsError) {
    console.error(
      "Could not load documents:",
      documentsError
    );
  }

const documents: DocumentRecord[] =
  data ?? [];
    return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Knowledge library"
        title="Study documents"
        description="Upload and manage the private PDF files that will later provide context for summaries, quizzes and AI conversations."
      />

      {params.message ? (
        <div
          role="status"
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300"
        >
          {params.message}
        </div>
      ) : null}

      {params.error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
        >
          {params.error}
        </div>
      ) : null}

      {documentsError ? (
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
        >
          Your documents could not be loaded.
          Check the database table and RLS policies.
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <DocumentUploadForm />

        <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="font-semibold text-white">
            Current storage design
          </h2>

          <div className="mt-5 space-y-4 text-sm leading-6 text-slate-400">
            <p>
              Each PDF is stored in a private bucket.
            </p>

            <p>
              The first folder in every path is the
              authenticated student&apos;s UUID.
            </p>

            <p>
              PostgreSQL stores searchable metadata,
              while Storage contains the actual PDF.
            </p>

            <p>
              Row Level Security prevents students
              from accessing another student&apos;s files.
            </p>
          </div>
        </aside>
      </section>

      <section>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Your documents
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              {documents.length === 1
                ? "1 document"
                : `${documents.length} documents`}
            </p>
          </div>
        </div>

        {documents.length === 0 ? (
          <EmptyState
            symbol="D"
            title="No documents uploaded"
            description="Upload your first PDF. Its metadata will appear here after Supabase Storage and PostgreSQL accept it."
            nextStep="Choose a small PDF using the upload form."
          />
        ) : (
          <div className="space-y-4">
            {documents.map((document) => (
              <article
                key={document.id}
                className="flex flex-col gap-5 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="break-all font-semibold text-white">
                      {document.original_name}
                    </h3>

                    <span
                      className={[
                        "rounded-full border px-3 py-1",
                        "text-xs font-medium capitalize",
                        statusStyles[document.status],
                      ].join(" ")}
                    >
                      {document.status}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                    <span>
                      {formatFileSize(
                        document.size_bytes
                      )}
                    </span>

                    <span>
                      {formatDate(
                        document.created_at
                      )}
                    </span>

                    <span>
                      PDF
                    </span>
                  </div>
                </div>

                <form action={deleteDocument}>
                  <input
                    type="hidden"
                    name="documentId"
                    value={document.id}
                  />

                  <button
                    type="submit"
                    className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
                  >
                    Delete
                  </button>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
