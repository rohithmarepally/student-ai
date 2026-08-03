import { PageHeader } from "@/components/ui/page-header";

const settingsSections = [
  {
    title: "Profile",
    description:
      "Your name, email address and account information will appear here after authentication.",
    status: "Milestone 3",
  },
  {
    title: "AI preferences",
    description:
      "Control answer length, quiz difficulty and explanation style.",
    status: "Planned",
  },
  {
    title: "Data and privacy",
    description:
      "Manage uploaded documents, conversations and account data.",
    status: "Planned",
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Configuration"
        title="Workspace settings"
        description="Configure your account, AI preferences and application data."
      />

      <section className="space-y-4">
        {settingsSections.map((section) => (
          <article
            key={section.title}
            className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <h2 className="font-semibold text-white">{section.title}</h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                {section.description}
              </p>
            </div>

            <span className="w-fit shrink-0 rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-medium text-slate-400">
              {section.status}
            </span>
          </article>
        ))}
      </section>
    </div>
  );
}
