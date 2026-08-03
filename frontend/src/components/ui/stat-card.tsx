type StatCardProps = {
  label: string;
  value: string;
  helper: string;
  symbol: string;
};

export function StatCard({
  label,
  value,
  helper,
  symbol,
}: StatCardProps) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-400">{label}</p>
          <p className="mt-3 text-3xl font-bold text-white">{value}</p>
        </div>

        <span
          aria-hidden="true"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 font-bold text-blue-300"
        >
          {symbol}
        </span>
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-500">{helper}</p>
    </article>
  );
}
