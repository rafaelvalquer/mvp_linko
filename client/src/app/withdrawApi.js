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
  const token = getAuthToken();
  return {
    ...(extra || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "Content-Type": "application/json",
  };
}

export async function getPayoutSettings() {
  return api("/withdraw/payout-settings", {
    headers: withAuthHeaders(),
    cache: "no-store",
  });
}

export async function updatePayoutSettings(payload) {
  return api("/withdraw/payout-settings", {
    method: "PUT",
    headers: withAuthHeaders(),
    body: JSON.stringify(payload || {}),
  });
}
