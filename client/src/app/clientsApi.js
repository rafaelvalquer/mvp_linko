// src/app/clientsApi.js
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8011/api";

function getAuthToken() {
  try {
    const direct =
      localStorage.getItem("token") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("authToken") ||
      localStorage.getItem("auth_token") ||
      localStorage.getItem("jwt");

    const t = String(direct || "").trim();
    if (t) return t.toLowerCase().startsWith("bearer ") ? t.slice(7).trim() : t;

    const auth = localStorage.getItem("auth");
    if (auth) {
      const parsed = JSON.parse(auth);
      const raw =
        parsed?.token ||
        parsed?.accessToken ||
        parsed?.authToken ||
        parsed?.auth_token ||
        parsed?.jwt ||
        null;
      const s = String(raw || "").trim();
      if (!s) return null;
      return s.toLowerCase().startsWith("bearer ") ? s.slice(7).trim() : s;
    }
  } catch {}
  return null;
}

async function reqJson(path, opts = {}) {
  const t = getAuthToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || "Request failed");
    err.status = res.status;
    throw err;
  }
  return data;
}

export function listClients({ q } = {}) {
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  const s = qs.toString();
  return reqJson(`/clients${s ? `?${s}` : ""}`);
}

export function createClient({ fullName, email, cpfCnpj, phone }) {
  return reqJson("/clients", {
    method: "POST",
    body: JSON.stringify({ fullName, email, cpfCnpj, phone }),
  });
}

export function updateClient(id, { fullName, email, cpfCnpj, phone }) {
  return reqJson(`/clients/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ fullName, email, cpfCnpj, phone }),
  });
}
