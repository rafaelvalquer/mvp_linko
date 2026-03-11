import useThemeToggle from "../../app/useThemeToggle.js";

export function Input({ className = "", ...props }) {
  const { isDark } = useThemeToggle();

  return (
    <input
      className={`w-full rounded-2xl border px-3.5 py-2.5 text-sm outline-none transition focus:ring-2 ${isDark ? "border-white/10 bg-white/6 text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/30 focus:ring-cyan-400/20" : "border-slate-200/80 bg-white/92 text-slate-900 placeholder:text-slate-400 shadow-[0_14px_24px_-22px_rgba(15,23,42,0.2)] focus:border-cyan-300 focus:ring-cyan-500/30"} ${className}`}
      {...props}
    />
  );
}

export function Textarea({ className = "", ...props }) {
  const { isDark } = useThemeToggle();

  return (
    <textarea
      className={`w-full rounded-2xl border px-3.5 py-2.5 text-sm outline-none transition focus:ring-2 ${isDark ? "border-white/10 bg-white/6 text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/30 focus:ring-cyan-400/20" : "border-slate-200/80 bg-white/92 text-slate-900 placeholder:text-slate-400 shadow-[0_14px_24px_-22px_rgba(15,23,42,0.2)] focus:border-cyan-300 focus:ring-cyan-500/30"} ${className}`}
      {...props}
    />
  );
}
