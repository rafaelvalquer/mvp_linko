import { Router } from "express";
import crypto from "crypto";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Offer } from "../models/Offer.js";
import { ensureAuth, tenantFromUser } from "../middleware/auth.js";
import { Client } from "../models/Client.js";

const r = Router();

const LINK_TTL_DAYS = Number(process.env.OFFER_LINK_TTL_DAYS || 90);
const HAS_TENANT = !!Offer?.schema?.path?.("workspaceId");
const HAS_OWNER = !!Offer?.schema?.path?.("ownerUserId");

function isNonEmpty(s) {
  return String(s || "").trim().length > 0;
}

function onlyDigits(v) {
  return String(v || "").replace(/\D+/g, "");
}

function clampInt(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  const xi = Math.trunc(x);
  return Math.max(min, max != null ? Math.min(max, xi) : xi);
}

function safeBool(v) {
  return v === true;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function generateUniquePublicToken() {
  // 128-bit hex token (32 chars)
  for (let i = 0; i < 8; i++) {
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
    .map((it) => {
      const description = String(it?.description || "").trim();
      const qty = clampInt(it?.qty, 1);
      const unitPriceCents = Number(it?.unitPriceCents);
      const lineTotalCents = Number(it?.lineTotalCents);

      return {
        description,
        qty,
        unitPriceCents: Number.isFinite(unitPriceCents) ? unitPriceCents : null,
        lineTotalCents: Number.isFinite(lineTotalCents) ? lineTotalCents : null,
      };
    })
    .filter((it) => isNonEmpty(it.description));
}

async function createOfferLocal({ tenantId, userId, body }) {
  const b = body || {};
  // ✅ Vendedor (persistido para notificações)
  let sellerEmail = String(b.sellerEmail || "")
    .trim()
    .toLowerCase();
  let sellerName = String(b.sellerName || "").trim();
  // ✅ Cliente (snapshot)
  let customerId = b.customerId || null;
  let customerName = String(b.customerName || "").trim();
  let customerEmail = String(b.customerEmail || "").trim();
  let customerDoc = onlyDigits(b.customerDoc);
  let customerWhatsApp = String(b.customerWhatsApp || "").trim();
  const notifyWhatsAppOnPaid = safeBool(b.notifyWhatsAppOnPaid);


  if (customerId) {
    const c = await Client.findOne({
      _id: customerId,
      workspaceId: tenantId,
    }).lean();
    if (!c) {
      const err = new Error("Cliente não encontrado neste workspace");
      err.statusCode = 400;
      throw err;
    }
    customerId = c._id;

    customerName = String(c.name || customerName || "").trim();
    customerEmail = String(c.email || customerEmail || "").trim();
    customerDoc = onlyDigits(c.cpfCnpjDigits || c.cpfCnpj || customerDoc || "");
    customerWhatsApp = String(c.phone || customerWhatsApp || "").trim();
  }

  const offerTypeRaw = String(b.offerType || "service")
    .trim()
    .toLowerCase();
  const offerType = offerTypeRaw === "product" ? "product" : "service";

  const now = new Date();
  const publicToken = await generateUniquePublicToken();
  const expiresAt = addDays(
    now,
    Number.isFinite(LINK_TTL_DAYS) ? LINK_TTL_DAYS : 90,
  );

  const title = isNonEmpty(b.title)
    ? String(b.title).trim()
    : offerType === "product"
      ? "Orçamento"
      : "Proposta";
  const description = isNonEmpty(b.description) ? String(b.description) : "";

  // Totais
  const amountCents = Number(b.amountCents ?? b.totalCents);
  const subtotalCents = Number.isFinite(Number(b.subtotalCents))
    ? Number(b.subtotalCents)
    : null;
  const discountCents = Number.isFinite(Number(b.discountCents))
    ? Number(b.discountCents)
    : null;
  const freightCents = Number.isFinite(Number(b.freightCents))
    ? Number(b.freightCents)
    : null;
  const totalCents = Number.isFinite(Number(b.totalCents))
    ? Number(b.totalCents)
    : amountCents;

  const depositEnabled = b.depositEnabled !== false && Number(b.depositPct) > 0;
  const depositPct = depositEnabled ? clampInt(b.depositPct, 1, 100) : 0;

  // ✅ Condições (opcional) — sempre persistir flags + valor
  const durationEnabled =
    offerType === "service" ? safeBool(b.durationEnabled) : false;
  const durationMin =
    offerType === "service" &&
    durationEnabled &&
    Number.isFinite(Number(b.durationMin))
      ? clampInt(b.durationMin, 1)
      : null;

  const validityEnabled = safeBool(b.validityEnabled);
  const validityDays =
    validityEnabled && Number.isFinite(Number(b.validityDays))
      ? clampInt(b.validityDays, 1)
      : null;

  const deliveryEnabled = safeBool(b.deliveryEnabled);
  const deliveryText =
    deliveryEnabled && isNonEmpty(b.deliveryText)
      ? String(b.deliveryText).trim()
      : null;

  const warrantyEnabled = safeBool(b.warrantyEnabled);
  const warrantyText =
    warrantyEnabled && isNonEmpty(b.warrantyText)
      ? String(b.warrantyText).trim()
      : null;

  const notesEnabled = safeBool(b.notesEnabled);
  const conditionsNotes =
    notesEnabled && isNonEmpty(b.conditionsNotes)
      ? String(b.conditionsNotes).trim()
      : null;

  // Desconto/Frete: persistir flags e também os valores em cents (já calculados no front)
  const discountEnabled = safeBool(b.discountEnabled);
  const discountType =
    discountEnabled && (b.discountType === "pct" || b.discountType === "fixed")
      ? b.discountType
      : null;
  const discountValue = discountEnabled ? (b.discountValue ?? null) : null;

  const freightEnabled = safeBool(b.freightEnabled);
  const freightValue = freightEnabled ? (b.freightValue ?? null) : null;

  // Items (product)
  const items = offerType === "product" ? normalizeItems(b.items) : [];

  const doc = {
    ...(HAS_TENANT ? { workspaceId: tenantId } : {}),
    ...(HAS_OWNER ? { ownerUserId: userId } : {}),

    // notificações de pagamento (Resend)
    sellerEmail: sellerEmail || null,
    sellerName: sellerName || null,

    customerId: customerId || null,
    customerName,
    customerEmail,
    customerDoc,
    customerWhatsApp,

    notifyWhatsAppOnPaid,

    offerType,
    title,
    description,

    items,

    amountCents: amountCents,
    subtotalCents,
    discountCents,
    freightCents,
    totalCents,

    depositEnabled,
    depositPct,

    durationEnabled,
    durationMin,
    validityEnabled,
    validityDays,
    deliveryEnabled,
    deliveryText,
    warrantyEnabled,
    warrantyText,
    notesEnabled,
    conditionsNotes,

    discountEnabled,
    discountType,
    discountValue,

    freightEnabled,
    freightValue,

    publicToken,
    expiresAt,
    status: "PUBLIC",
  };

  const offer = await Offer.create(doc);

  return offer;
}

r.use(ensureAuth, tenantFromUser);

r.get(
  "/offers",
  ensureAuth,
  tenantFromUser,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId;
    const userId = req.user?._id;
    const q = { workspaceId: tenantId };
    if (userId) q.ownerUserId = userId;
    const items = await Offer.find(q).sort({ createdAt: -1 }).limit(200);
    res.json({ ok: true, items });
  }),
);

r.post(
  "/offers",
  asyncHandler(async (req, res) => {
    const {
      customerName,
      customerId,
      title,
      amountCents,
      totalCents,
      offerType,
    } = req.body || {};

    // Validações mínimas (mantém compatibilidade)
    if (!isNonEmpty(customerName) && !isNonEmpty(customerId)) {
      return res.status(400).json({
        ok: false,
        error: "customerName or customerId required",
      });
    }

    // Para service, title é obrigatório; para product, title pode vir vazio (front manda 'Orçamento')
    const isProduct = String(offerType || "").toLowerCase() === "product";
    if (!isProduct && !isNonEmpty(title)) {
      return res.status(400).json({ ok: false, error: "title required" });
    }

    const cents = Number(totalCents ?? amountCents);
    if (!Number.isFinite(cents) || cents <= 0) {
      return res.status(400).json({ ok: false, error: "amountCents invalid" });
    }

    const offer = await createOfferLocal({
      tenantId: req.tenantId,
      userId: req.user?._id,
      body: req.body,
    });
    res.json({ ok: true, offer, publicUrl: `/p/${offer.publicToken}` });
  }),
);

export default r;
