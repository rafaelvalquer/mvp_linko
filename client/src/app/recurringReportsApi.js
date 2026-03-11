import { api } from "./api.js";

export function getRecurringReportsDashboard(params = {}) {
  const qs = new URLSearchParams();

  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.type) qs.set("type", params.type);
  if (params.recurringStatus) qs.set("recurringStatus", params.recurringStatus);

  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return api(`/reports/recurring/dashboard${suffix}`);
}
