import { normalizeDestinationPhoneN11 } from "../../utils/phone.js";

export const WHATSAPP_AI_INTENTS = [
  "create_offer_send_whatsapp",
  "unknown",
];

export const WHATSAPP_AI_REQUIRED_FIELDS = [
  "customer_name_raw",
  "destination_phone_n11",
  "product_name_raw",
  "quantity",
  "unit_price_cents",
];

const EXTRACTION_KEYS = [
  "intent",
  "customer_name_raw",
  "destination_phone_n11",
  "product_name_raw",
  "quantity",
  "unit_price_cents",
  "send_via_whatsapp",
  "source_text",
];

function isNonEmpty(value) {
  return String(value || "").trim().length > 0;
}

function toPositiveInteger(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  const intVal = Math.trunc(num);
  return intVal > 0 ? intVal : null;
}

function normalizeIntent(value) {
  const intent = String(value || "").trim();
  return WHATSAPP_AI_INTENTS.includes(intent) ? intent : "unknown";
}

function ensureNoExtraKeys(payload) {
  const extras = Object.keys(payload || {}).filter(
    (key) => !EXTRACTION_KEYS.includes(key),
  );

  if (!extras.length) return;

  const err = new Error(
    `Campos nao suportados retornados pela IA: ${extras.join(", ")}`,
  );
  err.code = "WHATSAPP_AI_INVALID_KEYS";
  throw err;
}

export function buildExtractionResponseFormat() {
  return {
    type: "json_schema",
    json_schema: {
      name: "whatsapp_offer_intent",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          intent: {
            type: "string",
            enum: WHATSAPP_AI_INTENTS,
          },
          customer_name_raw: { type: "string" },
          destination_phone_n11: { type: "string" },
          product_name_raw: { type: "string" },
          quantity: {
            anyOf: [{ type: "integer", minimum: 1 }, { type: "null" }],
          },
          unit_price_cents: {
            anyOf: [{ type: "integer", minimum: 1 }, { type: "null" }],
          },
          send_via_whatsapp: { type: "boolean" },
          source_text: { type: "string" },
        },
        required: EXTRACTION_KEYS,
      },
    },
  };
}

export function createEmptyExtraction() {
  return {
    intent: "unknown",
    customer_name_raw: "",
    destination_phone_n11: "",
    product_name_raw: "",
    quantity: null,
    unit_price_cents: null,
    send_via_whatsapp: true,
    source_text: "",
  };
}

export function createEmptyResolved() {
  return {
    ...createEmptyExtraction(),
    customerId: null,
    customerName: "",
    customerLookupQuery: "",
    customerLookupMiss: false,
    productId: null,
    productName: "",
    productLookupQuery: "",
    productLookupMiss: false,
  };
}

export function parseStructuredExtraction(payload) {
  let value = payload;

  if (typeof value === "string") {
    value = JSON.parse(value);
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    const err = new Error("A IA retornou um payload invalido.");
    err.code = "WHATSAPP_AI_INVALID_PAYLOAD";
    throw err;
  }

  ensureNoExtraKeys(value);

  return {
    intent: normalizeIntent(value.intent),
    customer_name_raw: String(value.customer_name_raw || "").trim(),
    destination_phone_n11: normalizeDestinationPhoneN11(
      value.destination_phone_n11 || "",
    ),
    product_name_raw: String(value.product_name_raw || "").trim(),
    quantity: toPositiveInteger(value.quantity),
    unit_price_cents: toPositiveInteger(value.unit_price_cents),
    send_via_whatsapp: value.send_via_whatsapp !== false,
    source_text: String(value.source_text || "").trim(),
  };
}

