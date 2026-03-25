import { normalizeDestinationPhoneN11 } from "../../utils/phone.js";

export const WHATSAPP_AI_INTENTS = [
  "create_offer_send_whatsapp",
  "unknown",
];

export const WHATSAPP_AI_ROUTING_INTENTS = [
  "create_offer_send_whatsapp",
  "generate_sales_insight",
  "query_daily_agenda",
  "query_weekly_agenda",
  "query_next_booking",
  "reschedule_booking",
  "cancel_booking",
  "query_pending_offers",
  "send_offer_payment_reminder",
  "cancel_offer",
  "create_client",
  "create_product",
  "update_product_price",
  "lookup_client_phone",
  "lookup_product",
  "ambiguous_booking_operation",
  "ambiguous_offer_or_agenda",
  "ambiguous_offer_sales_operation",
  "ambiguous_backoffice_operation",
  "unknown",
];

export const WHATSAPP_AI_AGENDA_DAY_KINDS = [
  "today",
  "tomorrow",
  "explicit_date",
  "unspecified",
];

export const WHATSAPP_AI_BOOKING_TARGET_REFERENCES = [
  "next",
  "explicit",
  "unspecified",
];

export const WHATSAPP_AI_OFFER_TARGET_DAY_KINDS = [
  "today",
  "yesterday",
  "last_week",
  "explicit_date",
  "unspecified",
];

export const WHATSAPP_AI_BACKOFFICE_INTENTS = [
  "create_client",
  "create_product",
  "update_product_price",
  "lookup_client_phone",
  "lookup_product",
  "unknown",
];

export const WHATSAPP_AI_PRODUCT_LOOKUP_MODES = [
  "by_name",
  "by_code",
  "unspecified",
];

export const WHATSAPP_AI_REQUIRED_FIELDS = [
  "customer_name_raw",
  "destination_phone_n11",
  "items.0.product_name_raw",
  "items.0.quantity",
  "items.0.unit_price_cents",
];

const ITEM_FIELD_ORDER = [
  "product_name_raw",
  "product_code",
  "quantity",
  "unit_price_cents",
];

const EXTRACTION_KEYS = [
  "intent",
  "customer_name_raw",
  "destination_phone_n11",
  "product_name_raw",
  "product_code",
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

function normalizeRoutingIntent(value) {
  const intent = String(value || "").trim();
  return WHATSAPP_AI_ROUTING_INTENTS.includes(intent) ? intent : "unknown";
}

function normalizeAgendaDayKind(value) {
  const kind = String(value || "").trim();
  return WHATSAPP_AI_AGENDA_DAY_KINDS.includes(kind) ? kind : "unspecified";
}

function normalizeBookingTargetReference(value) {
  const reference = String(value || "").trim();
  return WHATSAPP_AI_BOOKING_TARGET_REFERENCES.includes(reference)
    ? reference
    : "unspecified";
}

function normalizeOfferTargetDayKind(value) {
  const kind = String(value || "").trim();
  return WHATSAPP_AI_OFFER_TARGET_DAY_KINDS.includes(kind)
    ? kind
    : "unspecified";
}

function normalizeProductLookupMode(value) {
  const mode = String(value || "").trim();
  return WHATSAPP_AI_PRODUCT_LOOKUP_MODES.includes(mode)
    ? mode
    : "unspecified";
}

function normalizeProductCode(value) {
  return String(value || "").trim();
}

function normalizeDateIso(value) {
  const dateIso = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(dateIso) ? dateIso : "";
}

function normalizeTimeHhmm(value) {
  const raw = String(value || "")
    .trim()
    .replace(/[hH]/g, ":")
    .replace(/[^\d:]/g, "");
  if (!raw) return "";

  if (/^\d{1,2}:\d{2}$/.test(raw)) {
    const [hours, minutes] = raw.split(":").map(Number);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }
  }

  if (/^\d{1,2}$/.test(raw)) {
    const hours = Number(raw);
    if (hours >= 0 && hours <= 23) return `${String(hours).padStart(2, "0")}:00`;
  }

  return "";
}

function isPositiveInteger(value) {
  return toPositiveInteger(value) != null;
}

