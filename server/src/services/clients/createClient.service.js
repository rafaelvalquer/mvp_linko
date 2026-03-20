import crypto from "crypto";

import { Client } from "../../models/Client.js";

function isNonEmpty(value) {
  return String(value || "").trim().length > 0;
}

function normalizeClientInput(input = {}) {
  return {
    fullName: String(input.fullName || "").trim(),
    email: String(input.email || "")
      .trim()
      .toLowerCase(),
    cpfCnpj: String(input.cpfCnpj || "").trim(),
    phone: String(input.phone || "").trim(),
  };
}

function validateClientInput(input = {}) {
  if (!isNonEmpty(input.fullName)) {
    const err = new Error("fullName required");
    err.status = 400;
    err.statusCode = 400;
    err.code = "CLIENT_FULLNAME_REQUIRED";
    throw err;
  }

  if (!isNonEmpty(input.email)) {
    const err = new Error("email required");
    err.status = 400;
    err.statusCode = 400;
    err.code = "CLIENT_EMAIL_REQUIRED";
    throw err;
  }

  if (!isNonEmpty(input.cpfCnpj)) {
    const err = new Error("cpfCnpj required");
    err.status = 400;
    err.statusCode = 400;
    err.code = "CLIENT_CPFCNPJ_REQUIRED";
    throw err;
  }

  if (!isNonEmpty(input.phone)) {
    const err = new Error("phone required");
    err.status = 400;
    err.statusCode = 400;
    err.code = "CLIENT_PHONE_REQUIRED";
    throw err;
  }
}

function makeClientId() {
  return `cli_${crypto.randomBytes(6).toString("hex")}`;
}

async function generateUniqueClientId(workspaceId) {
  let clientId = makeClientId();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await Client.findOne({ workspaceId, clientId })
      .select("_id")
      .lean();
    if (!exists) return clientId;
    clientId = makeClientId();
  }

  const err = new Error("Falha ao gerar um clientId unico.");
  err.status = 500;
  err.statusCode = 500;
  err.code = "CLIENT_ID_GENERATION_FAILED";
  throw err;
}

export async function createClientForWorkspace({
  workspaceId,
  ownerUserId,
  fullName,
  email,
  cpfCnpj,
  phone,
}) {
  const normalized = normalizeClientInput({
    fullName,
    email,
    cpfCnpj,
    phone,
  });

  validateClientInput(normalized);

  const clientId = await generateUniqueClientId(workspaceId);
  return Client.create({
    workspaceId,
    ownerUserId,
    clientId,
    ...normalized,
  });
}

export { normalizeClientInput, validateClientInput };
