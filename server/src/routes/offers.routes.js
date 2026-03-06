// server/src/routes/offers.routes.js
import { Router } from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Offer } from "../models/Offer.js";
import Booking from "../models/Booking.js";
import { ensureAuth, tenantFromUser } from "../middleware/auth.js";
import { Client } from "../models/Client.js";
import { readPaymentProofBase64 } from "../services/storageLocal.js";
import {
  notifyPaymentConfirmed,
  notifyPaymentRejected,
} from "../services/whatsappNotify.js";
import {
  notifySellerPixPaid,
  notifySellerPaymentConfirmedOnPlatform,
} from "../services/resendEmail.js";

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

function computeChargeCentsForManual(offer) {
  const totalCents = Number(offer?.totalCents ?? offer?.amountCents ?? 0) || 0;

  const depositPctRaw = Number(offer?.depositPct);
  const depositPct =
    Number.isFinite(depositPctRaw) && depositPctRaw > 0 ? depositPctRaw : 0;

  const depositEnabled =
    offer?.depositEnabled === false ? false : depositPct > 0;

  const depositCents = depositEnabled
    ? Math.round((totalCents * depositPct) / 100)
    : 0;

  return depositEnabled ? depositCents : totalCents;
}

async function generateUniquePublicToken() {
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
  let sellerEmail = String(b.sellerEmail || "")
    .trim()
    .toLowerCase();
  let sellerName = String(b.sellerName || "").trim();

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
    : null;

  const items = normalizeItems(b.items);

  const depositEnabled = safeBool(b.depositEnabled);
  const depositPct = Number.isFinite(Number(b.depositPct))
    ? Number(b.depositPct)
    : 0;

  const durationEnabled = safeBool(b.durationEnabled);
  const durationMin = Number.isFinite(Number(b.durationMin))
    ? Number(b.durationMin)
    : null;

  const validityEnabled = safeBool(b.validityEnabled);
  const validityDays = Number.isFinite(Number(b.validityDays))
    ? Number(b.validityDays)
    : null;

  const deliveryEnabled = safeBool(b.deliveryEnabled);
  const deliveryText = isNonEmpty(b.deliveryText)
    ? String(b.deliveryText)
    : null;

  const warrantyEnabled = safeBool(b.warrantyEnabled);
  const warrantyText = isNonEmpty(b.warrantyText)
    ? String(b.warrantyText)
    : null;

  const notesEnabled = safeBool(b.notesEnabled);
  const conditionsNotes = isNonEmpty(b.conditionsNotes)
    ? String(b.conditionsNotes)
    : null;

  const discountEnabled = safeBool(b.discountEnabled);
  const discountType = isNonEmpty(b.discountType)
    ? String(b.discountType)
    : null;
  const discountValue = b.discountValue ?? null;

  const freightEnabled = safeBool(b.freightEnabled);
  const freightValue = b.freightValue ?? null;

  const doc = {
    ...(HAS_TENANT ? { workspaceId: tenantId } : {}),
    ...(HAS_OWNER && userId ? { ownerUserId: userId } : {}),

    sellerEmail: sellerEmail || null,
    sellerName: sellerName || null,

    customerId,
    customerName,
    customerEmail,
    customerDoc,
    customerWhatsApp,

    notifyWhatsAppOnPaid,

    offerType,
    title,
    description,

    items,

    amountCents,
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
    paymentMethod: "MANUAL_PIX",
    paymentStatus: "PENDING",
  };

  const offer = await Offer.create(doc);
  return offer;
}

r.use(ensureAuth, tenantFromUser);

// LIST
r.get(
  "/offers",
  ensureAuth,
  tenantFromUser,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId;
    const userId = req.user?._id;

    const q = { workspaceId: tenantId };
    if (userId) q.ownerUserId = userId;

    const items = await Offer.find(q).sort({ createdAt: -1 }).limit(200).lean();
    res.json({ ok: true, items });
  }),
);

// DETAILS
r.get(
  "/offers/:id",
  ensureAuth,
  tenantFromUser,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId;
    const userId = req.user?._id;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ ok: false, error: "invalid id" });
    }

    const q = { _id: id, workspaceId: tenantId };
    if (userId) q.ownerUserId = userId;

    const offer = await Offer.findOne(q).lean();
    if (!offer) {
      return res.status(404).json({ ok: false, error: "Offer not found" });
    }

    let booking = null;
    try {
      booking = await Booking.findOne({
        offerId: offer._id,
        workspaceId: tenantId,
      })
        .sort({ startAt: -1 })
        .lean();
    } catch {
      booking = null;
    }

    res.json({ ok: true, offer, booking });
  }),
);

// ====== MANUAL PIX: comprovante + confirmacao ======

