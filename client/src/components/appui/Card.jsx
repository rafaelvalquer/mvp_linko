import useThemeToggle from "../../app/useThemeToggle.js";

export default function Card({ className = "", children }) {
  const { isDark } = useThemeToggle();

  return (
    <div
      className={`${isDark ? "rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.84),rgba(8,15,30,0.76))] shadow-[0_22px_52px_-40px_rgba(15,23,42,0.7)]" : "rounded-[26px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,247,251,0.92))] shadow-[0_20px_52px_-42px_rgba(15,23,42,0.16)]"} transition-colors ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, right }) {
  const { isDark } = useThemeToggle();

  return (
    <div className={`flex items-start justify-between gap-3 border-b px-5 py-4 ${isDark ? "border-white/8" : "border-slate-200/80"}`}>
      <div>
        <div className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-950"}`}>{title}</div>
        {subtitle ? (
          <div className={`mt-1 text-xs leading-5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>{subtitle}</div>
        ) : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

export function CardBody({ className = "", children }) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}
