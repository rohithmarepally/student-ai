import type { ReactNode } from "react";

import { Topbar } from "@/components/layout/topbar";
import { Sidebar } from "@/components/navigation/sidebar";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Sidebar />

      <div className="min-h-screen md:pl-72">
        <Topbar />

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
