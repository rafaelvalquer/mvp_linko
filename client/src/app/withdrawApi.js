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

export async function createWithdraw({
  pixType,
  pixKey,
  grossAmountCents,
  description,
}) {
  return api(`/withdraw/create`, {
    method: "POST",
    headers: withAuthHeaders(),
    body: JSON.stringify({
      pixType,
      pixKey,
      grossAmountCents,
      description,
    }),
  });
}

export async function getWithdraw(externalId) {
  const q = new URLSearchParams({ externalId }).toString();
  return api(`/withdraw/get?${q}`, {
    headers: withAuthHeaders(),
  });
}

export async function listWithdraws({ limit = 20 } = {}) {
  const q = new URLSearchParams({ limit: String(limit) }).toString();
  return api(`/withdraw/list?${q}`, {
    headers: withAuthHeaders(),
  });
}
