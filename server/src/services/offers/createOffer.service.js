import crypto from "crypto";

import { Client } from "../../models/Client.js";
import { Offer } from "../../models/Offer.js";
import { canUseNotifyWhatsAppOnPaid } from "../../utils/planFeatures.js";
import {
  getDefaultOfferNotificationFlags,
  resolveWorkspaceNotificationContext,
} from "../notificationSettings.js";
import { onlyDigits } from "../../utils/phone.js";

const LINK_TTL_DAYS = Number(process.env.OFFER_LINK_TTL_DAYS || 90);
const HAS_TENANT = !!Offer?.schema?.path?.("workspaceId");
const HAS_OWNER = !!Offer?.schema?.path?.("ownerUserId");

function isNonEmpty(value) {
  return String(value || "").trim().length > 0;
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

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + Number(days || 0));
  return next;
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

function makePublicCode() {
  return `LP${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

async function generateUniquePublicCode(workspaceId) {
  const scopedWorkspaceId = workspaceId || null;

  for (let i = 0; i < 8; i += 1) {
    const code = makePublicCode();
    // eslint-disable-next-line no-await-in-loop
    const exists = await Offer.exists({
      workspaceId: scopedWorkspaceId,
      publicCode: code,
    });
    if (!exists) return code;
  }

  throw new Error("Failed to generate a unique public code");
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
      const err = new Error("Cliente nao encontrado neste workspace");
      err.statusCode = 400;
      throw err;
    }

    customerId = client._id;
    customerName = String(client.fullName || customerName || "").trim();
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

function buildOfferSnapshotFields({
  body,
  workspacePlan,
  customer,
  notificationContext,
}) {
  const input = body || {};
  const offerTypeRaw = String(input.offerType || "service").trim().toLowerCase();
  const offerType = offerTypeRaw === "product" ? "product" : "service";
  const defaultFlags = getDefaultOfferNotificationFlags(notificationContext);

  const title = isNonEmpty(input.title)
    ? String(input.title).trim()
    : offerType === "product"
      ? "Orcamento"
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
      ? input.notifyWhatsAppOnPaid === true
        ? true
        : input.notifyWhatsAppOnPaid === false
          ? false
          : defaultFlags.notifyWhatsAppOnPaid
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
    paymentReminders: defaultFlags.paymentReminders,
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
  notificationContext = null,
}) {
  const effectiveNotificationContext =
    notificationContext ||
    (await resolveWorkspaceNotificationContext({
      workspaceId: tenantId,
      ownerUserId: userId || null,
      workspacePlan,
    }));

  const customer = await resolveCustomerSnapshot({ tenantId, body });
  const snapshot = buildOfferSnapshotFields({
    body,
    workspacePlan,
    customer,
    notificationContext: effectiveNotificationContext,
  });

  validateOfferSnapshotFields(snapshot);

  const publicToken = await generateUniquePublicToken();
  const publicCode = await generateUniquePublicCode(tenantId);
  const expiresAt = addDays(
    new Date(),
    Number.isFinite(LINK_TTL_DAYS) ? LINK_TTL_DAYS : 90,
  );

  const doc = {
    ...(HAS_TENANT ? { workspaceId: tenantId } : {}),
    ...(HAS_OWNER && userId ? { ownerUserId: userId } : {}),

    ...snapshot,

    publicToken,
    publicCode,
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
