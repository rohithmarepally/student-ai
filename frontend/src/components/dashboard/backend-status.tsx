"use client";

import { useEffect, useState } from "react";

type HealthResponse = {
  status: string;
  service: string;
};

type ConnectionState = "checking" | "online" | "offline";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

const stateStyles: Record<ConnectionState, string> = {
  checking: "bg-amber-400",
  online: "bg-emerald-400",
  offline: "bg-red-400",
};

export function BackendStatus() {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("checking");

  const [message, setMessage] = useState(
    "Checking the FastAPI connection...",
  );

  useEffect(() => {
    let componentIsMounted = true;

    async function checkBackend(): Promise<void> {
      try {
        const response = await fetch(`${API_URL}/health`);

        if (!response.ok) {
          throw new Error(`Backend returned ${response.status}`);
        }

        const data: HealthResponse = await response.json();

        if (componentIsMounted) {
          setConnectionState("online");
          setMessage(`${data.service} responded with status: ${data.status}`);
        }
      } catch (error) {
        console.error("Backend connection failed:", error);

        if (componentIsMounted) {
          setConnectionState("offline");
          setMessage(
            "FastAPI is offline. Start the backend development server.",
          );
        }
      }
    }

    void checkBackend();

    return () => {
      componentIsMounted = false;
    };
  }, []);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className={[
            "mt-1 h-3 w-3 shrink-0 rounded-full",
            stateStyles[connectionState],
          ].join(" ")}
        />

        <div>
          <h2 className="font-semibold text-white">Backend connection</h2>

          <p className="mt-2 text-sm leading-6 text-slate-400">{message}</p>
        </div>
      </div>
    </section>
  );
}
