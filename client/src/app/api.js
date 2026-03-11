// src/app/api.js
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8011/api";

// cache em memória para GET (opcional) – útil se algum endpoint insistir em 304
const _memCache = new Map();

export async function api(path, opts = {}) {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("auth_token") : "";

  const method = String(opts.method || "GET").toUpperCase();
  const url = `${API_BASE}${path}`;

  const headers = { ...(opts.headers || {}) };

  // Só define Content-Type quando realmente existe body (evita preflight desnecessário em GET)
  const hasBody = opts.body != null;
  const hasCT = headers["Content-Type"] || headers["content-type"];
  if (hasBody && !hasCT) headers["Content-Type"] = "application/json";

  // Authorization (vai gerar preflight, mas normalmente seu backend já permite)
  if (token && !headers.Authorization && !headers.authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...opts,
    method,
    headers,
    cache: opts.cache ?? "no-store",
  });

  // 304 não tem body; tenta usar cache em memória
  if (res.status === 304) {
    if (_memCache.has(url)) return _memCache.get(url);
    const err = new Error("Resposta 304 (Not Modified) sem cache local.");
    err.status = 304;
    throw err;
  }

  if (res.status === 204) return {};

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data?.error || "Request failed");
    err.status = res.status;
    err.code = data?.code || "";
    err.reason = data?.reason || "";
    err.capability = data?.capability || null;
    err.data = data;
    throw err;
  }

  // guarda cache de GET bem-sucedido
  if (method === "GET") _memCache.set(url, data);

  return data;
}
