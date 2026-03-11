import useThemeToggle from "../../app/useThemeToggle.js";

const MAP = {
  PUBLIC:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200",
  ACCEPTED:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200",
  PAID: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200",
  EXPIRED:
    "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-white/10 dark:bg-white/6 dark:text-slate-300",
  DRAFT:
    "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-white/10 dark:bg-white/6 dark:text-slate-300",
  HOLD: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200",
  CONFIRMED:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200",
  CANCELED:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200",
  CANCELLED:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200",
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
};

export default function Badge({ tone = "PUBLIC", children }) {
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
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${MAP[key] || (isDark ? "border-white/10 bg-white/6 text-slate-300" : "border-zinc-200 bg-zinc-50 text-zinc-700")}`}
    >
      {content}
    </span>
  );
}
