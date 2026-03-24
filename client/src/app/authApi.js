//src/app/authApi.js

import { api } from "./api.js";

export function login({ email, password }) {
  return api("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function register({
  name,
  email,
  password,
  workspaceName,
  whatsappPhone,
}) {
  return api("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      name,
      email,
      password,
      workspaceName,
      whatsappPhone,
    }),
  });
}

export function me() {
  return api("/auth/me");
}

export function updateMyWhatsAppPhone({ whatsappPhone }) {
  return api("/auth/me/whatsapp-phone", {
    method: "PATCH",
    body: JSON.stringify({ whatsappPhone }),
  });
}

export function getWhatsNew() {
  return api("/auth/whats-new");
}

export function ackWhatsNew({ seenAt }) {
  return api("/auth/whats-new/ack", {
    method: "POST",
    body: JSON.stringify({ seenAt }),
  });
}

export function listWorkspaceUsers() {
  return api("/auth/workspace-users");
}

export function createWorkspaceUser(payload) {
  return api("/auth/workspace-users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateWorkspaceUser(id, payload) {
  return api(`/auth/workspace-users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
