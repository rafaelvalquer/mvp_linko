import { api } from "./api.js";

export function getMyPageReportsAnalytics(params = {}) {
  const search = new URLSearchParams();
  const range = String(params.range || "30d").trim() || "30d";
  search.set("range", range);

  if (range === "custom") {
    if (params.from) search.set("from", String(params.from));
    if (params.to) search.set("to", String(params.to));
  }

  if (params.pageId) search.set("pageId", String(params.pageId));
  if (params.scope) search.set("scope", String(params.scope));
  if (params.ownerUserId) search.set("ownerUserId", String(params.ownerUserId));

  return api(`/reports/my-page/analytics?${search.toString()}`);
}
