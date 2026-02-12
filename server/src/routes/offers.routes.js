import { Router } from "express";
import crypto from "crypto";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Offer } from "../models/Offer.js";

const r = Router();

const LINK_TTL_DAYS = Number(process.env.OFFER_LINK_TTL_DAYS || 90);

function isNonEmpty(s) {
  return String(s || "").trim().length > 0;
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

async function createOfferLocal(body) {
  const b = body || {};

  const offerTypeRaw = String(b.offerType || "service").trim().toLowerCase();
  const offerType = offerTypeRaw === "product" ? "product" : "service";

  const now = new Date();
  const publicToken = await generateUniquePublicToken();
  const expiresAt = addDays(now, Number.isFinite(LINK_TTL_DAYS) ? LINK_TTL_DAYS : 90);

  const title = isNonEmpty(b.title) ? String(b.title).trim() : offerType === "product" ? "Orçamento" : "Proposta";
  const description = isNonEmpty(b.description) ? String(b.description) : "";

  // Totais
  const amountCents = Number(b.amountCents);
  const subtotalCents = Number.isFinite(Number(b.subtotalCents)) ? Number(b.subtotalCents) : null;
  const discountCents = Number.isFinite(Number(b.discountCents)) ? Number(b.discountCents) : null;
  const freightCents = Number.isFinite(Number(b.freightCents)) ? Number(b.freightCents) : null;
  const totalCents = Number.isFinite(Number(b.totalCents)) ? Number(b.totalCents) : amountCents;

  const depositEnabled = b.depositEnabled !== false && Number(b.depositPct) > 0;
  const depositPct = depositEnabled ? clampInt(b.depositPct, 0, 100) : 0;

  // ✅ Condições (opcional) — sempre persistir flags + valor
  const durationEnabled = offerType === "service" ? safeBool(b.durationEnabled) : false;
  const durationMin =
    offerType === "service" && durationEnabled && Number.isFinite(Number(b.durationMin))
      ? clampInt(b.durationMin, 1)
      : null;

  const validityEnabled = safeBool(b.validityEnabled);
  const validityDays = validityEnabled && Number.isFinite(Number(b.validityDays)) ? clampInt(b.validityDays, 1) : null;

  const deliveryEnabled = safeBool(b.deliveryEnabled);
  const deliveryText = deliveryEnabled && isNonEmpty(b.deliveryText) ? String(b.deliveryText).trim() : null;

  const warrantyEnabled = safeBool(b.warrantyEnabled);
  const warrantyText = warrantyEnabled && isNonEmpty(b.warrantyText) ? String(b.warrantyText).trim() : null;

  const notesEnabled = safeBool(b.notesEnabled);
  const conditionsNotes = notesEnabled && isNonEmpty(b.conditionsNotes) ? String(b.conditionsNotes).trim() : null;

  // Desconto/Frete: persistir flags e também os valores em cents (já calculados no front)
  const discountEnabled = safeBool(b.discountEnabled);
  const discountType = discountEnabled && (b.discountType === "pct" || b.discountType === "fixed") ? b.discountType : null;
  const discountValue = discountEnabled ? b.discountValue ?? null : null;

  const freightEnabled = safeBool(b.freightEnabled);
  const freightValue = freightEnabled ? b.freightValue ?? null : null;

  // Items (product)
  const items = offerType === "product" ? normalizeItems(b.items) : [];

  const offer = await Offer.create({
    customerName: String(b.customerName || "").trim(),
    customerWhatsApp: isNonEmpty(b.customerWhatsApp) ? String(b.customerWhatsApp).trim() : "",

    offerType,
    title,
    description,

    items,

    amountCents: amountCents,
    subtotalCents,
    discountCents,
    freightCents,
    totalCents,

    depositEnabled: !!b.depositEnabled,
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
  });

  return offer;
}

r.get(
  "/offers",
  asyncHandler(async (_req, res) => {
    const items = await Offer.find().sort({ createdAt: -1 }).limit(200);
    res.json({ ok: true, items });
  }),
);

r.post(
  "/offers",
  asyncHandler(async (req, res) => {
    const { customerName, title, amountCents, offerType } = req.body || {};

    // Validações mínimas (mantém compatibilidade)
    if (!isNonEmpty(customerName)) {
      return res
        .status(400)
        .json({
          ok: false,
          error: "customerName required",
        });
    }

    // Para service, title é obrigatório; para product, title pode vir vazio (front manda 'Orçamento')
    const isProduct = String(offerType || "").toLowerCase() === "product";
    if (!isProduct && !isNonEmpty(title)) {
      return res.status(400).json({ ok: false, error: "title required" });
    }

    if (!Number.isFinite(Number(amountCents)) || Number(amountCents) <= 0) {
      return res.status(400).json({ ok: false, error: "amountCents invalid" });
    }

    const offer = await createOfferLocal(req.body);
    res.json({ ok: true, offer, publicUrl: `/p/${offer.publicToken}` });
  }),
);

export default r;
