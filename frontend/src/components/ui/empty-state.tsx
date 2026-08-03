type EmptyStateProps = {
  symbol: string;
  title: string;
  description: string;
  nextStep: string;
};

export function EmptyState({
  symbol,
  title,
  description,
  nextStep,
}: EmptyStateProps) {
  return (
    <section className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 px-6 py-14 text-center">
      <span
        aria-hidden="true"
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700 bg-slate-950 text-xl font-bold text-blue-300"
      >
        {symbol}
      </span>

      <h2 className="mt-5 text-xl font-semibold text-white">{title}</h2>

      <p className="mx-auto mt-2 max-w-xl leading-7 text-slate-400">
        {description}
      </p>

      <p className="mt-5 text-sm font-medium text-blue-300">{nextStep}</p>
    </section>
  );
}
