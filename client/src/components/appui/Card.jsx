import useThemeToggle from "../../app/useThemeToggle.js";

const CARD_VARIANTS = {
  default: "surface-panel",
  elevated: "surface-elevated",
  secondary: "surface-secondary",
  quiet: "surface-quiet",
};

export default function Card({
  className = "",
  children,
  variant = "default",
}) {
  return (
    <div
      className={`${CARD_VARIANTS[variant] || CARD_VARIANTS.default} transition-colors ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, right }) {
  const { isDark } = useThemeToggle();

  return (
    <div
      className={`flex items-start justify-between gap-3 border-b px-5 py-4 ${
        isDark ? "border-white/8" : "border-slate-200/80"
      }`}
    >
      <div>
        <div
          className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-950"}`}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            className={`mt-1 text-xs leading-5 ${isDark ? "text-slate-400" : "text-slate-500"}`}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

export function CardBody({ className = "", children }) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}
