const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8011/api";

export async function api(path, opts) {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("auth_token") : "";

  const headers = { ...(opts?.headers || {}) };
  const hasCT = headers["Content-Type"] || headers["content-type"];
  if (!hasCT) headers["Content-Type"] = "application/json";

  if (token && !headers.Authorization && !headers.authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data?.error || "Request failed");
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}
