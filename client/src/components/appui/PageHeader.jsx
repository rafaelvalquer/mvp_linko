import useThemeToggle from "../../app/useThemeToggle.js";

export default function PageHeader({
  title,
  subtitle,
  actions,
  right,
  eyebrow = "Painel",
  compact = true,
  contentClassName = "",
}) {
  const { isDark } = useThemeToggle();
  const controls = actions || right || null;
  const containerClassName = compact
    ? isDark
      ? "border-white/8 bg-[linear-gradient(135deg,rgba(16,24,41,0.88),rgba(10,18,32,0.78))] shadow-[0_20px_48px_-40px_rgba(2,6,23,0.7)]"
      : "border-slate-200/90 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(239,246,255,0.92))] shadow-[0_20px_48px_-40px_rgba(15,23,42,0.16)]"
    : isDark
      ? "border-white/10 bg-[linear-gradient(135deg,rgba(16,24,41,0.92),rgba(10,18,32,0.82))] shadow-[0_26px_70px_-44px_rgba(2,6,23,0.74)]"
      : "border-slate-200/90 bg-[linear-gradient(135deg,rgba(255,255,255,0.99),rgba(236,246,255,0.94))] shadow-[0_26px_70px_-44px_rgba(15,23,42,0.18)]";

  return (
    <div
      className={`relative overflow-hidden rounded-[28px] border ${compact ? "p-4 sm:p-5" : "p-5 sm:p-6"} ${containerClassName}`}
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-20 ${
          isDark
            ? "bg-[linear-gradient(180deg,rgba(56,189,248,0.12),transparent)]"
            : "bg-[linear-gradient(180deg,rgba(37,99,235,0.12),transparent)]"
        }`}
      />
      <div
        className={`pointer-events-none absolute right-0 top-0 ${compact ? "h-24 w-24" : "h-28 w-28"} rounded-full blur-3xl ${isDark ? "bg-cyan-400/10" : "bg-cyan-400/14"}`}
      />
      <div
        className={`relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${contentClassName}`}
      >
        <div className="max-w-3xl">
          <div
            className={`text-[11px] font-bold uppercase tracking-[0.22em] ${isDark ? "text-sky-200/80" : "text-sky-700"}`}
          >
            {eyebrow}
          </div>
          <div
            className={`mt-2 bg-[linear-gradient(135deg,#2563eb,#0f766e)] bg-clip-text font-black tracking-tight text-transparent ${compact ? "text-[1.85rem] sm:text-[2.3rem]" : "text-2xl sm:text-3xl"}`}
          >
            {title}
          </div>
          {subtitle ? (
            <div
              className={`mt-2 text-sm leading-6 ${isDark ? "text-slate-300" : "text-slate-600"}`}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
        {controls ? (
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">{controls}</div>
        ) : null}
      </div>
    </div>
  );
}
