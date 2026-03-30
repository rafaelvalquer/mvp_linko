import { api } from "./api.js";

export function getFeedbackReportsDashboard(params = {}) {
  const qs = new URLSearchParams();

  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.type) qs.set("type", params.type);
  if (params.scope) qs.set("scope", params.scope);
  if (params.ownerUserId) qs.set("ownerUserId", params.ownerUserId);

  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return api(`/reports/feedback/dashboard${suffix}`);
}
