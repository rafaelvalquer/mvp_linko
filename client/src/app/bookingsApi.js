// src/app/bookingsApi.js
import { api } from "./api.js";

export async function listBookings({ from, to, status } = {}) {
  const q = new URLSearchParams();

  if (from) q.set("from", from);
  if (to) q.set("to", to);

  if (status) {
    const v = Array.isArray(status) ? status.join(",") : String(status);
    q.set("status", v);
  }

  const qs = q.toString();
  return api(`/bookings${qs ? `?${qs}` : ""}`);
}
