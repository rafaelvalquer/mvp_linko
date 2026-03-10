// src/app/recurringOffersApi.js
import { api } from "./api.js";

export function listRecurringOffers(params = {}) {
  const qs = new URLSearchParams();
  if (params.status && params.status !== "ALL") {
    qs.set("status", String(params.status).toLowerCase());
  }
  if (params.q) qs.set("q", String(params.q));
  if (params.bucket) qs.set("bucket", String(params.bucket).toLowerCase());
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return api(`/recurring-offers${suffix}`);
}

export function createRecurringOffer(payload) {
  return api("/recurring-offers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getRecurringOffer(id) {
  return api(`/recurring-offers/${id}`);
}

export function updateRecurringOffer(id, payload) {
  return api(`/recurring-offers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function pauseRecurringOffer(id) {
  return api(`/recurring-offers/${id}/pause`, { method: "POST" });
}

export function resumeRecurringOffer(id) {
  return api(`/recurring-offers/${id}/resume`, { method: "POST" });
}

export function runRecurringOfferNow(id) {
  return api(`/recurring-offers/${id}/run-now`, { method: "POST" });
}

export function endRecurringOffer(id) {
  return api(`/recurring-offers/${id}/end`, { method: "POST" });
}

export function duplicateRecurringOffer(id) {
  return api(`/recurring-offers/${id}/duplicate`, { method: "POST" });
}

export function listRecurringOfferOffers(id) {
  return api(`/recurring-offers/${id}/offers`);
}

export function listRecurringOfferHistory(id) {
  return api(`/recurring-offers/${id}/history`);
}
