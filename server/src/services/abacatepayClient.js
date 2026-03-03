// server/src/services/abacatepayClient.js
const BASE_URL =
  process.env.ABACATEPAY_BASE_URL || "https://api.abacatepay.com";
const TOKEN = process.env.ABACATEPAY_TOKEN || "";

function mustAuth() {
  if (!TOKEN) {
    const e = new Error(
      "AbacatePay não configurado (ABACATEPAY_TOKEN ausente).",
    );
    e.status = 500;
    throw e;
  }
}

/**
 * Request "cru" para a AbacatePay:
 * - Loga status + body quando dá erro
 * - Retorna o JSON completo (sem cortar para json.data)
 */
async function request(path, { method = "GET", body } = {}) {
  mustAuth();

  const url = `${BASE_URL}${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${TOKEN}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text().catch(() => "");
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    // ✅ log de debug do gateway (não inclui token)
    console.log(
      "[abacatepay][http.error]",
      JSON.stringify(
        {
          url,
          method,
          status: res.status,
          response: json,
        },
        null,
        2,
      ),
    );

    const msg =
      json?.error?.message ||
      json?.error ||
      json?.message ||
      `AbacatePay HTTP ${res.status}`;

    const err = new Error(msg);
    err.status = res.status;
    err.details = json;
    throw err;
  }

  return json;
}

export async function abacateCreatePixQr({
  amount,
  expiresIn = 3600,
  description,
  customer,
  metadata,
}) {
  // mantendo /v1 (como você já usa)
  return request("/v1/pixQrCode/create", {
    method: "POST",
    body: { amount, expiresIn, description, customer, metadata },
  });
}

export async function abacateCheckPix({ pixId }) {
  const q = new URLSearchParams({ id: pixId }).toString();
  return request(`/v1/pixQrCode/check?${q}`, { method: "GET" });
}

export async function abacateCreateWithdraw({
  externalId,
  amount,
  pix,
  description,
}) {
  // ✅ usar a rota correta direto (igual seu cURL)
  const body = {
    externalId,
    method: "PIX",
    amount,
    pix,
    description,
  };

  return request("/v1/withdraw/create", { method: "POST", body });
}

export async function abacateGetWithdraw({ externalId }) {
  const q = new URLSearchParams({ externalId }).toString();
  return request(`/v1/withdraw/get?${q}`, { method: "GET" });
}

export async function abacateSimulatePixPayment({ pixId }) {
  const q = new URLSearchParams({ id: pixId }).toString();
  return request(`/v1/pixQrCode/simulate-payment?${q}`, { method: "POST" });
}
