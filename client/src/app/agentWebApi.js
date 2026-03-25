import { api } from "./api.js";

export function getLuminaBootstrap() {
  return api("/agent/web/bootstrap");
}

export function getLuminaSession(sessionId) {
  return api(`/agent/web/sessions/${sessionId}`);
}

export function sendLuminaMessage({ text, actionKey = "" }) {
  const body = {
    text,
  };

  if (String(actionKey || "").trim()) {
    body.actionKey = String(actionKey || "").trim();
  }

  return api("/agent/web/messages", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function startNewLuminaSession() {
  return api("/agent/web/sessions/new", {
    method: "POST",
  });
}