export function createEmptyResolvedItem() {
  return {
    product_name_raw: "",
    productCode: "",
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
    item?.productCode,
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
    productCode: normalizeProductCode(
      item.productCode || item.product_code || "",
    ),
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
    product_code: source.product_code,
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
    product_code: firstItem.productCode,
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
      if (itemPatch.productCode === undefined && itemPatch.product_code === undefined) {
        next.productCode = "";
      }
      next.productId = null;
      next.productName = "";
      next.productLookupQuery = "";
      next.productLookupMiss = false;
    }
  }

  if (itemPatch.productCode !== undefined || itemPatch.product_code !== undefined) {
    const nextProductCode = normalizeProductCode(
      itemPatch.productCode ?? itemPatch.product_code,
    );
    if (nextProductCode !== String(current.productCode || "").trim()) {
      next.productId = null;
      next.productName = "";
      next.productLookupQuery = "";
      next.productLookupMiss = false;
    }
    next.productCode = nextProductCode;
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
          product_code: { type: "string" },
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
                product_code: { type: "string" },
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

export function buildIntentRoutingResponseFormat() {
  return {
    type: "json_schema",
    json_schema: {
      name: "whatsapp_intent_router",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          intent: {
            type: "string",
            enum: WHATSAPP_AI_ROUTING_INTENTS,
          },
          source_text: { type: "string" },
        },
        required: ["intent", "source_text"],
      },
    },
  };
}

export function buildAgendaDateResponseFormat() {
  return {
    type: "json_schema",
    json_schema: {
      name: "whatsapp_agenda_day_query",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          requested_day_kind: {
            type: "string",
            enum: WHATSAPP_AI_AGENDA_DAY_KINDS,
          },
          requested_date_iso: { type: "string" },
          source_text: { type: "string" },
        },
        required: ["requested_day_kind", "requested_date_iso", "source_text"],
      },
    },
  };
}

export function buildBookingOperationResponseFormat() {
  return {
    type: "json_schema",
    json_schema: {
      name: "whatsapp_booking_operation",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          intent: {
            type: "string",
            enum: [
              "reschedule_booking",
              "cancel_booking",
              "query_next_booking",
              "unknown",
            ],
          },
          target_customer_name: { type: "string" },
          target_date_iso: { type: "string" },
          target_time_hhmm: { type: "string" },
          target_reference: {
            type: "string",
            enum: WHATSAPP_AI_BOOKING_TARGET_REFERENCES,
          },
          new_date_iso: { type: "string" },
          new_time_hhmm: { type: "string" },
          source_text: { type: "string" },
        },
        required: [
          "intent",
          "target_customer_name",
          "target_date_iso",
          "target_time_hhmm",
          "target_reference",
          "new_date_iso",
          "new_time_hhmm",
          "source_text",
        ],
      },
    },
  };
}

export function buildOfferSalesOperationResponseFormat() {
  return {
    type: "json_schema",
    json_schema: {
      name: "whatsapp_offer_sales_operation",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          intent: {
            type: "string",
            enum: [
              "query_pending_offers",
              "send_offer_payment_reminder",
              "cancel_offer",
              "unknown",
            ],
          },
          target_customer_name: { type: "string" },
          target_created_day_kind: {
            type: "string",
            enum: WHATSAPP_AI_OFFER_TARGET_DAY_KINDS,
          },
          target_created_date_iso: { type: "string" },
          source_text: { type: "string" },
        },
        required: [
          "intent",
          "target_customer_name",
          "target_created_day_kind",
          "target_created_date_iso",
          "source_text",
        ],
      },
    },
  };
}

export function buildBackofficeOperationResponseFormat() {
  return {
    type: "json_schema",
    json_schema: {
      name: "whatsapp_backoffice_operation",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          intent: {
            type: "string",
            enum: WHATSAPP_AI_BACKOFFICE_INTENTS,
          },
          client_full_name: { type: "string" },
          client_phone: { type: "string" },
          client_email: { type: "string" },
          client_cpf_cnpj: { type: "string" },
          product_name: { type: "string" },
          product_code: { type: "string" },
          product_lookup_mode: {
            type: "string",
            enum: WHATSAPP_AI_PRODUCT_LOOKUP_MODES,
          },
          product_price_cents: {
            anyOf: [{ type: "integer", minimum: 1 }, { type: "null" }],
          },
          product_description: { type: "string" },
          source_text: { type: "string" },
        },
        required: [
          "intent",
          "client_full_name",
          "client_phone",
          "client_email",
          "client_cpf_cnpj",
          "product_name",
          "product_code",
          "product_lookup_mode",
          "product_price_cents",
          "product_description",
          "source_text",
        ],
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
    product_code: "",
    quantity: null,
    unit_price_cents: null,
    items: [],
    send_via_whatsapp: true,
    source_text: "",
  };
}

