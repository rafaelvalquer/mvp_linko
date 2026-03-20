import { api } from "./api.js";

function toQueryString(params = {}) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value == null) return;
    if (value === "") return;
    search.set(key, String(value));
  });

  const query = search.toString();
  return query ? `?${query}` : "";
}

export function getAdminOverview() {
  return api("/admin/overview");
}

export function getAdminServices() {
  return api("/admin/services");
}

export function listAdminWorkspaces(params = {}) {
  return api(`/admin/workspaces${toQueryString(params)}`);
}

export function listAdminUsers(params = {}) {
  return api(`/admin/users${toQueryString(params)}`);
}

export function listAdminClients(params = {}) {
  return api(`/admin/clients${toQueryString(params)}`);
}

export function listAdminWhatsAppOutbox(params = {}) {
  return api(`/admin/whatsapp/outbox${toQueryString(params)}`);
}

export function listAdminWhatsAppMessageLogs(params = {}) {
  return api(`/admin/whatsapp/message-logs${toQueryString(params)}`);
}

export function getAdminTenantDiagnostics(workspaceId, params = {}) {
  return api(`/admin/tenants/${workspaceId}/diagnostics${toQueryString(params)}`);
}
