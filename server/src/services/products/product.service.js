import crypto from "crypto";

import { Product } from "../../models/Product.js";

function isNonEmpty(value) {
  return String(value || "").trim().length > 0;
}

function toPriceCents(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  const intVal = Math.trunc(num);
  return intVal >= 0 ? intVal : null;
}

function normalizeProductInput(input = {}) {
  return {
    productId: String(input.productId || "").trim(),
    name: String(input.name || "").trim(),
    description: String(input.description || "").trim(),
    priceCents: toPriceCents(input.priceCents),
    imageUrl: String(input.imageUrl || "").trim(),
  };
}

function validateProductInput(input = {}, { requireProductId = false } = {}) {
  if (requireProductId && !isNonEmpty(input.productId)) {
    const err = new Error("productId required");
    err.status = 400;
    err.statusCode = 400;
    err.code = "PRODUCT_ID_REQUIRED";
    throw err;
  }

  if (!isNonEmpty(input.name)) {
    const err = new Error("name required");
    err.status = 400;
    err.statusCode = 400;
    err.code = "PRODUCT_NAME_REQUIRED";
    throw err;
  }

  if (!Number.isFinite(input.priceCents) || input.priceCents < 0) {
    const err = new Error("priceCents invalid");
    err.status = 400;
    err.statusCode = 400;
    err.code = "PRODUCT_PRICE_INVALID";
    throw err;
  }
}

function makeProductId() {
  return `prd_${crypto.randomBytes(6).toString("hex")}`;
}

async function generateUniqueProductId(workspaceId) {
  let productId = makeProductId();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await Product.findOne({ workspaceId, productId })
      .select("_id")
      .lean();
    if (!exists) return productId;
    productId = makeProductId();
  }

  const err = new Error("Falha ao gerar um productId unico.");
  err.status = 500;
  err.statusCode = 500;
  err.code = "PRODUCT_ID_GENERATION_FAILED";
  throw err;
}

async function assertProductIdAvailable(workspaceId, productId) {
  const normalizedProductId = String(productId || "").trim();
  if (!normalizedProductId) return;

  const exists = await Product.findOne({
    workspaceId,
    productId: normalizedProductId,
  })
    .select("_id")
    .lean();

  if (!exists) return;

  const err = new Error("ID do produto ja existe neste workspace.");
  err.status = 409;
  err.statusCode = 409;
  err.code = "PRODUCT_ID_CONFLICT";
  throw err;
}

export async function createProductForWorkspace({
  workspaceId,
  ownerUserId,
  productId = "",
  name,
  description = "",
  priceCents,
  imageUrl = "",
}) {
  const normalized = normalizeProductInput({
    productId,
    name,
    description,
    priceCents,
    imageUrl,
  });

  if (!normalized.productId) {
    normalized.productId = await generateUniqueProductId(workspaceId);
  } else {
    await assertProductIdAvailable(workspaceId, normalized.productId);
  }

  validateProductInput(normalized, { requireProductId: true });

  return Product.create({
    workspaceId,
    ownerUserId,
    ...normalized,
  });
}

export async function updateProductForWorkspace({
  workspaceId,
  productMongoId,
  ownerUserId = null,
  name,
  description = "",
  priceCents,
  imageUrl,
}) {
  const normalized = normalizeProductInput({
    name,
    description,
    priceCents,
    imageUrl,
  });

  validateProductInput(normalized);

  const patch = {
    name: normalized.name,
    description: normalized.description,
    priceCents: normalized.priceCents,
  };

  if (imageUrl !== undefined) {
    patch.imageUrl = normalized.imageUrl;
  }

  return Product.findOneAndUpdate(
    {
      _id: productMongoId,
      workspaceId,
      ...(ownerUserId ? { ownerUserId } : {}),
    },
    { $set: patch },
    { new: true, runValidators: true },
  ).lean();
}

export async function updateProductPriceForWorkspace({
  workspaceId,
  productMongoId,
  priceCents,
}) {
  const normalizedPrice = toPriceCents(priceCents);
  if (!Number.isFinite(normalizedPrice) || normalizedPrice < 0) {
    const err = new Error("priceCents invalid");
    err.status = 400;
    err.statusCode = 400;
    err.code = "PRODUCT_PRICE_INVALID";
    throw err;
  }

  return Product.findOneAndUpdate(
    { _id: productMongoId, workspaceId },
    { $set: { priceCents: normalizedPrice } },
    { new: true, runValidators: true },
  ).lean();
}

export { normalizeProductInput, validateProductInput, assertProductIdAvailable };
