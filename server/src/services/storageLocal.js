// server/src/services/storageLocal.js
import fs from "fs";
import path from "path";

export const PAYMENT_PROOF_DIR = path.resolve(
  process.cwd(),
  "uploads",
  "payment-proofs",
);

export function ensurePaymentProofDir() {
  fs.mkdirSync(PAYMENT_PROOF_DIR, { recursive: true });
}

function safeKey(key) {
  const raw = String(key || "");
  const base = path.basename(raw);
  if (!base || base !== raw) {
    const err = new Error("Invalid storage key");
    err.statusCode = 400;
    throw err;
  }
  return base;
}

export function absPaymentProofPath(key) {
  const k = safeKey(key);
  return path.join(PAYMENT_PROOF_DIR, k);
}

export async function readPaymentProofBase64(key) {
  const p = absPaymentProofPath(key);
  const buf = await fs.promises.readFile(p);
  return buf.toString("base64");
}
