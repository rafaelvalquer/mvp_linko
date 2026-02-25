// server/src/routes/webhooks.abacatepay.routes.js
import express from "express";
import crypto from "node:crypto";
import mongoose from "mongoose";

import {
  abacateCheckPix,
  abacateCreateWithdraw,
} from "../services/abacatepayClient.js";

import { Offer } from "../models/Offer.js";
import * as BookingModule from "../models/Booking.js";
import Withdraw from "../models/Withdraw.js";
import WebhookEvent from "../models/WebhookEvent.js";
import { Workspace } from "../models/Workspace.js";
import PixDebit from "../models/PixDebit.js";

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

function normalizeWithdrawStatus(st) {
  const s = String(st || "")
    .trim()
    .toUpperCase();
  if (!s) return "PENDING";
  if (s === "CANCELED") return "CANCELLED";
  if (s === "PAID" || s === "DONE" || s === "COMPLETED" || s === "SUCCESS")
    return "COMPLETE";
  if (s === "FAILED") return "FAILED";
  if (s === "EXPIRED") return "EXPIRED";
  if (s === "REFUNDED") return "REFUNDED";
  if (s === "PROCESSING" || s === "PENDING") return "PENDING";
  return "PENDING";
}

async function updateOfferPayment(offerId, patch) {
  const $set = {};
  for (const [k, v] of Object.entries(patch || {})) {
    if (v === undefined) continue;
    $set[`payment.${k}`] = v;
  }
  if (!Object.keys($set).length) return;
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
    // ignora se não existir
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

  // snapshot Pix
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
  const externalId = meta?.externalId;
  const publicTokenFromMeta = meta?.publicToken;
  const offerIdFromMeta = meta?.offerId;

  // 1) por pixId já registrado
  let offer = await Offer.findOne({ "payment.lastPixId": pixId }).lean();

  // 2) por offerId (se tiver)
  if (!offer && offerIdFromMeta && isValidObjectId(offerIdFromMeta)) {
    offer = await Offer.findById(offerIdFromMeta).lean();
  }

  // 3) Booking por externalId (se for ObjectId)
  let booking = null;
  if (Booking && externalId && isValidObjectId(externalId)) {
    booking = await Booking.findById(externalId).lean();
  }

  // 4) Booking pelo providerPaymentId
  if (!booking && Booking) {
    booking = await Booking.findOne({
      "payment.providerPaymentId": pixId,
    }).lean();
  }

  // 5) se achou Booking, resolve Offer pelo offerId
  if (!offer && booking?.offerId) {
    offer = await Offer.findById(booking.offerId).lean();
  }

  // 6) pagamento direto de produto (token aponta para Offer.publicToken)
  if (!offer) {
    const token =
      publicTokenFromMeta ||
      (externalId && !isValidObjectId(externalId) ? externalId : null);
    if (token) offer = await Offer.findOne({ publicToken: token }).lean();
  }

  return { offer, booking };
}

function toProviderPixType(workspacePixType) {
  const t = String(workspacePixType || "")
    .trim()
    .toUpperCase();
  if (t === "EVP") return "RANDOM";
  return t;
}

