// server/src/services/recurring-offers.service.js
import crypto from "crypto";
import { Client } from "../models/Client.js";
import { Offer } from "../models/Offer.js";
import { Workspace } from "../models/Workspace.js";
import { RecurringOffer } from "../models/RecurringOffer.js";
import { isWhatsAppNotificationsEnabled } from "./waGateway.js";
import { queueOrSendWhatsApp } from "./whatsappOutbox.service.js";
import {
  assertRecurringPlanAllowed,
  canUseNotifyWhatsAppOnPaid,
  canUseRecurring,
} from "../utils/planFeatures.js";

const LINK_TTL_DAYS = Number(process.env.OFFER_LINK_TTL_DAYS || 90);
const RUNNER_LOCK_TTL_MS = Number(
  process.env.RECURRING_RUNNER_LOCK_TTL_MS || 10 * 60 * 1000,
);
const HISTORY_LIMIT = Number(process.env.RECURRING_HISTORY_LIMIT || 100);

const HAS_TENANT = !!Offer?.schema?.path?.("workspaceId");
const HAS_OWNER = !!Offer?.schema?.path?.("ownerUserId");

function isNonEmpty(value) {
  return String(value || "").trim().length > 0;
}

function onlyDigits(value) {
  return String(value || "").replace(/\D+/g, "");
}

function safeBool(value) {
  return value === true;
}

function clampInt(value, min, max) {
  const num = Number(value);
  if (!Number.isFinite(num)) return min;
  const intVal = Math.trunc(num);
  return Math.max(min, max != null ? Math.min(max, intVal) : intVal);
}

function normalizeStatus(value) {
  const v = String(value || "").trim().toUpperCase();
  if (!v) return "";
  return v === "CANCELED" ? "CANCELLED" : v;
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/g, "");
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

function combineDateAndTime(dateLike, timeOfDay = "09:00") {
  const base = dateLike instanceof Date ? new Date(dateLike) : new Date(dateLike);
  if (Number.isNaN(base.getTime())) return null;

  const [hh, mm] = String(timeOfDay || "09:00")
    .split(":")
    .map((v) => Number(v));

  base.setHours(Number.isFinite(hh) ? hh : 9, Number.isFinite(mm) ? mm : 0, 0, 0);
  return base;
}

function normalizeTimeOfDay(value) {
  const raw = String(value || "09:00").trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(raw) ? raw : "09:00";
}

function pushHistory(history = [], entry = {}) {
  const next = [entry, ...(Array.isArray(history) ? history : [])];
  return next.slice(0, Math.max(10, HISTORY_LIMIT));
}

async function generateUniquePublicToken() {
  for (let i = 0; i < 8; i += 1) {
    const token = crypto.randomBytes(16).toString("hex");
    // eslint-disable-next-line no-await-in-loop
    const exists = await Offer.exists({ publicToken: token });
    if (!exists) return token;
  }
  throw new Error("Failed to generate a unique public token");
}

function normalizeItems(raw) {
  const items = Array.isArray(raw) ? raw : [];
  return items
    .map((item) => {
      const description = String(item?.description || "").trim();
      const qty = clampInt(item?.qty, 1);
      const unitPriceCents = Number(item?.unitPriceCents);
      const lineTotalCents = Number(item?.lineTotalCents);
      return {
        description,
        qty,
        unitPriceCents: Number.isFinite(unitPriceCents) ? unitPriceCents : null,
        lineTotalCents: Number.isFinite(lineTotalCents) ? lineTotalCents : null,
      };
    })
    .filter((item) => isNonEmpty(item.description));
}

async function resolveCustomerSnapshot({ tenantId, body }) {
  const input = body || {};

  let customerId = input.customerId || null;
  let customerName = String(input.customerName || "").trim();
  let customerEmail = String(input.customerEmail || "").trim();
  let customerDoc = onlyDigits(input.customerDoc);
  let customerWhatsApp = String(input.customerWhatsApp || "").trim();

  if (customerId) {
    const client = await Client.findOne({
      _id: customerId,
      workspaceId: tenantId,
    }).lean();

    if (!client) {
      const err = new Error("Cliente não encontrado neste workspace");
      err.statusCode = 400;
      throw err;
    }

    customerId = client._id;
    customerName = String(client.name || customerName || "").trim();
    customerEmail = String(client.email || customerEmail || "").trim();
    customerDoc = onlyDigits(
      client.cpfCnpjDigits || client.cpfCnpj || customerDoc || "",
    );
    customerWhatsApp = String(client.phone || customerWhatsApp || "").trim();
  }

  return {
    customerId,
    customerName,
    customerEmail,
    customerDoc,
    customerWhatsApp,
  };
}