r.get(
  "/offers/:id/payment-proof",
  ensureAuth,
  tenantFromUser,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId;
    const userId = req.user?._id;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ ok: false, error: "invalid id" });
    }

    const q = { _id: id, workspaceId: tenantId };
    if (userId) q.ownerUserId = userId;

    const offer = await Offer.findOne(q)
      .select("paymentProof paymentStatus status")
      .lean();

    if (!offer) {
      return res.status(404).json({ ok: false, error: "Offer not found" });
    }

    const proof = offer?.paymentProof || null;
    const key = String(proof?.storage?.key || "").trim();
    if (!key) {
      return res
        .status(404)
        .json({ ok: false, error: "Payment proof not found" });
    }

    const inline = String(req.query.inline || "") === "1";
    if (inline) {
      const base64 = await readPaymentProofBase64(key);
      return res.json({
        ok: true,
        proof: {
          ...proof,
          storage: { ...proof.storage, path: undefined },
        },
        file: {
          mimeType: proof?.mimeType || "application/octet-stream",
          base64,
        },
      });
    }

    return res.json({
      ok: true,
      proof: {
        ...proof,
        storage: { ...proof.storage, path: undefined },
      },
    });
  }),
);

async function safeNotifyPaymentConfirmed(offerId) {
  try {
    return await notifyPaymentConfirmed(offerId);
  } catch (err) {
    return {
      ok: false,
      status: "FAILED",
      error: {
        message: String(err?.message || "Falha ao notificar WhatsApp"),
        code: String(err?.code || err?.name || "NOTIFY_FAILED"),
      },
    };
  }
}

async function safeNotifySellerPixPaid({ offer, booking, now }) {
  try {
    const r2 = await notifySellerPixPaid({
      offerId: offer._id,
      offer,
      booking,
      pixId: offer?.payment?.lastPixId || null, // manual -> null => key "paid"
      paidAt: offer?.paidAt || now,
      paidAmountCents: offer?.paidAmountCents || null,
      proof: offer?.paymentProof || null, // opcional (anexa se possível)
    });

    if (r2?.skipped) return { status: "SKIPPED", reason: r2.reason || "" };
    return { status: "SENT", id: r2?.id || null, to: r2?.to || "" };
  } catch (e) {
    return { status: "FAILED", error: String(e?.message || "email_failed") };
  }
}

async function safeNotifySellerConfirmedOnPlatform({ offer, booking }) {
  try {
    const r3 = await notifySellerPaymentConfirmedOnPlatform({
      offerId: offer._id,
      offer,
      booking,
      proof: offer?.paymentProof || null,
    });

    if (r3?.skipped) return { status: "SKIPPED", reason: r3.reason || "" };
    return { status: "SENT", id: r3?.id || null, to: r3?.to || "" };
  } catch (e) {
    return { status: "FAILED", error: String(e?.message || "email_failed") };
  }
}

async function confirmPaymentHandler(req, res) {
  const tenantId = req.tenantId;
  const userId = req.user?._id;
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ ok: false, error: "invalid id" });
  }

  const q = { _id: id, workspaceId: tenantId };
  if (userId) q.ownerUserId = userId;

  const offer0 = await Offer.findOne(q).lean();
  if (!offer0) {
    return res.status(404).json({ ok: false, error: "Offer not found" });
  }

  // garante campos mais recentes para idempotência (paymentNotifiedAt / confirmedNotifiedAt)
  const offer = (await Offer.findById(offer0._id).lean()) || offer0;

  const ps = String(offer?.paymentStatus || "")
    .trim()
    .toUpperCase();
  const alreadyConfirmed =
    ps === "CONFIRMED" || ps === "PAID" || !!offer?.paidAt;

  // booking (para enriquecer os e-mails)
  let booking = null;
  try {
    booking = await Booking.findOne({
      offerId: offer._id,
      workspaceId: tenantId,
    })
      .sort({ startAt: -1 })
      .lean();
  } catch {
    booking = null;
  }

  // Se já estava confirmado, ainda assim:
  // - WhatsApp (idempotente via MessageLog)
  // - Email 1: "Pix confirmado" (idempotente via paymentNotifiedAt)
  // - Email 2: "Confirmado na plataforma" (idempotente via confirmedNotifiedAt)
  if (alreadyConfirmed) {
    const notify =
      offer?.notifyWhatsAppOnPaid === true
        ? await safeNotifyPaymentConfirmed(offer._id)
        : { ok: false, status: "SKIPPED", reason: "OFFER_FLAG_DISABLED" };

    const email = await safeNotifySellerPixPaid({
      offer,
      booking,
      now: new Date(),
    });

    const emailConfirmed = await safeNotifySellerConfirmedOnPlatform({
      offer,
      booking,
    });

    console.log("[email] paid confirmed (alreadyConfirmed)", {
      offerId: String(offer._id),
      emailStatus: email?.status,
      emailConfirmedStatus: emailConfirmed?.status,
    });

    return res.json({ ok: true, offer, notify, email, emailConfirmed });
  }

  const hasProof = !!offer?.paymentProof?.storage?.key;
  if (!hasProof) {
    return res.status(409).json({
      ok: false,
      error: "Nenhum comprovante enviado para esta proposta.",
      code: "NO_PROOF",
    });
  }

  const now = new Date();
  const paidAmountCents = computeChargeCentsForManual(offer);

  await Offer.updateOne(
    { _id: offer._id },
    {
      $set: {
        paymentMethod: "MANUAL_PIX",
        paymentStatus: "CONFIRMED",
        status: "CONFIRMED",
        paidAt: now,
        paidAmountCents: paidAmountCents || null,
        confirmedAt: now,
        confirmedByUserId: userId || null,
        rejectedAt: null,
        rejectedByUserId: null,
        rejectionNote: null,
        publicDoneOnly: true,
        publicLockedAt: now.toISOString(),
      },
    },
    { strict: false },
  );

  // atualiza booking, se existir
  if (booking?._id) {
    try {
      await Booking.updateOne(
        { _id: booking._id },
        {
          $set: {
            status: "CONFIRMED",
            "payment.provider": "MANUAL_PIX",
            "payment.status": "CONFIRMED",
            "payment.paidAt": now,
          },
        },
        { strict: false },
      );
    } catch {
      // silencioso
    }
  }

  const updated = await Offer.findById(offer._id).lean();

  // WhatsApp para cliente (se flag ativa)
  const notify =
    updated?.notifyWhatsAppOnPaid === true
      ? await safeNotifyPaymentConfirmed(updated._id)
      : { ok: false, status: "SKIPPED", reason: "OFFER_FLAG_DISABLED" };

  // ✅ Email 1: template antigo "Pagamento Pix confirmado" (+ anexo opcional)
  const email = await safeNotifySellerPixPaid({
    offer: updated,
    booking,
    now,
  });

  // ✅ Email 2: estilo do "Comprovante recebido", porém "confirmado na plataforma"
  const emailConfirmed = await safeNotifySellerConfirmedOnPlatform({
    offer: updated,
    booking,
  });

  console.log("[email] paid confirmed", {
    offerId: String(updated._id),
    emailStatus: email?.status,
    emailConfirmedStatus: emailConfirmed?.status,
  });

  return res.json({ ok: true, offer: updated, notify, email, emailConfirmed });
}

