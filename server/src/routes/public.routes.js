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
  buildPublicBookingSelfServiceState,
  cancelPublicBooking,
  getPublicBookingManageSummary,
  listPublicBookingManageSlots,
  reschedulePublicBooking,
} from "../services/publicBookingSelfService.service.js";

import * as WorkspaceModule from "../models/Workspace.js";
import { buildPixBrCode } from "../services/pixEmv.js";
import { uploadPaymentProof } from "../middleware/uploadProof.js";
import { notifySellerPaymentProofSubmitted } from "../services/resendEmail.js";
import {
  isEmailNotificationEnabled,
  resolveWorkspaceNotificationContext,
} from "../services/notificationSettings.js";
import path from "path";

const router = express.Router();

const Booking = BookingModule.default || BookingModule.Booking;
const Workspace = WorkspaceModule.default || WorkspaceModule.Workspace;

const LINK_TTL_DAYS = Number(process.env.OFFER_LINK_TTL_DAYS || 90);
const HOLD_MINUTES = Number(process.env.PUBLIC_HOLD_MINUTES || 15);

const acceptances =
  globalThis.__PAYLINK_ACCEPTANCES__ ||
  (globalThis.__PAYLINK_ACCEPTANCES__ = new Map());

function nowIso() {
  return new Date().toISOString();
}

function noStore(res) {
  res.setHeader("Cache-Control", "no-store");
}

function sendLegacyPixEndpointDisabled(res, { refreshHint = false } = {}) {
  return res.status(410).json({
    ok: false,
    error: refreshHint
      ? "Este endpoint legado de pagamento foi desativado. Atualize a pagina."
      : "Este endpoint legado de pagamento foi desativado.",
    code: "ABACATEPAY_DISABLED",
  });
}

function normalizeOfferStatus(st) {
  const s = String(st || "")
    .trim()
    .toUpperCase();
  if (!s) return "";
  if (s === "CANCELED") return "CANCELLED";
  return s;
}

function isPaidStatus(st) {
  const s = normalizeOfferStatus(st);
  return s === "PAID" || s === "CONFIRMED";
}