export function createEmptyIntentRoutingExtraction() {
  return {
    intent: "unknown",
    source_text: "",
  };
}

export function createEmptyAgendaDateExtraction() {
  return {
    requested_day_kind: "unspecified",
    requested_date_iso: "",
    source_text: "",
  };
}

export function createEmptyBookingOperationExtraction() {
  return {
    intent: "unknown",
    target_customer_name: "",
    target_date_iso: "",
    target_time_hhmm: "",
    target_reference: "unspecified",
    new_date_iso: "",
    new_time_hhmm: "",
    source_text: "",
  };
}

export function createEmptyOfferSalesOperationExtraction() {
  return {
    intent: "unknown",
    target_customer_name: "",
    target_created_day_kind: "unspecified",
    target_created_date_iso: "",
    source_text: "",
  };
}

export function createEmptyBackofficeOperationExtraction() {
  return {
    intent: "unknown",
    client_full_name: "",
    client_phone: "",
    client_email: "",
    client_cpf_cnpj: "",
    product_name: "",
    product_code: "",
    product_lookup_mode: "unspecified",
    product_price_cents: null,
    product_description: "",
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

  const rawItems = Array.isArray(value.items)
    ? value.items.map((item, index) =>
        index === 0
          ? {
              ...(item && typeof item === "object" ? item : {}),
              product_code:
                item?.product_code ?? item?.productCode ?? value.product_code ?? "",
            }
          : item,
      )
    : [];

  const items = normalizeResolvedItems({
    items: rawItems,
    product_name_raw: value.product_name_raw,
    product_code: value.product_code,
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
    product_code: firstItem.productCode,
    quantity: firstItem.quantity,
    unit_price_cents: firstItem.unit_price_cents,
    items: items.map((item) => ({
      product_name_raw: item.product_name_raw,
      product_code: item.productCode,
      quantity: item.quantity,
      unit_price_cents: item.unit_price_cents,
    })),
    send_via_whatsapp: value.send_via_whatsapp !== false,
    source_text: String(value.source_text || "").trim(),
  };
}

export function parseIntentRoutingExtraction(payload) {
  let value = payload;

  if (typeof value === "string") {
    value = JSON.parse(value);
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    const err = new Error("A IA retornou um payload de roteamento invalido.");
    err.code = "WHATSAPP_AI_INVALID_ROUTING_PAYLOAD";
    throw err;
  }

  const allowedKeys = ["intent", "source_text"];
  const extras = Object.keys(value).filter((key) => !allowedKeys.includes(key));
  if (extras.length) {
    const err = new Error(
      `Campos nao suportados no roteamento: ${extras.join(", ")}`,
    );
    err.code = "WHATSAPP_AI_INVALID_ROUTING_KEYS";
    throw err;
  }

  return {
    intent: normalizeRoutingIntent(value.intent),
    source_text: String(value.source_text || "").trim(),
  };
}

export function parseAgendaDateExtraction(payload) {
  let value = payload;

  if (typeof value === "string") {
    value = JSON.parse(value);
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    const err = new Error("A IA retornou um payload de agenda invalido.");
    err.code = "WHATSAPP_AI_INVALID_AGENDA_PAYLOAD";
    throw err;
  }

  const allowedKeys = ["requested_day_kind", "requested_date_iso", "source_text"];
  const extras = Object.keys(value).filter((key) => !allowedKeys.includes(key));
  if (extras.length) {
    const err = new Error(
      `Campos nao suportados na consulta de agenda: ${extras.join(", ")}`,
    );
    err.code = "WHATSAPP_AI_INVALID_AGENDA_KEYS";
    throw err;
  }

  return {
    requested_day_kind: normalizeAgendaDayKind(value.requested_day_kind),
    requested_date_iso: normalizeDateIso(value.requested_date_iso),
    source_text: String(value.source_text || "").trim(),
  };
}

export function parseBookingOperationExtraction(payload) {
  let value = payload;

  if (typeof value === "string") {
    value = JSON.parse(value);
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    const err = new Error("A IA retornou um payload de operacao de agenda invalido.");
    err.code = "WHATSAPP_AI_INVALID_BOOKING_OPERATION_PAYLOAD";
    throw err;
  }

  const allowedKeys = [
    "intent",
    "target_customer_name",
    "target_date_iso",
    "target_time_hhmm",
    "target_reference",
    "new_date_iso",
    "new_time_hhmm",
    "source_text",
  ];
  const extras = Object.keys(value).filter((key) => !allowedKeys.includes(key));
  if (extras.length) {
    const err = new Error(
      `Campos nao suportados na operacao de agenda: ${extras.join(", ")}`,
    );
    err.code = "WHATSAPP_AI_INVALID_BOOKING_OPERATION_KEYS";
    throw err;
  }

  const normalizedIntent = normalizeRoutingIntent(value.intent);
  const allowedIntents = [
    "reschedule_booking",
    "cancel_booking",
    "query_next_booking",
  ];

  return {
    intent: allowedIntents.includes(normalizedIntent) ? normalizedIntent : "unknown",
    target_customer_name: String(value.target_customer_name || "").trim(),
    target_date_iso: normalizeDateIso(value.target_date_iso),
    target_time_hhmm: normalizeTimeHhmm(value.target_time_hhmm),
    target_reference: normalizeBookingTargetReference(value.target_reference),
    new_date_iso: normalizeDateIso(value.new_date_iso),
    new_time_hhmm: normalizeTimeHhmm(value.new_time_hhmm),
    source_text: String(value.source_text || "").trim(),
  };
}

export function parseOfferSalesOperationExtraction(payload) {
  let value = payload;

  if (typeof value === "string") {
    value = JSON.parse(value);
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    const err = new Error("A IA retornou um payload de operacao de oferta invalido.");
    err.code = "WHATSAPP_AI_INVALID_OFFER_OPERATION_PAYLOAD";
    throw err;
  }

  const allowedKeys = [
    "intent",
    "target_customer_name",
    "target_created_day_kind",
    "target_created_date_iso",
    "source_text",
  ];
  const extras = Object.keys(value).filter((key) => !allowedKeys.includes(key));
  if (extras.length) {
    const err = new Error(
      `Campos nao suportados na operacao de oferta: ${extras.join(", ")}`,
    );
    err.code = "WHATSAPP_AI_INVALID_OFFER_OPERATION_KEYS";
    throw err;
  }

  const normalizedIntent = normalizeRoutingIntent(value.intent);
  const allowedIntents = [
    "query_pending_offers",
    "send_offer_payment_reminder",
    "cancel_offer",
  ];

  return {
    intent: allowedIntents.includes(normalizedIntent) ? normalizedIntent : "unknown",
    target_customer_name: String(value.target_customer_name || "").trim(),
    target_created_day_kind: normalizeOfferTargetDayKind(
      value.target_created_day_kind,
    ),
    target_created_date_iso: normalizeDateIso(value.target_created_date_iso),
    source_text: String(value.source_text || "").trim(),
  };
}

function normalizeBackofficeIntent(value) {
  const intent = String(value || "").trim();
  return WHATSAPP_AI_BACKOFFICE_INTENTS.includes(intent) ? intent : "unknown";
}

export function parseBackofficeOperationExtraction(payload) {
  let value = payload;

  if (typeof value === "string") {
    value = JSON.parse(value);
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    const err = new Error("A IA retornou um payload de backoffice invalido.");
    err.code = "WHATSAPP_AI_INVALID_BACKOFFICE_PAYLOAD";
    throw err;
  }

  const allowedKeys = [
    "intent",
    "client_full_name",
    "client_phone",
    "client_email",
    "client_cpf_cnpj",
    "product_name",
    "product_code",
    "product_lookup_mode",
    "product_price_cents",
    "product_description",
    "source_text",
  ];
  const extras = Object.keys(value).filter((key) => !allowedKeys.includes(key));
  if (extras.length) {
    const err = new Error(
      `Campos nao suportados na operacao de backoffice: ${extras.join(", ")}`,
    );
    err.code = "WHATSAPP_AI_INVALID_BACKOFFICE_KEYS";
    throw err;
  }

  return {
    intent: normalizeBackofficeIntent(value.intent),
    client_full_name: String(value.client_full_name || "").trim(),
    client_phone: String(value.client_phone || "").trim(),
    client_email: String(value.client_email || "")
      .trim()
      .toLowerCase(),
    client_cpf_cnpj: String(value.client_cpf_cnpj || "").trim(),
    product_name: String(value.product_name || "").trim(),
    product_code: normalizeProductCode(value.product_code),
    product_lookup_mode: normalizeProductLookupMode(value.product_lookup_mode),
    product_price_cents: toPositiveInteger(value.product_price_cents),
    product_description: String(value.product_description || "").trim(),
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
    patch.product_code !== undefined ||
    patch.productCode !== undefined ||
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
        productCode: patch.productCode ?? patch.product_code,
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

export function parseEmailFromText(text) {
  const match = String(text || "")
    .trim()
    .match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? String(match[0] || "").trim().toLowerCase() : "";
}

export function parseCpfCnpjDigits(text) {
  const digits = String(text || "").replace(/\D+/g, "");
  if (digits.length === 11 || digits.length === 14) return digits;
  return "";
}

export function parseProductCodeFromText(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return "";

  const keywordMatch = trimmed.match(
    /\b(?:codigo(?: do produto)?|id(?: do produto)?|cod)\b[\s:#-]*([A-Za-z0-9._-]+)/i,
  );
  if (keywordMatch?.[1]) {
    return normalizeProductCode(keywordMatch[1]);
  }

  if (/^\d[\d._-]*$/.test(trimmed)) {
    return normalizeProductCode(trimmed);
  }

  return "";
}

export function parseDirectReplyValue(field, text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return {};

  const itemField = parseItemFieldKey(field);
  if (itemField) {
    if (itemField.field === "product_selection") return {};

    if (itemField.field === "product_name_raw") {
      const productCode = parseProductCodeFromText(trimmed);
      return {
        ...buildSparseItemPatch(itemField.itemIndex, {
          product_name_raw: trimmed,
          ...(productCode ? { productCode } : {}),
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
      const productCode = parseProductCodeFromText(trimmed);
      const explicitCodeReference = /\b(?:codigo(?: do produto)?|id(?: do produto)?|cod)\b/i.test(
        trimmed,
      );
      if (!unit_price_cents && !productCode) return {};

      return {
        ...buildSparseItemPatch(itemField.itemIndex, {
          ...(explicitCodeReference && productCode
            ? { productCode }
            : unit_price_cents
              ? { unit_price_cents }
              : {}),
        }),
        source_text: trimmed,
      };
    }
  }

  if (field === "customer_name_raw") {
    return { customer_name_raw: trimmed, source_text: trimmed };
  }

  if (field === "product_name_raw") {
    const product_code = parseProductCodeFromText(trimmed);
    return {
      product_name_raw: trimmed,
      ...(product_code ? { product_code } : {}),
      source_text: trimmed,
    };
  }

  if (field === "quantity") {
    const quantity = parsePositiveIntegerFromText(trimmed);
    return quantity ? { quantity, source_text: trimmed } : {};
  }

  if (field === "unit_price_cents") {
    const unit_price_cents = parseMoneyToCents(trimmed);
    const product_code = parseProductCodeFromText(trimmed);
    const explicitCodeReference = /\b(?:codigo(?: do produto)?|id(?: do produto)?|cod)\b/i.test(
      trimmed,
    );
    if (!unit_price_cents && !product_code) return {};

    return {
      ...(explicitCodeReference && product_code
        ? { product_code }
        : unit_price_cents
          ? { unit_price_cents }
          : {}),
      source_text: trimmed,
    };
  }

  if (field === "destination_phone_n11") {
    const destination_phone_n11 = normalizeDestinationPhoneN11(trimmed);
    return destination_phone_n11 ? { destination_phone_n11, source_text: trimmed } : {};
  }

  if (field === "client_full_name") {
    return { client_full_name: trimmed, source_text: trimmed };
  }

  if (field === "client_phone") {
    return { client_phone: trimmed, source_text: trimmed };
  }

  if (field === "client_email") {
    const client_email = parseEmailFromText(trimmed);
    return client_email ? { client_email, source_text: trimmed } : {};
  }

  if (field === "client_cpf_cnpj") {
    const client_cpf_cnpj = parseCpfCnpjDigits(trimmed);
    return client_cpf_cnpj ? { client_cpf_cnpj, source_text: trimmed } : {};
  }

  if (field === "product_name") {
    return { product_name: trimmed, source_text: trimmed };
  }

  if (field === "product_code") {
    const product_code = parseProductCodeFromText(trimmed);
    return product_code
      ? {
          product_code,
          product_lookup_mode: "by_code",
          source_text: trimmed,
        }
      : {};
  }

  if (field === "product_price_cents") {
    const product_price_cents = parseMoneyToCents(trimmed);
    const product_code = parseProductCodeFromText(trimmed);
    if (!product_price_cents && !product_code) return {};

    return {
      ...(product_price_cents ? { product_price_cents } : {}),
      ...(product_code ? { product_code } : {}),
      source_text: trimmed,
    };
  }

  if (field === "product_description") {
    return { product_description: trimmed, source_text: trimmed };
  }

  return {};
}
