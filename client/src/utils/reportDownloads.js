const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8011/api";

function authHeaders() {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("auth_token") : "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function downloadBlob(blob, filename) {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

export async function downloadReportFile(path, filename) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: authHeaders(),
  });

  if (!response.ok) {
    let message = "Falha no download";
    try {
      const payload = await response.json();
      message = payload?.error || message;
    } catch {}
    throw new Error(message);
  }

  const blob = await response.blob();
  downloadBlob(blob, filename);
}