function inferOfferType(offerRaw) {
  const t = String(offerRaw?.offerType || "")
    .trim()
    .toLowerCase();
  if (t === "product") return "product";
  return "service";
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

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Cálculo do valor a cobrar (depósito opcional) */
function computeAmountCents(offerRaw) {
  const totalCents =
    Number(offerRaw?.totalCents ?? offerRaw?.amountCents ?? 0) || 0;

  const depositPctRaw = Number(offerRaw?.depositPct);
  const depositPct =
    Number.isFinite(depositPctRaw) && depositPctRaw > 0 ? depositPctRaw : 0;

  const depositEnabled =
    offerRaw?.depositEnabled === false ? false : depositPct > 0;

  const depositCents = depositEnabled
    ? Math.round((totalCents * depositPct) / 100)
    : 0;
  const amountCents = depositEnabled ? depositCents : totalCents;

  return {
    totalCents,
    depositEnabled,
    depositPct,
    depositCents,
    amountCents,
  };
}

function shortDesc(s) {
  const x = String(s || "").trim();
  if (!x) return "Pagamento via Pix";
  return x.length <= 55 ? x : x.slice(0, 55);
}

async function expireOldHolds() {
  const now = new Date();
  await Booking.updateMany(
    {
      status: "HOLD",
      holdExpiresAt: { $lte: now },
    },
    { $set: { status: "EXPIRED" } },
    { strict: false },
  ).catch(() => {});
}

function computePaymentStatus(offerRaw) {
  const explicit = normalizeOfferStatus(offerRaw?.paymentStatus);
  if (explicit) return explicit;

  const status = normalizeOfferStatus(offerRaw?.status);
  const lastPix = String(offerRaw?.payment?.lastPixStatus || "")
    .trim()
    .toUpperCase();

  const paid =
    isPaidStatus(status) ||
    !!offerRaw?.paidAt ||
    lastPix === "PAID" ||
    status === "PAID";

  return paid ? "PAID" : "PENDING";
}

function computePublicFlow({ offerRaw, booking }) {
  const status = normalizeOfferStatus(offerRaw?.status);
  const paymentStatus = computePaymentStatus(offerRaw);
  const isPaymentDone =
    paymentStatus === "PAID" || paymentStatus === "CONFIRMED";

  const expiresAt = offerRaw?.expiresAt ? new Date(offerRaw.expiresAt) : null;
  const expired =
    expiresAt &&
    !Number.isNaN(expiresAt.getTime()) &&
    expiresAt.getTime() <= Date.now();

  // expirado/cancelado: terminal
  if (status === "CANCELLED" || status === "CANCELED") {
    return {
      step: "CANCELED",
      reason: "CANCELED",
      bookingId: null,
      paymentStatus,
    };
  }
  if (expired && !isPaymentDone) {
    return {
      step: "EXPIRED",
      reason: "EXPIRED",
      bookingId: null,
      paymentStatus,
    };
  }

  // DONE apenas quando pagamento confirmado
  if (isPaymentDone) {
    return {
      step: "DONE",
      reason: "PAID",
      bookingId: booking?._id ? String(booking._id) : null,
      paymentStatus,
    };
  }

  const type = inferOfferType(offerRaw);

  // aceitar primeiro
  if (status === "PUBLIC" || status === "DRAFT") {
    return {
      step: "ACCEPT",
      reason: "NOT_ACCEPTED",
      bookingId: null,
      type,
      paymentStatus,
    };
  }

  // service: precisa de booking (hold/confirm) antes do payment
  if (type === "service") {
    const bStatus = normalizeOfferStatus(booking?.status);
    const now = Date.now();
    const holdOk =
      bStatus === "HOLD" &&
      (booking?.holdExpiresAt ? new Date(booking.holdExpiresAt).getTime() : 0) >
        now;

    const confirmed = bStatus === "CONFIRMED" || bStatus === "PAID";

    if (!confirmed && !holdOk) {
      return {
        step: "SCHEDULE",
        reason: "NEEDS_BOOKING",
        bookingId: null,
        type,
        paymentStatus,
      };
    }

    return {
      step: "PAYMENT",
      reason: "BOOKED",
      bookingId: booking?._id ? String(booking._id) : null,
      type,
      paymentStatus,
    };
  }

  // product: direto para payment
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
    cancelledAt:
      b.cancelledAt instanceof Date
        ? b.cancelledAt.toISOString()
        : b.cancelledAt || null,
    cancelledBy: b.cancelledBy || "",
    cancelReason: b.cancelReason || "",
  };
}

function normalizeBookingStatusForSlots(st) {
  const s = String(st || "")
    .trim()
    .toUpperCase();
  if (s === "PAID") return "CONFIRMED";
  if (s === "CANCELED") return "CANCELLED";
  return s;
}

function bookingScopeFromOffer(offerRaw) {
  const q = {};
  if (offerRaw?.workspaceId) q.workspaceId = offerRaw.workspaceId;
  if (offerRaw?.ownerUserId) q.ownerUserId = offerRaw.ownerUserId;
  if (!q.workspaceId && !q.ownerUserId) q.offerId = offerRaw._id;
  return q;
}

/**
 * GET /p/:token
 * Retorna offer + flow.step (idempotência do link público)
 */
