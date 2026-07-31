"use client";

import { useEffect, useState } from "react";

type HealthResponse = {
  status: string;
  service: string;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export default function Home() {
  const [backendMessage, setBackendMessage] = useState(
    "Checking backend connection..."
  );

  useEffect(() => {
    async function checkBackend(): Promise<void> {
      try {
        const response = await fetch(`${API_URL}/health`);

        if (!response.ok) {
          throw new Error(`Backend returned ${response.status}`);
        }

        const data: HealthResponse = await response.json();

        setBackendMessage(
          `${data.service} is connected — status: ${data.status}`
        );
      } catch (error) {
        console.error("Backend connection failed:", error);

        setBackendMessage(
          "Backend is not reachable. Confirm that FastAPI is running."
        );
      }
    }

    void checkBackend();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-5xl">
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-blue-400">
          AI-powered learning platform
        </p>

        <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-6xl">
          Understand your study material with an AI assistant
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
          Upload study documents, ask questions, generate summaries,
          practise quizzes and create flashcards.
        </p>

        <section className="mt-12 rounded-2xl border border-slate-700 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold">
            System status
          </h2>

          <p className="mt-3 text-slate-300">
            {backendMessage}
          </p>
        </section>
      </div>
    </main>
  );
}
