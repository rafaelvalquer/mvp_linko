export const QUOTE_REQUEST_STATUS_FILTERS = [
  "ALL",
  "NEW",
  "IN_PROGRESS",
  "CONVERTED",
  "ARCHIVED",
];

export function normalizeQuoteRequestStatusFilter(value) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();
  if (QUOTE_REQUEST_STATUS_FILTERS.includes(normalized)) {
    return normalized;
  }
  return "ALL";
}

export function matchesQuoteRequestStatus(request, filter) {
  const normalized = normalizeQuoteRequestStatusFilter(filter);
  if (normalized === "ALL") return true;
  return String(request?.status || "").trim().toUpperCase() === normalized;
}

export function quoteRequestStatusBadge(status) {
  const value = String(status || "").trim().toLowerCase();
  if (value === "converted") {
    return { tone: "PAID", label: "Convertida" };
  }
  if (value === "in_progress") {
    return { tone: "PUBLIC", label: "Em andamento" };
  }
  if (value === "archived") {
    return { tone: "DRAFT", label: "Arquivada" };
  }
  return { tone: "ACCEPTED", label: "Nova" };
}

export function formatQuoteRequestDateTime(value) {
  if (!value) return "Agora";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Agora";
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Agora";
  }
}

export function buildQuoteRequestsSummary(items = []) {
  return (Array.isArray(items) ? items : []).reduce(
    (acc, item) => {
      acc.total += 1;
      const status = String(item?.status || "").trim().toLowerCase();
      if (status === "in_progress") acc.inProgress += 1;
      else if (status === "converted") acc.converted += 1;
      else if (status === "archived") acc.archived += 1;
      else acc.newCount += 1;
      return acc;
    },
    {
      total: 0,
      newCount: 0,
      inProgress: 0,
      converted: 0,
      archived: 0,
    },
  );
}
