// src/app/productsApi.js
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8011/api";

function getServerOrigin() {
  return API_BASE.replace(/\/api\/?$/i, "");
}
console.log(API_BASE);
function normalizeToken(t) {
  const s = String(t || "").trim();
  if (!s) return null;
  return s.toLowerCase().startsWith("bearer ") ? s.slice(7).trim() : s;
}

function getAuthToken() {
  try {
    const direct =
      localStorage.getItem("token") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("authToken") ||
      localStorage.getItem("auth_token") ||
      localStorage.getItem("jwt") ||
      sessionStorage.getItem("token") ||
      sessionStorage.getItem("accessToken") ||
      sessionStorage.getItem("authToken") ||
      sessionStorage.getItem("auth_token") ||
      sessionStorage.getItem("jwt");

    const normDirect = normalizeToken(direct);
    if (normDirect) return normDirect;

    const auth = localStorage.getItem("auth") || sessionStorage.getItem("auth");
    if (auth) {
      const parsed = JSON.parse(auth);
      const raw =
        parsed?.token ||
        parsed?.accessToken ||
        parsed?.authToken ||
        parsed?.auth_token ||
        parsed?.jwt ||
        parsed?.access_token ||
        null;

      const norm = normalizeToken(raw);
      if (norm) return norm;
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

async function reqForm(path, formData, opts = {}) {
  const t = getAuthToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method || "POST",
    body: formData,
    headers: {
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

export function imageSrc(imageUrl) {
  if (!imageUrl) return "";
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  return `${getServerOrigin()}${imageUrl}`;
}

export function listProducts({ q } = {}) {
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  const s = qs.toString();
  return reqJson(`/products${s ? `?${s}` : ""}`);
}

export function getProduct(id) {
  return reqJson(`/products/${encodeURIComponent(id)}`);
}

export function createProduct({
  productId,
  name,
  description,
  priceCents,
  imageFile,
}) {
  const fd = new FormData();
  fd.set("productId", productId);
  fd.set("name", name);
  fd.set("description", description || "");
  fd.set("priceCents", String(priceCents || 0));
  if (imageFile) fd.set("image", imageFile);
  return reqForm(`/products`, fd, { method: "POST" });
}

export function updateProduct(
  id,
  { name, description, priceCents, imageFile },
) {
  const fd = new FormData();
  fd.set("name", name);
  fd.set("description", description || "");
  fd.set("priceCents", String(priceCents || 0));
  if (imageFile) fd.set("image", imageFile);
  return reqForm(`/products/${encodeURIComponent(id)}`, fd, { method: "PUT" });
}
