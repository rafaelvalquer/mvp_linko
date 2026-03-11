export function getRecurringStatusLabel(status) {
  const s = String(status || "").trim().toUpperCase();
  if (s === "ACTIVE") return "Ativa";
  if (s === "PAUSED") return "Pausada";
  if (s === "ENDED") return "Encerrada";
  if (s === "ERROR") return "Com erro";
  return "Rascunho";
}

export function getRecurringStatusTone(status) {
  const s = String(status || "").trim().toUpperCase();
  if (s === "ACTIVE") return "PAID";
  if (s === "PAUSED") return "ACCEPTED";
  if (s === "ENDED") return "EXPIRED";
  if (s === "ERROR") return "CANCELLED";
  return "DRAFT";
}

export function getRecurringHistoryStatusLabel(status) {
  const s = String(status || "").trim().toLowerCase();
  if (s === "generated") return "Gerada";
  if (s === "queued") return "Na fila";
  if (s === "sent") return "Enviada";
  if (s === "skipped") return "Ignorada";
  if (s === "failed") return "Falhou";
  if (s === "paused") return "Pausada";
  if (s === "ended") return "Encerrada";
  return "Gerada";
}

export function getRecurringHistoryTone(status) {
  const s = String(status || "").trim().toLowerCase();
  if (s === "generated" || s === "sent") return "PAID";
  if (s === "queued" || s === "skipped" || s === "paused") return "ACCEPTED";
  if (s === "ended") return "EXPIRED";
  if (s === "failed") return "CANCELLED";
  return "PUBLIC";
}
