import { Client } from "../../models/Client.js";
import { Product } from "../../models/Product.js";
import { formatPhoneDisplay, onlyDigits } from "../../utils/phone.js";
import {
  resolveCustomerCandidates,
  resolveProductCandidates,
} from "./whatsappEntityResolver.service.js";

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeComparableText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function tokenize(value) {
  return normalizeComparableText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function buildRegexes(value) {
  const raw = String(value || "").trim();
  const tokens = tokenize(raw);
  const regexes = [];

  if (raw) regexes.push(new RegExp(escapeRegex(raw), "i"));
  if (tokens.length > 1) {
    regexes.push(
      new RegExp(tokens.map((token) => `(?=.*${escapeRegex(token)})`).join(""), "i"),
    );
  }
  if (tokens.length) regexes.push(new RegExp(escapeRegex(tokens[0]), "i"));

  return regexes;
}

function formatMoney(cents) {
  const value = Number(cents);
  if (!Number.isFinite(value)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

function formatClientLookupEntry(candidate = {}, index = 0) {
  return `${index + 1}. ${String(candidate?.fullName || "Cliente").trim()} - ${formatPhoneDisplay(
    candidate?.phoneDigits || candidate?.phone || "",
  )}`;
}

function formatProductLookupEntry(candidate = {}, index = 0) {
  const externalProductId = String(candidate?.externalProductId || "").trim();
  return `${index + 1}. ${String(candidate?.name || "Produto").trim()}${
    externalProductId ? ` - Codigo: ${externalProductId}` : ""
  } - ${formatMoney(candidate?.priceCents)}`;
}

function mapProductDoc(doc = {}) {
  return {
    productId: doc._id,
    name: String(doc.name || "").trim(),
    description: String(doc.description || "").trim(),
    priceCents: Number(doc.priceCents || 0) || 0,
    externalProductId: String(doc.productId || "").trim(),
  };
}

export async function searchClientCandidates({
  workspaceId,
  clientNameRaw,
  limit = 5,
}) {
  return resolveCustomerCandidates({
    workspaceId,
    customerNameRaw: clientNameRaw,
    limit,
  });
}

export async function searchProductCandidates({
  workspaceId,
  productNameRaw,
  limit = 5,
}) {
  const baseCandidates = await resolveProductCandidates({
    workspaceId,
    productNameRaw,
    limit,
  });

  if (!baseCandidates.length) return [];

  const docs = await Product.find({
    workspaceId,
    _id: { $in: baseCandidates.map((candidate) => candidate.productId) },
  })
    .select("_id name description priceCents")
    .lean();

  const byId = new Map(docs.map((doc) => [String(doc._id), doc]));
  return baseCandidates.map((candidate) => {
    const doc = byId.get(String(candidate.productId)) || {};
    return {
      ...candidate,
      description: String(doc.description || "").trim(),
      priceCents: Number(doc.priceCents || 0) || 0,
    };
  });
}

export async function lookupClientPhones({
  workspaceId,
  clientNameRaw,
  limit = 5,
}) {
  const candidates = await searchClientCandidates({
    workspaceId,
    clientNameRaw,
    limit,
  });

  return {
    count: candidates.length,
    items: candidates,
    lines: candidates.map(formatClientLookupEntry),
  };
}

export async function lookupProducts({
  workspaceId,
  productNameRaw,
  productCode = "",
  lookupMode = "by_name",
  limit = 8,
}) {
  const normalizedProductCode = String(productCode || "").trim();
  if (lookupMode === "by_code") {
    if (!normalizedProductCode) {
      return { count: 0, items: [], lines: [], lookupMode: "by_code" };
    }

    const doc = await Product.findOne({
      workspaceId,
      productId: normalizedProductCode,
    })
      .select("_id name description priceCents productId")
      .lean();

    const items = doc ? [mapProductDoc(doc)] : [];
    return {
      count: items.length,
      items,
      lines: items.map(formatProductLookupEntry),
      lookupMode: "by_code",
    };
  }

  const regexes = buildRegexes(productNameRaw);
  if (!regexes.length) {
    return { count: 0, items: [], lines: [], lookupMode: "by_name" };
  }

  const docs = await Product.find({
    workspaceId,
    $or: regexes.map((regex) => ({ name: regex })),
  })
    .select("_id name description priceCents productId")
    .sort({ createdAt: -1 })
    .limit(Math.max(limit, 8))
    .lean();

  const items = docs.map(mapProductDoc);

  return {
    count: items.length,
    items,
    lines: items.map(formatProductLookupEntry),
    lookupMode: "by_name",
  };
}

export async function findProductByCode({
  workspaceId,
  productCode,
}) {
  const normalizedProductCode = String(productCode || "").trim();
  if (!normalizedProductCode) return null;

  const doc = await Product.findOne({
    workspaceId,
    productId: normalizedProductCode,
  })
    .select("_id name description priceCents productId")
    .lean();

  return doc ? mapProductDoc(doc) : null;
}

export function normalizeClientPhoneForStorage(raw) {
  const digits = onlyDigits(raw);
  if (!digits) return "";
  if (digits.length === 11) return formatPhoneDisplay(digits);
  if (digits.length === 13 && digits.startsWith("55")) {
    return formatPhoneDisplay(digits.slice(2));
  }
  return String(raw || "").trim();
}
