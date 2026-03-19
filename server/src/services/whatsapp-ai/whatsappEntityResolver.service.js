import { Client } from "../../models/Client.js";
import { Product } from "../../models/Product.js";
import { normalizeDestinationPhoneN11 } from "../../utils/phone.js";
import {
  buildSparseItemPatch,
  mergeResolvedDraft,
  normalizeResolvedItems,
} from "./whatsappAi.schemas.js";

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function tokenize(value) {
  return normalizeSearchText(value)
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
  if (tokens.length >= 1) regexes.push(new RegExp(escapeRegex(tokens[0]), "i"));

  return regexes;
}

function computeScore(label, query) {
  const normalizedLabel = normalizeSearchText(label);
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedLabel || !normalizedQuery) return 0;

  if (normalizedLabel === normalizedQuery) return 100;
  if (normalizedLabel.startsWith(normalizedQuery)) return 80;
  if (normalizedLabel.includes(normalizedQuery)) return 60;

  const queryTokens = tokenize(normalizedQuery);
  const matchedTokens = queryTokens.filter((token) =>
    normalizedLabel.includes(token),
  ).length;

  if (!queryTokens.length || !matchedTokens) return 0;
  return 30 + matchedTokens;
}

function dedupeById(items = [], key) {
  const seen = new Set();
  return items.filter((item) => {
    const value = String(item?.[key] || "");
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

export function pickCandidateByOrdinal(text, candidates = []) {
  const match = String(text || "").trim().match(/^\d+$/);
  if (!match) return null;

  const index = Number(match[0]) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= candidates.length) {
    return null;
  }

  return candidates[index] || null;
}

export function applyCustomerSelection(resolved = {}, candidate = null) {
  if (!candidate) return resolved;

  const next = {
    ...resolved,
    customerId: candidate.customerId || null,
    customerName: String(candidate.fullName || resolved.customer_name_raw || "").trim(),
    customer_name_raw: String(
      resolved.customer_name_raw || candidate.fullName || "",
    ).trim(),
    customerLookupQuery: String(
      resolved.customer_name_raw || candidate.fullName || "",
    ).trim(),
    customerLookupMiss: false,
  };

  if (!next.destination_phone_n11) {
    next.destination_phone_n11 = normalizeDestinationPhoneN11(
      candidate.phoneDigits || candidate.phone || "",
    );
  }

  return next;
}

export function applyProductSelection(resolved = {}, candidate = null) {
  return applyProductSelectionToItem(resolved, 0, candidate);
}

export function applyProductSelectionToItem(
  resolved = {},
  itemIndex = 0,
  candidate = null,
) {
  if (!candidate) return resolved;

  const items = normalizeResolvedItems(resolved);
  const currentItem = items[itemIndex] || null;
  const productNameRaw = String(
    currentItem?.product_name_raw || candidate.name || "",
  ).trim();

  return mergeResolvedDraft(
    {
      ...resolved,
      items,
    },
    buildSparseItemPatch(itemIndex, {
      productId: candidate.productId || null,
      productName: String(candidate.name || productNameRaw).trim(),
      product_name_raw: productNameRaw,
      productLookupQuery: productNameRaw,
      productLookupMiss: false,
    }),
  );
}

export async function resolveCustomerCandidates({
  workspaceId,
  customerNameRaw,
  limit = 5,
}) {
  const regexes = buildRegexes(customerNameRaw);
  if (!regexes.length) return [];

  const rows = await Client.find({
    workspaceId,
    $or: regexes.map((regex) => ({ fullName: regex })),
  })
    .select("_id fullName phone phoneDigits")
    .limit(Math.max(limit, 8))
    .lean();

  return dedupeById(
    rows
      .map((row) => ({
        customerId: row._id,
        fullName: String(row.fullName || "").trim(),
        phone: String(row.phone || "").trim(),
        phoneDigits: String(row.phoneDigits || "").trim(),
        score: computeScore(row.fullName, customerNameRaw),
      }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score || a.fullName.localeCompare(b.fullName))
      .slice(0, limit),
    "customerId",
  );
}

export async function resolveProductCandidates({
  workspaceId,
  productNameRaw,
  limit = 5,
}) {
  const regexes = buildRegexes(productNameRaw);
  if (!regexes.length) return [];

  const rows = await Product.find({
    workspaceId,
    $or: regexes.map((regex) => ({ name: regex })),
  })
    .select("_id name")
    .limit(Math.max(limit, 8))
    .lean();

  return dedupeById(
    rows
      .map((row) => ({
        productId: row._id,
        name: String(row.name || "").trim(),
        score: computeScore(row.name, productNameRaw),
      }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, limit),
    "productId",
  );
}
