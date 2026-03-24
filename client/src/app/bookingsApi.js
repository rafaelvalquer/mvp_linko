// src/app/bookingsApi.js
import { api } from "./api.js";

function getAuthToken() {
  try {
    const direct =
      localStorage.getItem("token") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("authToken");
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

export async function listBookings({ from, to, status, scope, ownerUserId } = {}) {
  const q = new URLSearchParams();
  if (from) q.set("from", from);
  if (to) q.set("to", to);
  if (status) q.set("status", status);
  if (scope) q.set("scope", scope);
  if (ownerUserId) q.set("ownerUserId", ownerUserId);

  return api(`/bookings?${q.toString()}`, {
    headers: withAuthHeaders(),
  });
}

export async function cancelBooking(id) {
  return api(`/bookings/${id}/cancel`, {
    method: "PATCH",
    headers: withAuthHeaders(),
  });
}
