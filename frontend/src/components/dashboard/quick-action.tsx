import Link from "next/link";

type QuickActionProps = {
  href: string;
  symbol: string;
  title: string;
  description: string;
};

export function QuickAction({
  href,
  symbol,
  title,
  description,
}: QuickActionProps) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-slate-800 bg-slate-900 p-5 transition hover:-translate-y-0.5 hover:border-blue-500/40"
    >
      <span
        aria-hidden="true"
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 font-bold text-blue-300"
      >
        {symbol}
      </span>

      <h3 className="mt-5 font-semibold text-white group-hover:text-blue-300">
        {title}
      </h3>

      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>

      <p className="mt-4 text-sm font-medium text-blue-400">Open page →</p>
    </Link>
  );
}