function buildOfferSnapshotFields({ body, workspacePlan, customer }) {
  const input = body || {};
  const offerTypeRaw = String(input.offerType || "service").trim().toLowerCase();
  const offerType = offerTypeRaw === "product" ? "product" : "service";

  const title = isNonEmpty(input.title)
    ? String(input.title).trim()
    : offerType === "product"
      ? "Orçamento"
      : "Proposta";

  return {
    sellerEmail: String(input.sellerEmail || "").trim().toLowerCase() || null,
    sellerName: String(input.sellerName || "").trim() || null,

    customerId: customer.customerId,
    customerName: customer.customerName,
    customerEmail: customer.customerEmail,
    customerDoc: customer.customerDoc,
    customerWhatsApp: customer.customerWhatsApp,

    notifyWhatsAppOnPaid: canUseNotifyWhatsAppOnPaid(workspacePlan)
      ? safeBool(input.notifyWhatsAppOnPaid)
      : false,

    offerType,
    title,
    description: isNonEmpty(input.description) ? String(input.description) : "",
    items: normalizeItems(input.items),

    amountCents: Number(input.amountCents ?? input.totalCents),
    subtotalCents: Number.isFinite(Number(input.subtotalCents))
      ? Number(input.subtotalCents)
      : null,
    discountCents: Number.isFinite(Number(input.discountCents))
      ? Number(input.discountCents)
      : null,
    freightCents: Number.isFinite(Number(input.freightCents))
      ? Number(input.freightCents)
      : null,
    totalCents: Number.isFinite(Number(input.totalCents))
      ? Number(input.totalCents)
      : null,

    depositEnabled: safeBool(input.depositEnabled),
    depositPct: Number.isFinite(Number(input.depositPct))
      ? Number(input.depositPct)
      : 0,

    durationEnabled: safeBool(input.durationEnabled),
    durationMin: Number.isFinite(Number(input.durationMin))
      ? Number(input.durationMin)
      : null,

    validityEnabled: safeBool(input.validityEnabled),
    validityDays: Number.isFinite(Number(input.validityDays))
      ? Number(input.validityDays)
      : null,

    deliveryEnabled: safeBool(input.deliveryEnabled),
    deliveryText: isNonEmpty(input.deliveryText)
      ? String(input.deliveryText)
      : null,

    warrantyEnabled: safeBool(input.warrantyEnabled),
    warrantyText: isNonEmpty(input.warrantyText)
      ? String(input.warrantyText)
      : null,

    notesEnabled: safeBool(input.notesEnabled),
    conditionsNotes: isNonEmpty(input.conditionsNotes)
      ? String(input.conditionsNotes)
      : null,

    discountEnabled: safeBool(input.discountEnabled),
    discountType: isNonEmpty(input.discountType)
      ? String(input.discountType)
      : null,
    discountValue: input.discountValue ?? null,

    freightEnabled: safeBool(input.freightEnabled),
    freightValue: input.freightValue ?? null,
  };
}

function validateOfferSnapshotFields(snapshot) {
  if (!isNonEmpty(snapshot.customerName)) {
    const err = new Error("customerName required");
    err.statusCode = 400;
    throw err;
  }

  if (snapshot.offerType === "service" && !isNonEmpty(snapshot.title)) {
    const err = new Error("title required");
    err.statusCode = 400;
    throw err;
  }

  const cents = Number(snapshot.totalCents ?? snapshot.amountCents);
  if (!Number.isFinite(cents) || cents <= 0) {
    const err = new Error("amountCents invalid");
    err.statusCode = 400;
    throw err;
  }
}

export async function createOfferFromPayload({
  tenantId,
  userId,
  workspacePlan,
  body,
  recurringMeta = null,
}) {
  const customer = await resolveCustomerSnapshot({ tenantId, body });
  const snapshot = buildOfferSnapshotFields({ body, workspacePlan, customer });
  validateOfferSnapshotFields(snapshot);

  const publicToken = await generateUniquePublicToken();
  const expiresAt = addDays(
    new Date(),
    Number.isFinite(LINK_TTL_DAYS) ? LINK_TTL_DAYS : 90,
  );

  const doc = {
    ...(HAS_TENANT ? { workspaceId: tenantId } : {}),
    ...(HAS_OWNER && userId ? { ownerUserId: userId } : {}),

    ...snapshot,

    publicToken,
    expiresAt,
    status: "PUBLIC",
    paymentMethod: "MANUAL_PIX",
    paymentStatus: "PENDING",
    recurringOfferId: recurringMeta?.recurringOfferId || null,
    recurringSequence: Number.isFinite(Number(recurringMeta?.sequence))
      ? Number(recurringMeta.sequence)
      : null,
    generatedBy: recurringMeta?.recurringOfferId ? "recurring" : "manual",
    recurringNameSnapshot: recurringMeta?.name || null,
    originMeta: recurringMeta?.originMeta || null,
  };

  return Offer.create(doc);
}

function normalizeEndMode(value) {
  const v = String(value || "never").trim().toLowerCase();
  if (["never", "until_date", "until_count"].includes(v)) return v;
  return "never";
}

function computeFirstNextRun({ startsAt, intervalDays, timeOfDay, now = new Date() }) {
  const normalizedStart = combineDateAndTime(startsAt, timeOfDay);
  if (!normalizedStart) return null;

  const interval = clampInt(intervalDays, 1);
  let next = new Date(normalizedStart);
  while (next.getTime() < now.getTime()) {
    next = combineDateAndTime(addDays(next, interval), timeOfDay);
  }
  return next;
}

function computeFollowingRun({ baseDate, intervalDays, timeOfDay }) {
  const base = baseDate instanceof Date ? baseDate : new Date(baseDate);
  if (Number.isNaN(base.getTime())) return null;
  return combineDateAndTime(
    addDays(base, clampInt(intervalDays, 1)),
    timeOfDay,
  );
}

function shouldEndRecurring(recurring, nextRunCount, nextRunAt) {
  const endMode = normalizeEndMode(recurring?.recurrence?.endMode);

  if (endMode === "until_count") {
    const maxOccurrences = Number(recurring?.recurrence?.maxOccurrences);
    if (Number.isFinite(maxOccurrences) && maxOccurrences > 0) {
      return nextRunCount >= maxOccurrences;
    }
  }

  if (endMode === "until_date") {
    const endsAt = recurring?.recurrence?.endsAt
      ? new Date(recurring.recurrence.endsAt)
      : null;
    if (endsAt && !Number.isNaN(endsAt.getTime()) && nextRunAt) {
      return nextRunAt.getTime() > endsAt.getTime();
    }
  }

  return false;
}

function buildRecurringStatusMeta(recurring) {
  return {
    recurringOfferId: recurring?._id ? String(recurring._id) : null,
    recurringName: recurring?.name || "",
  };
}

function firstName(name) {
  const s = String(name || "").trim();
  if (!s) return "";
  return s.split(/\s+/)[0] || "";
}

function normalizePhoneForWa(raw) {
  const digits = onlyDigits(raw);
  if (!digits) return "";
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  return digits;
}

