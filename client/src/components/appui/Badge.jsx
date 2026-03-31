import useThemeToggle from "../../app/useThemeToggle.js";

const MAP = {
  PUBLIC:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200",
  INFO:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200",
  ACCEPTED:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200",
  PENDING:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200",
  PAID:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200",
  SUCCESS:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200",
  EXPIRED:
    "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-400/20 dark:bg-slate-900/60 dark:text-slate-100",
  DRAFT:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-400/20 dark:bg-slate-900/60 dark:text-slate-100",
  NEUTRAL:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-400/20 dark:bg-slate-900/60 dark:text-slate-100",
  HOLD:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200",
  CONFIRMED:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200",
  CANCELED:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200",
  CANCELLED:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200",
};

const LABEL = {
  PUBLIC: "Publico",
  ACCEPTED: "Aceito",
  PAID: "Pago",
  EXPIRED: "Expirado",
  DRAFT: "Rascunho",
  HOLD: "Reservado",
  CONFIRMED: "Confirmado",
  CANCELED: "Cancelado",
  CANCELLED: "Cancelado",
  PENDING: "Pendente",
  NEUTRAL: "Neutro",
};

const SIZE_MAP = {
  xs: "px-2 py-0.5 text-[10px] font-bold",
  sm: "px-2.5 py-1 text-[11px] font-semibold",
  md: "px-3 py-1 text-xs font-semibold",
};

export default function Badge({
  tone = "PUBLIC",
  size = "md",
  className = "",
  children,
}) {
  const { isDark } = useThemeToggle();
  const key = String(tone || "")
    .trim()
    .toUpperCase();

  let content = LABEL[key] ?? key;

  if (children !== undefined && children !== null) {
    if (typeof children === "string") {
      const childKey = children.trim().toUpperCase();
      content = childKey && childKey !== key ? children : content;
    } else {
      content = children;
    }
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border uppercase tracking-[0.14em] ${SIZE_MAP[size] || SIZE_MAP.md} ${MAP[key] || (isDark ? "border-slate-400/20 bg-slate-950/60 text-slate-100" : "border-zinc-200 bg-zinc-50 text-zinc-700")} ${className}`}
    >
      {content}
    </span>
  );
}
