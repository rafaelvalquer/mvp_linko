// src/app/withdrawApi.js
import { api } from "./api.js";

function getAuthToken() {
  try {
    const direct =
      localStorage.getItem("token") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("authToken") ||
      localStorage.getItem("auth_token");
    if (direct) return direct;

    const auth = localStorage.getItem("auth");
    if (auth) {
      const parsed = JSON.parse(auth);
      return (
        parsed?.token ||
        parsed?.accessToken ||
        parsed?.authToken ||
        parsed?.jwt ||
        null
      );
    }
  } catch {}
  return null;
}

function withAuthHeaders(extra) {
  const t = getAuthToken();
  return {
    ...(extra || {}),
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

export async function getWithdrawConfig() {
  return api(`/withdraw/config`, {
    headers: withAuthHeaders(),
  });
}

export async function getPayoutSettings() {
  return api(`/withdraw/payout-settings`, {
    method: "GET",
    cache: "no-store",
    headers: withAuthHeaders(),
  });
}

export async function updatePayoutSettings(payload) {
  return api(`/withdraw/payout-settings`, {
    method: "PUT",
    headers: withAuthHeaders(),
    body: JSON.stringify(payload || {}),
  });
}

/**
 * createWithdraw
 * - amountCents: number
 * - description?: string
 * - idempotencyKey?: string (opcional)
 */
export async function createWithdraw({
  amountCents,
  description,
  idempotencyKey,
} = {}) {
  const headers = withAuthHeaders();
  if (idempotencyKey) headers["Idempotency-Key"] = String(idempotencyKey);

  return api(`/withdraw/create`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      amountCents,
      description,
      // fallback para quem preferir enviar no body
      idempotencyKey,
    }),
  });
}

export async function getWithdraw(externalId) {
  const d = await api(
    `/withdraw/get?externalId=${encodeURIComponent(externalId)}`,
    {
      method: "GET",
      cache: "no-store",
      headers: withAuthHeaders(),
    },
  );
  return d?.withdraw || null;
}

export async function listWithdraws({ limit = 20 } = {}) {
  const d = await api(`/withdraw/list?limit=${encodeURIComponent(limit)}`, {
    method: "GET",
    cache: "no-store",
    headers: withAuthHeaders(),
  });
  return Array.isArray(d?.items) ? d.items : [];
}
