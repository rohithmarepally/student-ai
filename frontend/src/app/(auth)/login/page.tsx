import Link from "next/link";

import { login } from "@/app/auth/actions";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
    next?: string;
  }>;
};

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const params = await searchParams;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl sm:p-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
          Welcome back
        </p>

        <h1 className="mt-2 text-3xl font-bold">
          Log in to continue
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-400">
          Access your documents, conversations, quizzes and flashcards.
        </p>
      </div>

      {params.message ? (
        <div
          role="status"
          className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300"
        >
          {params.message}
        </div>
      ) : null}

      {params.error ? (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
        >
          {params.error}
        </div>
      ) : null}

      <form action={login} className="mt-8 space-y-5">
        <div>
          <label
            htmlFor="email"
            className="text-sm font-medium text-slate-200"
          >
            Email address
          </label>

          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="student@example.com"
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="text-sm font-medium text-slate-200"
          >
            Password
          </label>

          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="Enter your password"
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-400"
        >
          Log in
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-400">
        Need an account?{" "}
        <Link
          href="/sign-up"
          className="font-semibold text-blue-400 hover:text-blue-300"
        >
          Sign up
        </Link>
      </p>
    </section>
  );
}
