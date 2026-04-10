// src/app/api.js
function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function isLocalHostname(hostname = "") {
  const value = String(hostname || "").trim().toLowerCase();
  return (
    value === "localhost" ||
    value === "127.0.0.1" ||
    value === "0.0.0.0" ||
    value === "[::1]"
  );
}

function resolveApiBase() {
  const explicitBase = trimTrailingSlash(import.meta.env.VITE_API_BASE || "");
  if (explicitBase) return explicitBase;

  if (typeof window === "undefined") {
    return "http://localhost:8011/api";
  }

  const currentOrigin = trimTrailingSlash(window.location.origin || "");
  if (!currentOrigin) return "/api";

  if (isLocalHostname(window.location.hostname)) {
    return "http://localhost:8011/api";
  }

  return `${currentOrigin}/api`;
}

export const API_BASE = resolveApiBase();

// cache em memória para GET (opcional) – útil se algum endpoint insistir em 304
const _memCache = new Map();

function isPublicMyPagePath(path = "") {
  return String(path || "").startsWith("/my-page/public/");
}

export async function api(path, opts = {}) {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("auth_token") : "";

  const method = String(opts.method || "GET").toUpperCase();
  const url = `${API_BASE}${path}`;

  const headers = { ...(opts.headers || {}) };

  // Só define Content-Type quando realmente existe body (evita preflight desnecessário em GET)
  const hasBody = opts.body != null;
  const isFormData =
    typeof FormData !== "undefined" && opts.body instanceof FormData;
  const hasCT = headers["Content-Type"] || headers["content-type"];
  if (hasBody && !hasCT && !isFormData) {
    headers["Content-Type"] = "application/json";
  }

  // Authorization (vai gerar preflight, mas normalmente seu backend já permite)
  if (
    token &&
    !isPublicMyPagePath(path) &&
    !headers.Authorization &&
    !headers.authorization
  ) {
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
