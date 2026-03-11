// server/src/services/waGateway.js
function boolEnv(name, defVal = false) {
  const v = String(process.env[name] ?? "")
    .trim()
    .toLowerCase();
  if (!v) return defVal;
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export function isWhatsAppNotificationsEnabled() {
  if (!boolEnv("WHATSAPP_NOTIFICATIONS_ENABLED", false)) return false;
  if (!process.env.WA_GATEWAY_URL) return false;
  if (!process.env.WA_GATEWAY_API_KEY) return false;
  return true;
}

function gatewayBaseConfig() {
  const baseUrl = String(process.env.WA_GATEWAY_URL || "").replace(/\/+$/g, "");
  const apiKey = String(process.env.WA_GATEWAY_API_KEY || "").trim();

  if (!baseUrl) {
    const err = new Error("WA_GATEWAY_URL ausente");
    err.code = "WA_GATEWAY_URL_MISSING";
    throw err;
  }
  if (!apiKey) {
    const err = new Error("WA_GATEWAY_API_KEY ausente");
    err.code = "WA_GATEWAY_API_KEY_MISSING";
    throw err;
  }

  return { baseUrl, apiKey };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildGatewayError(message, code, extra = {}) {
  const err = new Error(message);
  err.code = code;
  Object.assign(err, extra);
  return err;
}

function isNetworkLikeError(err) {
  const name = String(err?.name || "");
  const code = String(err?.code || "");
  const message = String(err?.message || "").trim().toLowerCase();
  const causeCode = String(err?.cause?.code || "");
  return (
    name === "AbortError" ||
    (name === "TypeError" && message.includes("fetch failed")) ||
    [
      "ETIMEDOUT",
      "ECONNRESET",
      "ECONNREFUSED",
      "EHOSTUNREACH",
      "ENOTFOUND",
      "UND_ERR_CONNECT_TIMEOUT",
      "UND_ERR_HEADERS_TIMEOUT",
      "UND_ERR_SOCKET",
    ].includes(code || causeCode)
  );
}

async function requestGatewayJson(path, { method = "GET", body = null } = {}) {
  const { baseUrl, apiKey } = gatewayBaseConfig();
  const url = `${baseUrl}${path}`;

  const timeoutMs = Number(process.env.WA_GATEWAY_TIMEOUT_MS || 4000);
  const retries = Number(process.env.WA_GATEWAY_RETRIES || 0);

  let lastErr = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const resp = await fetch(url, {
        method,
        headers: {
          "x-api-key": apiKey,
          ...(body ? { "content-type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: ctrl.signal,
      });

      const data = await resp.json().catch(() => null);

      if (!resp.ok || !data?.ok) {
        throw buildGatewayError(
          data?.error || `Falha wa-gateway (HTTP ${resp.status})`,
          data?.error || `HTTP_${resp.status}`,
          {
            status: resp.status,
            details: data,
          },
        );
      }

      return data;
    } catch (err) {
      if (err?.name === "AbortError") {
        lastErr = buildGatewayError("Timeout ao comunicar com wa-gateway", "WA_TIMEOUT", {
          status: 408,
          details: { path, method },
        });
      } else if (isNetworkLikeError(err)) {
        lastErr = buildGatewayError(
          err?.message || "Erro de rede ao comunicar com wa-gateway",
          err?.code || err?.cause?.code || "WA_NETWORK_ERROR",
          {
            status: err?.status || err?.cause?.status || 503,
            details: {
              path,
              method,
              causeCode: err?.cause?.code || null,
            },
          },
        );
      } else {
        lastErr = err;
      }

      if (attempt < retries) {
        await sleep(250);
        continue;
      }
    } finally {
      clearTimeout(t);
    }
  }

  throw lastErr;
}

export function isRetryableWhatsAppError(err) {
  const status = Number(err?.status || err?.details?.status || 0);
  const code = String(err?.code || "").trim().toUpperCase();
  const name = String(err?.name || "").trim();
  const message = String(err?.message || "").trim().toLowerCase();

  if (status >= 500) return true;
  if (status === 408 || status === 429) return true;
  if (name === "AbortError") return true;
  if (name === "TypeError" && message.includes("fetch failed")) return true;
  if (
    [
      "WHATSAPP_NOT_READY",
      "WA_TIMEOUT",
      "WA_NETWORK_ERROR",
      "ETIMEDOUT",
      "ECONNRESET",
      "ECONNREFUSED",
      "EHOSTUNREACH",
      "ENOTFOUND",
      "UND_ERR_CONNECT_TIMEOUT",
      "UND_ERR_HEADERS_TIMEOUT",
      "UND_ERR_SOCKET",
    ].includes(code)
  ) {
    return true;
  }

  return false;
}

export async function getWhatsAppGatewayStatus() {
  const data = await requestGatewayJson("/status", { method: "GET" });
  return {
    ok: true,
    state: String(data?.state || "").trim().toUpperCase(),
    ready: String(data?.state || "").trim().toUpperCase() === "READY",
    raw: data,
  };
}

export async function sendWhatsAppNow({ to, message }) {
  const data = await requestGatewayJson("/send", {
    method: "POST",
    body: { to, message },
  });

  return {
    ok: true,
    providerMessageId: data?.providerMessageId || null,
    raw: data,
  };
}

export async function sendWhatsApp(payload) {
  return sendWhatsAppNow(payload);
}
