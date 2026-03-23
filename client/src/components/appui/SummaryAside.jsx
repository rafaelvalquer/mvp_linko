import useThemeToggle from "../../app/useThemeToggle.js";

export default function SummaryAside({
  title,
  subtitle,
  children,
  footer = null,
  className = "",
}) {
  const { isDark } = useThemeToggle();

  return (
    <aside
      className={`surface-panel overflow-hidden ${className} ${
        isDark ? "text-slate-100" : "text-slate-900"
      }`}
    >
      <div
        className={`border-b px-5 py-4 ${isDark ? "border-white/8" : "border-slate-200/80"}`}
      >
        <div
          className={`text-[11px] font-bold uppercase tracking-[0.18em] ${
            isDark ? "text-slate-400" : "text-slate-500"
          }`}
        >
          Resumo
        </div>
        <div className="mt-2 text-base font-semibold">{title}</div>
        {subtitle ? (
          <div
            className={`mt-1 text-xs leading-5 ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}
          >
            {subtitle}
          </div>
        ) : null}
      </div>

      <div className="space-y-4 px-5 py-4">{children}</div>

      {footer ? (
        <div
          className={`border-t px-5 py-4 ${isDark ? "border-white/8" : "border-slate-200/80"}`}
        >
          {footer}
        </div>
      ) : null}
    </aside>
  );
}
