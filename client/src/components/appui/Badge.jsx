const MAP = {
  // Neutro / rascunho
  DRAFT: "bg-zinc-50 text-zinc-700 border-zinc-200",

  // Link publicado/enviado
  PUBLIC: "bg-sky-50 text-sky-700 border-sky-200",
  SENT: "bg-sky-50 text-sky-700 border-sky-200",

  // Aguardando ação
  HOLD: "bg-violet-50 text-violet-700 border-violet-200",

  // Aceito / aprovado
  ACCEPTED: "bg-amber-50 text-amber-800 border-amber-200",

  // Finalizado com sucesso
  CONFIRMED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",

  // Falhou / inválido
  EXPIRED: "bg-red-50 text-red-700 border-red-200",
  CANCELED: "bg-red-50 text-red-700 border-red-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",

  // Pós-pagamento
  REFUNDED: "bg-rose-50 text-rose-700 border-rose-200",
};

const LABELS_PT = {
  DRAFT: "Rascunho",
  PUBLIC: "Pública",
  SENT: "Enviada",
  HOLD: "Em espera",
  ACCEPTED: "Aceita",
  CONFIRMED: "Confirmada",
  PAID: "Paga",
  EXPIRED: "Expirada",
  CANCELED: "Cancelada",
  CANCELLED: "Cancelada",
  REFUNDED: "Reembolsada",
};

function normTone(v) {
  return String(v || "")
    .trim()
    .toUpperCase();
}

export default function Badge({ tone = "PUBLIC", children }) {
  const key = normTone(tone || children || "PUBLIC");
  const cls = MAP[key] || "bg-zinc-50 text-zinc-700 border-zinc-200";

  const text =
    typeof children === "string"
      ? LABELS_PT[key] || children
      : (children ?? LABELS_PT[key] ?? key);

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}
    >
      {text}
    </span>
  );
}