function centsFromOffer(offer) {
  const v =
    offer?.amountCents ??
    offer?.totalCents ??
    offer?.payment?.amountCents ??
    offer?.payment?.grossAmountCents ??
    0;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * ✅ crédito idempotente: key = credit:pixPaid:<paymentId>
 */
async function creditWalletIdempotent({
  workspaceId,
  offerId,
  paymentId,
  amountCents,
}) {
  const wid = String(workspaceId || "").trim();
  const pid = String(paymentId || "").trim();
  const cents = Math.round(Number(amountCents) || 0);
  if (!wid || !pid || cents <= 0) return { ok: false, credited: false };

  const key = `credit:pixPaid:${pid}`;
  const session = await mongoose.startSession();

  try {
    let already = false;

    await session.withTransaction(async () => {
      try {
        await PixDebit.create(
          [
            {
              workspaceId: wid,
              kind: "WALLET_CREDIT",
              key,
              offerId: offerId || null,
              paymentId: pid,
              amountCents: cents,
              status: "APPLIED",
            },
          ],
          { session },
        );
      } catch (e) {
        if (e?.code === 11000) {
          already = true;
          return;
        }
        throw e;
      }

      await Workspace.updateOne(
        { _id: wid },
        { $inc: { walletAvailableCents: cents } },
        { session },
      );
    });

    const wsAfter = await Workspace.findById(wid)
      .select(
        "walletAvailableCents autoPayoutEnabled autoPayoutMinCents payoutPixKeyMasked payoutPixKeyType",
      )
      .lean()
      .catch(() => null);

    return {
      ok: true,
      credited: !already,
      alreadyProcessed: already,
      walletAvailableCents: Number(wsAfter?.walletAvailableCents || 0),
      autoPayoutEnabled: !!wsAfter?.autoPayoutEnabled,
      autoPayoutMinCents: Number(wsAfter?.autoPayoutMinCents || 0),
      payoutPixKeyMasked: wsAfter?.payoutPixKeyMasked || null,
      payoutPixKeyType: wsAfter?.payoutPixKeyType || null,
    };
  } finally {
    session.endSession();
  }
}

async function safeRevertWallet({ workspaceId, ownerUserId, amountCents }) {
  const wid = String(workspaceId || "").trim();
  const oid = String(ownerUserId || "").trim();
  const cents = Math.round(Number(amountCents) || 0);
  if (!wid || !oid || cents <= 0) return;

  await Workspace.updateOne(
    { _id: wid, ownerUserId: oid },
    { $inc: { walletAvailableCents: cents } },
  ).catch(() => {});
}

async function markDebitReverted({ workspaceId, withdrawId }) {
  if (!workspaceId || !withdrawId) return;

  await PixDebit.updateMany(
    {
      workspaceId,
      withdrawId,
      kind: { $in: ["AUTO_PAYOUT", "MANUAL_WITHDRAW"] },
      status: { $in: ["CREATED", "APPLIED"] },
    },
    { $set: { status: "REVERTED" } },
  ).catch(() => {});
}

/**
 * ✅ auto payout idempotente: key = autowithdraw:pixPaid:<paymentId>
 * - debita wallet ANTES do gateway
 * - se gateway falhar, estorna e marca REVERTED/FAILED
 */
async function tryAutoPayout({ workspaceId, offerId, paymentId, amountCents }) {
  const wid = String(workspaceId || "").trim();
  const pid = String(paymentId || "").trim();
  const cents = Math.round(Number(amountCents) || 0);
  if (!wid || !pid || cents <= 0) return { ok: false, skipped: true };

  const ws = await Workspace.findById(wid)
    .select(
      "+payoutPixKey ownerUserId walletAvailableCents payoutPixKeyType payoutPixKeyMasked autoPayoutEnabled autoPayoutMinCents",
    )
    .lean()
    .catch(() => null);

  if (!ws) return { ok: false, skipped: true };
  if (!ws.autoPayoutEnabled)
    return { ok: true, skipped: true, reason: "auto_disabled" };
  if (!ws.payoutPixKeyType || !ws.payoutPixKey)
    return { ok: true, skipped: true, reason: "no_pix_key" };

  const min = Math.round(Number(ws.autoPayoutMinCents || 0));
  if (Number.isFinite(min) && min > 0 && cents < min) {
    return { ok: true, skipped: true, reason: "below_min" };
  }

  const providerPixType = toProviderPixType(ws.payoutPixKeyType);
  const pixMasked = ws.payoutPixKeyMasked || "";

  const ledgerKey = `autowithdraw:pixPaid:${pid}`;
  let ledgerDoc = null;

  try {
    ledgerDoc = await PixDebit.create({
      workspaceId: wid,
      kind: "AUTO_PAYOUT",
      key: ledgerKey,
      offerId: offerId || null,
      paymentId: pid,
      amountCents: cents,
      status: "CREATED",
      meta: { at: new Date().toISOString() },
    });
  } catch (e) {
    if (e?.code === 11000)
      return { ok: true, skipped: true, reason: "already_processed" };
    throw e;
  }

  const externalId = `autowithdraw_${wid}_${pid}`;

  let withdrawDoc =
    (await Withdraw.findOne({ externalId, workspaceId: wid })
      .lean()
      .catch(() => null)) ||
    (await Withdraw.create({
      workspaceId: wid,
      ownerUserId: ws.ownerUserId,
      externalId,
      requestedBy: "AUTO",
      method: "PIX",
      grossAmountCents: cents,
      feePct: 0,
      feeCents: 0,
      netAmountCents: cents,
      destinationPixKeyType: ws.payoutPixKeyType,
      destinationPixKeyMasked: pixMasked,
      pix: { type: providerPixType, key: pixMasked },
      description: "Auto saque (Pix confirmado)",
      provider: "ABACATEPAY",
      status: "PENDING",
      ledgerDebited: false,
      balanceReverted: false,
    }));

  // ✅ debita wallet antes do gateway
  const debitedWs = await Workspace.findOneAndUpdate(
    { _id: wid, walletAvailableCents: { $gte: cents } },
    { $inc: { walletAvailableCents: -cents } },
    { new: true },
  ).lean();

  if (!debitedWs) {
    await Withdraw.updateOne(
      { _id: withdrawDoc._id },
      {
        $set: {
          status: "FAILED",
          error: {
            code: "INSUFFICIENT_FUNDS",
            message: "Saldo insuficiente para auto saque.",
          },
        },
      },
    ).catch(() => {});

    await PixDebit.updateOne(
      { _id: ledgerDoc._id },
      {
        $set: {
          status: "FAILED",
          reason: "insufficient_funds",
          withdrawId: withdrawDoc._id,
        },
      },
    ).catch(() => {});

    return { ok: true, skipped: true, reason: "insufficient_funds" };
  }

  await Withdraw.updateOne(
    { _id: withdrawDoc._id },
    { $set: { ledgerDebited: true } },
  ).catch(() => {});
  await PixDebit.updateOne(
    { _id: ledgerDoc._id },
    { $set: { status: "APPLIED", withdrawId: withdrawDoc._id } },
  ).catch(() => {});

  // chama gateway
  let createResp;
  try {
    createResp = await abacateCreateWithdraw({
      externalId,
      amount: cents,
      pix: { type: providerPixType, key: ws.payoutPixKey },
      description: "Auto saque (Pix confirmado)",
    });
  } catch (err) {
    await safeRevertWallet({
      workspaceId: wid,
      ownerUserId: ws.ownerUserId,
      amountCents: cents,
    });
    await markDebitReverted({ workspaceId: wid, withdrawId: withdrawDoc._id });

    await Withdraw.updateOne(
      { _id: withdrawDoc._id },
      {
        $set: {
          status: "FAILED",
          balanceReverted: true,
          error: {
            code: "GATEWAY_CREATE_FAILED",
            message: err?.message || "Falha ao criar auto saque no gateway.",
          },
          gateway: { lastError: err?.details || err?.message || String(err) },
        },
      },
    ).catch(() => {});

    return { ok: true, failed: true, error: err?.message || String(err) };
  }

  const data = createResp?.data ?? createResp ?? {};
  const status = normalizeWithdrawStatus(data.status || "PENDING");
  const receiptUrl = data.receiptUrl || data.receipt_url || "";
  const providerTransactionId =
    data.id || data.withdrawId || data.transactionId || "";

  await Withdraw.updateOne(
    { _id: withdrawDoc._id },
    {
      $set: {
        status,
        receiptUrl,
        providerTransactionId,
        gateway: { rawCreateResponse: createResp },
      },
    },
    { strict: false },
  ).catch(() => {});

  return {
    ok: true,
    transferred: true,
    walletAvailableCents: Number(debitedWs.walletAvailableCents || 0),
  };
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

  // confirma no AbacatePay (status real)
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

  // não mapeou -> responde 200 (evita retry infinito)
  if (!offer) return { ok: true, mapped: false, pixStatus: pix.status };

  // sempre atualiza snapshot do pix na offer
  await updateOfferPayment(offer._id, {
    lastPixId: pix.id,
    lastPixStatus: pix.status || event?.data?.pixQrCode?.status,
    lastPixExpiresAt: computeExpiresAtIso(pix) || undefined,
    lastPixUpdatedAt: new Date(),
  });

  if (pix.status !== "PAID") {
    return { ok: true, mapped: true, markedPaid: false, pixStatus: pix.status };
  }

  // marca como pago (idempotente pelo estado da Offer)
  await markAsPaidFromWebhook({ offer, booking, pix });

  // ✅ quota Pix (idempotente pelo PixDebit legado)
  try {
    const wsId = offer?.workspaceId ? String(offer.workspaceId) : "";
    const paymentId = String(pix?.id || "").trim();
    if (wsId && paymentId) await debitPix(wsId, paymentId);
  } catch (err) {
    console.warn(
      "[abacatepay webhook] quota debit failed",
      err?.message || err,
    );
  }

  // ✅ wallet credit + auto payout (não bloqueia confirmação do pagamento)
  try {
    const wsId = offer?.workspaceId ? String(offer.workspaceId) : "";
    const paymentId = String(pix?.id || "").trim();
    const netCents = centsFromOffer(offer);

    console.log("wsId = " + wsId);
    console.log("paymentId = " + paymentId);
    console.log("netCents = " + netCents);

    if (wsId && paymentId && netCents > 0) {
      await creditWalletIdempotent({
        workspaceId: wsId,
        offerId: offer?._id,
        paymentId,
        amountCents: netCents,
      });

      try {
        await tryAutoPayout({
          workspaceId: wsId,
          offerId: offer?._id,
          paymentId,
          amountCents: netCents,
        });
      } catch (err) {
        console.warn(
          "[abacatepay webhook] auto payout failed",
          err?.message || err,
        );
      }
    }
  } catch (err) {
    console.warn(
      "[abacatepay webhook] wallet credit failed",
      err?.message || err,
    );
  }

  return { ok: true, mapped: true, markedPaid: true };
}

async function handleWithdrawEvent(event) {
  const tx = event?.data?.transaction;
  if (!tx?.externalId) {
    const err = new Error("Webhook withdraw.* sem transaction.externalId");
    err.status = 400;
    throw err;
  }

  const externalId = String(tx.externalId || "").trim();
  const status = normalizeWithdrawStatus(tx.status);

  const patch = {
    providerTransactionId: tx.id,
    status,
    receiptUrl: tx.receiptUrl,
  };

  const updated = await Withdraw.findOneAndUpdate(
    { externalId },
    { $set: patch },
    { new: true },
  )
    .lean()
    .catch(() => null);

  // se falhou no gateway depois de já ter debitado a wallet, estorna uma vez
  if (updated) {
    const isFail =
      status === "FAILED" ||
      status === "CANCELLED" ||
      status === "EXPIRED" ||
      status === "REFUNDED";
    if (isFail && updated.ledgerDebited && !updated.balanceReverted) {
      await safeRevertWallet({
        workspaceId: updated.workspaceId,
        ownerUserId: updated.ownerUserId,
        amountCents: updated.netAmountCents,
      });

      await markDebitReverted({
        workspaceId: String(updated.workspaceId),
        withdrawId: updated._id,
      });

      await Withdraw.updateOne(
        { _id: updated._id },
        { $set: { balanceReverted: true } },
      ).catch(() => {});
    }
  }

  return { ok: true, mapped: !!updated, status: tx.status };
}

router.post("/webhooks/abacatepay", async (req, res, next) => {
  try {
    // 1) secret na URL
    const webhookSecret = req.query.webhookSecret;
    const expectedSecret = process.env.ABACATEPAY_WEBHOOK_SECRET;

    if (expectedSecret && webhookSecret !== expectedSecret) {
      return res
        .status(401)
        .json({ ok: false, error: "Invalid webhook secret" });
    }

    // 2) assinatura HMAC (precisa rawBody)
    const signature = req.get("X-Webhook-Signature") || "";
    if (!req.rawBody) {
      return res.status(400).json({
        ok: false,
        error: "Missing rawBody for signature verification",
      });
    }

    const sigOk = verifyAbacateSignature(req.rawBody, signature);
    if (!sigOk)
      return res.status(401).json({ ok: false, error: "Invalid signature" });

    const event = req.body || {};
    const eventId = String(event.id || "").trim();
    const eventType = String(event.event || "").trim();

    if (!eventId || !eventType) {
      return res
        .status(400)
        .json({ ok: false, error: "Invalid webhook payload" });
    }

    // Idempotência por eventId
    const already = await WebhookEvent.findOne({ eventId }).lean();
    if (already) {
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

    return res.status(200).json({ ok: true, received: true });
  } catch (e) {
    return next(e);
  }
});

export default router;
