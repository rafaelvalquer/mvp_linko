// server/src/routes/public.routes.js
import express from "express";
import mongoose from "mongoose";
import { Offer } from "../models/Offer.js";
import Booking from "../models/Booking.js";

import { acceptances, pixCharges } from "../mvpStore.js";
import {
  abacateCreatePixQr,
  abacateCheckPix,
  abacateSimulatePixPayment,
} from "../services/abacatepayClient.js";

const router = express.Router();

const HOLD_MINUTES = 15;
const PIX_EXPIRES_IN = Number(process.env.PIX_EXPIRES_IN || 3600); // segundos

function nowIso() {
  return new Date().toISOString();
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

function computeAmountCents(offer) {
  const totalCents =
    (Number.isFinite(offer?.totalCents) && offer.totalCents) ||
    (Number.isFinite(offer?.amountCents) && offer.amountCents) ||
    0;

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
  const times = ["09:00", "10:00", "14:00", "16:00", "18:00"];
  const dur = Number(durationMin) > 0 ? Number(durationMin) : 60;

  return times.map((hhmm) => {
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

/**
 * Busca offer por token público.
 * - withTenant=true: traz workspaceId/ownerUserId para derivar tenant do Booking
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
  // garante que não vaze tenant mesmo se veio com withTenant=true
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
// suporta retorno { data: {...} } ou direto {...}
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

  if (Array.isArray(pixCharges)) {
    const i = pixCharges.findIndex((x) => x?.pixId === charge.pixId);
    if (i >= 0) pixCharges[i] = { ...pixCharges[i], ...charge };
    else pixCharges.push(charge);
    return;
  }
  if (typeof pixCharges.set === "function") {
    pixCharges.set(charge.pixId, charge);
    return;
  }
  pixCharges[charge.pixId] = charge;
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
    status: b.status,
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

async function markAsPaid({ token, offerId, bookingId, pix }) {
  const paidAt = new Date();
  const paidAtIso = paidAt.toISOString();

  // offer -> PAID + trava pública
  if (offerId) {
    await Offer.updateOne(
      { _id: offerId },
      {
        $set: {
          status: "PAID",
          paidAt: paidAtIso,
          publicDoneOnly: true,
          publicLockedAt: paidAtIso,
        },
      },
      { strict: false },
    ).catch(() => {});
  }

  // rastro do pix no offer.payment.*
  await updateOfferPayment(offerId, {
    lastPixId: pix?.id,
    lastPixStatus: "PAID",
    lastPixExpiresAt: toDateOrNull(pix?.expiresAt) || undefined,
    lastPixUpdatedAt: paidAt,
  });

  // booking -> CONFIRMED (se existir)
  if (bookingId && mongoose.isValidObjectId(bookingId)) {
    await updateBookingPayment(bookingId, {
      status: "CONFIRMED",
      payment: {
        provider: "ABACATEPAY",
        providerPaymentId: pix?.id,
        status: "PAID",
        paidAt,
      },
    });
  }

  upsertPixCharge({
    pixId: pix?.id,
    bookingId: bookingId || null,
    token,
    status: "PAID",
    paidAt: paidAtIso,
    updatedAt: paidAtIso,
    pix,
  });

  return paidAtIso;
}

/**
 * GET /p/:token  -> retorna offer pública (+ locked/doneOnly)
 */
router.get("/p/:token", async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!token)
      return res.status(400).json({ ok: false, error: "Token inválido." });

    const offerRaw = await findOfferByPublicToken(token, { withTenant: true });
    if (!offerRaw)
      return res
        .status(404)
        .json({ ok: false, error: "Proposta não encontrada." });

    const offer = sanitizeOfferPublic(offerRaw);
    const locked = isPaidStatus(offerRaw?.status);

    return res.json({ ok: true, offer, locked, doneOnly: locked });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /p/:token/summary?bookingId=...
 * -> resumo final (somente leitura). Usado pelo /done
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

    // booking: busca por _id (se veio) e valida offerId, senão pega o mais recente
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
 * POST /p/:token/accept
 */
router.post("/p/:token/accept", async (req, res, next) => {
  try {
    const { token } = req.params;
    const { agreeTerms, ackDeposit, acceptedAt } = req.body || {};

    if (!token)
      return res.status(400).json({ ok: false, error: "Token inválido." });
    if (!agreeTerms)
      return res.status(400).json({ ok: false, error: "Aceite obrigatório." });

    const offerRaw = await findOfferByPublicToken(token, { withTenant: true });
    if (offerRaw && isPaidStatus(offerRaw?.status)) {
      return res
        .status(409)
        .json({ ok: false, error: "Proposta já concluída." });
    }

    if (acceptances?.set) {
      acceptances.set(token, {
        agreeTerms: true,
        ackDeposit: !!ackDeposit,
        acceptedAt: acceptedAt || nowIso(),
      });
    }

    try {
      await Offer.updateOne(
        { publicToken: token },
        { $set: { status: "ACCEPTED", acceptedAt: acceptedAt || nowIso() } },
      );
    } catch {
      // ignora
    }

    return res.json({ ok: true });
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

    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59.999`);
    const now = new Date();

    // busca bookings ativos do dia (HOLD válido ou CONFIRMED)
    const activeBookings = await Booking.find({
      offerId: offerRaw._id,
      startAt: { $lt: dayEnd },
      endAt: { $gt: dayStart },
      $or: [
        { status: "CONFIRMED" },
        { status: "HOLD", holdExpiresAt: { $gt: now } },
      ],
    })
      .select("_id startAt endAt status holdExpiresAt")
      .lean();

    const slots = buildDaySlots(date, durationMin).map((s) => {
      const conflict = activeBookings.find((b) =>
        overlaps(s.startAt, s.endAt, b.startAt, b.endAt),
      );
      return conflict ? { ...s, status: conflict.status } : s;
    });

    return res.json({ ok: true, date, slots });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /p/:token/book
 * Body: { startAt, endAt, customerName, customerWhatsApp? }
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
    const workspaceId =
      offerRaw.workspaceId || process.env.LEGACY_WORKSPACE_ID || null;
    const ownerUserId = offerRaw.ownerUserId || null;

    if (!workspaceId || !ownerUserId) {
      return res.status(500).json({
        ok: false,
        error:
          "Oferta sem tenant (workspaceId/ownerUserId). Ajuste a migração das offers.",
      });
    }

    const now = new Date();

    // conflito via Mongo (mesma offer)
    const conflict = await Booking.findOne({
      offerId: offerRaw._id,
      startAt: { $lt: e },
      endAt: { $gt: s },
      $or: [
        { status: "CONFIRMED" },
        { status: "HOLD", holdExpiresAt: { $gt: now } },
      ],
    })
      .select("_id")
      .lean();

    if (conflict)
      return res
        .status(409)
        .json({ ok: false, error: "Horário indisponível." });

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

    return res.json({ ok: true, booking: toPublicBooking(booking.toObject()) });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /p/:token/pix/create
 * Body:
 *  - service: { bookingId, customer: { name, cellphone, email, taxId } }
 *  - product: { customer: { name, cellphone, email, taxId } }  (SEM bookingId)
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

    const effectiveBookingId = String(
      (bookingId && String(bookingId).trim()) || (isProduct ? token : ""),
    ).trim();

    if (!effectiveBookingId) {
      return res
        .status(400)
        .json({ ok: false, error: "bookingId obrigatório." });
    }

    // se já pago, trava
    if (isPaidStatus(offerRaw?.status)) {
      return res.status(409).json({
        ok: false,
        error: "Pagamento já confirmado.",
        locked: true,
        doneOnly: true,
      });
    }

    // serviço: valida HOLD no Mongo
    let booking = null;
    if (!isProduct) {
      if (!mongoose.isValidObjectId(effectiveBookingId)) {
        return res
          .status(400)
          .json({ ok: false, error: "bookingId inválido." });
      }

      booking = await Booking.findOne({
        _id: effectiveBookingId,
        offerId: offerRaw._id,
        status: "HOLD",
        holdExpiresAt: { $gt: new Date() },
      }).lean();

      if (!booking) {
        return res.status(409).json({
          ok: false,
          error: "Reserva inválida/expirada. Refaça o agendamento.",
        });
      }
    }

    // idempotência:
    // - serviço: reutiliza o pix do booking (payment.providerPaymentId) se não terminal
    // - produto: reutiliza o lastPixId do offer.payment se não terminal
    const existingPixId = !isProduct
      ? booking?.payment?.providerPaymentId
      : offerRaw?.payment?.lastPixId;

    if (existingPixId) {
      const chk = await abacateCheckPix({ pixId: existingPixId });
      const pixDataRaw = pickPixData(chk);

      if (pixDataRaw?.id) {
        const st = normalizePixStatus(pixDataRaw.status);
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
        // se terminal, segue e cria outro
      }
    }

    const name = String(customer?.name || "").trim();
    const cellphone = String(customer?.cellphone || "").trim();
    const email = String(customer?.email || "").trim();
    const taxId = onlyDigits(customer?.taxId);

    if (!name || !cellphone || !email || !taxId) {
      return res.status(400).json({
        ok: false,
        error:
          "Dados do pagador incompletos (nome, celular, email e CPF/CNPJ).",
      });
    }

    const { amountCents } = computeAmountCents(offerRaw);
    if (!amountCents || amountCents <= 0) {
      return res
        .status(400)
        .json({ ok: false, error: "Valor inválido para cobrança." });
    }

    // expiração:
    // - serviço: alinhada com HOLD restante
    // - produto: PIX_EXPIRES_IN
    let expiresIn = Math.max(60, PIX_EXPIRES_IN);

    if (!isProduct) {
      const nowMs = Date.now();
      const holdMs = new Date(booking.holdExpiresAt).getTime();
      const remainingHoldSec = Math.max(
        60,
        Math.floor((holdMs - nowMs) / 1000),
      );
      expiresIn = Math.min(
        Math.max(60, remainingHoldSec),
        Math.max(60, PIX_EXPIRES_IN),
      );
    }

    const metadata = { externalId: String(effectiveBookingId) };

    const ab = await abacateCreatePixQr({
      amount: amountCents,
      expiresIn,
      description: shortDesc(offerRaw?.title || "Pagamento via Pix"),
      customer: { name, cellphone, email, taxId },
      metadata,
    });

    const pixDataRaw = pickPixData(ab);
    if (!pixDataRaw?.id) {
      return res.status(502).json({ ok: false, error: "Falha ao gerar Pix." });
    }

    const st = normalizePixStatus(pixDataRaw.status || "PENDING");
    const expiresAtIso = computeExpiresAtIso(pixDataRaw, expiresIn);

    // persiste rastro do pix no offer
    await updateOfferPayment(offerRaw._id, {
      lastPixId: pixDataRaw.id,
      lastPixStatus: st,
      lastPixExpiresAt: toDateOrNull(expiresAtIso) || undefined,
      lastPixUpdatedAt: new Date(),
    });

    // serviço: grava pix no booking.payment
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

    const ab = await abacateCheckPix({ pixId });
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

    // tenta achar booking:
    // 1) pelo metadata.externalId (service)
    // 2) pelo payment.providerPaymentId (fallback)
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
      paidAt = await markAsPaid({
        token,
        offerId: offerRaw._id,
        bookingId,
        pix: { ...pixDataRaw, status: st, expiresAt: expiresAtIso },
      });
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
