const MAP = {
  PUBLIC: "bg-emerald-50 text-emerald-700 border-emerald-200",
  EXPIRED: "bg-zinc-50 text-zinc-600 border-zinc-200",
  DRAFT: "bg-blue-50 text-blue-700 border-blue-200",

  HOLD: "bg-amber-50 text-amber-700 border-amber-200",
  CONFIRMED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELED: "bg-zinc-50 text-zinc-600 border-zinc-200",
};

export default function Badge({ tone = "PUBLIC", children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
        MAP[tone] || "bg-zinc-50 text-zinc-700 border-zinc-200"
      }`}
    >
      {children}
    </span>
  );
}
