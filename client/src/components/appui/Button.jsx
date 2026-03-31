import useThemeToggle from "../../app/useThemeToggle.js";

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}) {
  const { isDark } = useThemeToggle();
  const base =
    `inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 ${isDark ? "focus:ring-offset-[#08111f]" : "focus:ring-offset-white"} disabled:pointer-events-none disabled:opacity-60`;

  const sizes = {
    sm: "h-9 rounded-xl px-3 py-2 text-xs",
    md: "h-10 rounded-2xl px-4 py-2.5 text-sm",
    lg: "h-11 rounded-2xl px-5 py-3 text-sm",
  };

  const styles = isDark
    ? {
        primary:
          "border border-sky-400/20 bg-[linear-gradient(135deg,#2563eb,#0f766e)] text-white shadow-[0_20px_40px_-26px_rgba(37,99,235,0.65)] hover:-translate-y-[1px] hover:brightness-110",
        secondary:
          "border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] text-slate-100 hover:border-sky-400/20 hover:bg-white/10",
        ghost:
          "bg-transparent text-slate-300 hover:bg-white/8 hover:text-white",
        danger:
          "border border-rose-500/20 bg-[linear-gradient(135deg,#e11d48,#be123c)] text-white shadow-[0_18px_36px_-24px_rgba(225,29,72,0.45)] hover:-translate-y-[1px] hover:brightness-110",
      }
    : {
        primary:
          "border border-sky-200 bg-[linear-gradient(135deg,#2563eb,#0f766e)] text-white shadow-[0_18px_36px_-24px_rgba(37,99,235,0.52)] hover:-translate-y-[1px] hover:brightness-110",
        secondary:
          "border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] text-slate-800 shadow-[0_16px_28px_-24px_rgba(15,23,42,0.16)] hover:border-sky-200 hover:bg-slate-50",
        ghost:
          "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-950",
        danger:
          "border border-rose-200 bg-[linear-gradient(135deg,#e11d48,#be123c)] text-white shadow-[0_18px_36px_-24px_rgba(225,29,72,0.4)] hover:-translate-y-[1px] hover:brightness-110",
      };

  return (
    <button
      className={`${base} ${sizes[size] || sizes.md} ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
