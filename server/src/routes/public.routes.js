// server/src/routes/public.routes.js
import express from "express";
import mongoose from "mongoose";
import { Offer } from "../models/Offer.js";
import { Client } from "../models/Client.js";
import * as BookingModule from "../models/Booking.js";
import { AppSettings } from "../models/AppSettings.js";
import {
  DEFAULT_AGENDA,
  resolveAgendaForDate,
  dayRangeInTZ,
  buildSlotsForDate,
} from "../services/agendaSettings.js";

import {
  abacateCreatePixQr,
  abacateCheckPix,
  abacateSimulatePixPayment,
} from "../services/abacatepayClient.js";

import { notifySellerPixPaid } from "../services/resendEmail.js";
import { maybeNotifyWhatsAppPixPaid } from "../services/whatsappNotify.js";
import { assertPixQuotaAvailable, debitPix } from "../utils/pixQuota.js";
import { creditWalletOnPaid } from "../services/wallet.service.js";

const router = express.Router();

// ✅ garante que NÃO vai quebrar por "acceptances is not defined" / "pixCharges is not defined"
const acceptances =
  globalThis.__PAYLINK_ACCEPTANCES__ ||
  (globalThis.__PAYLINK_ACCEPTANCES__ = new Map());

const pixCharges =
  globalThis.__PAYLINK_PIX_CHARGES__ ||
  (globalThis.__PAYLINK_PIX_CHARGES__ = new Map());

// ✅ compat: Booking pode ser export default OU named (export const Booking = ...)
const Booking = BookingModule.default || BookingModule.Booking;

const HOLD_MINUTES = 15;
const PIX_EXPIRES_IN = Number(process.env.PIX_EXPIRES_IN || 3600); // segundos

// timeouts (evita request "pendurado" em chamadas externas/efeitos colaterais)
const ABACATEPAY_CHECK_TIMEOUT_MS = Number(
  process.env.ABACATEPAY_CHECK_TIMEOUT_MS || 4500,
);
const MARK_AS_PAID_TIMEOUT_MS = Number(
  process.env.MARK_AS_PAID_TIMEOUT_MS || 6500,
);

function nowIso() {
  return new Date().toISOString();
}

function isResendIdempotencyConflict(err) {
  return (
    err?.statusCode === 409 &&
    (err?.data?.name === "invalid_idempotent_request" ||
      String(err?.message || "").includes("idempotency key"))
  );
}

