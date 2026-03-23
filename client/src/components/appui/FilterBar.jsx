import useThemeToggle from "../../app/useThemeToggle.js";

export default function FilterBar({
  children,
  actions = null,
  summary = null,
  className = "",
}) {
  const { isDark } = useThemeToggle();

  return (
    <div
      className={`surface-secondary px-4 py-4 sm:px-5 ${className} ${
        isDark ? "text-slate-100" : "text-slate-900"
      }`}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">{children}</div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>

      {summary ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">{summary}</div>
      ) : null}
    </div>
  );
}
