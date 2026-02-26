import express from "express";
import crypto from "node:crypto";
import mongoose from "mongoose";

import { abacateCreateWithdraw } from "../services/abacatepayClient.js";
import { Offer } from "../models/Offer.js";
import { Workspace } from "../models/Workspace.js";
import PixDebit from "../models/PixDebit.js";

import * as BookingModule from "../models/Booking.js";
import Withdraw from "../models/Withdraw.js";
import WebhookEvent from "../models/WebhookEvent.js";
import { debitPix } from "../utils/pixQuota.js";

const Booking = BookingModule.Booking || BookingModule.default;

const router = express.Router();

const ABACATEPAY_API_BASE =
  String(process.env.ABACATEPAY_API_BASE || process.env.ABACATEPAY_API_URL || "").trim() ||
  "https://api.abacatepay.com/v1";

async function abacatePixQrCodeCheck({ pixId }) {
  const id = String(pixId || "").trim();
  if (!id) throw new Error("pixId obrigatório.");

  const token = process.env.ABACATEPAY_TOKEN;
  if (!token) throw new Error("AbacatePay não configurado (ABACATEPAY_TOKEN ausente).");

  const url = `${ABACATEPAY_API_BASE}/pixQrCode/check?id=${encodeURIComponent(id)}`;
  const r = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const j = await r.json().catch(() => ({}));

  if (!r.ok || j?.error) {
    const msg = j?.error || `Falha ao checar Pix (${r.status})`;
    const err = new Error(msg);
    err.statusCode = 502;
    throw err;
  }

  // normaliza para o shape legado (pickPixData)
  return {
    data: {
      pixQrCode: {
        id,
        status: j?.data?.status,
        expiresAt: j?.data?.expiresAt,
      },
    },
    error: null,
  };
}

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

function onlyDigits(v) {
  return String(v || "").replace(/\D+/g, "");
}

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function normalizePixKey(type, key) {
  const t = String(type || "").trim().toUpperCase();
  const raw = String(key || "").trim();
  if (!raw) return "";

  if (t === "CPF" || t === "CNPJ" || t === "PHONE") return onlyDigits(raw);
  if (t === "EMAIL") return normalizeEmail(raw);
  if (t === "EVP") return raw.trim();
  return raw.trim();
}

function maskDigits(digits, keepStart = 0, keepEnd = 2) {
  const s = onlyDigits(digits);
  if (!s) return "";
  const a = s.slice(0, keepStart);
  const b = s.slice(-keepEnd);
  const midLen = Math.max(0, s.length - keepStart - keepEnd);
  return a + "*".repeat(midLen) + b;
}

function maskEmail(email) {
  const e = normalizeEmail(email);
  if (!e || !e.includes("@")) return "";
  const [user, domain] = e.split("@");
  const u = user.length <= 2 ? user[0] + "*" : user.slice(0, 2) + "*".repeat(Math.max(1, user.length - 2));
  const dparts = String(domain || "").split(".");
  const d0 = dparts[0] ? dparts[0].slice(0, 2) + "*".repeat(Math.max(1, dparts[0].length - 2)) : "***";
  const rest = dparts.slice(1).join(".");
  return `${u}@${d0}${rest ? "." + rest : ""}`;
}

function maskPixKey(type, key) {
  const t = String(type || "").trim().toUpperCase();
  const k = normalizePixKey(t, key);
  if (!k) return "";

  if (t === "CPF") return maskDigits(k, 0, 2);
  if (t === "CNPJ") return maskDigits(k, 0, 3);
  if (t === "PHONE") return maskDigits(k, 0, 4);
  if (t === "EMAIL") return maskEmail(k);
  if (t === "EVP") {
    const s = String(k);
    if (s.length <= 8) return "*".repeat(s.length);
    return `${s.slice(0, 4)}****${s.slice(-4)}`;
  }
  return "***";
}

function gatewayPixTypeFromWorkspaceType(t) {
  const s = String(t || "").trim().toUpperCase();
  if (s === "EVP") return "RANDOM";
  return s;
}

