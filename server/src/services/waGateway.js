// server/src/services/waGateway.js
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

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

export async function sendWhatsApp({ to, message }) {
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

  const url = `${baseUrl}/send`;
  const payload = { to, message };

  const timeoutMs = Number(process.env.WA_GATEWAY_TIMEOUT_MS || 4000);
  const retries = Number(process.env.WA_GATEWAY_RETRIES || 1);

  let lastErr = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });

      const data = await resp.json().catch(() => null);

      if (!resp.ok || !data?.ok) {
        const msg = data?.error || `Falha wa-gateway (HTTP ${resp.status})`;
        const err = new Error(msg);
        err.code = data?.error || `HTTP_${resp.status}`;
        err.status = resp.status;
        err.details = data;
        throw err;
      }

      return {
        ok: true,
        providerMessageId: data?.providerMessageId || data?.providerMessageId,
        raw: data,
      };
    } catch (err) {
      lastErr = err;
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
