import useThemeToggle from "../../app/useThemeToggle.js";

export default function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}) {
  const { isDark } = useThemeToggle();
  const base =
    `inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 ${isDark ? "focus:ring-offset-slate-950" : "focus:ring-offset-white"} disabled:pointer-events-none disabled:opacity-60`;

  const styles = isDark
    ? {
        primary:
          "bg-[linear-gradient(135deg,#2563eb,#14b8a6)] text-white shadow-[0_18px_36px_-24px_rgba(37,99,235,0.7)] hover:brightness-110",
        secondary:
          "border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10",
        ghost:
          "bg-transparent text-slate-300 hover:bg-white/10 hover:text-white",
        danger:
          "bg-red-600 text-white shadow-[0_18px_36px_-24px_rgba(220,38,38,0.45)] hover:bg-red-700",
      }
    : {
        primary:
          "bg-[linear-gradient(135deg,#2563eb,#14b8a6)] text-white shadow-[0_18px_36px_-24px_rgba(37,99,235,0.7)] hover:brightness-110",
        secondary:
          "border border-slate-200/80 bg-white text-slate-800 shadow-[0_14px_28px_-22px_rgba(15,23,42,0.18)] hover:border-slate-300 hover:bg-slate-50",
        ghost:
          "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-950",
        danger:
          "bg-red-600 text-white shadow-[0_18px_36px_-24px_rgba(220,38,38,0.45)] hover:bg-red-700",
      };

  return (
    <button className={`${base} ${styles[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