function isTransientTxnError(err) {
  return (
    err?.code === 251 ||
    (Array.isArray(err?.errorLabels) &&
      err.errorLabels.includes("TransientTransactionError"))
  );
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function msSince(t0) {
  return Date.now() - Number(t0 || 0);
}

// resolve sempre (não rejeita) e sinaliza timeout
async function raceTimeout(promise, ms, label) {
  let t = null;

  const timeout = new Promise((resolve) => {
    t = setTimeout(() => resolve({ timeout: true, label, ms }), ms);
  });

  const wrapped = Promise.resolve(promise)
    .then((value) => ({ value }))
    .catch((error) => ({ error }));

  const out = await Promise.race([wrapped, timeout]).finally(() => {
    if (t) clearTimeout(t);
  });

  return out;
}

// gate simples para logs (evita spam no polling)
const _pixStatusLogGate =
  globalThis.__PAYLINK_PIX_STATUS_LOG_GATE__ ||
  (globalThis.__PAYLINK_PIX_STATUS_LOG_GATE__ = new Map());

function gatedLog(key, minIntervalMs, fn) {
  const now = Date.now();
  const last = _pixStatusLogGate.get(key) || 0;
  if (now - last < minIntervalMs) return;
  _pixStatusLogGate.set(key, now);
  try {
    fn();
  } catch {}
}

async function debitPixWithRetry(wsId, paymentId, { retries = 3 } = {}) {
  for (let i = 0; i <= retries; i++) {
    try {
      await debitPix(wsId, paymentId);
      return;
    } catch (err) {
      // duplicidade (caso seu debitPix crie registro único por paymentId)
      if (err?.code === 11000) return;

      // erro transitório de transação: retry com backoff
      if (isTransientTxnError(err) && i < retries) {
        await sleep(150 * (i + 1));
        continue;
      }

      throw err;
    }
  }
}

function noStore(res) {
  res.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.set("Surrogate-Control", "no-store");
  return res;
}

/** Expira HOLDs antigos no Mongo */
async function expireOldHolds() {
  const now = new Date();
  await Booking.updateMany(
    { status: "HOLD", holdExpiresAt: { $lte: now } },
    { $set: { status: "EXPIRED" } },
  );
}

/** Overlap: [aStart,aEnd) vs [bStart,bEnd) */
function overlaps(aStart, aEnd, bStart, bEnd) {
  const as = new Date(aStart).getTime();
  const ae = new Date(aEnd).getTime();
  const bs = new Date(bStart).getTime();
  const be = new Date(bEnd).getTime();
  return as < be && bs < ae;
}

function toInt(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function computeAmountCents(offer) {
  const totalCents =
    toInt(offer?.totalCents, null) ?? toInt(offer?.amountCents, 0);

  const depositPctRaw = Number(offer?.depositPct);
  const depositPct =
    Number.isFinite(depositPctRaw) && depositPctRaw > 0 ? depositPctRaw : 0;

  const depositEnabled =
    offer?.depositEnabled === false ? false : depositPct > 0;

  const depositCents = depositEnabled
    ? Math.round((totalCents * depositPct) / 100)
    : 0;

  const amountCents = depositEnabled ? depositCents : totalCents;

  return { totalCents, depositEnabled, depositPct, depositCents, amountCents };
}

function onlyDigits(v) {
  return String(v || "").replace(/\D+/g, "");
}

function shortDesc(s, max = 37) {
  const t = String(s || "").trim();
  if (!t) return "Pagamento via Pix";
  return t.length <= max ? t : t.slice(0, max);
}

function buildDaySlots(dateStr, durationMin = 60) {
  const times = [
    "09:00",
    "10:00",
    "11:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
    "18:00",
  ];
  const dur = Number(durationMin) > 0 ? Number(durationMin) : 60;

  return times.map((hhmm) => {
    // interpreta como horário LOCAL do servidor (ex.: -03:00) e converte para ISO (UTC)
    const start = new Date(`${dateStr}T${hhmm}:00`);
    const end = new Date(start.getTime() + dur * 60 * 1000);
    return {
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      status: "FREE",
    };
  });
}

function isPaidStatus(st) {
  const s = String(st || "").toUpperCase();
  return s === "PAID" || s === "CONFIRMED";
}

/**
 * Infer tipo sem quebrar legado:
 * - Se offerType for "product" => produto
 * - Se não houver offerType mas existir items => produto
 * - Caso contrário => service
 */
function inferOfferType(offer) {
  const raw = String(offer?.offerType || "")
    .trim()
    .toLowerCase();
  if (raw === "product") return "product";
  const items = Array.isArray(offer?.items) ? offer.items : [];
  if (items.length > 0) return "product";
  return "service";
}

/** ---------- Public flow (máquina de estados) ---------- */
function normalizeOfferStatus(st) {
  const s = String(st || "")
    .trim()
    .toUpperCase();
  if (s === "CANCELED") return "CANCELLED";
  return s;
}

function computePaymentStatus(offerRaw) {
  const explicit = normalizeOfferStatus(offerRaw?.paymentStatus);
  if (explicit) return explicit;

  const status = normalizeOfferStatus(offerRaw?.status);
  const lastPix = normalizePixStatus(offerRaw?.payment?.lastPixStatus);
  const paid =
    isPaidStatus(status) ||
    !!offerRaw?.paidAt ||
    lastPix === "PAID" ||
    status === "PAID";
  return paid ? "PAID" : "PENDING";
}

function computePublicFlow({ offerRaw, booking }) {
  const now = new Date();
  const status = normalizeOfferStatus(offerRaw?.status);
  const paymentStatus = computePaymentStatus(offerRaw);

  const offerType = inferOfferType(offerRaw); // "service" | "product"
  const type = offerType === "product" ? "PRODUCT" : "SERVICE";

  const expiresAt = toDateOrNull(offerRaw?.expiresAt);
  const isExpired =
    paymentStatus !== "PAID" &&
    (status === "EXPIRED" ||
      (expiresAt && expiresAt.getTime() <= now.getTime()));

  const isCancelled = status === "CANCELLED";

  // prioridade: DONE > CANCELLED > EXPIRED
  if (paymentStatus === "PAID") {
    return {
      step: "DONE",
      reason: "PAID",
      bookingId: booking?._id ? String(booking._id) : null,
      type,
      paymentStatus,
    };
  }

  if (isCancelled) {
    return {
      step: "CANCELED",
      reason: "CANCELLED",
      bookingId: null,
      type,
      paymentStatus,
    };
  }

  if (isExpired) {
    return {
      step: "EXPIRED",
      reason: "EXPIRED",
      bookingId: null,
      type,
      paymentStatus,
    };
  }

  const accepted = status === "ACCEPTED" || !!offerRaw?.acceptedAt;

  // estados pré-aceite (compat com legado)
  const isPreAccept =
    !accepted && ["DRAFT", "SENT", "PUBLIC", ""].includes(status);

  if (isPreAccept) {
    return {
      step: "ACCEPT",
      reason: status || "PUBLIC",
      bookingId: null,
      type,
      paymentStatus,
    };
  }

  // pós-aceite
  if (offerType === "service") {
    const b = booking || null;
    const bStatus = normalizeOfferStatus(b?.status);

    const holdOk =
      bStatus === "HOLD" &&
      (toDateOrNull(b?.holdExpiresAt)?.getTime() || 0) > now.getTime();

    const confirmed = bStatus === "CONFIRMED" || bStatus === "PAID";

    if (confirmed || holdOk) {
      return {
        step: "PAYMENT",
        reason: confirmed ? "BOOKING_CONFIRMED" : "BOOKING_HOLD",
        bookingId: b?._id ? String(b._id) : null,
        type,
        paymentStatus,
      };
    }

    return {
      step: "SCHEDULE",
      reason: "NEEDS_BOOKING",
      bookingId: null,
      type,
      paymentStatus,
    };
  }

  // produto
  return {
    step: "PAYMENT",
    reason: "PRODUCT",
    bookingId: null,
    type,
    paymentStatus,
  };
}

/**
 * Busca offer por token público.
 * - withTenant=true: traz workspaceId/ownerUserId para derivar escopo de agenda
 * - Respostas públicas SEMPRE sanitizadas (não vazam tenant).
 */
async function findOfferByPublicToken(token, { withTenant = false } = {}) {
  const select = withTenant ? "-__v" : "-workspaceId -ownerUserId -__v";

  const offer =
    (await Offer.findOne({ publicToken: token }).select(select).lean()) ||
    (await Offer.findOne({ token }).select(select).lean()) ||
    (await Offer.findOne({ publicId: token }).select(select).lean());

  return offer || null;
}

function sanitizeOfferPublic(offer) {
  if (!offer) return null;
  // eslint-disable-next-line no-unused-vars
  const { workspaceId, ownerUserId, __v, ...rest } = offer;
  return rest;
}

function toDateOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/** ---------- Pix helpers ---------- */
function normalizePixStatus(st) {
  const s = String(st || "")
    .trim()
    .toUpperCase();
  if (s === "CANCELED") return "CANCELLED";
  return s;
}
function isTerminalPixStatus(st) {
  const s = normalizePixStatus(st);
  return (
    s === "PAID" || s === "EXPIRED" || s === "CANCELLED" || s === "REFUNDED"
  );
}
function pickPixData(abResult) {
  const d = abResult?.data;
  return d && d.id ? d : abResult;
}
function computeExpiresAtIso(pixData, fallbackExpiresInSec) {
  const fromApi = pixData?.expiresAt || pixData?.expires_at || null;
  if (fromApi) return fromApi;

  const expSec = Number(pixData?.expiresIn || pixData?.expires_in || 0);
  const useSec =
    Number.isFinite(expSec) && expSec > 0
      ? expSec
      : Math.max(60, Number(fallbackExpiresInSec) || 3600);

  return new Date(Date.now() + useSec * 1000).toISOString();
}

function upsertPixCharge(charge) {
  if (!pixCharges) return;

  // Map
  if (typeof pixCharges.set === "function") {
    pixCharges.set(charge.pixId, {
      ...(pixCharges.get(charge.pixId) || {}),
      ...charge,
    });
    return;
  }

  // fallback object
  pixCharges[charge.pixId] = { ...(pixCharges[charge.pixId] || {}), ...charge };
}

async function updateOfferPayment(offerId, patch) {
  if (!offerId) return;

  const $set = {};
  if (patch.lastPixId !== undefined)
    $set["payment.lastPixId"] = patch.lastPixId;
  if (patch.lastPixStatus !== undefined)
    $set["payment.lastPixStatus"] = patch.lastPixStatus;
  if (patch.lastPixExpiresAt !== undefined)
    $set["payment.lastPixExpiresAt"] = patch.lastPixExpiresAt;
  if (patch.lastPixUpdatedAt !== undefined)
    $set["payment.lastPixUpdatedAt"] = patch.lastPixUpdatedAt;

  if (!Object.keys($set).length) return;

  await Offer.updateOne({ _id: offerId }, { $set }, { strict: false }).catch(
    () => {},
  );
}

async function updateBookingPayment(bookingId, patch) {
  if (!bookingId || !mongoose.isValidObjectId(bookingId)) return;

  const $set = {};
  if (patch.status !== undefined) $set.status = patch.status;

  if (patch.payment?.provider !== undefined)
    $set["payment.provider"] = patch.payment.provider;
  if (patch.payment?.providerPaymentId !== undefined)
    $set["payment.providerPaymentId"] = patch.payment.providerPaymentId;
  if (patch.payment?.amountCents !== undefined)
    $set["payment.amountCents"] = patch.payment.amountCents;
  if (patch.payment?.status !== undefined)
    $set["payment.status"] = patch.payment.status;
  if (patch.payment?.paidAt !== undefined)
    $set["payment.paidAt"] = patch.payment.paidAt;

  if (!Object.keys($set).length) return;

  await Booking.updateOne(
    { _id: bookingId },
    { $set },
    { strict: false },
  ).catch(() => {});
}

function toPublicBooking(b) {
  if (!b) return null;
  return {
    id: String(b._id),
    status: String(b.status || "")
      .trim()
      .toUpperCase(),
    startAt: b.startAt instanceof Date ? b.startAt.toISOString() : b.startAt,
    endAt: b.endAt instanceof Date ? b.endAt.toISOString() : b.endAt,
    holdExpiresAt:
      b.holdExpiresAt instanceof Date
        ? b.holdExpiresAt.toISOString()
        : b.holdExpiresAt || null,
    customerName: b.customerName || "",
    customerWhatsApp: b.customerWhatsApp || "",
  };
}

function normalizeBookingStatusForSlots(st) {
  const s = String(st || "")
    .trim()
    .toUpperCase();
  // compat legado
  if (s === "PAID") return "CONFIRMED";
  if (s === "CANCELED") return "CANCELLED";
  return s;
}

// ✅ escopo correto: bloquear por VENDEDOR (workspaceId + ownerUserId), não por offerId.
// Isso impede outro cliente (outra offer) de reservar o mesmo horário.
function bookingScopeFromOffer(offerRaw) {
  const q = {};
  if (offerRaw?.workspaceId) q.workspaceId = offerRaw.workspaceId;
  if (offerRaw?.ownerUserId) q.ownerUserId = offerRaw.ownerUserId;

  // fallback (legado): se não tiver tenant, mantém comportamento anterior
  if (!q.workspaceId && !q.ownerUserId) q.offerId = offerRaw._id;

  return q;
}

async function markAsPaid({
  token,
  offerId,
  bookingId,
  pix,
  offerRaw,
  paidAmountCents,
}) {
  // 0) lê estado atual (para idempotência)
  const offerState = await Offer.findById(offerId)
    .select(
      "workspaceId status paymentStatus paidAt paidAmountCents paymentNotifiedAt sellerEmail sellerName",
    )
    .lean()
    .catch(() => null);

  const alreadyPaid =
    String(offerState?.paymentStatus || "").toUpperCase() === "PAID" ||
    String(offerState?.status || "").toUpperCase() === "PAID" ||
    !!offerState?.paidAt;

  // 1) valor pago (fixo)
  let paidCents = Number(paidAmountCents);
  if (!Number.isFinite(paidCents) || paidCents <= 0) {
    const base =
      offerRaw ||
      offerState ||
      (await Offer.findById(offerId)
        .lean()
        .catch(() => null));
    paidCents = Number(computeAmountCents(base).amountCents) || 0;
  }

  // 2) paidAt estável: se já estava pago, reaproveita o paidAt do banco
  const paidAtDate = alreadyPaid ? new Date(offerState.paidAt) : new Date();

  const paidAtIso = paidAtDate.toISOString();

  // 3) Atualiza offer como paga apenas se ainda não tinha paidAt (evita reescrever e mudar body do email)
  if (!alreadyPaid) {
    await Offer.updateOne(
      { _id: offerId, paidAt: { $in: [null, undefined] } },
      {
        $set: {
          status: "PAID",
          paymentStatus: "PAID",
          paidAt: paidAtDate,
          paidAmountCents: paidCents || null,
          publicDoneOnly: true,
          publicLockedAt: paidAtIso,
        },
      },
      { strict: false },
    ).catch(() => {});

    // garante status mesmo se paidAt já existia por corrida
    await Offer.updateOne(
      { _id: offerId, paymentStatus: { $ne: "PAID" } },
      { $set: { status: "PAID", paymentStatus: "PAID", publicDoneOnly: true } },
      { strict: false },
    ).catch(() => {});
  }

  // 4) Atualiza snapshot do Pix na offer
  await updateOfferPayment(offerId, {
    lastPixId: pix?.id,
    lastPixStatus: "PAID",
    lastPixExpiresAt: toDateOrNull(pix?.expiresAt) || undefined,
    lastPixUpdatedAt: paidAtDate,
  });

  // 5) Confirma booking
  if (bookingId && mongoose.isValidObjectId(bookingId)) {
    await updateBookingPayment(bookingId, {
      status: "CONFIRMED",
      payment: {
        provider: "ABACATEPAY",
        providerPaymentId: pix?.id,
        status: "PAID",
        paidAt: paidAtDate,
      },
    });
  }

  // 5b) WALLET CREDIT (idempotente) — não quebra confirmação se falhar
  try {
    const wsId = String(
      offerRaw?.workspaceId || offerState?.workspaceId || "",
    ).trim();

    const paymentId = String(pix?.id || "").trim();

    if (wsId && paymentId && paidCents > 0) {
      // ⚠️ não await aqui: nunca deixe o /pix/status "pendurado" por causa do crédito
      creditWalletOnPaid({
        workspaceId: wsId,
        offerId,
        paymentId,
        amountCents: paidCents,
        meta: { source: "public.markAsPaid", token },
      })
        .then((r) => {
          if (r?.credited) {
            console.log("[wallet] credit applied", {
              wsId,
              offerId: String(offerId),
              paymentId,
              amountCents: paidCents,
            });
          } else if (r?.skipped) {
            console.log("[wallet] credit skipped (already applied)", {
              wsId,
              offerId: String(offerId),
              paymentId,
            });
          } else if (!r?.ok) {
            console.warn("[wallet] credit failed (ignored)", {
              wsId,
              offerId: String(offerId),
              paymentId,
              error: r?.error,
              reason: r?.reason,
            });
          }
        })
        .catch((err) => {
          console.warn("[wallet] credit failed (ignored)", {
            wsId,
            offerId: String(offerId),
            paymentId,
            message: err?.message,
            code: err?.code,
          });
        });
    }
  } catch (err) {
    console.warn(
      "[wallet] credit scheduling failed (ignored)",
      err?.message || err,
    );
  }

  // 6) E-mail: só tenta se ainda não marcou como notificado
  try {
    const offerEmail =
      offerRaw ||
      (await Offer.findById(offerId)
        .lean()
        .catch(() => null)) ||
      offerState;
    const pixId = String(pix?.id || "").trim();

    if (offerEmail && !offerEmail.paymentNotifiedAt) {
      const bookingForEmail =
        bookingId && mongoose.isValidObjectId(bookingId)
          ? await Booking.findById(bookingId)
              .lean()
              .catch(() => null)
          : null;

      try {
        await notifySellerPixPaid({
          offerId: String(offerId),
          offer: offerEmail,
          booking: bookingForEmail,
          pixId,
          paidAt: offerEmail?.paidAt || paidAtDate, // ✅ evita variar entre chamadas
          paidAmountCents: offerEmail?.paidAmountCents ?? paidCents ?? null,
        });

        // ✅ marca como notificado (evita reenvio)
        await Offer.updateOne(
          { _id: offerId, paymentNotifiedAt: { $in: [null, undefined] } },
          {
            $set: {
              paymentNotifiedAt: paidAtDate,
              paymentNotifiedPixId: pixId || null,
              paymentNotifiedTo:
                String(offerEmail?.sellerEmail || "").trim() || null,
            },
          },
          { strict: false },
        ).catch(() => {});
      } catch (err) {
        // ✅ se Resend der 409 por idempotência, trate como "já foi enviado" e marque igual
        if (isResendIdempotencyConflict(err)) {
          await Offer.updateOne(
            { _id: offerId, paymentNotifiedAt: { $in: [null, undefined] } },
            {
              $set: {
                paymentNotifiedAt: paidAtDate,
                paymentNotifiedPixId: pixId || null,
                paymentNotifiedTo:
                  String(offerEmail?.sellerEmail || "").trim() || null,
              },
            },
            { strict: false },
          ).catch(() => {});
        } else {
          console.error("[pix] failed to send paid email", err);
        }
      }
    }
  } catch (err) {
    console.error("[pix] failed to send paid email", err);
  }

  // 6b) WhatsApp (cliente): tentativa única e idempotente via MessageLog
  try {
    const offerForWhatsApp =
      offerRaw ||
      (await Offer.findById(offerId)
        .lean()
        .catch(() => null)) ||
      offerState;

    await maybeNotifyWhatsAppPixPaid({
      offer: offerForWhatsApp,
      offerId: String(offerId),
      workspaceId: offerForWhatsApp?.workspaceId
        ? String(offerForWhatsApp.workspaceId)
        : null,
      bookingId:
        bookingId && mongoose.isValidObjectId(bookingId) ? bookingId : null,
      booking:
        bookingId && mongoose.isValidObjectId(bookingId)
          ? await Booking.findById(bookingId)
              .lean()
              .catch(() => null)
          : null,
      pixId: String(pix?.id || "").trim(),
    });
  } catch (err) {
    console.warn("[whatsapp] failed to notify customer (ignored)", {
      message: err?.message,
      code: err?.code,
    });
  }

  // 7) Pix quota: debita com retry (transiente) e idempotência
  try {
    const wsId = offerRaw?.workspaceId ? String(offerRaw.workspaceId) : "";
    const paymentId = String(pix?.id || "").trim();

    // ✅ não debita de novo se já estava pago (evita duplicidade)
    if (!alreadyPaid && wsId && paymentId) {
      await debitPixWithRetry(wsId, paymentId, { retries: 3 });
    }
  } catch (err) {
    console.warn("[pix] quota debit failed", {
      code: err?.code,
      name: err?.name,
      message: err?.message,
      wsId: offerRaw?.workspaceId ? String(offerRaw.workspaceId) : "",
      paymentId: String(pix?.id || "").trim(),
    });
  }

  return paidAtIso;
}

/**
 * GET /p/:token  -> retorna offer pública (+ locked/doneOnly) + flowState
 */
router.get("/p/:token", async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!token)
      return res.status(400).json({ ok: false, error: "Token inválido." });

    // mantém consistência ao expirar HOLDs antigos
    await expireOldHolds();

    const offerRaw = await findOfferByPublicToken(token, { withTenant: true });
    if (!offerRaw)
      return res
        .status(404)
        .json({ ok: false, error: "Proposta não encontrada." });

    // ✅ otimização: se a oferta já está PAID no Mongo, não consulta o gateway de novo
    if (isPaidStatus(offerRaw?.status) || offerRaw?.paidAt) {
      noStore(res);
      const paidPixId =
        offerRaw?.payment?.lastPixId || offerRaw?.paymentNotifiedPixId || null;
      return res.json({
        ok: true,
        pix: { id: paidPixId, status: "PAID" },
        locked: true,
        paidAt: offerRaw?.paidAt
          ? new Date(offerRaw.paidAt).toISOString()
          : null,
        reused: true,
      });
    }

    // ✅ sem cache (evita 304 e dados "travados")
    noStore(res);

    // ✅ fallback/backfill para ofertas antigas sem snapshot
    let offerForPublic = offerRaw;
    const missingEmail = !String(offerRaw?.customerEmail || "").trim();
    const missingDoc = !String(offerRaw?.customerDoc || "").trim();
    if ((missingEmail || missingDoc) && offerRaw?.workspaceId) {
      const docDigits = onlyDigits(offerRaw?.customerDoc);
      const waDigits = onlyDigits(offerRaw?.customerWhatsApp);

      let c = null;
      if (
        offerRaw?.customerId &&
        mongoose.isValidObjectId(offerRaw.customerId)
      ) {
        c = await Client.findOne({
          _id: offerRaw.customerId,
          workspaceId: offerRaw.workspaceId,
        }).lean();
      }
      if (!c && docDigits) {
        c = await Client.findOne({
          workspaceId: offerRaw.workspaceId,
          $or: [{ cpfCnpjDigits: docDigits }, { cpfCnpj: docDigits }],
        }).lean();
      }
      if (!c && waDigits) {
        c = await Client.findOne({
          workspaceId: offerRaw.workspaceId,
          $or: [{ whatsApp: waDigits }, { whatsapp: waDigits }],
        }).lean();
      }

      if (c) {
        const patch = {};
        if (!offerRaw.customerId) patch.customerId = c._id;
        if (missingEmail) patch.customerEmail = String(c.email || "").trim();
        if (missingDoc)
          patch.customerDoc = onlyDigits(c.cpfCnpjDigits || c.cpfCnpj || "");
        if (!String(offerRaw.customerName || "").trim())
          patch.customerName = String(c.name || "").trim();
        if (!String(offerRaw.customerWhatsApp || "").trim()) {
          patch.customerWhatsApp = String(
            c.whatsApp || c.whatsapp || "",
          ).trim();
        }

        // opcional: persistir para não depender sempre de lookup
        if (Object.keys(patch).length) {
          await Offer.updateOne(
            { _id: offerRaw._id },
            { $set: patch },
            { strict: false },
          ).catch(() => {});
          offerForPublic = { ...offerRaw, ...patch };
        }
      }
    }

    const offerSan = sanitizeOfferPublic(offerForPublic);

    // ✅ se já existir reserva (HOLD válida / CONFIRMED), devolve para o front não depender de bookingId na URL
    const offerType = inferOfferType(offerRaw);
    const now = new Date();
    let booking = null;
    if (offerType === "service") {
      booking =
        (await Booking.findOne({ offerId: offerRaw._id, status: "CONFIRMED" })
          .sort({ startAt: -1 })
          .lean()
          .catch(() => null)) ||
        (await Booking.findOne({
          offerId: offerRaw._id,
          status: "HOLD",
          holdExpiresAt: { $gt: now },
        })
          .sort({ startAt: -1 })
          .lean()
          .catch(() => null));
    }

    const flow = computePublicFlow({ offerRaw, booking });
    const locked = flow.step === "DONE";
    const offer = {
      ...offerSan,
      type: flow.type,
      paymentStatus: flow.paymentStatus,
    };

    noStore(res);
    return res.json({
      ok: true,
      offer,
      locked,
      doneOnly: locked,
      booking: booking ? toPublicBooking(booking) : null,
      flow: {
        step: flow.step,
        reason: flow.reason,
        bookingId: flow.bookingId,
      },
    });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /p/:token/summary?bookingId=...
 */
router.get("/p/:token/summary", async (req, res, next) => {
  try {
    await expireOldHolds();

    const { token } = req.params;
    const bookingId = String(req.query.bookingId || "").trim();

    if (!token)
      return res.status(400).json({ ok: false, error: "Token inválido." });

    const offerRaw = await findOfferByPublicToken(token, { withTenant: true });
    if (!offerRaw)
      return res
        .status(404)
        .json({ ok: false, error: "Proposta não encontrada." });

    const offerLocked = isPaidStatus(offerRaw?.status);

    const offerType = offerRaw?.offerType || inferOfferType(offerRaw);
    const amounts = computeAmountCents(offerRaw);

    const now = new Date();
    let booking = null;

    if (bookingId && mongoose.isValidObjectId(bookingId)) {
      booking = await Booking.findOne({
        _id: bookingId,
        offerId: offerRaw._id,
      })
        .lean()
        .catch(() => null);
    } else {
      booking =
        (await Booking.findOne({
          offerId: offerRaw._id,
          status: "CONFIRMED",
        })
          .sort({ startAt: -1 })
          .lean()
          .catch(() => null)) ||
        (await Booking.findOne({
          offerId: offerRaw._id,
          status: "HOLD",
          holdExpiresAt: { $gt: now },
        })
          .sort({ startAt: -1 })
          .lean()
          .catch(() => null));
    }

    const paidAt =
      offerRaw?.paidAt || booking?.payment?.paidAt || booking?.paidAt || null;

    const summary = {
      locked: offerLocked || booking?.status === "CONFIRMED",
      paidAt,
      offer: sanitizeOfferPublic({
        ...offerRaw,
        offerType,
        customerName: offerRaw?.customerName || offerRaw?.customer?.name || "",
      }),
      booking: booking ? toPublicBooking(booking) : null,
      totalCents: amounts.totalCents,
      depositEnabled: amounts.depositEnabled,
      depositPct: amounts.depositPct,
      depositCents: amounts.depositCents,
      amountToChargeCents: amounts.amountCents,
    };

    noStore(res);
    return res.json({ ok: true, summary });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /p/:token/accept (idempotente + retorna flow)
 */
router.post("/p/:token/accept", async (req, res, next) => {
  try {
    const { token } = req.params;
    const { agreeTerms, acceptedAt } = req.body || {};

    if (!token)
      return res.status(400).json({ ok: false, error: "Token inválido." });

    const offerRaw = await findOfferByPublicToken(token, { withTenant: true });
    if (!offerRaw)
      return res
        .status(404)
        .json({ ok: false, error: "Proposta não encontrada." });

    // booking atual (para decidir próximo passo em SERVICE)
    const now = new Date();
    let booking = null;
    if (inferOfferType(offerRaw) === "service") {
      booking =
        (await Booking.findOne({ offerId: offerRaw._id, status: "CONFIRMED" })
          .sort({ startAt: -1 })
          .lean()
          .catch(() => null)) ||
        (await Booking.findOne({
          offerId: offerRaw._id,
          status: "HOLD",
          holdExpiresAt: { $gt: now },
        })
          .sort({ startAt: -1 })
          .lean()
          .catch(() => null));
    }

    const preFlow = computePublicFlow({ offerRaw, booking });

    // ✅ idempotência: se já está aceito/pago/expirado/cancelado, não erra — só devolve o próximo passo
    if (preFlow.step !== "ACCEPT") {
      noStore(res);
      return res.json({
        ok: true,
        flow: {
          step: preFlow.step,
          reason: preFlow.reason,
          bookingId: preFlow.bookingId,
        },
      });
    }

    if (!agreeTerms)
      return res.status(400).json({ ok: false, error: "Aceite obrigatório." });

    const acc = acceptedAt ? new Date(acceptedAt) : new Date();
    const acceptedAtDate = Number.isNaN(acc.getTime()) ? new Date() : acc;

    // opcional (não quebra)
    try {
      acceptances.set(token, {
        agreeTerms: true,
        acceptedAt: acceptedAtDate.toISOString(),
      });
    } catch {}

    // marca como aceito (sem depender do campo/token legado)
    await Offer.updateOne(
      { _id: offerRaw._id },
      {
        $set: {
          status: "ACCEPTED",
          acceptedAt: offerRaw.acceptedAt || acceptedAtDate,
          paymentStatus: "PENDING",
        },
      },
      { strict: false },
    ).catch(() => {});

    const offerAfter = (await Offer.findById(offerRaw._id)
      .lean()
      .catch(() => null)) || {
      ...offerRaw,
      status: "ACCEPTED",
      acceptedAt: offerRaw.acceptedAt || acceptedAtDate,
      paymentStatus: "PENDING",
    };

    const flow = computePublicFlow({ offerRaw: offerAfter, booking });

    noStore(res);
    return res.json({
      ok: true,
      flow: { step: flow.step, reason: flow.reason, bookingId: flow.bookingId },
    });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /p/:token/slots?date=YYYY-MM-DD
 * ✅ agora lê do Mongo e bloqueia horários ocupados por OUTRAS OFFERS do mesmo vendedor.
 */
router.get("/p/:token/slots", async (req, res, next) => {
  try {
    await expireOldHolds();

    const { token } = req.params;
    const date = String(req.query.date || "").trim();

    if (!token)
      return res.status(400).json({ ok: false, error: "Token inválido." });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res
        .status(400)
        .json({ ok: false, error: "Informe date=YYYY-MM-DD." });
    }

    const offerRaw = await findOfferByPublicToken(token, { withTenant: true });
    if (!offerRaw)
      return res
        .status(404)
        .json({ ok: false, error: "Proposta não encontrada." });

    if (isPaidStatus(offerRaw?.status)) {
      return res.status(410).json({
        ok: false,
        error: "Esta proposta já foi concluída (paga).",
        locked: true,
        doneOnly: true,
      });
    }

    const durationMin =
      Number(offerRaw?.durationMin) > 0 ? Number(offerRaw.durationMin) : 60;

    // Range do dia (LOCAL do servidor)
    // Carrega configurações do DONO da offer (tenant via offer)
    let agenda = DEFAULT_AGENDA;
    try {
      if (offerRaw?.workspaceId && offerRaw?.ownerUserId) {
        const s = await AppSettings.findOne({
          workspaceId: offerRaw.workspaceId,
          ownerUserId: offerRaw.ownerUserId,
        })
          .select("agenda")
          .lean();
        if (s?.agenda) agenda = { ...DEFAULT_AGENDA, ...s.agenda };
      }
    } catch (e) {
      console.warn("[agenda] failed to load settings:", e?.message || e);
      agenda = DEFAULT_AGENDA;
    }

    const tz =
      agenda?.timezone || DEFAULT_AGENDA.timezone || "America/Sao_Paulo";

    // Range do dia no timezone configurado (não depende do timezone do server)
    const { dayStart, dayEnd } = dayRangeInTZ(date, tz);
    const now = new Date();

    const scope = bookingScopeFromOffer(offerRaw);

    // Bookings ativos do dia (por vendedor):
    // - CONFIRMED/PAID sempre
    // - HOLD apenas se holdExpiresAt > now
    const activeBookings = await Booking.find({
      ...scope,
      startAt: { $lt: dayEnd },
      endAt: { $gt: dayStart },
      $or: [
        { status: { $in: ["CONFIRMED", "PAID"] } }, // compat
        { status: "HOLD", holdExpiresAt: { $gt: now } },
      ],
    })
      .select("_id startAt endAt status holdExpiresAt")
      .lean();

    const resolved = resolveAgendaForDate(agenda, date, { durationMin });

    // slots base (FREE) vindos da configuração + fallback compatível (DEFAULT_AGENDA)
    // Se settings inexistente/incompleto => resolveAgendaForDate cai no defaultSlots.
    const baseSlots =
      resolved?.slots?.length > 0
        ? buildSlotsForDate(date, resolved.slots, durationMin, tz)
        : [];

    // (compat) se não houver slots por configuração, mantém resposta com slots vazios
    const slots = baseSlots.map((slot) => {
      let best = null; // CONFIRMED ganha de HOLD
      for (const b of activeBookings) {
        if (!overlaps(slot.startAt, slot.endAt, b.startAt, b.endAt)) continue;

        const st = normalizeBookingStatusForSlots(b.status);
        if (st === "CONFIRMED") {
          best = "CONFIRMED";
          break;
        }
        if (st === "HOLD") best = best || "HOLD";
      }
      return best ? { ...slot, status: best } : slot;
    });

    noStore(res);
    return res.json({ ok: true, date, slots, now: now.toISOString() });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /p/:token/book
 * ✅ valida conflito no Mongo (mesma regra do /slots) e retorna 409 se ocupado.
 */
router.post("/p/:token/book", async (req, res, next) => {
  try {
    await expireOldHolds();

    const { token } = req.params;
    const { startAt, endAt, customerName, customerWhatsApp } = req.body || {};

    if (!token)
      return res.status(400).json({ ok: false, error: "Token inválido." });
    if (!startAt || !endAt) {
      return res
        .status(400)
        .json({ ok: false, error: "startAt/endAt obrigatórios." });
    }

    const s = new Date(startAt);
    const e = new Date(endAt);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e <= s) {
      return res.status(400).json({
        ok: false,
        error: "startAt/endAt inválidos.",
      });
    }

    const now = new Date();

    // bloqueia passado (tolerância de 60s)
    if (s.getTime() <= now.getTime() - 60 * 1000) {
      return res.status(400).json({
        ok: false,
        error: "Horário no passado.",
      });
    }

    const offerRaw = await findOfferByPublicToken(token, { withTenant: true });
    if (!offerRaw)
      return res
        .status(404)
        .json({ ok: false, error: "Proposta não encontrada." });

    if (isPaidStatus(offerRaw?.status)) {
      return res.status(410).json({
        ok: false,
        error: "Esta proposta já foi concluída (paga).",
        locked: true,
        doneOnly: true,
      });
    }

    // tenant deriva da offer
    const workspaceId = offerRaw.workspaceId || null;
    const ownerUserId = offerRaw.ownerUserId || null;

    if (!workspaceId || !ownerUserId) {
      return res.status(500).json({
        ok: false,
        error:
          "Oferta sem tenant (workspaceId/ownerUserId). Ajuste a migração das offers.",
      });
    }

    const scope = bookingScopeFromOffer(offerRaw);

    // conflito via Mongo (por vendedor) — evita race condition
    const conflict = await Booking.findOne({
      ...scope,
      startAt: { $lt: e },
      endAt: { $gt: s },
      $or: [
        { status: { $in: ["CONFIRMED", "PAID"] } }, // compat
        { status: "HOLD", holdExpiresAt: { $gt: now } },
      ],
    })
      .select("_id status startAt endAt")
      .lean();

    if (conflict) {
      noStore(res);
      return res.status(409).json({ ok: false, error: "Horário indisponível" });
    }

    const holdExpiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000);

    const booking = await Booking.create({
      offerId: offerRaw._id,
      workspaceId,
      ownerUserId,
      publicToken: token,
      startAt: s,
      endAt: e,
      status: "HOLD",
      holdExpiresAt,
      customerName: String(customerName || "").trim() || undefined,
      customerWhatsApp: String(customerWhatsApp || "").trim() || undefined,
      payment: {
        provider: "ABACATEPAY",
        status: "PENDING",
        amountCents: computeAmountCents(offerRaw).amountCents,
      },
    });

    noStore(res);
    return res.json({
      ok: true,
      booking: toPublicBooking(booking.toObject()),
      now: now.toISOString(),
    });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /p/:token/pix/create
 * (mantido como estava no seu arquivo; apenas garantindo pixCharges definido)
 */
router.post("/p/:token/pix/create", async (req, res, next) => {
  try {
    await expireOldHolds();

    const { token } = req.params;
    const { bookingId, customer } = req.body || {};
    if (!token)
      return res.status(400).json({ ok: false, error: "Token inválido." });
    const offerRaw = await findOfferByPublicToken(token, { withTenant: true });
    if (!offerRaw)
      return res
        .status(404)
        .json({ ok: false, error: "Proposta não encontrada." });
    const offerType = inferOfferType(offerRaw);
    const isProduct = offerType === "product";
    // ✅ para SERVICE: se não vier bookingId, tenta reaproveitar um HOLD válido existente
    let effectiveBookingId = String(bookingId || "").trim();
    let booking = null;
    if (!isProduct && !effectiveBookingId) {
      booking = await Booking.findOne({
        offerId: offerRaw._id,
        status: "HOLD",
        holdExpiresAt: { $gt: new Date() },
      })
        .sort({ startAt: -1 })
        .lean()
        .catch(() => null);
      if (booking?._id) effectiveBookingId = String(booking._id);
    }

    // para PRODUCT, mantém o comportamento atual (bookingId "virtual")
    if (isProduct) effectiveBookingId = token;

    if (!effectiveBookingId) {
      return res
        .status(400)
        .json({ ok: false, error: "bookingId obrigatório." });
    }

    if (isPaidStatus(offerRaw?.status)) {
      return res.status(409).json({
        ok: false,
        error: "Pagamento já confirmado.",
        locked: true,
        doneOnly: true,
      });
    }

    if (!isProduct) {
      if (!mongoose.isValidObjectId(effectiveBookingId)) {
        return res
          .status(400)
          .json({ ok: false, error: "bookingId inválido." });
      }

      booking =
        booking ||
        (await Booking.findOne({
          _id: effectiveBookingId,
          offerId: offerRaw._id,
          status: "HOLD",
          holdExpiresAt: { $gt: new Date() },
        })
          .lean()
          .catch(() => null));

      if (!booking) {
        return res.status(409).json({
          ok: false,
          error: "Reserva inválida/expirada. Refaça o agendamento.",
        });
      }
    }

    const existingPixId = !isProduct
      ? booking?.payment?.providerPaymentId
      : offerRaw?.payment?.lastPixId;

    if (existingPixId) {
      // Se existir Pix anterior, tenta reaproveitar. Se o gateway responder "not found", ignora e cria um novo.
      let chk = null;
      try {
        chk = await abacateCheckPix({ pixId: existingPixId });
      } catch (err) {
        const msg = String(err?.details?.error || err?.message || "");
        const st = Number(err?.status || err?.statusCode || 0);
        const notFound =
          (st === 400 || st === 404) && msg.toLowerCase().includes("not found");
        if (!notFound) throw err;
        chk = null;
      }

      const pixDataRaw = chk ? pickPixData(chk) : null;

      if (pixDataRaw?.id) {
        const st = normalizePixStatus(pixDataRaw.status);
        gatedLog(`pix/status:gateway:${pixId}:${st}`, 5000, () => {
          console.log("[pix/status] gateway status", {
            token,
            pixId,
            st,
            ms: msSince(tCheck),
          });
        });
        const expiresAtIso = computeExpiresAtIso(pixDataRaw, PIX_EXPIRES_IN);
        const updatedAt = new Date();

        await updateOfferPayment(offerRaw._id, {
          lastPixId: pixDataRaw.id,
          lastPixStatus: st,
          lastPixExpiresAt: toDateOrNull(expiresAtIso) || undefined,
          lastPixUpdatedAt: updatedAt,
        });

        if (!isProduct) {
          await updateBookingPayment(String(booking._id), {
            payment: {
              provider: "ABACATEPAY",
              providerPaymentId: pixDataRaw.id,
              status: st === "PAID" ? "PAID" : "PENDING",
            },
          });
        }

        if (st === "PAID") {
          const paidAt = await markAsPaid({
            token,
            offerId: offerRaw._id,
            bookingId: isProduct ? null : String(booking._id),
            pix: { ...pixDataRaw, status: st, expiresAt: expiresAtIso },
            offerRaw,
            paidAmountCents: computeAmountCents(offerRaw).amountCents,
          });
          noStore(res);
          return res.json({
            ok: true,
            pix: { ...pixDataRaw, status: st, expiresAt: expiresAtIso },
            locked: true,
            paidAt,
            reused: true,
          });
        }

        if (!isTerminalPixStatus(st)) {
          noStore(res);
          return res.json({
            ok: true,
            pix: { ...pixDataRaw, status: st, expiresAt: expiresAtIso },
            reused: true,
          });
        }
      }
    }

    const name = String(customer?.name || offerRaw?.customerName || "").trim();
    const cellphone = String(
      customer?.cellphone ||
        customer?.phone ||
        offerRaw?.customerWhatsApp ||
        "",
    ).trim();
    const email = String(
      customer?.email || offerRaw?.customerEmail || "",
    ).trim();
    const taxId = onlyDigits(customer?.taxId || offerRaw?.customerDoc || "");

    if (!name || !cellphone || !email || !taxId) {
      return res.status(400).json({
        ok: false,
        error:
          "Dados do pagador incompletos (nome, celular, email e CPF/CNPJ).",
      });
    }

    const { amountCents } = computeAmountCents(offerRaw);
    const amount = Number(amountCents);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res
        .status(400)
        .json({ ok: false, error: "Valor inválido para cobrança." });
    }

    // 1) Calcula expiresIn ANTES de usar
    const expiresInSec = (() => {
      const base = Math.max(60, PIX_EXPIRES_IN);

      if (isProduct) return base;

      const nowMs = Date.now();
      const holdMs = new Date(booking.holdExpiresAt).getTime();
      const remainingHoldSec = Math.max(
        60,
        Math.floor((holdMs - nowMs) / 1000),
      );

      // Pix não pode durar mais que o hold da reserva
      return Math.min(remainingHoldSec, base);
    })();

    // 2) Quota pré-check ANTES de criar Pix
    if (!offerRaw?.workspaceId) {
      return res
        .status(500)
        .json({ ok: false, error: "Oferta sem workspaceId (tenant)." });
    }

    try {
      await assertPixQuotaAvailable(String(offerRaw.workspaceId));
    } catch (err) {
      const status = Number(err?.status) || 402;
      return res.status(status).json({
        ok: false,
        error:
          err?.message ||
          "Sua cota de Pix do mês acabou. Faça upgrade do plano.",
      });
    }

    // 3) Metadata ANTES de usar
    const metadata = {
      externalId: String(effectiveBookingId), // usado depois no /pix/status
      publicToken: token,
      offerId: String(offerRaw._id),
    };

    // 4) Agora sim cria o Pix (com expiresInSec e metadata já definidos)
    const ab = await abacateCreatePixQr({
      amount, // number
      expiresIn: expiresInSec, // number
      description: shortDesc(offerRaw?.title || "Pagamento via Pix"),
      customer: { name, cellphone, email, taxId },
      metadata,
    });

    // 5) Continua como você já faz
    const pixDataRaw = pickPixData(ab);
    if (!pixDataRaw?.id) {
      return res.status(502).json({ ok: false, error: "Falha ao gerar Pix." });
    }

    const st = normalizePixStatus(pixDataRaw.status || "PENDING");
    const expiresAtIso = computeExpiresAtIso(pixDataRaw, expiresInSec);

    await updateOfferPayment(offerRaw._id, {
      lastPixId: pixDataRaw.id,
      lastPixStatus: st,
      lastPixExpiresAt: toDateOrNull(expiresAtIso) || undefined,
      lastPixUpdatedAt: new Date(),
    });

    if (!isProduct) {
      await updateBookingPayment(String(booking._id), {
        payment: {
          provider: "ABACATEPAY",
          providerPaymentId: pixDataRaw.id,
          amountCents,
          status: "PENDING",
        },
      });
    }

    upsertPixCharge({
      pixId: pixDataRaw.id,
      bookingId: isProduct ? null : String(booking?._id || ""),
      token,
      status: st,
      updatedAt: nowIso(),
      pix: { ...pixDataRaw, status: st, expiresAt: expiresAtIso },
    });

    noStore(res);
    return res.json({
      ok: true,
      pix: { ...pixDataRaw, status: st, expiresAt: expiresAtIso },
    });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /p/:token/pix/status?pixId=...
 */
router.get("/p/:token/pix/status", async (req, res, next) => {
  try {
    await expireOldHolds();

    const { token } = req.params;
    const pixId = String(req.query.pixId || "").trim();

    if (!token)
      return res.status(400).json({ ok: false, error: "Token inválido." });
    if (!pixId)
      return res.status(400).json({ ok: false, error: "pixId obrigatório." });

    const offerRaw = await findOfferByPublicToken(token, { withTenant: true });
    if (!offerRaw)
      return res
        .status(404)
        .json({ ok: false, error: "Proposta não encontrada." });

    const t0 = Date.now();
    gatedLog(`pix/status:in:${pixId}`, 5000, () => {
      console.log("[pix/status] in", {
        token,
        pixId,
        at: new Date().toISOString(),
      });
    });

    // ✅ Otimização: se a oferta já está paga, não precisa chamar o gateway.
    if (isPaidStatus(offerRaw?.status) || offerRaw?.paidAt) {
      noStore(res);
      return res.json({
        ok: true,
        pix: { id: pixId, status: "PAID" },
        locked: true,
        paidAt: offerRaw?.paidAt
          ? new Date(offerRaw.paidAt).toISOString()
          : null,
        reused: true,
      });
    }

    const tCheck = Date.now();
    const abRes = await raceTimeout(
      abacateCheckPix({ pixId }),
      ABACATEPAY_CHECK_TIMEOUT_MS,
      "abacateCheckPix",
    );

    if (abRes?.timeout) {
      gatedLog(`pix/status:abacate_timeout:${pixId}`, 10000, () => {
        console.warn("[pix/status] gateway timeout", {
          token,
          pixId,
          ms: msSince(tCheck),
        });
      });

      noStore(res);
      return res.status(504).json({
        ok: false,
        error: "Timeout ao consultar status do Pix.",
      });
    }

    if (abRes?.error) {
      console.error("[pix/status] gateway error", {
        token,
        pixId,
        ms: msSince(tCheck),
        message: abRes.error?.message,
        code: abRes.error?.code,
      });

      return res
        .status(502)
        .json({ ok: false, error: "Falha ao consultar status do Pix." });
    }

    const ab = abRes.value;
    const pixDataRaw = pickPixData(ab);

    if (!pixDataRaw?.id) {
      return res
        .status(502)
        .json({ ok: false, error: "Falha ao consultar status do Pix." });
    }

    const st = normalizePixStatus(pixDataRaw.status);
    const expiresAtIso = computeExpiresAtIso(pixDataRaw, PIX_EXPIRES_IN);
    const updatedAt = new Date();

    await updateOfferPayment(offerRaw._id, {
      lastPixId: pixDataRaw.id,
      lastPixStatus: st,
      lastPixExpiresAt: toDateOrNull(expiresAtIso) || undefined,
      lastPixUpdatedAt: updatedAt,
    });

    const externalId = String(
      pixDataRaw?.metadata?.externalId ||
        pixDataRaw?.metadata?.external_id ||
        "",
    ).trim();

    let bookingId = null;

    if (externalId && mongoose.isValidObjectId(externalId)) {
      bookingId = externalId;
    } else {
      const b = await Booking.findOne({
        offerId: offerRaw._id,
        "payment.providerPaymentId": pixId,
      })
        .select("_id")
        .lean()
        .catch(() => null);
      bookingId = b?._id ? String(b._id) : null;
    }

    let paidAt = null;
    let locked = false;

    if (st === "PAID") {
      locked = true;
      const ctx = {
        token,
        offerId: String(offerRaw._id),
        workspaceId: offerRaw?.workspaceId
          ? String(offerRaw.workspaceId)
          : null,
        bookingId: bookingId || null,
        paymentId: String(pixDataRaw?.id || pixId),
        amountCents: computeAmountCents(offerRaw).amountCents,
      };

      gatedLog(`pix/status:paid:${pixId}`, 15000, () => {
        console.log("[pix/status] entering PAID block", ctx);
      });

      const tPaid = Date.now();
      const paidRes = await raceTimeout(
        markAsPaid({
          token,
          offerId: offerRaw._id,
          bookingId,
          pix: { ...pixDataRaw, status: st, expiresAt: expiresAtIso },
          offerRaw,
          paidAmountCents: computeAmountCents(offerRaw).amountCents,
        }),
        MARK_AS_PAID_TIMEOUT_MS,
        "markAsPaid",
      );

      if (paidRes?.timeout) {
        console.warn("[pix/status] markAsPaid timeout (ignored)", {
          ...ctx,
          ms: msSince(tPaid),
        });

        const db = await Offer.findById(offerRaw._id)
          .select("paidAt")
          .lean()
          .catch(() => null);

        paidAt = db?.paidAt ? new Date(db.paidAt).toISOString() : null;
      } else if (paidRes?.error) {
        console.error("[pix/status] markAsPaid error (ignored)", {
          ...ctx,
          ms: msSince(tPaid),
          message: paidRes.error?.message,
          code: paidRes.error?.code,
          stack: paidRes.error?.stack,
        });

        const db = await Offer.findById(offerRaw._id)
          .select("paidAt")
          .lean()
          .catch(() => null);

        paidAt = db?.paidAt ? new Date(db.paidAt).toISOString() : null;
      } else {
        paidAt = paidRes?.value || null;
        gatedLog(`pix/status:paid_done:${pixId}`, 15000, () => {
          console.log("[pix/status] markAsPaid done", {
            ...ctx,
            ms: msSince(tPaid),
            paidAt,
          });
        });
      }
    } else {
      locked = isPaidStatus(offerRaw?.status);
    }

    upsertPixCharge({
      pixId: pixDataRaw.id,
      bookingId: bookingId || null,
      token,
      status: st,
      updatedAt: nowIso(),
      pix: { ...pixDataRaw, status: st, expiresAt: expiresAtIso },
    });

    noStore(res);
    return res.json({
      ok: true,
      pix: { ...pixDataRaw, status: st, expiresAt: expiresAtIso },
      locked,
      paidAt,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /p/:token/pix/dev/simulate?pixId=...
 * (DEV Mode)
 */
router.post("/p/:token/pix/dev/simulate", async (req, res, next) => {
  try {
    const pixId = String(req.query.pixId || "").trim();
    if (!pixId)
      return res.status(400).json({ ok: false, error: "pixId obrigatório." });

    if (process.env.NODE_ENV === "production") {
      return res.status(404).json({ ok: false, error: "Not found" });
    }

    await abacateSimulatePixPayment({ pixId });
    noStore(res);
    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