function makeExternalId(workspaceId, prefix = "withdraw") {
  const rand = crypto.randomBytes(4).toString("hex");
  return `${prefix}_${workspaceId}_${Date.now()}_${rand}`;
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

function computePaidAmountCents({ offer, booking }) {
  // 1) preferir valor registrado na reserva (é o valor efetivamente cobrado)
  const b = Number(booking?.payment?.amountCents);
  if (Number.isFinite(b) && b > 0) return Math.round(b);

  // 2) fallback: calcula pela oferta (MVP)
  const totalCents = Number(offer?.totalCents ?? offer?.amountCents ?? 0);
  const total = Number.isFinite(totalCents) ? Math.round(totalCents) : 0;

  const depositEnabled =
    offer?.depositEnabled === undefined ? true : !!offer.depositEnabled;

  const pct = Number(offer?.depositPct ?? 0);
  const dp = Number.isFinite(pct) ? pct : 0;

  if (depositEnabled && dp > 0) {
    const dep = Math.round((total * dp) / 100);
    return dep > 0 ? dep : total;
  }
  return total;
}

async function markAsPaidFromWebhook({ offer, booking, pix }) {
  const now = new Date();
  const paidAtIso = now.toISOString();

  const paidAmountCents = computePaidAmountCents({ offer, booking });

  // idempotência simples: se já estava pago, não muda paidAt
  const current = await Offer.findById(offer._id)
    .select("status paymentStatus paidAt paidAmountCents")
    .lean()
    .catch(() => null);

  const alreadyPaid =
    String(current?.paymentStatus || "").toUpperCase() === "PAID" ||
    String(current?.status || "").toUpperCase() === "PAID" ||
    !!current?.paidAt;

  const stablePaidAt = alreadyPaid && current?.paidAt ? new Date(current.paidAt) : now;

  // Offer -> PAID + paymentStatus PAID
  const offerSet = {
    status: "PAID",
    paymentStatus: "PAID",
    paidAt: stablePaidAt,
    paidAmountCents: current?.paidAmountCents ?? paidAmountCents ?? null,
    publicDoneOnly: true,
    publicLockedAt: stablePaidAt.toISOString(),
  };

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
    lastPixUpdatedAt: stablePaidAt,
  });

  // Booking -> CONFIRMED + payment PAID
  if (booking?._id && isValidObjectId(booking._id)) {
    await updateBooking(booking._id, {
      status: "CONFIRMED",
      payment: {
        provider: "ABACATEPAY",
        providerPaymentId: pix?.id,
        status: "PAID",
        paidAt: stablePaidAt,
      },
    });
  }

  await tryUpsertOfferLocked(offer._id, paidAtIso, pix);

  return { paidAtIso, paidAmountCents };
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

async function creditWalletIdempotent({ workspaceId, offerId, paymentId, netCents }) {
  if (!workspaceId || !paymentId) return { ok: false, skipped: true };
  if (!Number.isFinite(Number(netCents)) || Number(netCents) <= 0) return { ok: false, skipped: true };

  const key = `credit:paid:${paymentId}`;

  // cria ledger idempotente
  try {
    await PixDebit.create({
      workspaceId,
      offerId,
      paymentId,
      key,
      kind: "WALLET_CREDIT",
      amountCents: Math.round(Number(netCents)),
      status: "APPLIED",
    });
  } catch (e) {
    if (e?.code === 11000) return { ok: true, duplicated: true };
    throw e;
  }

  await Workspace.updateOne(
    { _id: workspaceId },
    { $inc: { walletAvailableCents: Math.round(Number(netCents)) } },
  ).catch(() => {});

  return { ok: true, credited: true };
}

