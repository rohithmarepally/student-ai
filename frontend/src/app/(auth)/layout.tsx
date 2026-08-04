import Link from "next/link";
import type { ReactNode } from "react";

type AuthLayoutProps = {
  children: ReactNode;
};

export default function AuthLayout({
  children,
}: AuthLayoutProps) {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-12 text-white">
      <div className="mx-auto max-w-md">
        <Link
          href="/"
          className="mb-8 flex items-center justify-center gap-3"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500 text-sm font-black">
            AI
          </span>

          <span>
            <span className="block font-bold">
              Study Assistant
            </span>

            <span className="block text-xs text-slate-500">
              Student workspace
            </span>
          </span>
        </Link>

        {children}
      </div>
    </main>
  );
}
