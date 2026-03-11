import useThemeToggle from "../../app/useThemeToggle.js";

export default function Card({ className = "", children }) {
  const { isDark } = useThemeToggle();

  return (
    <div
      className={`${isDark ? "rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(9,15,28,0.82))] shadow-[0_24px_70px_-42px_rgba(15,23,42,0.72)]" : "rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(241,245,249,0.88))] shadow-[0_24px_70px_-42px_rgba(15,23,42,0.18)]"} transition-colors ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, right }) {
  const { isDark } = useThemeToggle();

  return (
    <div className={`flex items-start justify-between gap-3 border-b px-5 py-4 ${isDark ? "border-white/10" : "border-slate-200/80"}`}>
      <div>
        <div className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-950"}`}>{title}</div>
        {subtitle ? (
          <div className={`mt-1 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>{subtitle}</div>
        ) : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

export function CardBody({ className = "", children }) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}