async function autoPayoutIfEnabled({ workspaceId, ownerUserId, paymentId, netCents }) {
  if (!workspaceId || !paymentId) return { ok: false, skipped: true };

  const ws = await Workspace.findById(workspaceId)
    .select("walletAvailableCents autoPayoutEnabled autoPayoutMinCents payoutPixKeyType payoutPixKey payoutPixKeyMasked ownerUserId")
    .lean()
    .catch(() => null);

  if (!ws) return { ok: false, skipped: true };

  if (!ws.autoPayoutEnabled) return { ok: true, skipped: true };
  if (!ws.payoutPixKeyType || !ws.payoutPixKey || !ws.payoutPixKeyMasked) {
    return { ok: true, skipped: true };
  }

  const min = Number(ws.autoPayoutMinCents || 0);
  const amt = Math.round(Number(netCents || 0));
  if (!Number.isFinite(amt) || amt <= 0) return { ok: true, skipped: true };
  if (amt < min) return { ok: true, skipped: true };

  const autoKey = `auto:paid:${paymentId}`;

  // idempotência: cria ledger do auto payout
  let autoDebit;
  try {
    autoDebit = await PixDebit.create({
      workspaceId,
      paymentId,
      key: autoKey,
      kind: "AUTO_PAYOUT",
      amountCents: amt,
      status: "APPLIED",
    });
  } catch (e) {
    if (e?.code === 11000) return { ok: true, duplicated: true };
    throw e;
  }

  // ✅ debita wallet ANTES do gateway (atômico)
  const debitedWs = await Workspace.findOneAndUpdate(
    { _id: workspaceId, walletAvailableCents: { $gte: amt } },
    { $inc: { walletAvailableCents: -amt } },
    { new: true },
  )
    .select("walletAvailableCents")
    .lean()
    .catch(() => null);

  if (!debitedWs) {
    await PixDebit.updateOne(
      { workspaceId, key: autoKey },
      { $set: { status: "FAILED", reason: "INSUFFICIENT_WALLET" } },
      { strict: false },
    ).catch(() => {});
    return { ok: false, skipped: true, reason: "INSUFFICIENT_WALLET" };
  }

  const externalId = makeExternalId(workspaceId, "auto_withdraw");

  // cria withdraw local
  const wdoc = await Withdraw.create({
    workspaceId,
    ownerUserId: ws.ownerUserId || ownerUserId || null,
    requestedBy: "AUTO",
    externalId,
    method: "PIX",
    amountCents: amt,
    grossAmountCents: amt,
    feePct: 0,
    feeCents: 0,
    netAmountCents: amt,
    destinationPixKeyType: ws.payoutPixKeyType,
    destinationPixKeyMasked: ws.payoutPixKeyMasked,
    pix: { type: ws.payoutPixKeyType, key: ws.payoutPixKeyMasked },
    description: "Transferência automática (Pix confirmado)",
    provider: "ABACATEPAY",
    status: "PENDING",
  }).catch(() => null);

  if (wdoc?._id) {
    await PixDebit.updateOne(
      { workspaceId, key: autoKey },
      { $set: { withdrawId: wdoc._id } },
      { strict: false },
    ).catch(() => {});
  }

  // chama gateway
  try {
    const createResp = await abacateCreateWithdraw({
      externalId,
      amount: amt,
      pix: { type: gatewayPixTypeFromWorkspaceType(ws.payoutPixKeyType), key: String(ws.payoutPixKey) },
      description: "Transferência automática (Pix confirmado)",
    });

    const data = createResp?.data ?? createResp ?? {};
    const status = String(data.status || "PENDING").toUpperCase();
    const receiptUrl = data.receiptUrl || data.receipt_url || "";
    const providerTransactionId =
      data.id || data.withdrawId || data.transactionId || "";

    await Withdraw.updateOne(
      { _id: wdoc?._id },
      {
        $set: {
          providerTransactionId,
          status,
          receiptUrl,
          devMode: Boolean(data.devMode),
          gateway: { rawCreateResponse: createResp },
        },
      },
      { strict: false },
    ).catch(() => {});

    return { ok: true, created: true, externalId, status };
  } catch (err) {
    // estorno wallet
    await Workspace.updateOne(
      { _id: workspaceId },
      { $inc: { walletAvailableCents: amt } },
    ).catch(() => {});

    await PixDebit.updateOne(
      { workspaceId, key: autoKey },
      {
        $set: {
          status: "REVERTED",
          reason: err?.message || "gateway_create_failed",
          meta: { gatewayError: err?.details || err?.message || String(err) },
        },
      },
      { strict: false },
    ).catch(() => {});

    await Withdraw.updateOne(
      { _id: wdoc?._id },
      {
        $set: {
          status: "FAILED",
          error: err?.message || "Falha ao criar saque no gateway.",
          gateway: { lastError: err?.details || err?.message || String(err) },
        },
      },
      { strict: false },
    ).catch(() => {});

    return { ok: false, failed: true, error: err?.message || String(err) };
  }
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
  const chk = await abacatePixQrCodeCheck({ pixId });
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
    const { paidAmountCents } = await markAsPaidFromWebhook({ offer, booking, pix });

    // ✅ Wallet: credita SOMENTE quando pagamento confirmado (idempotente por paymentId)
    try {
      const wsId = offer?.workspaceId ? String(offer.workspaceId) : "";
      const paymentId = String(pix?.id || "").trim();
      if (wsId && paymentId) {
        await creditWalletIdempotent({
          workspaceId: wsId,
          offerId: offer._id,
          paymentId,
          netCents: paidAmountCents,
        });

        // ✅ Auto payout (idempotente por paymentId)
        await autoPayoutIfEnabled({
          workspaceId: wsId,
          ownerUserId: offer?.ownerUserId ? String(offer.ownerUserId) : null,
          paymentId,
          netCents: paidAmountCents,
        });
      }
    } catch (err) {
      console.warn("[abacatepay webhook] wallet/auto payout failed", err?.message || err);
    }

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
