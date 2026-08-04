import { logout } from "@/app/auth/actions";
import { MobileNavigation } from "@/components/navigation/sidebar";

type TopbarProps = {
  userEmail: string;
};

export function Topbar({
  userEmail,
}: TopbarProps) {
  const initial = userEmail.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
      <div className="flex min-h-16 items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <MobileNavigation />

          <div>
            <p className="text-sm font-semibold text-white">
              Student workspace
            </p>

            <p className="hidden text-xs text-slate-500 sm:block">
              Learn, build and track your progress
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden max-w-56 text-right sm:block">
            <p className="truncate text-sm font-medium text-white">
              {userEmail}
            </p>

            <p className="text-xs text-emerald-400">
              Authenticated
            </p>
          </div>

          <div
            aria-label={`Profile for ${userEmail}`}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/10 text-sm font-bold text-blue-300"
          >
            {initial}
          </div>

          <form action={logout}>
            <button
              type="submit"
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-red-500/40 hover:text-red-300"
            >
              Logout
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
