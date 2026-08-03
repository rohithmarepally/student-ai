import Link from "next/link";

import { BackendStatus } from "@/components/dashboard/backend-status";
import { QuickAction } from "@/components/dashboard/quick-action";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";

const statistics = [
  {
    label: "Documents",
    value: "0",
    helper: "PDF upload will be added in Milestone 4.",
    symbol: "D",
  },
  {
    label: "Questions asked",
    value: "0",
    helper: "Your document conversations will appear here.",
    symbol: "C",
  },
  {
    label: "Quizzes completed",
    value: "0",
    helper: "Quiz progress will be tracked later.",
    symbol: "Q",
  },
  {
    label: "Flashcards",
    value: "0",
    helper: "Generated revision cards will appear here.",
    symbol: "F",
  },
];

const gettingStartedSteps = [
  {
    number: "01",
    title: "Create the workspace",
    description:
      "The frontend, backend and repository foundation are complete.",
    complete: true,
  },
  {
    number: "02",
    title: "Build the application interface",
    description:
      "Create responsive navigation, routes and reusable components.",
    complete: true,
  },
  {
    number: "03",
    title: "Add authentication",
    description: "Sign-up, login and protected routes are coming next.",
    complete: false,
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Workspace overview"
        title="Welcome to your AI study assistant"
        description="Manage study documents, ask questions, generate quizzes and review flashcards from one learning workspace."
        action={
          <Link
            href="/documents"
            className="inline-flex rounded-xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-400"
          >
            Add a document
          </Link>
        }
      />

      <section
        aria-label="Workspace statistics"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {statistics.map((statistic) => (
          <StatCard
            key={statistic.label}
            label={statistic.label}
            value={statistic.value}
            helper={statistic.helper}
            symbol={statistic.symbol}
          />
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-white">Quick actions</h2>

            <p className="mt-1 text-sm text-slate-400">
              Open one of the main learning tools.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <QuickAction
              href="/documents"
              symbol="D"
              title="Manage documents"
              description="Upload, browse and organise your course material."
            />

            <QuickAction
              href="/chat"
              symbol="C"
              title="Ask the AI"
              description="Start a conversation grounded in your documents."
            />

            <QuickAction
              href="/quizzes"
              symbol="Q"
              title="Practise quizzes"
              description="Test your understanding with generated questions."
            />

            <QuickAction
              href="/flashcards"
              symbol="F"
              title="Review flashcards"
              description="Use short revision cards to recall key concepts."
            />
          </div>
        </div>

        <div className="space-y-6">
          <BackendStatus />

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="font-semibold text-white">Project progress</h2>

            <div className="mt-5 space-y-5">
              {gettingStartedSteps.map((step) => (
                <div key={step.number} className="flex gap-4">
                  <span
                    className={[
                      "flex h-9 w-9 shrink-0 items-center justify-center",
                      "rounded-full text-xs font-bold",
                      step.complete
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-slate-800 text-slate-400",
                    ].join(" ")}
                  >
                    {step.number}
                  </span>

                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      {step.title}
                    </h3>

                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-white">Recent activity</h2>

          <p className="mt-1 text-sm text-slate-400">
            Your latest learning actions will be listed here.
          </p>
        </div>

        <EmptyState
          symbol="A"
          title="No activity yet"
          description="After document upload and AI chat are implemented, summaries, questions and quiz results will appear here."
          nextStep="Continue building the next milestone."
        />
      </section>
    </div>
  );
}
