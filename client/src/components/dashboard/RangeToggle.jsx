import useThemeToggle from "../../app/useThemeToggle.js";

const OPTIONS = [
  { key: "today", label: "Hoje" },
  { key: "last7", label: "7 dias" },
  { key: "last30", label: "30 dias" },
];

export default function RangeToggle({ value, onChange, className = "" }) {
  const { isDark } = useThemeToggle();

  return (
    <div
      className={[
        "inline-flex items-center rounded-2xl border p-1",
        isDark
          ? "border-white/10 bg-white/5"
          : "border-slate-200 bg-white/90 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.35)]",
        className,
      ].join(" ")}
      role="tablist"
      aria-label="Período"
    >
      {OPTIONS.map((option) => {
        const active = value === option.key;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange?.(option.key)}
            className={[
              "rounded-xl px-3 py-1.5 text-[11px] font-bold transition",
              active
                ? "bg-[linear-gradient(135deg,#2563eb,#14b8a6)] text-white shadow-[0_12px_24px_-16px_rgba(37,99,235,0.65)]"
                : isDark
                  ? "text-slate-300 hover:bg-white/10 hover:text-white"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
            ].join(" ")}
            role="tab"
            aria-selected={active}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