r.post(
  "/offers/:id/confirm-payment",
  ensureAuth,
  tenantFromUser,
  asyncHandler(confirmPaymentHandler),
);

// Alias PATCH (seu frontend pode preferir PATCH)
r.patch(
  "/offers/:id/confirm-payment",
  ensureAuth,
  tenantFromUser,
  asyncHandler(confirmPaymentHandler),
);

r.post(
  "/offers/:id/reject-payment",
  ensureAuth,
  tenantFromUser,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId;
    const userId = req.user?._id;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ ok: false, error: "invalid id" });
    }

    const reason = String(req.body?.reason || req.body?.note || "").trim();

    const q = { _id: id, workspaceId: tenantId };
    if (userId) q.ownerUserId = userId;

    const offer = await Offer.findOne(q).lean();
    if (!offer) {
      return res.status(404).json({ ok: false, error: "Offer not found" });
    }

    const ps = String(offer?.paymentStatus || "")
      .trim()
      .toUpperCase();
    const hasProof = !!offer?.paymentProof?.storage?.key;

    if (!hasProof) {
      return res.status(409).json({
        ok: false,
        error: "Nenhum comprovante enviado para esta proposta.",
        code: "NO_PROOF",
      });
    }

    if (ps === "CONFIRMED" || ps === "PAID" || offer?.paidAt) {
      return res.status(409).json({
        ok: false,
        error: "Pagamento já confirmado — não é possível recusar.",
        code: "ALREADY_CONFIRMED",
      });
    }

    const now = new Date();

    await Offer.updateOne(
      { _id: offer._id },
      {
        $set: {
          paymentMethod: "MANUAL_PIX",
          paymentStatus: "REJECTED",
          rejectedAt: now,
          rejectedByUserId: userId || null,
          rejectionNote: reason || null,
        },
      },
      { strict: false },
    );

    const publicUrl = String(req.body?.publicUrl || "").trim();

    const updated = await Offer.findById(offer._id).lean();

    let notify = {
      ok: false,
      status: "SKIPPED",
      reason: "OFFER_FLAG_DISABLED",
    };
    if (updated?.notifyWhatsAppOnPaid === true) {
      try {
        notify = await notifyPaymentRejected(updated._id, {
          reason,
          publicUrl,
        });
      } catch (e) {
        notify = {
          ok: false,
          status: "FAILED",
          error: { message: String(e?.message || "Falha ao notificar") },
        };
      }
    }

    return res.json({ ok: true, offer: updated, notify });
  }),
);

// CREATE
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

    if (!isNonEmpty(customerName) && !isNonEmpty(customerId)) {
      return res
        .status(400)
        .json({ ok: false, error: "customerName or customerId required" });
    }

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
