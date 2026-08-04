import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { Topbar } from "@/components/layout/topbar";
import { Sidebar } from "@/components/navigation/sidebar";
import { createClient } from "@/lib/supabase/server";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    redirect("/login");
  }

  const userEmail =
    typeof data.claims.email === "string"
      ? data.claims.email
      : "student";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Sidebar />

      <div className="min-h-screen md:pl-72">
        <Topbar userEmail={userEmail} />

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
