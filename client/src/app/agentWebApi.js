import { api } from "./api.js";

export function getLuminaBootstrap() {
  return api("/agent/web/bootstrap");
}

export function getLuminaPassiveStatus() {
  return api("/agent/web/passive-status");
}

export function getLuminaSession(sessionId) {
  return api(`/agent/web/sessions/${sessionId}`);
}

export function getLuminaOfferPaymentProof(offerId, { inline = true } = {}) {
  const normalizedOfferId = String(offerId || "").trim();
  const query = inline ? "?inline=1" : "";
  return api(`/offers/${normalizedOfferId}/payment-proof${query}`);
}

export function sendLuminaMessage({
  text,
  actionKey = "",
  automationContext = null,
  sessionId = "",
}) {
  const body = {
    text,
  };

  if (String(actionKey || "").trim()) {
    body.actionKey = String(actionKey || "").trim();
  }

  if (automationContext && typeof automationContext === "object") {
    body.automationContext = automationContext;
  }

  if (String(sessionId || "").trim()) {
    body.sessionId = String(sessionId || "").trim();
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
