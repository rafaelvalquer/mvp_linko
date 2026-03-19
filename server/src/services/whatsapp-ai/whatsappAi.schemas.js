import { normalizeDestinationPhoneN11 } from "../../utils/phone.js";

export const WHATSAPP_AI_INTENTS = [
  "create_offer_send_whatsapp",
  "unknown",
];

export const WHATSAPP_AI_REQUIRED_FIELDS = [
  "customer_name_raw",
  "destination_phone_n11",
  "items.0.product_name_raw",
  "items.0.quantity",
  "items.0.unit_price_cents",
];

const ITEM_FIELD_ORDER = ["product_name_raw", "quantity", "unit_price_cents"];

const EXTRACTION_KEYS = [
  "intent",
  "customer_name_raw",
  "destination_phone_n11",
  "product_name_raw",
  "quantity",
  "unit_price_cents",
  "items",
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

function isPositiveInteger(value) {
  return toPositiveInteger(value) != null;
}

export function createEmptyResolvedItem() {
  return {
    product_name_raw: "",
    quantity: null,
    unit_price_cents: null,
    productId: null,
    productName: "",
    productLookupQuery: "",
    productLookupMiss: false,
  };
}

function hasItemData(item = {}) {
  return [
    item?.product_name_raw,
    item?.quantity,
    item?.unit_price_cents,
    item?.productId,
    item?.productName,
  ].some((value) => {
    if (typeof value === "string") return value.trim().length > 0;
    return value != null;
  });
}

function normalizeItemPatch(item = {}) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;

  const current = createEmptyResolvedItem();
  const next = {
    ...current,
    product_name_raw: String(item.product_name_raw || "").trim(),
    quantity: toPositiveInteger(item.quantity),
    unit_price_cents: toPositiveInteger(item.unit_price_cents),
    productId: item.productId || null,
    productName: String(item.productName || "").trim(),
    productLookupQuery: String(item.productLookupQuery || "").trim(),
    productLookupMiss: item.productLookupMiss === true,
  };

  return hasItemData(next) ? next : null;
}

function buildLegacyItem(source = {}) {
  const item = normalizeItemPatch({
    product_name_raw: source.product_name_raw,
    quantity: source.quantity,
    unit_price_cents: source.unit_price_cents,
    productId: source.productId,
    productName: source.productName,
    productLookupQuery: source.productLookupQuery,
    productLookupMiss: source.productLookupMiss,
  });

  return item ? [item] : [];
}

export function normalizeResolvedItems(source = {}) {
  const rawItems = Array.isArray(source?.items) ? source.items : [];
  const normalizedItems = rawItems
    .map((item) => normalizeItemPatch(item))
    .filter(Boolean);

  if (normalizedItems.length) return normalizedItems;
  return buildLegacyItem(source);
}

function syncPrimaryItemAliases(target = {}) {
  const items = normalizeResolvedItems(target);
  const firstItem = items[0] || createEmptyResolvedItem();

  return {
    ...target,
    items,
    product_name_raw: firstItem.product_name_raw,
    quantity: firstItem.quantity,
    unit_price_cents: firstItem.unit_price_cents,
    productId: firstItem.productId,
    productName: firstItem.productName,
    productLookupQuery: firstItem.productLookupQuery,
    productLookupMiss: firstItem.productLookupMiss,
  };
}

function mergeItemDraft(currentItem = {}, itemPatch = {}) {
  if (!itemPatch || typeof itemPatch !== "object" || Array.isArray(itemPatch)) {
    return normalizeItemPatch(currentItem) || createEmptyResolvedItem();
  }

  const current = normalizeItemPatch(currentItem) || createEmptyResolvedItem();
  const next = { ...current };

  const nextProductRaw = String(itemPatch.product_name_raw || "").trim();
  if (nextProductRaw) {
    next.product_name_raw = nextProductRaw;
    if (nextProductRaw !== String(current.product_name_raw || "").trim()) {
      next.productId = null;
      next.productName = "";
      next.productLookupQuery = "";
      next.productLookupMiss = false;
    }
  }

  const nextQuantity = toPositiveInteger(itemPatch.quantity);
  if (nextQuantity != null) next.quantity = nextQuantity;

  const nextUnitPriceCents = toPositiveInteger(itemPatch.unit_price_cents);
  if (nextUnitPriceCents != null) next.unit_price_cents = nextUnitPriceCents;

  if (itemPatch.productId !== undefined) next.productId = itemPatch.productId || null;
  if (itemPatch.productName !== undefined) {
    next.productName = String(itemPatch.productName || "").trim();
  }
  if (itemPatch.productLookupQuery !== undefined) {
    next.productLookupQuery = String(itemPatch.productLookupQuery || "").trim();
  }
  if (itemPatch.productLookupMiss !== undefined) {
    next.productLookupMiss = itemPatch.productLookupMiss === true;
  }

  return normalizeItemPatch(next) || createEmptyResolvedItem();
}

function applyItemArrayPatch(currentItems = [], patchItems = []) {
  const nextItems = normalizeResolvedItems({ items: currentItems }).map((item) => ({
    ...item,
  }));

  patchItems.forEach((itemPatch, index) => {
    if (!itemPatch) return;
    nextItems[index] = mergeItemDraft(nextItems[index], itemPatch);
  });

  return nextItems.filter(hasItemData);
}

export function buildSparseItemPatch(index, patch = {}) {
  const items = [];
  items[index] = patch;
  return { items };
}

