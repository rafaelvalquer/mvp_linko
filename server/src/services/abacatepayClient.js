// server/src/services/abacatepayClient.js
// MVP MANUAL_PIX: AbacatePay desativado.
// Mantém exports para não quebrar imports legados.

function disabled() {
  const err = new Error(
    "AbacatePay desativado: este projeto usa pagamento manual via Pix do vendedor.",
  );
  err.statusCode = 410;
  throw err;
}

export async function abacateCreatePixQr() {
  return disabled();
}

export async function abacateCheckPix() {
  return disabled();
}

export async function abacateSimulatePixPayment() {
  return disabled();
}
