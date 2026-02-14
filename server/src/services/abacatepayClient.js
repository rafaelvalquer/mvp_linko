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

async function request(path, { method = "GET", body } = {}) {
  mustAuth();

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${TOKEN}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      json?.error?.message || json?.message || `AbacatePay HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.details = json;
    throw err;
  }

  // docs retornam { data: {...}, error: ... } em Pix QRCode
  return json?.data ?? json;
}

export async function abacateCreatePixQr({
  amount,
  expiresIn = 3600,
  description,
  customer,
  metadata,
}) {
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
  // Prefer the path requested (/withdraw/*), fallback to /v1/withdraw/* if needed.
  const body = {
    externalId,
    method: "PIX",
    amount,
    pix,
    description,
  };

  try {
    return await request("/withdraw/create", { method: "POST", body });
  } catch (err) {
    if (err?.status === 404) {
      return request("/v1/withdraw/create", { method: "POST", body });
    }
    throw err;
  }
}

export async function abacateGetWithdraw({ externalId }) {
  const q = new URLSearchParams({ externalId }).toString();

  try {
    return await request(`/withdraw/get?${q}`, { method: "GET" });
  } catch (err) {
    if (err?.status === 404) {
      return request(`/v1/withdraw/get?${q}`, { method: "GET" });
    }
    throw err;
  }
}

export async function abacateSimulatePixPayment({ pixId }) {
  const q = new URLSearchParams({ id: pixId }).toString();
  return request(`/v1/pixQrCode/simulate-payment?${q}`, { method: "POST" });
}
