// src/components/dashboard/RangeToggle.jsx

const OPTS = [
  { key: "today", label: "Hoje" },
  { key: "last7", label: "7 dias" },
  { key: "last30", label: "30 dias" },
];

export default function RangeToggle({ value, onChange, className = "" }) {
  return (
    <div
      className={[
        "inline-flex items-center rounded-xl border bg-white p-1 shadow-sm",
        className,
      ].join(" ")}
      role="tablist"
      aria-label="Período"
    >
      {OPTS.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange?.(o.key)}
            className={[
              "px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition",
              active
                ? "bg-zinc-900 text-white"
                : "text-zinc-700 hover:bg-zinc-50",
            ].join(" ")}
            role="tab"
            aria-selected={active}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