export function mergeResolvedDraft(baseResolved = {}, patch = {}) {
  const current = {
    ...createEmptyResolved(),
    ...(baseResolved && typeof baseResolved === "object" ? baseResolved : {}),
  };
  const next = { ...current };

  const nextCustomerRaw = String(patch.customer_name_raw || "").trim();
  if (nextCustomerRaw) {
    next.customer_name_raw = nextCustomerRaw;
    if (nextCustomerRaw !== String(current.customer_name_raw || "").trim()) {
      next.customerId = null;
      next.customerName = "";
      next.customerLookupQuery = "";
      next.customerLookupMiss = false;
    }
  }

  const nextProductRaw = String(patch.product_name_raw || "").trim();
  if (nextProductRaw) {
    next.product_name_raw = nextProductRaw;
    if (nextProductRaw !== String(current.product_name_raw || "").trim()) {
      next.productId = null;
      next.productName = "";
      next.productLookupQuery = "";
      next.productLookupMiss = false;
    }
  }

  const nextDestinationPhone = normalizeDestinationPhoneN11(
    patch.destination_phone_n11 || "",
  );
  if (nextDestinationPhone) next.destination_phone_n11 = nextDestinationPhone;

  const nextQuantity = toPositiveInteger(patch.quantity);
  if (nextQuantity != null) next.quantity = nextQuantity;

  const nextUnitPriceCents = toPositiveInteger(patch.unit_price_cents);
  if (nextUnitPriceCents != null) next.unit_price_cents = nextUnitPriceCents;

  if (typeof patch.send_via_whatsapp === "boolean") {
    next.send_via_whatsapp = patch.send_via_whatsapp;
  }

  if (isNonEmpty(patch.source_text)) {
    next.source_text = String(patch.source_text || "").trim();
  }

  if (patch.customerId !== undefined) next.customerId = patch.customerId || null;
  if (patch.customerName !== undefined) {
    next.customerName = String(patch.customerName || "").trim();
  }
  if (patch.customerLookupQuery !== undefined) {
    next.customerLookupQuery = String(patch.customerLookupQuery || "").trim();
  }
  if (patch.customerLookupMiss !== undefined) {
    next.customerLookupMiss = patch.customerLookupMiss === true;
  }

  if (patch.productId !== undefined) next.productId = patch.productId || null;
  if (patch.productName !== undefined) {
    next.productName = String(patch.productName || "").trim();
  }
  if (patch.productLookupQuery !== undefined) {
    next.productLookupQuery = String(patch.productLookupQuery || "").trim();
  }
  if (patch.productLookupMiss !== undefined) {
    next.productLookupMiss = patch.productLookupMiss === true;
  }

  return next;
}

export function listMissingMandatoryFields(resolved = {}) {
  const current = {
    ...createEmptyResolved(),
    ...(resolved && typeof resolved === "object" ? resolved : {}),
  };

  const missing = [];
  if (!isNonEmpty(current.customer_name_raw)) missing.push("customer_name_raw");
  if (!isNonEmpty(current.destination_phone_n11)) {
    missing.push("destination_phone_n11");
  }
  if (!isNonEmpty(current.product_name_raw)) missing.push("product_name_raw");
  if (toPositiveInteger(current.quantity) == null) missing.push("quantity");
  if (toPositiveInteger(current.unit_price_cents) == null) {
    missing.push("unit_price_cents");
  }

  return missing;
}

export function parsePositiveIntegerFromText(text) {
  const match = String(text || "").match(/\d+/);
  if (!match) return null;
  return toPositiveInteger(match[0]);
}

export function parseMoneyToCents(text) {
  const raw = String(text || "")
    .trim()
    .replace(/[Rr]\$/g, "")
    .replace(/\breais?\b/gi, "")
    .replace(/\brea\b/gi, "")
    .replace(/\s+/g, " ");

  if (!raw) return null;

  const candidates =
    raw.match(/\d[\d.\s,]*/g)?.map((value) => value.trim()).filter(Boolean) || [];

  if (!candidates.length) return null;

  const compact = candidates[0].replace(/\s+/g, "");
  if (!compact) return null;

  let normalized = compact;
  if (compact.includes(",") && compact.includes(".")) {
    normalized = compact.replace(/\./g, "").replace(",", ".");
  } else if (compact.includes(",")) {
    normalized = compact.replace(/\./g, "").replace(",", ".");
  } else if (compact.includes(".")) {
    const parts = compact.split(".");
    if (parts.length > 2 || (parts[1] || "").length > 2) {
      normalized = compact.replace(/\./g, "");
    }
  }

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

export function parseDirectReplyValue(field, text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return {};

  if (field === "customer_name_raw") {
    return { customer_name_raw: trimmed, source_text: trimmed };
  }

  if (field === "product_name_raw") {
    return { product_name_raw: trimmed, source_text: trimmed };
  }

  if (field === "quantity") {
    const quantity = parsePositiveIntegerFromText(trimmed);
    return quantity ? { quantity, source_text: trimmed } : {};
  }

  if (field === "unit_price_cents") {
    const unit_price_cents = parseMoneyToCents(trimmed);
    return unit_price_cents ? { unit_price_cents, source_text: trimmed } : {};
  }

  if (field === "destination_phone_n11") {
    const destination_phone_n11 = normalizeDestinationPhoneN11(trimmed);
    return destination_phone_n11 ? { destination_phone_n11, source_text: trimmed } : {};
  }

  return {};
}