router.get("/p/:token", async (req, res, next) => {
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

    // booking atual (service)
    const now = new Date();
    let booking = null;

    if (inferOfferType(offerRaw) === "service") {
      if (bookingId && mongoose.isValidObjectId(bookingId)) {
        booking = await Booking.findOne({
          _id: bookingId,
          offerId: offerRaw._id,
        })
          .lean()
          .catch(() => null);
      }

      if (!booking) {
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
    }

    const flow = computePublicFlow({ offerRaw, booking });

    noStore(res);
    return res.json({
      ok: true,
      offer: sanitizeOfferPublic({
        ...offerRaw,
        offerType: offerRaw?.offerType || inferOfferType(offerRaw),
      }),
      booking: booking ? toPublicBooking(booking) : null,
      flow: {
        step: flow.step,
        reason: flow.reason,
        bookingId: flow.bookingId,
        type: flow.type,
        paymentStatus: flow.paymentStatus,
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

    const ps = normalizeOfferStatus(offerRaw?.paymentStatus);
    const offerLocked =
      isPaidStatus(offerRaw?.status) ||
      ps === "PAID" ||
      ps === "CONFIRMED" ||
      !!offerRaw?.paidAt;

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

    const selfService =
      offerType === "service" && booking
        ? await buildPublicBookingSelfServiceState({
            offerRaw,
            booking,
            now,
          })
        : null;

    const summary = {
      locked: offerLocked || booking?.status === "CONFIRMED",
      paidAt,
      offer: sanitizeOfferPublic({
        ...offerRaw,
        offerType,
        customerName: offerRaw?.customerName || offerRaw?.customer?.name || "",
      }),
      booking: booking ? toPublicBooking(booking) : null,
      selfService: selfService
        ? {
            ...selfService,
          }
        : null,
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
 * GET /p/:token/manage?bookingId=...
 */
router.get("/p/:token/manage", async (req, res, next) => {
  try {
    const { token } = req.params;
    const bookingId = String(req.query.bookingId || "").trim();

    const summary = await getPublicBookingManageSummary({ token, bookingId });

    noStore(res);
    return res.json({ ok: true, summary });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /p/:token/manage/slots?bookingId=...&date=YYYY-MM-DD
 */
router.get("/p/:token/manage/slots", async (req, res, next) => {
  try {
    const { token } = req.params;
    const bookingId = String(req.query.bookingId || "").trim();
    const date = String(req.query.date || "").trim();

    const payload = await listPublicBookingManageSlots({
      token,
      bookingId,
      date,
    });

    noStore(res);
    return res.json({ ok: true, ...payload });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /p/:token/manage/reschedule
 */
router.post("/p/:token/manage/reschedule", async (req, res, next) => {
  try {
    const { token } = req.params;
    const bookingId = String(req.body?.bookingId || "").trim();
    const startAt = req.body?.startAt ?? req.body?.start;
    const endAt = req.body?.endAt ?? req.body?.end;

    const payload = await reschedulePublicBooking({
      token,
      bookingId,
      startAt,
      endAt,
    });

    noStore(res);
    return res.json({ ok: true, ...payload });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /p/:token/manage/cancel
 */
router.post("/p/:token/manage/cancel", async (req, res, next) => {
  try {
    const { token } = req.params;
    const bookingId = String(req.body?.bookingId || "").trim();
    const reason = String(req.body?.reason || "").trim();

    const payload = await cancelPublicBooking({
      token,
      bookingId,
      reason,
    });

    noStore(res);
    return res.json({ ok: true, ...payload });
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

    try {
      acceptances.set(token, {
        agreeTerms: true,
        acceptedAt: acceptedAtDate.toISOString(),
      });
    } catch {}

    await Offer.updateOne(
      { _id: offerRaw._id },
      {
        $set: {
          status: "ACCEPTED",
          acceptedAt: offerRaw.acceptedAt || acceptedAtDate,
          paymentMethod: "MANUAL_PIX",
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
      paymentMethod: "MANUAL_PIX",
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
    } catch {
      agenda = DEFAULT_AGENDA;
    }

    const tz =
      agenda?.timezone || DEFAULT_AGENDA.timezone || "America/Sao_Paulo";
    const { dayStart, dayEnd } = dayRangeInTZ(date, tz);
    const now = new Date();

    const scope = bookingScopeFromOffer(offerRaw);

    const bookings = await Booking.find({
      ...scope,
      startAt: { $gte: dayStart, $lt: dayEnd },
      $or: [
        { status: { $in: ["CONFIRMED", "PAID"] } },
        { status: "HOLD", holdExpiresAt: { $gt: now } },
      ],
    })
      .select("startAt endAt status holdExpiresAt")
      .lean()
      .catch(() => []);

    const busy = bookings
      .map((b) => ({
        startAt: b.startAt,
        endAt: b.endAt,
        status: normalizeBookingStatusForSlots(b.status),
      }))
      .filter((b) => b.startAt && b.endAt);

    const dayAgenda = resolveAgendaForDate(agenda, date);
    const slots = buildSlotsForDate({ dayAgenda, date, durationMin, tz });

    const blocked = slots.map((s) => {
      const slotStart = new Date(s.startAt);
      const slotEnd = new Date(s.endAt);

      const overlaps = busy.some((b) => {
        const bs = new Date(b.startAt);
        const be = new Date(b.endAt);
        return slotStart < be && slotEnd > bs;
      });

      return { ...s, available: !overlaps };
    });

    noStore(res);
    return res.json({ ok: true, slots: blocked });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /p/:token/book
 * cria/renova HOLD
 */
router.post("/p/:token/book", async (req, res, next) => {
  try {
    await expireOldHolds();

    const { token } = req.params;

    // ✅ aceita ambos formatos
    const startRaw = req.body?.startAt ?? req.body?.start;
    const endRaw = req.body?.endAt ?? req.body?.end;

    const customerName = String(req.body?.customerName || "").trim();
    const customerWhatsApp = String(req.body?.customerWhatsApp || "").trim();

    if (!token)
      return res.status(400).json({ ok: false, error: "Token inválido." });

    const offerRaw = await findOfferByPublicToken(token, { withTenant: true });
    if (!offerRaw)
      return res
        .status(404)
        .json({ ok: false, error: "Proposta não encontrada." });

    if (inferOfferType(offerRaw) !== "service") {
      return res
        .status(400)
        .json({ ok: false, error: "Agendamento só para serviços." });
    }

    if (isPaidStatus(offerRaw?.status)) {
      return res.status(410).json({
        ok: false,
        error: "Esta proposta já foi concluída (paga).",
        locked: true,
        doneOnly: true,
      });
    }

    const startAt = new Date(startRaw);
    const endAt = new Date(endRaw);

    if (
      !startRaw ||
      !endRaw ||
      Number.isNaN(startAt.getTime()) ||
      Number.isNaN(endAt.getTime()) ||
      endAt <= startAt
    ) {
      return res.status(400).json({
        ok: false,
        error: "Horário inválido.",
        details: { startRaw, endRaw },
      });
    }

    const now = new Date();
    const holdExpiresAt = new Date(now.getTime() + HOLD_MINUTES * 60 * 1000);

    // escopo por vendedor (workspaceId + ownerUserId) — mantém sua lógica
    const scope = bookingScopeFromOffer(offerRaw);

    const conflict = await Booking.findOne({
      ...scope,
      startAt: { $lt: endAt },
      endAt: { $gt: startAt },
      $or: [
        { status: { $in: ["CONFIRMED", "PAID"] } },
        { status: "HOLD", holdExpiresAt: { $gt: now } },
      ],
    })
      .select("_id")
      .lean()
      .catch(() => null);

    if (conflict) {
      return res.status(409).json({
        ok: false,
        error: "Este horário já foi reservado. Escolha outro.",
      });
    }

    const booking = await Booking.create({
      ...(offerRaw?.workspaceId ? { workspaceId: offerRaw.workspaceId } : {}),
      ...(offerRaw?.ownerUserId ? { ownerUserId: offerRaw.ownerUserId } : {}),
      offerId: offerRaw._id,

      startAt,
      endAt,

      status: "HOLD",
      holdExpiresAt,

      customerName: customerName || undefined,
      customerWhatsApp: customerWhatsApp || undefined,

      payment: {
        provider: "MANUAL_PIX",
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

// GET /p/:token/payment/details  (MANUAL_PIX)
router.get("/p/:token/payment/details", async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!token)
      return res.status(400).json({ ok: false, error: "Token inválido." });

    const offerRaw = await findOfferByPublicToken(token, { withTenant: true });
    if (!offerRaw)
      return res
        .status(404)
        .json({ ok: false, error: "Proposta não encontrada." });

    const ws = await Workspace.findById(offerRaw.workspaceId)
      .select("name payoutPixKeyType payoutPixKey payoutPixKeyMasked")
      .lean();

    if (!ws)
      return res
        .status(404)
        .json({ ok: false, error: "Workspace não encontrado." });

    if (!ws.payoutPixKey) {
      return res.status(400).json({
        ok: false,
        error:
          "O vendedor ainda não configurou a chave Pix. Abra: Conta Pix (Dashboard).",
        code: "PIX_KEY_MISSING",
      });
    }

    // valor a pagar (usa seu helper existente)
    const { amountCents } = computeAmountCents(offerRaw);

    // normaliza chave (principalmente PHONE)
    const type = String(ws.payoutPixKeyType || "").toUpperCase();
    let pixKey = String(ws.payoutPixKey || "").trim();

    if (type === "PHONE") {
      const digits = pixKey.replace(/\D+/g, "");
      if (pixKey.startsWith("+")) {
        // ok
      } else if (digits.length === 10 || digits.length === 11) {
        pixKey = `+55${digits}`;
      } else if (
        (digits.length === 12 || digits.length === 13) &&
        digits.startsWith("55")
      ) {
        pixKey = `+${digits}`;
      }
    }

    // TXID deve ser alfanumérico (sem hífen/underscore)
    const txid = `LUMINOR${String(offerRaw._id).slice(-18)}`
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

    const receiverName = ws.name || "RECEBEDOR";
    const receiverCity = "SAO PAULO"; // opcional: depois você pode salvar cidade no Workspace

    const brCode = buildPixBrCode({
      pixKey,
      amountCents,
      receiverName,
      receiverCity,
      txid,
      description: String(offerRaw.title || "Pagamento").slice(0, 50),
    });

    noStore(res);
    return res.json({
      ok: true,
      amountCents,
      pixKey, // público somente via token
      pixKeyType: ws.payoutPixKeyType || null,
      pixKeyMasked: ws.payoutPixKeyMasked || null,
      receiverName,
      receiverCity,
      txid,
      brCode,
    });
  } catch (e) {
    next(e);
  }
});
/**
 * GET /p/:token/payment/proof/status
 */
router.get("/p/:token/payment/proof/status", async (req, res, next) => {
  try {
    const { token } = req.params;
    const offer = await Offer.findOne({ publicToken: token })
      .select("paymentStatus rejectedReason confirmedAt paymentProof")
      .lean();

    if (!offer)
      return res
        .status(404)
        .json({ ok: false, error: "Proposta não encontrada." });

    noStore(res);
    return res.json({
      ok: true,
      paymentStatus: offer.paymentStatus || "PENDING",
      hasProof: !!offer.paymentProof?.storage?.path,
      rejectedReason: offer.rejectedReason || null,
      confirmedAt: offer.confirmedAt || null,
    });
  } catch (e) {
    next(e);
  }
});
async function loadOfferForProof(req, res, next) {
  try {
    const { token } = req.params;
    if (!token)
      return res.status(400).json({ ok: false, error: "Token inválido." });

    const offerRaw = await findOfferByPublicToken(token, { withTenant: true });
    if (!offerRaw)
      return res
        .status(404)
        .json({ ok: false, error: "Proposta não encontrada." });

    req.offerRaw = offerRaw;
    next();
  } catch (e) {
    next(e);
  }
}

function sendPublicProofUploadError(res, status, code, error) {
  return res.status(status).json({ ok: false, code, error });
}

/**
 * POST /p/:token/payment/proof (multipart/form-data)
 * - file (obrigatório): jpg/png/pdf
 * - note (opcional)
 */
router.post("/p/:token/payment/proof", async (req, res, next) => {
  try {
    const { token } = req.params;

    const offer = await findOfferByPublicToken(token, { withTenant: true });
    if (!offer) {
      return sendPublicProofUploadError(
        res,
        404,
        "OFFER_NOT_FOUND",
        "Proposta nao encontrada.",
      );
    }

    // ✅ trava se já estiver confirmado
    const ps = String(offer?.paymentStatus || "")
      .trim()
      .toUpperCase();
    if (ps === "PAID" || ps === "CONFIRMED" || offer?.paidAt) {
      return sendPublicProofUploadError(
        res,
        409,
        "ALREADY_CONFIRMED",
        "Pagamento ja confirmado.",
      );
    }

    // ✅ passa offerId para o filename do multer
    req.offerIdForUpload = String(offer._id);

    // ✅ roda multer e só depois lê req.body.note (multipart)
    uploadPaymentProof.single("file")(req, res, async (err) => {
      try {
        if (err) {
          const isSize = err?.code === "LIMIT_FILE_SIZE";
          const isTypeError = err?.statusCode === 400;
          const code = isSize
            ? "FILE_TOO_LARGE"
            : isTypeError
              ? "INVALID_FILE_TYPE"
              : "UPLOAD_FAILED";
          const status = isSize ? 413 : 400;
          const message = isSize
            ? "Arquivo muito grande. Envie um comprovante com ate 10MB."
            : isTypeError
              ? err.message
              : "Falha no upload do comprovante. Tente novamente com uma conexao estavel e um arquivo menor.";

          console.warn("[public-payment-proof] upload rejected", {
            offerId: String(offer._id),
            code,
            detail: err?.message || "",
            contentType: String(req.headers["content-type"] || ""),
          });

          return sendPublicProofUploadError(res, status, code, message);
        }

        const f = req.file;
        if (!f) {
          return sendPublicProofUploadError(
            res,
            400,
            "MISSING_FILE",
            "Selecione um comprovante em JPG, PNG ou PDF antes de enviar.",
          );
        }

        const note = String(req.body?.note || "").trim();

        // caminho relativo (compat com seu static /uploads no app.js) :contentReference[oaicite:4]{index=4}
        const relPath = path.posix.join(
          "uploads",
          "payment-proofs",
          f.filename,
        );

        const proof = {
          storage: {
            provider: "local",
            key: String(f.filename || ""),
            path: relPath,
            url: null,
          },
          originalName: String(f.originalname || ""),
          mimeType: String(f.mimetype || ""),
          size: Number(f.size || 0),
          uploadedAt: new Date(),
          uploadedBy: "public",
          note: note || null,
        };

        await Offer.updateOne(
          { _id: offer._id },
          {
            $set: {
              paymentMethod: "MANUAL_PIX",
              paymentStatus: "WAITING_CONFIRMATION",
              paymentProof: proof,
              rejectedAt: null,
              rejectedByUserId: null,
              rejectionNote: null,
            },
          },
          { strict: false },
        );

        // ✅ dispara e-mail para o vendedor (com idempotência por offerId + proofKey)
        let email = null;
        try {
          const notificationContext = await resolveWorkspaceNotificationContext({
            workspaceId: offer?.workspaceId || null,
            ownerUserId: offer?.ownerUserId || null,
          });

          if (
            !isEmailNotificationEnabled(
              notificationContext,
              "sellerProofSubmitted",
            )
          ) {
            email = {
              status: "SKIPPED",
              reason:
                notificationContext?.capabilities?.environment?.email
                  ?.available !== true
                  ? notificationContext?.capabilities?.environment?.email
                      ?.reason || "EMAIL_UNAVAILABLE"
                  : "WORKSPACE_SETTING_DISABLED",
            };
          } else {
          const fullOffer = await Offer.findById(offer._id)
            .lean()
            .catch(() => null);

          // booking é opcional (só para enriquecer email quando for serviço)
          let booking = null;
          try {
            booking = await Booking.findOne({
              offerId: offer._id,
              ...(offer?.workspaceId ? { workspaceId: offer.workspaceId } : {}),
            })
              .sort({ startAt: -1 })
              .lean();
          } catch {}

          const r = await notifySellerPaymentProofSubmitted({
            offerId: offer._id,
            offer: fullOffer || offer,
            booking,
            proof,
          });

          if (r?.skipped) {
            email = { status: "SKIPPED", reason: r.reason || "" };
          } else {
            email = { status: "SENT", id: r?.id || null, to: r?.to || "" };
          }
          }

          console.log("[email] proof submitted", {
            offerId: String(offer._id),
            to: email?.to,
            proofKey: String(proof?.storage?.key || ""),
            status: email?.status,
          });
        } catch (e3) {
          email = { status: "FAILED", error: e3?.message || "email_failed" };
          console.warn("[email] proof submitted failed", {
            offerId: String(offer._id),
            proofKey: String(proof?.storage?.key || ""),
            err: e3?.message || String(e3),
          });
        }

        noStore(res);
        return res.json({ ok: true, email });
      } catch (e2) {
        return next(e2);
      }
    });
  } catch (e) {
    next(e);
  }
});
/**
 * Endpoints legados do gateway antigo, mantidos apenas para compatibilidade.
 */
router.post("/p/:token/pix/create", (req, res) => {
  return sendLegacyPixEndpointDisabled(res, { refreshHint: true });
});

router.get("/p/:token/pix/status", (req, res) => {
  return sendLegacyPixEndpointDisabled(res, { refreshHint: true });
});

router.post("/p/:token/pix/dev/simulate", (req, res) => {
  return sendLegacyPixEndpointDisabled(res);
});

export default router;
