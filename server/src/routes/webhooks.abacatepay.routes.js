import express from "express";
import crypto from "node:crypto";
import mongoose from "mongoose";

import { abacateCheckPix } from "../services/abacatepayClient.js";
import { Offer } from "../models/Offer.js";
import * as BookingModule from "../models/Booking.js";
import Withdraw from "../models/Withdraw.js";
import WebhookEvent from "../models/WebhookEvent.js";
import { debitPix } from "../utils/pixQuota.js";

const Booking = BookingModule.Booking || BookingModule.default;

const router = express.Router();

// Public HMAC key (AbacatePay)
const ABACATEPAY_PUBLIC_KEY =
  "t9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9";

function verifyAbacateSignature(rawBody, signatureFromHeader) {
  if (!rawBody || !signatureFromHeader) return false;

  const bodyBuffer = Buffer.isBuffer(rawBody)
    ? rawBody
    : Buffer.from(String(rawBody), "utf8");

  const expectedSig = crypto
    .createHmac("sha256", ABACATEPAY_PUBLIC_KEY)
    .update(bodyBuffer)
    .digest("base64");

  const A = Buffer.from(expectedSig);
  const B = Buffer.from(String(signatureFromHeader));

  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

function isValidObjectId(v) {
  return !!v && mongoose.isValidObjectId(String(v));
}

function pickPixData(d) {
  const pix = d?.data?.pixQrCode || d?.pixQrCode || d;
  if (!pix) return null;
  return {
    id: pix?.id,
    status: String(pix?.status || "")
      .trim()
      .toUpperCase(),
    createdAt: pix?.createdAt,
    expiresAt: pix?.expiresAt,
    expiresIn: pix?.expiresIn,
    metadata: pix?.metadata || {},
  };
}

function computeExpiresAtIso(pix) {
  if (!pix) return null;

  if (pix.expiresAt) {
    const dt = new Date(pix.expiresAt);
    return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
  }

  if (pix.createdAt && Number.isFinite(Number(pix.expiresIn))) {
    const created = new Date(pix.createdAt);
    if (!Number.isNaN(created.getTime())) {
      const ms = created.getTime() + Number(pix.expiresIn) * 1000;
      return new Date(ms).toISOString();
    }
  }

  return null;
}

async function updateOfferPayment(offerId, patch) {
  const $set = {};
  for (const [k, v] of Object.entries(patch || {})) {
    if (v === undefined) continue;
    $set[`payment.${k}`] = v;
  }
  if (Object.keys($set).length === 0) return;

  await Offer.updateOne({ _id: offerId }, { $set }, { strict: false }).catch(
    () => {},
  );
}

async function updateBooking(bookingId, patch) {
  if (!Booking) return;
  await Booking.updateOne(
    { _id: bookingId },
    { $set: patch },
    { strict: false },
  ).catch(() => {});
}

/**
 * Opcional: se você tiver OfferLocked no projeto, tenta upsert sem quebrar build caso não exista.
 */
async function tryUpsertOfferLocked(offerId, paidAtIso, pix) {
  try {
    const mod = await import("../models/OfferLocked.js");
    const OfferLocked = mod?.OfferLocked || mod?.default;
    if (!OfferLocked) return;

    await OfferLocked.updateOne(
      { offerId },
      {
        $set: {
          offerId,
          status: "paid",
          paidAt: paidAtIso,
          publicLockedAt: paidAtIso,
          paidPix: {
            id: pix?.id,
            status: pix?.status,
            expiresAt: pix?.expiresAt || undefined,
            metadata: pix?.metadata || undefined,
          },
        },
      },
      { upsert: true, strict: false },
    ).catch(() => {});
  } catch {
    // model não existe -> ignora
  }
}

async function markAsPaidFromWebhook({ offer, booking, pix }) {
  const now = new Date();
  const paidAtIso = now.toISOString();

  // Offer -> PAID
  const offerSet = { status: "PAID", paidAt: now };

  if (booking?._id) {
    offerSet.bookingId = booking._id;
    offerSet.scheduledStartAt = booking.startAt || booking.scheduledStartAt;
    offerSet.scheduledEndAt = booking.endAt || booking.scheduledEndAt;
  }

  await Offer.updateOne(
    { _id: offer._id },
    { $set: offerSet },
    { strict: false },
  ).catch(() => {});

  // Payment status no Offer
  await updateOfferPayment(offer._id, {
    lastPixId: pix?.id,
    lastPixStatus: "PAID",
    lastPixExpiresAt: computeExpiresAtIso(pix) || undefined,
    lastPixUpdatedAt: now,
  });

  // Booking -> CONFIRMED + payment PAID
  if (booking?._id && isValidObjectId(booking._id)) {
    await updateBooking(booking._id, {
      status: "CONFIRMED",
      payment: {
        provider: "ABACATEPAY",
        providerPaymentId: pix?.id,
        status: "PAID",
        paidAt: now,
      },
    });
  }

  await tryUpsertOfferLocked(offer._id, paidAtIso, pix);

  return paidAtIso;
}

async function resolveOfferAndBookingFromPix({ pixId, pix }) {
  const meta = pix?.metadata || {};
  const externalId = meta?.externalId; // bookingId OU publicToken
  const publicTokenFromMeta = meta?.publicToken;
  const offerIdFromMeta = meta?.offerId;

  // 1) tenta Offer por pixId já registrado
  let offer = await Offer.findOne({ "payment.lastPixId": pixId }).lean();

  // 2) tenta Offer por offerId (se tiver)
  if (!offer && offerIdFromMeta && isValidObjectId(offerIdFromMeta)) {
    offer = await Offer.findById(offerIdFromMeta).lean();
  }

  // 3) tenta Booking por externalId (se for ObjectId)
  let booking = null;
  if (Booking && externalId && isValidObjectId(externalId)) {
    booking = await Booking.findById(externalId).lean();
  }

  // 4) tenta Booking pelo providerPaymentId
  if (!booking && Booking) {
    booking = await Booking.findOne({
      "payment.providerPaymentId": pixId,
    }).lean();
  }

  // 5) se achou Booking, resolve Offer pelo offerId
  if (!offer && booking?.offerId) {
    offer = await Offer.findById(booking.offerId).lean();
  }

  // 6) pagamento direto de produto: externalId/publicToken aponta pra Offer.publicToken
  if (!offer) {
    const token =
      publicTokenFromMeta ||
      (externalId && !isValidObjectId(externalId) ? externalId : null);
    if (token) offer = await Offer.findOne({ publicToken: token }).lean();
  }

  return { offer, booking };
}

async function handleBillingPaid(event) {
  const pixId =
    event?.data?.pixQrCode?.id ||
    event?.data?.pix_qr_code?.id ||
    event?.data?.pixQrCodeId;

  if (!pixId) {
    const err = new Error("Webhook billing.paid sem pixQrCode.id");
    err.status = 400;
    throw err;
  }

  // Confirma no API da AbacatePay (verificação “de fato”)
  const chk = await abacateCheckPix({ pixId });
  const pix = pickPixData(chk);

  if (!pix?.id) {
    const err = new Error("Falha ao validar PIX no AbacatePay");
    err.status = 502;
    throw err;
  }

  const { offer, booking } = await resolveOfferAndBookingFromPix({
    pixId,
    pix,
  });

  // Se não conseguir mapear, responde 200 (evita retry infinito), mas registra no log
  if (!offer) {
    return { ok: true, mapped: false, pixStatus: pix.status };
  }

  // Sempre atualiza o “lastPixStatus” do Offer
  await updateOfferPayment(offer._id, {
    lastPixId: pix.id,
    lastPixStatus: pix.status || event?.data?.pixQrCode?.status,
    lastPixExpiresAt: computeExpiresAtIso(pix) || undefined,
    lastPixUpdatedAt: new Date(),
  });

  // Só marca como pago se estiver PAID no check
  if (pix.status === "PAID") {
    await markAsPaidFromWebhook({ offer, booking, pix });

    // ✅ Pix quota: debita 1 por Pix pago (idempotente e atômico)
    try {
      const wsId = offer?.workspaceId ? String(offer.workspaceId) : "";
      const paymentId = String(pix?.id || "").trim();
      if (wsId && paymentId) {
        await debitPix(wsId, paymentId);
      }
    } catch (err) {
      console.warn(
        "[abacatepay webhook] quota debit failed",
        err?.message || err,
      );
    }

    return { ok: true, mapped: true, markedPaid: true };
  }

  return { ok: true, mapped: true, markedPaid: false, pixStatus: pix.status };
}

async function handleWithdrawEvent(event) {
  const tx = event?.data?.transaction;
  if (!tx?.externalId) {
    const err = new Error("Webhook withdraw.* sem transaction.externalId");
    err.status = 400;
    throw err;
  }

  const patch = {
    providerTransactionId: tx.id,
    status: tx.status,
    receiptUrl: tx.receiptUrl,
  };

  const updated = await Withdraw.findOneAndUpdate(
    { externalId: tx.externalId },
    { $set: patch },
    { new: true },
  )
    .lean()
    .catch(() => null);

  return { ok: true, mapped: !!updated, status: tx.status };
}

router.post("/webhooks/abacatepay", async (req, res, next) => {
  try {
    // ✅ LOG: chegou request (antes de validar, sem expor segredo)
    console.log("[abacatepay webhook] incoming", {
      method: req.method,
      url: req.originalUrl,
      hasWebhookSecret: !!req.query?.webhookSecret,
      hasSignature: !!req.get("X-Webhook-Signature"),
      rawBodyBytes: req.rawBody?.length || 0,
      at: new Date().toISOString(),
    });

    // 1) Secret na URL
    const webhookSecret = req.query.webhookSecret;
    const expectedSecret = process.env.ABACATEPAY_WEBHOOK_SECRET;

    console.log("meu env. " + expectedSecret);
    console.log("o que vem na url + " + webhookSecret);

    if (expectedSecret && webhookSecret !== expectedSecret) {
      console.log("[abacatepay webhook] rejected: invalid secret", {
        url: req.originalUrl,
        at: new Date().toISOString(),
      });
      return res
        .status(401)
        .json({ ok: false, error: "Invalid webhook secret" });
    }

    // 2) Assinatura HMAC (precisa do rawBody)
    const signature = req.get("X-Webhook-Signature") || "";

    if (!req.rawBody) {
      console.log("[abacatepay webhook] rejected: missing rawBody", {
        url: req.originalUrl,
        at: new Date().toISOString(),
      });
      return res.status(400).json({
        ok: false,
        error: "Missing rawBody for signature verification",
      });
    }

    const sigOk = verifyAbacateSignature(req.rawBody, signature);
    if (!sigOk) {
      console.log("[abacatepay webhook] rejected: invalid signature", {
        url: req.originalUrl,
        at: new Date().toISOString(),
      });
      return res.status(401).json({ ok: false, error: "Invalid signature" });
    }

    const event = req.body || {};
    const eventId = String(event.id || "").trim();
    const eventType = String(event.event || "").trim();

    // ✅ LOG: evento parseado
    console.log("[abacatepay webhook] event", {
      eventType,
      eventId,
      devMode: !!event.devMode,
      at: new Date().toISOString(),
    });

    if (!eventId || !eventType) {
      return res
        .status(400)
        .json({ ok: false, error: "Invalid webhook payload" });
    }

    // Idempotência: processa cada evento uma única vez
    const already = await WebhookEvent.findOne({ eventId }).lean();
    if (already) {
      console.log("[abacatepay webhook] duplicate ignored", {
        eventType,
        eventId,
        at: new Date().toISOString(),
      });
      return res
        .status(200)
        .json({ ok: true, received: true, duplicate: true });
    }

    const log = await WebhookEvent.create({
      eventId,
      event: eventType,
      devMode: !!event.devMode,
      payload: event,
      receivedAt: new Date(),
      ok: false,
    });

    let result = { ok: true };

    if (eventType === "billing.paid") {
      result = await handleBillingPaid(event);
    } else if (
      eventType === "withdraw.done" ||
      eventType === "withdraw.failed"
    ) {
      result = await handleWithdrawEvent(event);
    }

    await WebhookEvent.updateOne(
      { _id: log._id },
      { $set: { ok: true, processedAt: new Date(), result } },
      { strict: false },
    ).catch(() => {});

    // ✅ LOG: processado
    console.log("[abacatepay webhook] processed", {
      eventType,
      eventId,
      result,
      at: new Date().toISOString(),
    });

    return res.status(200).json({ ok: true, received: true });
  } catch (e) {
    console.error("[abacatepay webhook] error", e);
    return next(e);
  }
});

export default router;
