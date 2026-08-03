import { MobileNavigation } from "@/components/navigation/sidebar";

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
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
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-white">Student</p>
            <p className="text-xs text-slate-500">Free workspace</p>
          </div>

          <div
            aria-label="Student profile"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/10 text-sm font-bold text-blue-300"
          >
            S
          </div>
        </div>
      </div>
    </header>
  );
}
