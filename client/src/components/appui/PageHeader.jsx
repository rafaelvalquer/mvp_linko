import useThemeToggle from "../../app/useThemeToggle.js";

export default function PageHeader({
  title,
  subtitle,
  actions,
  right,
}) {
  const { isDark } = useThemeToggle();
  const controls = actions || right || null;

  return (
    <div className={`relative overflow-hidden rounded-[30px] border p-5 sm:p-6 ${isDark ? "border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.88),rgba(11,18,32,0.78))] shadow-[0_26px_70px_-44px_rgba(15,23,42,0.72)]" : "border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(238,245,252,0.92))] shadow-[0_26px_70px_-44px_rgba(15,23,42,0.2)]"}`}>
      <div className={`pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-full blur-3xl ${isDark ? "bg-cyan-400/12" : "bg-cyan-400/10"}`} />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-3xl">
          <div className={`text-[11px] font-bold uppercase tracking-[0.22em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Painel
          </div>
          <div className="mt-2 bg-[linear-gradient(135deg,#2563eb,#14b8a6)] bg-clip-text text-2xl font-black tracking-tight text-transparent sm:text-3xl">
            {title}
          </div>
          {subtitle ? (
            <div className={`mt-2 text-sm leading-6 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
              {subtitle}
            </div>
          ) : null}
        </div>
        {controls ? (
          <div className="flex flex-wrap items-center gap-2">{controls}</div>
        ) : null}
      </div>
    </div>
  );
}