export function parseItemFieldKey(field) {
  const match = String(field || "")
    .trim()
    .match(/^items\.(\d+)\.(product_name_raw|quantity|unit_price_cents|product_selection)$/);

  if (!match) return null;

  return {
    itemIndex: Number(match[1]),
    field: match[2],
  };
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
          items: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                product_name_raw: { type: "string" },
                quantity: {
                  anyOf: [{ type: "integer", minimum: 1 }, { type: "null" }],
                },
                unit_price_cents: {
                  anyOf: [{ type: "integer", minimum: 1 }, { type: "null" }],
                },
              },
              required: ITEM_FIELD_ORDER,
            },
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
    items: [],
    send_via_whatsapp: true,
    source_text: "",
  };
}

export function createEmptyResolved() {
  return syncPrimaryItemAliases({
    ...createEmptyExtraction(),
    customerId: null,
    customerName: "",
    customerLookupQuery: "",
    customerLookupMiss: false,
    productId: null,
    productName: "",
    productLookupQuery: "",
    productLookupMiss: false,
  });
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

  const items = normalizeResolvedItems({
    items: Array.isArray(value.items) ? value.items : [],
    product_name_raw: value.product_name_raw,
    quantity: value.quantity,
    unit_price_cents: value.unit_price_cents,
  });
  const firstItem = items[0] || createEmptyResolvedItem();

  return {
    intent: normalizeIntent(value.intent),
    customer_name_raw: String(value.customer_name_raw || "").trim(),
    destination_phone_n11: normalizeDestinationPhoneN11(
      value.destination_phone_n11 || "",
    ),
    product_name_raw: firstItem.product_name_raw,
    quantity: firstItem.quantity,
    unit_price_cents: firstItem.unit_price_cents,
    items: items.map((item) => ({
      product_name_raw: item.product_name_raw,
      quantity: item.quantity,
      unit_price_cents: item.unit_price_cents,
    })),
    send_via_whatsapp: value.send_via_whatsapp !== false,
    source_text: String(value.source_text || "").trim(),
  };
}

export function mergeResolvedDraft(baseResolved = {}, patch = {}) {
  const current = syncPrimaryItemAliases({
    ...createEmptyResolved(),
    ...(baseResolved && typeof baseResolved === "object" ? baseResolved : {}),
  });
  const next = {
    ...current,
    items: normalizeResolvedItems(current).map((item) => ({ ...item })),
  };

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

  if (Array.isArray(patch.items) && patch.items.length) {
    next.items = applyItemArrayPatch(next.items, patch.items);
  }

  if (
    patch.product_name_raw !== undefined ||
    patch.quantity !== undefined ||
    patch.unit_price_cents !== undefined ||
    patch.productId !== undefined ||
    patch.productName !== undefined ||
    patch.productLookupQuery !== undefined ||
    patch.productLookupMiss !== undefined
  ) {
    next.items = applyItemArrayPatch(next.items, [
      {
        product_name_raw: patch.product_name_raw,
        quantity: patch.quantity,
        unit_price_cents: patch.unit_price_cents,
        productId: patch.productId,
        productName: patch.productName,
        productLookupQuery: patch.productLookupQuery,
        productLookupMiss: patch.productLookupMiss,
      },
    ]);
  }

  const nextDestinationPhone = normalizeDestinationPhoneN11(
    patch.destination_phone_n11 || "",
  );
  if (nextDestinationPhone) next.destination_phone_n11 = nextDestinationPhone;

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

  return syncPrimaryItemAliases(next);
}

export function listMissingMandatoryFields(resolved = {}) {
  const current = syncPrimaryItemAliases({
    ...createEmptyResolved(),
    ...(resolved && typeof resolved === "object" ? resolved : {}),
  });

  const missing = [];
  if (!isNonEmpty(current.customer_name_raw)) missing.push("customer_name_raw");
  const items = normalizeResolvedItems(current);
  const fallbackItems = items.length ? items : [createEmptyResolvedItem()];

  fallbackItems.forEach((item, index) => {
    const prefix = `items.${index}.`;
    if (!isNonEmpty(item.product_name_raw)) {
      missing.push(`${prefix}product_name_raw`);
    }
    if (!isPositiveInteger(item.quantity)) {
      missing.push(`${prefix}quantity`);
    }
    if (!isPositiveInteger(item.unit_price_cents)) {
      missing.push(`${prefix}unit_price_cents`);
    }
  });

  if (!isNonEmpty(current.destination_phone_n11)) {
    missing.push("destination_phone_n11");
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

  const itemField = parseItemFieldKey(field);
  if (itemField) {
    if (itemField.field === "product_selection") return {};

    if (itemField.field === "product_name_raw") {
      return {
        ...buildSparseItemPatch(itemField.itemIndex, {
          product_name_raw: trimmed,
        }),
        source_text: trimmed,
      };
    }

    if (itemField.field === "quantity") {
      const quantity = parsePositiveIntegerFromText(trimmed);
      return quantity
        ? {
            ...buildSparseItemPatch(itemField.itemIndex, { quantity }),
            source_text: trimmed,
          }
        : {};
    }

    if (itemField.field === "unit_price_cents") {
      const unit_price_cents = parseMoneyToCents(trimmed);
      return unit_price_cents
        ? {
            ...buildSparseItemPatch(itemField.itemIndex, { unit_price_cents }),
            source_text: trimmed,
          }
        : {};
    }
  }

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