function buildOfferAutoSendMessage({ recurring, offer, origin }) {
  const name = firstName(recurring?.customerName);
  const greeting = name ? `Olá ${name}!` : "Olá!";
  const base = trimTrailingSlash(origin) || "";
  const publicUrl = offer?.publicToken ? `${base}/p/${offer.publicToken}` : "";

  return {
    publicUrl,
    message: [
      greeting,
      "",
      "Sua nova cobrança recorrente já está disponível.",
      "Você pode visualizar e finalizar pelo link abaixo:",
      publicUrl,
      "",
      "Se já tiver realizado o pagamento, pode ignorar esta mensagem 😊",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

async function tryAutoSendRecurringOfferLegacy({ recurring, offer, origin }) {
  if (recurring?.automation?.autoSendToCustomer !== true) {
    return {
      status: "generated",
      message: "Cobrança gerada sem envio automático.",
    };
  }

  if (!isWhatsAppNotificationsEnabled()) {
    return {
      status: "skipped",
      message:
        "Cobrança gerada, mas o envio automático por WhatsApp está desabilitado.",
      error: { code: "FEATURE_DISABLED", message: "WhatsApp desabilitado." },
    };
  }

  const to = normalizePhoneForWa(recurring?.customerWhatsApp);
  if (!to) {
    return {
      status: "skipped",
      message: "Cobrança gerada, mas o cliente não possui WhatsApp válido.",
      error: { code: "NO_PHONE", message: "Cliente sem WhatsApp válido." },
    };
  }

  const payload = buildOfferAutoSendMessage({ recurring, offer, origin });

  const result = await queueOrSendWhatsApp({
    workspaceId: recurring?.workspaceId || null,
    to,
    message: payload.message,
    dedupeKey: `recurring-offer:${offer?._id}:auto-send`,
    sourceType: "recurring_offer",
    sourceId: recurring?._id || null,
    meta: {
      offerId: offer?._id || null,
      recurringSequence: offer?.recurringSequence || null,
      recurringName: recurring?.name || "",
      publicUrl: payload.publicUrl,
    },
  });

  if (result?.status === "sent") {
    return {
      status: "sent",
      message:
        "CobranÃ§a gerada e enviada automaticamente ao cliente por WhatsApp.",
      meta: {
        to,
        publicUrl: payload.publicUrl,
        outboxId: result?.outbox?._id || null,
      },
    };
  }

  if (result?.status === "queued") {
    return {
      status: "queued",
      message:
        "CobranÃ§a gerada e colocada na fila do WhatsApp para envio automÃ¡tico.",
      meta: {
        to,
        publicUrl: payload.publicUrl,
        outboxId: result?.outbox?._id || null,
      },
    };
  }

  return {
    status: "failed",
    message:
      "CobranÃ§a gerada, mas o envio automÃ¡tico por WhatsApp falhou.",
    error: {
      code: String(result?.error?.code || result?.error?.name || "SEND_FAILED"),
      message: String(
        result?.error?.message || "Falha ao enviar WhatsApp",
      ),
      details: result?.error?.details || null,
    },
    meta: {
      to,
      publicUrl: payload.publicUrl,
      outboxId: result?.outbox?._id || null,
    },
  };

  try {
    await sendWhatsApp({ to, message: payload.message });
    return {
      status: "sent",
      message:
        "Cobrança gerada e enviada automaticamente ao cliente por WhatsApp.",
      meta: { to, publicUrl: payload.publicUrl },
    };
  } catch (err) {
    return {
      status: "failed",
      message:
        "Cobrança gerada, mas o envio automático por WhatsApp falhou.",
      error: {
        code: String(err?.code || err?.name || "SEND_FAILED"),
        message: String(err?.message || "Falha ao enviar WhatsApp"),
        details: err?.details || null,
      },
      meta: { to, publicUrl: payload.publicUrl },
    };
  }
}

async function appendRecurringHistory(recurringId, entry, patch = {}) {
  const recurring = await RecurringOffer.findById(recurringId).lean();
  if (!recurring) return null;

  const history = pushHistory(recurring.history, entry);
  const nextPatch = { history, ...patch };
  await RecurringOffer.updateOne(
    { _id: recurringId },
    { $set: nextPatch },
    { strict: false },
  );
  return RecurringOffer.findById(recurringId).lean();
}

async function tryAutoSendRecurringOfferOutbox({ recurring, offer, origin }) {
  if (recurring?.automation?.autoSendToCustomer !== true) {
    return {
      status: "generated",
      message: "Cobranca gerada sem envio automatico.",
    };
  }

  if (!isWhatsAppNotificationsEnabled()) {
    return {
      status: "skipped",
      message:
        "Cobranca gerada, mas o envio automatico por WhatsApp esta desabilitado.",
      error: { code: "FEATURE_DISABLED", message: "WhatsApp desabilitado." },
    };
  }

  const to = normalizePhoneForWa(recurring?.customerWhatsApp);
  if (!to) {
    return {
      status: "skipped",
      message: "Cobranca gerada, mas o cliente nao possui WhatsApp valido.",
      error: { code: "NO_PHONE", message: "Cliente sem WhatsApp valido." },
    };
  }

  const payload = buildOfferAutoSendMessage({ recurring, offer, origin });
  const result = await queueOrSendWhatsApp({
    workspaceId: recurring?.workspaceId || null,
    to,
    message: payload.message,
    dedupeKey: `recurring-offer:${offer?._id}:auto-send`,
    sourceType: "recurring_offer",
    sourceId: recurring?._id || null,
    meta: {
      offerId: offer?._id || null,
      recurringSequence: offer?.recurringSequence || null,
      recurringName: recurring?.name || "",
      publicUrl: payload.publicUrl,
    },
  });

  if (result?.status === "sent") {
    return {
      status: "sent",
      message:
        "Cobranca gerada e enviada automaticamente ao cliente por WhatsApp.",
      meta: {
        to,
        publicUrl: payload.publicUrl,
        outboxId: result?.outbox?._id || null,
      },
    };
  }

  if (result?.status === "queued") {
    return {
      status: "queued",
      message:
        "Cobranca gerada e colocada na fila do WhatsApp para envio automatico.",
      meta: {
        to,
        publicUrl: payload.publicUrl,
        outboxId: result?.outbox?._id || null,
      },
    };
  }

  return {
    status: "failed",
    message: "Cobranca gerada, mas o envio automatico por WhatsApp falhou.",
    error: {
      code: String(result?.error?.code || result?.error?.name || "SEND_FAILED"),
      message: String(result?.error?.message || "Falha ao enviar WhatsApp"),
      details: result?.error?.details || null,
    },
    meta: {
      to,
      publicUrl: payload.publicUrl,
      outboxId: result?.outbox?._id || null,
    },
  };
}

function buildRecurringBasePayload(recurring) {
  return {
    sellerName: recurring.sellerName,
    sellerEmail: recurring.sellerEmail,
    customerId: recurring.customerId,
    customerName: recurring.customerName,
    customerEmail: recurring.customerEmail,
    customerDoc: recurring.customerDoc,
    customerWhatsApp: recurring.customerWhatsApp,
    notifyWhatsAppOnPaid: recurring.notifyWhatsAppOnPaid,
    offerType: recurring.offerType,
    title: recurring.title,
    description: recurring.description,
    items: recurring.items,
    amountCents: recurring.amountCents,
    subtotalCents: recurring.subtotalCents,
    discountCents: recurring.discountCents,
    freightCents: recurring.freightCents,
    totalCents: recurring.totalCents,
    depositEnabled: recurring.depositEnabled,
    depositPct: recurring.depositPct,
    durationEnabled: recurring.durationEnabled,
    durationMin: recurring.durationMin,
    validityEnabled: recurring.validityEnabled,
    validityDays: recurring.validityDays,
    deliveryEnabled: recurring.deliveryEnabled,
    deliveryText: recurring.deliveryText,
    warrantyEnabled: recurring.warrantyEnabled,
    warrantyText: recurring.warrantyText,
    notesEnabled: recurring.notesEnabled,
    conditionsNotes: recurring.conditionsNotes,
    discountEnabled: recurring.discountEnabled,
    discountType: recurring.discountType,
    discountValue: recurring.discountValue,
    freightEnabled: recurring.freightEnabled,
    freightValue: recurring.freightValue,
  };
}

async function getWorkspacePlan(workspaceId) {
  const workspace = await Workspace.findById(workspaceId).select("plan").lean();
  return workspace?.plan || "start";
}

export async function assertRecurringFeatureForTenant(workspaceId) {
  const workspacePlan = await getWorkspacePlan(workspaceId);
  return assertRecurringPlanAllowed(workspacePlan);
}

function validateRecurringCreationInput(body) {
  const input = body || {};
  if (!isNonEmpty(input.name || input.recurringName)) {
    const err = new Error("name required");
    err.statusCode = 400;
    throw err;
  }

  const intervalDays = clampInt(
    input?.recurrence?.intervalDays ?? input.intervalDays,
    1,
  );
  if (!Number.isFinite(intervalDays) || intervalDays < 1) {
    const err = new Error("intervalDays invalid");
    err.statusCode = 400;
    throw err;
  }

  const startsAtRaw = input?.recurrence?.startsAt || input.startsAt;
  const startsAt = new Date(startsAtRaw);
  if (Number.isNaN(startsAt.getTime())) {
    const err = new Error("startsAt invalid");
    err.statusCode = 400;
    throw err;
  }
}

export async function createRecurringOffer({ tenantId, userId, body, origin = "" }) {
  validateRecurringCreationInput(body);

  const input = body || {};
  const workspacePlan = await assertRecurringFeatureForTenant(tenantId);
  const customer = await resolveCustomerSnapshot({ tenantId, body: input });
  const snapshot = buildOfferSnapshotFields({ body: input, workspacePlan, customer });
  validateOfferSnapshotFields(snapshot);

  const name = String(input.name || input.recurringName || "").trim();
  const timeOfDay = normalizeTimeOfDay(
    input?.recurrence?.timeOfDay || input.timeOfDay,
  );
  const startsAt = new Date(input?.recurrence?.startsAt || input.startsAt);
  const intervalDays = clampInt(
    input?.recurrence?.intervalDays ?? input.intervalDays,
    1,
  );
  const endMode = normalizeEndMode(input?.recurrence?.endMode || input.endMode);
  const endsAtRaw = input?.recurrence?.endsAt || input.endsAt || null;
  const endsAt = endsAtRaw ? new Date(endsAtRaw) : null;
  const maxOccurrences =
    endMode === "until_count"
      ? clampInt(
          input?.recurrence?.maxOccurrences ?? input.maxOccurrences,
          1,
        )
      : null;

  const status = ["draft", "active", "paused", "ended", "error"].includes(
    String(input.status || "active").trim().toLowerCase(),
  )
    ? String(input.status || "active").trim().toLowerCase()
    : "active";

  const recurring = await RecurringOffer.create({
    workspaceId: tenantId,
    ownerUserId: userId,
    name,
    ...snapshot,
    recurrence: {
      intervalDays,
      startsAt,
      nextRunAt:
        status === "active"
          ? computeFirstNextRun({ startsAt, intervalDays, timeOfDay })
          : null,
      timeOfDay,
      endMode,
      endsAt:
        endMode === "until_date" && endsAt && !Number.isNaN(endsAt.getTime())
          ? endsAt
          : null,
      maxOccurrences,
    },
    automation: {
      autoSendToCustomer: safeBool(
        input?.automation?.autoSendToCustomer ?? input.autoSendToCustomer,
      ),
      generateFirstNow: safeBool(
        input?.automation?.generateFirstNow ?? input.generateFirstNow,
      ),
    },
    status,
  });

  let firstOffer = null;
  let runResult = null;

  if (recurring.automation.generateFirstNow === true) {
    runResult = await executeRecurringOffer({
      recurringId: recurring._id,
      reason: "creation",
      origin,
      forceNow: true,
    });
    firstOffer = runResult?.offer || null;
  }

  return {
    recurring: await RecurringOffer.findById(recurring._id).lean(),
    firstOffer,
    runResult,
  };
}

function buildRecurringUpdatePatch(input = {}) {
  const patch = {};

  if (isNonEmpty(input.name)) patch.name = String(input.name).trim();
  if (isNonEmpty(input.title)) patch.title = String(input.title).trim();
  if (input.description !== undefined) patch.description = String(input.description || "");

  if (input.customerName !== undefined) patch.customerName = String(input.customerName || "").trim();
  if (input.customerEmail !== undefined) patch.customerEmail = String(input.customerEmail || "").trim();
  if (input.customerDoc !== undefined) patch.customerDoc = onlyDigits(input.customerDoc);
  if (input.customerWhatsApp !== undefined) patch.customerWhatsApp = String(input.customerWhatsApp || "").trim();

  if (input.notifyWhatsAppOnPaid !== undefined) {
    patch.notifyWhatsAppOnPaid = safeBool(input.notifyWhatsAppOnPaid);
  }

  if (Number.isFinite(Number(input.amountCents))) patch.amountCents = Number(input.amountCents);
  if (Number.isFinite(Number(input.subtotalCents))) patch.subtotalCents = Number(input.subtotalCents);
  if (input.totalCents !== undefined && Number.isFinite(Number(input.totalCents))) patch.totalCents = Number(input.totalCents);
  if (input.discountCents !== undefined && Number.isFinite(Number(input.discountCents))) patch.discountCents = Number(input.discountCents);
  if (input.freightCents !== undefined && Number.isFinite(Number(input.freightCents))) patch.freightCents = Number(input.freightCents);

  if (input.depositEnabled !== undefined) patch.depositEnabled = safeBool(input.depositEnabled);
  if (input.depositPct !== undefined && Number.isFinite(Number(input.depositPct))) patch.depositPct = Number(input.depositPct);

  if (input.durationEnabled !== undefined) patch.durationEnabled = safeBool(input.durationEnabled);
  if (input.durationMin !== undefined && Number.isFinite(Number(input.durationMin))) patch.durationMin = Number(input.durationMin);

  if (input.validityEnabled !== undefined) patch.validityEnabled = safeBool(input.validityEnabled);
  if (input.validityDays !== undefined && Number.isFinite(Number(input.validityDays))) patch.validityDays = Number(input.validityDays);

  if (input.deliveryEnabled !== undefined) patch.deliveryEnabled = safeBool(input.deliveryEnabled);
  if (input.deliveryText !== undefined) patch.deliveryText = isNonEmpty(input.deliveryText) ? String(input.deliveryText) : null;

  if (input.warrantyEnabled !== undefined) patch.warrantyEnabled = safeBool(input.warrantyEnabled);
  if (input.warrantyText !== undefined) patch.warrantyText = isNonEmpty(input.warrantyText) ? String(input.warrantyText) : null;

  if (input.notesEnabled !== undefined) patch.notesEnabled = safeBool(input.notesEnabled);
  if (input.conditionsNotes !== undefined) patch.conditionsNotes = isNonEmpty(input.conditionsNotes) ? String(input.conditionsNotes) : null;

  if (input.discountEnabled !== undefined) patch.discountEnabled = safeBool(input.discountEnabled);
  if (input.discountType !== undefined) patch.discountType = isNonEmpty(input.discountType) ? String(input.discountType) : null;
  if (input.discountValue !== undefined) patch.discountValue = input.discountValue ?? null;

  if (input.freightEnabled !== undefined) patch.freightEnabled = safeBool(input.freightEnabled);
  if (input.freightValue !== undefined) patch.freightValue = input.freightValue ?? null;

  if (Array.isArray(input.items)) patch.items = normalizeItems(input.items);

  return patch;
}

async function refreshNextRunFromPatch(recurring, input, patchSet) {
  const intervalDays =
    input?.recurrence?.intervalDays ?? recurring?.recurrence?.intervalDays;
  const startsAt = input?.recurrence?.startsAt || recurring?.recurrence?.startsAt;
  const timeOfDay = input?.recurrence?.timeOfDay || recurring?.recurrence?.timeOfDay;
  const endMode = input?.recurrence?.endMode || recurring?.recurrence?.endMode;
  const maxOccurrences =
    input?.recurrence?.maxOccurrences ?? recurring?.recurrence?.maxOccurrences;

  if (input?.recurrence?.intervalDays !== undefined) {
    patchSet["recurrence.intervalDays"] = clampInt(intervalDays, 1);
  }
  if (input?.recurrence?.startsAt !== undefined) {
    const d = new Date(startsAt);
    if (Number.isNaN(d.getTime())) {
      const err = new Error("startsAt invalid");
      err.statusCode = 400;
      throw err;
    }
    patchSet["recurrence.startsAt"] = d;
  }
  if (input?.recurrence?.timeOfDay !== undefined) {
    patchSet["recurrence.timeOfDay"] = normalizeTimeOfDay(timeOfDay);
  }
  if (input?.recurrence?.endMode !== undefined) {
    patchSet["recurrence.endMode"] = normalizeEndMode(endMode);
  }
  if (input?.recurrence?.endsAt !== undefined) {
    patchSet["recurrence.endsAt"] = input.recurrence.endsAt
      ? new Date(input.recurrence.endsAt)
      : null;
  }
  if (input?.recurrence?.maxOccurrences !== undefined) {
    patchSet["recurrence.maxOccurrences"] = Number.isFinite(Number(maxOccurrences))
      ? clampInt(maxOccurrences, 1)
      : null;
  }

  const willBeActive =
    String(input?.status || recurring?.status || "").toLowerCase() === "active";
  if (willBeActive) {
    const nextRunAt = computeFirstNextRun({
      startsAt: patchSet["recurrence.startsAt"] || recurring?.recurrence?.startsAt,
      intervalDays:
        patchSet["recurrence.intervalDays"] || recurring?.recurrence?.intervalDays,
      timeOfDay:
        patchSet["recurrence.timeOfDay"] || recurring?.recurrence?.timeOfDay,
    });
    patchSet["recurrence.nextRunAt"] = nextRunAt;
  }
}

export async function updateRecurringOffer({ recurringId, tenantId, userId, body }) {
  const recurring = await RecurringOffer.findOne({
    _id: recurringId,
    workspaceId: tenantId,
    ownerUserId: userId,
  }).lean();

  if (!recurring) {
    const err = new Error("Recurring offer not found");
    err.statusCode = 404;
    throw err;
  }

  const workspacePlan = await getWorkspacePlan(tenantId);
  const patch = buildRecurringUpdatePatch(body || {});
  if (
    patch.notifyWhatsAppOnPaid !== undefined &&
    !canUseNotifyWhatsAppOnPaid(workspacePlan)
  ) {
    patch.notifyWhatsAppOnPaid = false;
  }

  const setPatch = {};
  for (const [key, value] of Object.entries(patch)) setPatch[key] = value;

  if (body?.status !== undefined) {
    const status = String(body.status || "").trim().toLowerCase();
    if (["draft", "active", "paused", "ended", "error"].includes(status)) {
      setPatch.status = status;
      if (status === "paused" || status === "ended" || status === "draft") {
        setPatch["recurrence.nextRunAt"] = null;
      }
      if (status === "ended") {
        setPatch.endedAt = new Date();
      }
    }
  }

  if (body?.automation) {
    if (body.automation.autoSendToCustomer !== undefined) {
      setPatch["automation.autoSendToCustomer"] = safeBool(
        body.automation.autoSendToCustomer,
      );
    }
    if (body.automation.generateFirstNow !== undefined) {
      setPatch["automation.generateFirstNow"] = safeBool(
        body.automation.generateFirstNow,
      );
    }
  }

  if (body?.recurrence) {
    await refreshNextRunFromPatch(recurring, body, setPatch);
  }

  await RecurringOffer.updateOne(
    { _id: recurringId },
    { $set: setPatch },
    { strict: false },
  );
  return RecurringOffer.findById(recurringId).lean();
}

function buildSummaryByOffers(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  const summary = {
    generatedCount: list.length,
    paidCount: 0,
    pendingCount: 0,
    totalPaidCents: 0,
    totalPendingCents: 0,
    lastGeneratedAt: null,
  };

  for (const row of list) {
    const total = Number(row?.totalCents ?? row?.amountCents ?? 0) || 0;
    const paymentStatus = normalizeStatus(row?.paymentStatus);
    const status = normalizeStatus(row?.status);
    const paid =
      ["PAID", "CONFIRMED"].includes(paymentStatus) ||
      ["PAID", "CONFIRMED"].includes(status);
    if (paid) {
      summary.paidCount += 1;
      summary.totalPaidCents += total;
    } else {
      summary.pendingCount += 1;
      summary.totalPendingCents += total;
    }

    const createdAt = row?.createdAt ? new Date(row.createdAt) : null;
    if (createdAt && !Number.isNaN(createdAt.getTime())) {
      if (!summary.lastGeneratedAt || createdAt > new Date(summary.lastGeneratedAt)) {
        summary.lastGeneratedAt = createdAt;
      }
    }
  }

  return summary;
}

async function loadOffersForRecurring(recurringId, limit = 200) {
  return Offer.find({ recurringOfferId: recurringId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

export async function listRecurringOffers({
  tenantId,
  userId,
  status = "all",
  query = "",
  bucket = "",
}) {
  const q = { workspaceId: tenantId, ownerUserId: userId };

  const normalizedStatus = String(status || "all").trim().toLowerCase();
  if (["active", "paused", "ended", "error", "draft"].includes(normalizedStatus)) {
    q.status = normalizedStatus;
  }

  const normalizedBucket = String(bucket || "").trim().toLowerCase();
  if (normalizedBucket === "upcoming") {
    q.status = "active";
    q["recurrence.nextRunAt"] = { $ne: null };
  }

  if (isNonEmpty(query)) {
    q.$or = [
      { name: { $regex: query, $options: "i" } },
      { customerName: { $regex: query, $options: "i" } },
      { title: { $regex: query, $options: "i" } },
    ];
  }

  const sort =
    normalizedBucket === "upcoming"
      ? { "recurrence.nextRunAt": 1, createdAt: -1 }
      : { createdAt: -1 };
  const items = await RecurringOffer.find(q).sort(sort).limit(200).lean();

  const ids = items.map((item) => item._id);
  const offerRows = ids.length
    ? await Offer.find({ recurringOfferId: { $in: ids } })
        .select(
          "recurringOfferId totalCents amountCents paymentStatus status createdAt",
        )
        .lean()
    : [];

  const grouped = new Map();
  for (const row of offerRows) {
    const key = String(row.recurringOfferId || "");
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }

  return items.map((item) => ({
    ...item,
    summary: buildSummaryByOffers(grouped.get(String(item._id)) || []),
  }));
}

export async function getRecurringOfferDetails({ recurringId, tenantId, userId }) {
  const recurring = await RecurringOffer.findOne({
    _id: recurringId,
    workspaceId: tenantId,
    ownerUserId: userId,
  }).lean();

  if (!recurring) {
    const err = new Error("Recurring offer not found");
    err.statusCode = 404;
    throw err;
  }

  const offers = await loadOffersForRecurring(recurring._id, 500);
  const summary = buildSummaryByOffers(offers);

  return {
    recurring,
    summary,
    offers: offers.slice(0, 30),
    history: Array.isArray(recurring.history) ? recurring.history : [],
  };
}

export async function getRecurringOfferLinkedOffers({ recurringId, tenantId, userId }) {
  const recurring = await RecurringOffer.findOne({
    _id: recurringId,
    workspaceId: tenantId,
    ownerUserId: userId,
  })
    .select("_id")
    .lean();

  if (!recurring) {
    const err = new Error("Recurring offer not found");
    err.statusCode = 404;
    throw err;
  }

  return loadOffersForRecurring(recurring._id, 500);
}

export async function getRecurringOfferHistory({ recurringId, tenantId, userId }) {
  const recurring = await RecurringOffer.findOne({
    _id: recurringId,
    workspaceId: tenantId,
    ownerUserId: userId,
  })
    .select("history")
    .lean();

  if (!recurring) {
    const err = new Error("Recurring offer not found");
    err.statusCode = 404;
    throw err;
  }

  return Array.isArray(recurring.history) ? recurring.history : [];
}

export async function pauseRecurringOffer({ recurringId, tenantId, userId }) {
  const recurring = await RecurringOffer.findOne({
    _id: recurringId,
    workspaceId: tenantId,
    ownerUserId: userId,
  }).lean();

  if (!recurring) {
    const err = new Error("Recurring offer not found");
    err.statusCode = 404;
    throw err;
  }

  const now = new Date();
  return appendRecurringHistory(
    recurringId,
    {
      status: "paused",
      source: "pause",
      ranAt: now,
      message: "Recorrência pausada manualmente.",
      meta: buildRecurringStatusMeta(recurring),
    },
    {
      status: "paused",
      "recurrence.nextRunAt": null,
      runner: { lockedAt: null, lockId: null },
    },
  );
}

export async function resumeRecurringOffer({ recurringId, tenantId, userId }) {
  const recurring = await RecurringOffer.findOne({
    _id: recurringId,
    workspaceId: tenantId,
    ownerUserId: userId,
  }).lean();

  if (!recurring) {
    const err = new Error("Recurring offer not found");
    err.statusCode = 404;
    throw err;
  }

  const nextRunAt = computeFirstNextRun({
    startsAt: recurring?.recurrence?.startsAt,
    intervalDays: recurring?.recurrence?.intervalDays,
    timeOfDay: recurring?.recurrence?.timeOfDay,
  });

  return appendRecurringHistory(
    recurringId,
    {
      status: "generated",
      source: "resume",
      ranAt: new Date(),
      message: "Recorrência reativada e pronta para próximas execuções.",
      meta: buildRecurringStatusMeta(recurring),
    },
    {
      status: "active",
      endedAt: null,
      "recurrence.nextRunAt": nextRunAt,
      lastError: { message: null, code: null, details: null, at: null },
      runner: { lockedAt: null, lockId: null },
    },
  );
}

export async function endRecurringOffer({ recurringId, tenantId, userId }) {
  const recurring = await RecurringOffer.findOne({
    _id: recurringId,
    workspaceId: tenantId,
    ownerUserId: userId,
  }).lean();

  if (!recurring) {
    const err = new Error("Recurring offer not found");
    err.statusCode = 404;
    throw err;
  }

  const now = new Date();
  return appendRecurringHistory(
    recurringId,
    {
      status: "ended",
      source: "end",
      ranAt: now,
      message: "Recorrência encerrada manualmente.",
      meta: buildRecurringStatusMeta(recurring),
    },
    {
      status: "ended",
      endedAt: now,
      "recurrence.nextRunAt": null,
      runner: { lockedAt: null, lockId: null },
    },
  );
}

export async function duplicateRecurringOffer({ recurringId, tenantId, userId }) {
  const recurring = await RecurringOffer.findOne({
    _id: recurringId,
    workspaceId: tenantId,
    ownerUserId: userId,
  }).lean();

  if (!recurring) {
    const err = new Error("Recurring offer not found");
    err.statusCode = 404;
    throw err;
  }

  const copy = await RecurringOffer.create({
    ...recurring,
    _id: undefined,
    name: `${recurring.name} (cópia)`,
    status: "draft",
    runCount: 0,
    successCount: 0,
    failureCount: 0,
    lastRunAt: null,
    lastOfferId: null,
    lastError: { message: null, code: null, details: null, at: null },
    endedAt: null,
    createdAt: undefined,
    updatedAt: undefined,
    runner: { lockedAt: null, lockId: null },
    history: [
      {
        status: "generated",
        source: "duplicate",
        ranAt: new Date(),
        message: `Recorrência criada a partir da duplicação de ${recurring.name}.`,
        meta: {
          duplicatedFromId: recurring._id,
          duplicatedFromName: recurring.name,
        },
      },
    ],
  });

  return copy.toObject();
}

async function acquireRecurringRunLock({ recurringId }) {
  const now = new Date();
  const staleDate = new Date(now.getTime() - RUNNER_LOCK_TTL_MS);
  const lockId = crypto.randomUUID();

  const recurring = await RecurringOffer.findOneAndUpdate(
    {
      _id: recurringId,
      $or: [
        { "runner.lockedAt": null },
        { "runner.lockedAt": { $lte: staleDate } },
        { runner: { $exists: false } },
      ],
    },
    {
      $set: {
        "runner.lockedAt": now,
        "runner.lockId": lockId,
      },
    },
    { new: true },
  ).lean();

  return recurring ? { recurring, lockId } : null;
}

async function releaseRecurringRunLock(recurringId, lockId) {
  await RecurringOffer.updateOne(
    { _id: recurringId, "runner.lockId": lockId },
    { $set: { "runner.lockedAt": null, "runner.lockId": null } },
    { strict: false },
  ).catch(() => {});
}

export async function executeRecurringOffer({
  recurringId,
  reason = "manual",
  origin = "",
  forceNow = false,
}) {
  const locked = await acquireRecurringRunLock({ recurringId });
  if (!locked) {
    const err = new Error("Recurring offer is already running");
    err.statusCode = 409;
    throw err;
  }

  const { recurring, lockId } = locked;

  try {
    if (!["active", "error", "draft"].includes(String(recurring.status || ""))) {
      const updated = await appendRecurringHistory(
        recurring._id,
        {
          status: "skipped",
          source: reason === "manual" ? "manual" : "automatic",
          ranAt: new Date(),
          message: `Execução ignorada porque a recorrência está em status ${recurring.status}.`,
          meta: buildRecurringStatusMeta(recurring),
        },
        {},
      );
      return {
        recurring: updated,
        offer: null,
        execution: { status: "skipped" },
      };
    }

    const nextRunAt = recurring?.recurrence?.nextRunAt
      ? new Date(recurring.recurrence.nextRunAt)
      : null;

    if (!forceNow && nextRunAt && nextRunAt.getTime() > Date.now()) {
      return {
        recurring,
        offer: null,
        execution: {
          status: "skipped",
          message: "Recorrência ainda não está agendada para execução.",
        },
      };
    }

    const workspacePlan = await assertRecurringFeatureForTenant(
      recurring.workspaceId,
    );
    const nextSequence = Number(recurring.runCount || 0) + 1;

    const offer = await createOfferFromPayload({
      tenantId: recurring.workspaceId,
      userId: recurring.ownerUserId,
      workspacePlan,
      body: buildRecurringBasePayload(recurring),
      recurringMeta: {
        recurringOfferId: recurring._id,
        sequence: nextSequence,
        name: recurring.name,
        originMeta: { source: "recurring", recurringName: recurring.name },
      },
    });

    const sendResult = await tryAutoSendRecurringOfferOutbox({
      recurring,
      offer,
      origin,
    });

    const now = new Date();
    const followingRun = computeFollowingRun({
      baseDate: forceNow ? now : recurring?.recurrence?.nextRunAt || now,
      intervalDays: recurring?.recurrence?.intervalDays,
      timeOfDay: recurring?.recurrence?.timeOfDay,
    });

    const shouldEnd = shouldEndRecurring(recurring, nextSequence, followingRun);
    const status = shouldEnd
      ? "ended"
      : recurring.status === "draft"
        ? "active"
        : recurring.status;

    const updated = await appendRecurringHistory(
      recurring._id,
      {
        status: sendResult.status,
        source:
          reason === "creation"
            ? "creation"
            : reason === "automatic"
              ? "automatic"
              : "manual",
        ranAt: now,
        offerId: offer._id,
        recurringSequence: nextSequence,
        message: sendResult.message,
        error: sendResult.error || { message: null, code: null, details: null },
        meta: {
          ...buildRecurringStatusMeta(recurring),
          offerPublicToken: offer.publicToken,
          sendStatus: sendResult.status,
          ...(sendResult.meta || {}),
        },
      },
      {
        runCount: nextSequence,
        successCount: Number(recurring.successCount || 0) + 1,
        lastRunAt: now,
        lastOfferId: offer._id,
        status,
        endedAt: shouldEnd ? now : recurring.endedAt || null,
        "recurrence.nextRunAt": shouldEnd ? null : followingRun,
        lastError: {
          message:
            sendResult.status === "failed" ? sendResult.error?.message || null : null,
          code:
            sendResult.status === "failed" ? sendResult.error?.code || null : null,
          details:
            sendResult.status === "failed" ? sendResult.error?.details || null : null,
          at: sendResult.status === "failed" ? now : null,
        },
      },
    );

    return {
      recurring: updated,
      offer: offer.toObject ? offer.toObject() : offer,
      execution: {
        status: sendResult.status,
        message: sendResult.message,
      },
    };
  } catch (error) {
    const now = new Date();
    const updated = await appendRecurringHistory(
      recurring._id,
      {
        status: "failed",
        source: reason === "automatic" ? "automatic" : "manual",
        ranAt: now,
        message: "Falha ao gerar cobrança recorrente.",
        error: {
          message: String(error?.message || "Erro ao executar recorrência"),
          code: String(error?.code || error?.name || "RECURRING_RUN_FAILED"),
          details: error?.details || null,
        },
        meta: buildRecurringStatusMeta(recurring),
      },
      {
        failureCount: Number(recurring.failureCount || 0) + 1,
        lastRunAt: now,
        status: "error",
        lastError: {
          message: String(error?.message || "Erro ao executar recorrência"),
          code: String(error?.code || error?.name || "RECURRING_RUN_FAILED"),
          details: error?.details || null,
          at: now,
        },
      },
    );

    const err = new Error(
      String(error?.message || "Erro ao executar recorrência"),
    );
    err.statusCode = error?.statusCode || 500;
    err.details = { recurring: updated };
    throw err;
  } finally {
    await releaseRecurringRunLock(recurringId, lockId);
  }
}

export async function runRecurringOfferNow({ recurringId, tenantId, userId, origin = "" }) {
  const recurring = await RecurringOffer.findOne({
    _id: recurringId,
    workspaceId: tenantId,
    ownerUserId: userId,
  })
    .select("_id")
    .lean();

  if (!recurring) {
    const err = new Error("Recurring offer not found");
    err.statusCode = 404;
    throw err;
  }

  return executeRecurringOffer({
    recurringId: recurring._id,
    reason: "manual",
    origin,
    forceNow: true,
  });
}

export async function processDueRecurringOffers({ now = new Date(), origin = "" } = {}) {
  const allowedWorkspaceRows = await Workspace.find({
    plan: { $in: ["pro", "business", "enterprise"] },
  })
    .select("_id plan")
    .lean();

  const allowedWorkspaceIds = allowedWorkspaceRows
    .filter((row) => canUseRecurring(row?.plan))
    .map((row) => row._id);

  if (!allowedWorkspaceIds.length) {
    return {
      ok: true,
      scanned: 0,
      items: [],
    };
  }

  const dueRows = await RecurringOffer.find({
    status: "active",
    workspaceId: { $in: allowedWorkspaceIds },
    "recurrence.nextRunAt": { $ne: null, $lte: now },
  })
    .select("_id")
    .sort({ "recurrence.nextRunAt": 1 })
    .limit(50)
    .lean();

  const results = [];
  for (const row of dueRows) {
    try {
      const run = await executeRecurringOffer({
        recurringId: row._id,
        reason: "automatic",
        origin,
        forceNow: false,
      });
      results.push({
        recurringId: String(row._id),
        status: run?.execution?.status || "generated",
      });
    } catch (error) {
      results.push({
        recurringId: String(row._id),
        status: "failed",
        error: String(error?.message || "Erro ao executar recorrência"),
      });
    }
  }

  return {
    ok: true,
    scanned: dueRows.length,
    items: results,
  };
}
