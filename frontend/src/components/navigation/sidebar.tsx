"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { navigationItems } from "@/lib/navigation";

type NavigationLinksProps = {
  onNavigate?: () => void;
};

function NavigationLinks({
  onNavigate,
}: NavigationLinksProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary navigation"
      className="space-y-2"
    >
      {navigationItems.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href ||
              pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={[
              "group flex items-center gap-3 rounded-xl px-3 py-3",
              "text-sm font-medium transition",
              isActive
                ? "bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30"
                : "text-slate-400 hover:bg-slate-800 hover:text-white",
            ].join(" ")}
          >
            <span
              aria-hidden="true"
              className={[
                "flex h-9 w-9 shrink-0 items-center justify-center",
                "rounded-lg border text-sm font-bold",
                isActive
                  ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
                  : "border-slate-700 bg-slate-900 text-slate-400",
              ].join(" ")}
            >
              {item.symbol}
            </span>

            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link
      href="/dashboard"
      className="flex items-center gap-3"
    >
      <span
        aria-hidden="true"
        className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500 text-sm font-black text-white"
      >
        AI
      </span>

      <span>
        <span className="block font-bold text-white">
          Study Assistant
        </span>

        <span className="block text-xs text-slate-500">
          Student workspace
        </span>
      </span>
    </Link>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-800 bg-slate-950 md:flex md:flex-col">
      <div className="border-b border-slate-800 px-6 py-5">
        <Brand />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <NavigationLinks />
      </div>

      <div className="border-t border-slate-800 p-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-sm font-semibold text-white">
            Milestone 2
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-400">
            Building the application interface and route
            structure.
          </p>
        </div>
      </div>
    </aside>
  );
}

export function MobileNavigation() {
  const [isOpen, setIsOpen] = useState(false);

  function closeMenu(): void {
    setIsOpen(false);
  }

  return (
    <div className="relative md:hidden">
      <button
        type="button"
        onClick={() =>
          setIsOpen((currentValue) => !currentValue)
        }
        aria-expanded={isOpen}
        aria-controls="mobile-navigation"
        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-white"
      >
        {isOpen ? "Close" : "Menu"}
      </button>

      {isOpen ? (
        <div
          id="mobile-navigation"
          className="absolute left-0 top-12 z-50 w-72 rounded-2xl border border-slate-700 bg-slate-950 p-4 shadow-2xl"
        >
          <div className="mb-5 border-b border-slate-800 pb-4">
            <Brand />
          </div>

          <NavigationLinks onNavigate={closeMenu} />
        </div>
      ) : null}
    </div>
  );
}
