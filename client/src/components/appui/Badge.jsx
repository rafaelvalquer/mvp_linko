const MAP = {
  PUBLIC: "bg-blue-50 text-blue-700 border-blue-200",
  ACCEPTED: "bg-amber-50 text-amber-800 border-amber-200",
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
  EXPIRED: "bg-zinc-50 text-zinc-600 border-zinc-200",
  DRAFT: "bg-zinc-50 text-zinc-700 border-zinc-200",
  HOLD: "bg-amber-50 text-amber-800 border-amber-200",
  CONFIRMED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELED: "bg-red-50 text-red-700 border-red-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
};

const LABEL = {
  PUBLIC: "Público",
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
  const key = String(tone || "")
    .trim()
    .toUpperCase();

  // ✅ Se children for exatamente o status ("PAID", "PUBLIC"...),
  // mostramos o LABEL PT-BR.
  let content = LABEL[key] ?? key;

  if (children !== undefined && children !== null) {
    if (typeof children === "string") {
      const ck = children.trim().toUpperCase();
      content = ck && ck !== key ? children : content;
    } else {
      content = children;
    }
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
        MAP[key] || "bg-zinc-50 text-zinc-700 border-zinc-200"
      }`}
    >
      {content}
    </span>
  );
}
