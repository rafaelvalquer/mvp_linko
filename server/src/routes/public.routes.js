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

/** Expira HOLDs antigos no Mongo (substitui array em memória) */
async function expireOldHolds() {
  const now = new Date();
  await Booking.updateMany(
    { status: "HOLD", holdExpiresAt: { $lte: now } },
    { $set: { status: "EXPIRED" } },
  ).catch(() => {});
}

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

/** Busca offer por token público (mantém tenant internamente; sanitiza antes de responder) */
async function findOfferByPublicToken(token) {
  const offer =
    (await Offer.findOne({ publicToken: token }).lean()) ||
    (await Offer.findOne({ token }).lean()) ||
    (await Offer.findOne({ publicId: token }).lean());
  return offer || null;
}

function sanitizeOfferPublic(offer) {
  if (!offer) return null;
  const o = { ...offer };
  delete o.workspaceId;
  delete o.ownerUserId;
  delete o.__v;
  return o;
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
 * - offerType === "product" => produto
 * - se não houver offerType mas existir items => produto
 * - senão => service
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

/** -----------------------------
 *  Pix status helpers + persistência
 * ------------------------------ */
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
function toDateOrNull(iso) {
  if (!iso) return null;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  return t;
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

async function markAsPaid({ token, offerId, bookingId, pix }) {
  const paidAtIso = nowIso();
  const paidAt = new Date(paidAtIso);

  if (bookingId && mongoose.Types.ObjectId.isValid(String(bookingId))) {
    await Booking.updateOne(
      { _id: bookingId },
      {
        $set: {
          status: "CONFIRMED",
          confirmedAt: paidAt,
          "payment.status": "PAID",
          "payment.paidAt": paidAt,
          ...(pix?.id ? { "payment.providerPaymentId": pix.id } : {}),
          ...(pix?.amount ? { "payment.amountCents": Number(pix.amount) } : {}),
        },
      },
      { strict: false },
    ).catch(() => {});
  }

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

  await updateOfferPayment(offerId, {
    lastPixId: pix?.id,
    lastPixStatus: "PAID",
    lastPixExpiresAt: toDateOrNull(pix?.expiresAt) || undefined,
    lastPixUpdatedAt: paidAt,
  });

  upsertPixCharge({
    pixId: pix?.id,
    bookingId: bookingId ? String(bookingId) : null,
    token,
    status: "PAID",
    paidAt: paidAtIso,
    updatedAt: paidAtIso,
    pix,
  });

  return paidAtIso;
}

function pickExternalId(pixDataRaw) {
  return String(
    pixDataRaw?.metadata?.externalId || pixDataRaw?.metadata?.external_id || "",
  ).trim();
}

async function findActiveConflicts({ offerId, startAt, endAt, now }) {
  return Booking.exists({
    offerId,
    startAt: { $lt: endAt },
    endAt: { $gt: startAt },
    status: { $in: ["HOLD", "CONFIRMED"] },
    $or: [
      { status: "CONFIRMED" },
      { status: "HOLD", holdExpiresAt: { $gt: now } },
    ],
  });
}

/**
 * GET /p/:token  -> retorna offer pública (+ locked/doneOnly)
 */
router.get("/p/:token", async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!token)
      return res.status(400).json({ ok: false, error: "Token inválido." });

    const offer = await findOfferByPublicToken(token);
    if (!offer)
      return res
        .status(404)
        .json({ ok: false, error: "Proposta não encontrada." });

    const locked = isPaidStatus(offer?.status);
    return res.json({
      ok: true,
      offer: sanitizeOfferPublic(offer),
      locked,
      doneOnly: locked,
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

    const offer = await findOfferByPublicToken(token);
    if (!offer)
      return res
        .status(404)
        .json({ ok: false, error: "Proposta não encontrada." });

    const offerLocked = isPaidStatus(offer?.status);
    const offerType = offer?.offerType || inferOfferType(offer);

    const amounts = computeAmountCents(offer);
    const amountToChargeCents = amounts.amountCents;

    // booking (Mongo)
    let booking = null;

    if (bookingId && mongoose.Types.ObjectId.isValid(bookingId)) {
      booking = await Booking.findOne({
        _id: bookingId,
        offerId: offer._id,
      })
        .select("status startAt endAt payment holdExpiresAt")
        .lean();
    } else {
      // tenta o mais recente CONFIRMED; fallback HOLD ainda válido
      booking =
        (await Booking.findOne({
          offerId: offer._id,
          status: "CONFIRMED",
        })
          .sort({ updatedAt: -1, startAt: -1 })
          .select("status startAt endAt payment holdExpiresAt")
          .lean()) ||
        (await Booking.findOne({
          offerId: offer._id,
          status: "HOLD",
          holdExpiresAt: { $gt: new Date() },
        })
          .sort({ updatedAt: -1, startAt: -1 })
          .select("status startAt endAt payment holdExpiresAt")
          .lean());
    }

    const paidAt =
      offer?.paidAt || booking?.payment?.paidAt || booking?.paidAt || null;

    const locked = offerLocked || booking?.status === "CONFIRMED";

    const summary = {
      locked,
      paidAt,
      offer: offer
        ? {
            ...sanitizeOfferPublic(offer),
            offerType,
            customerName: offer?.customerName || offer?.customer?.name || "",
          }
        : null,
      booking: booking
        ? {
            id: String(booking._id),
            status: booking.status,
            startAt: booking.startAt,
            endAt: booking.endAt,
          }
        : null,
      totalCents: amounts.totalCents,
      depositEnabled: amounts.depositEnabled,
      depositPct: amounts.depositPct,
      depositCents: amounts.depositCents,
      amountToChargeCents,
      // mantém payment no summary para o /done (se quiser)
      payment: offer?.payment ? { ...offer.payment } : undefined,
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

    const offer = await findOfferByPublicToken(token);
    if (offer && isPaidStatus(offer?.status)) {
      return res
        .status(409)
        .json({ ok: false, error: "Proposta já concluída." });
    }

    try {
      acceptances?.set?.(token, {
        agreeTerms: true,
        ackDeposit: !!ackDeposit,
        acceptedAt: acceptedAt || nowIso(),
      });
    } catch {}

    try {
      await Offer.updateOne(
        { publicToken: token },
        { $set: { status: "ACCEPTED", acceptedAt: acceptedAt || nowIso() } },
        { strict: false },
      );
    } catch {}

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

    const offer = await findOfferByPublicToken(token);
    if (!offer)
      return res
        .status(404)
        .json({ ok: false, error: "Proposta não encontrada." });

    if (isPaidStatus(offer?.status)) {
      return res.status(410).json({
        ok: false,
        error: "Esta proposta já foi concluída (paga).",
        locked: true,
        doneOnly: true,
      });
    }

    const durationMin =
      Number(offer?.durationMin) > 0 ? Number(offer.durationMin) : 60;

    const now = new Date();

    // range do dia (base local, igual ao buildDaySlots)
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const dayBookings = await Booking.find({
      offerId: offer._id,
      status: { $in: ["HOLD", "CONFIRMED"] },
      startAt: { $lt: dayEnd },
      endAt: { $gt: dayStart },
      $or: [
        { status: "CONFIRMED" },
        { status: "HOLD", holdExpiresAt: { $gt: now } },
      ],
    })
      .select("status startAt endAt holdExpiresAt")
      .lean();

    const slots = buildDaySlots(date, durationMin).map((s) => {
      const conflict = dayBookings.find((b) =>
        overlaps(s.startAt, s.endAt, b.startAt, b.endAt),
      );
      return conflict ? { ...s, status: conflict.status } : s;
    });

    noStore(res);
    return res.json({ ok: true, date, slots });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /p/:token/book
 * Body: { startAt, endAt, customerName?, customerWhatsApp? }
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
      return res
        .status(400)
        .json({ ok: false, error: "Intervalo startAt/endAt inválido." });
    }

    const offer = await findOfferByPublicToken(token);
    if (!offer)
      return res
        .status(404)
        .json({ ok: false, error: "Proposta não encontrada." });

    if (isPaidStatus(offer?.status)) {
      return res.status(410).json({
        ok: false,
        error: "Esta proposta já foi concluída (paga).",
        locked: true,
        doneOnly: true,
      });
    }

    const now = new Date();
    const hasConflict = await findActiveConflicts({
      offerId: offer._id,
      startAt: s,
      endAt: e,
      now,
    });

    if (hasConflict) {
      return res
        .status(409)
        .json({ ok: false, error: "Horário indisponível." });
    }

    const holdExpiresAt = new Date(now.getTime() + HOLD_MINUTES * 60 * 1000);

    const created = await Booking.create({
      offerId: offer._id,
      workspaceId: offer.workspaceId,
      ownerUserId: offer.ownerUserId,
      publicToken: offer.publicToken || token,
      customerName: String(customerName || offer.customerName || "").trim(),
      customerWhatsApp: String(customerWhatsApp || offer.customerWhatsApp || "")
        .trim()
        .replace(/\s+/g, " "),
      startAt: s,
      endAt: e,
      status: "HOLD",
      holdExpiresAt,
      payment: {
        provider: "ABACATEPAY",
        status: "PENDING",
      },
    });

    // ✅ compat/UX: salva referência do agendamento na Offer (ajuda dashboard/legacy)
    await Offer.updateOne(
      { _id: offer._id },
      {
        $set: {
          bookingId: created._id,
          scheduledStartAt: s,
          scheduledEndAt: e,
        },
      },
      { strict: false },
    ).catch(() => {});

    const booking = {
      id: String(created._id),
      status: created.status,
      startAt: created.startAt,
      endAt: created.endAt,
      holdExpiresAt: created.holdExpiresAt,
    };

    noStore(res);
    return res.json({ ok: true, booking });
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

    const offer = await findOfferByPublicToken(token);
    if (!offer)
      return res
        .status(404)
        .json({ ok: false, error: "Proposta não encontrada." });

    const offerType = inferOfferType(offer);
    const isProduct = offerType === "product";

    if (isPaidStatus(offer?.status)) {
      return res.status(409).json({
        ok: false,
        error: "Pagamento já confirmado para esta proposta.",
        locked: true,
        doneOnly: true,
      });
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

    const { amountCents } = computeAmountCents(offer);
    const amount = amountCents;

    if (!amount || amount <= 0) {
      return res
        .status(400)
        .json({ ok: false, error: "Valor inválido para cobrança." });
    }

    const now = new Date();

    // SERVICE: precisa booking HOLD válido
    let booking = null;
    if (!isProduct) {
      const bid = String(bookingId || "").trim();
      if (!bid || !mongoose.Types.ObjectId.isValid(bid)) {
        return res
          .status(400)
          .json({ ok: false, error: "bookingId obrigatório." });
      }

      booking = await Booking.findOne({
        _id: bid,
        offerId: offer._id,
        status: "HOLD",
        holdExpiresAt: { $gt: now },
      }).lean();

      if (!booking) {
        return res.status(409).json({
          ok: false,
          error: "Reserva inválida/expirada. Refaça o agendamento.",
        });
      }
    }

    // idempotência:
    // - service: usa Booking.payment.providerPaymentId
    // - product: usa Offer.payment.lastPixId
    const existingPixId = !isProduct
      ? booking?.payment?.providerPaymentId
      : offer?.payment?.lastPixId;

    if (existingPixId) {
      const chk = await abacateCheckPix({ pixId: existingPixId });
      const pixDataRaw = pickPixData(chk);

      if (pixDataRaw?.id) {
        const st = normalizePixStatus(pixDataRaw.status);
        const expiresAtIso = computeExpiresAtIso(pixDataRaw, PIX_EXPIRES_IN);
        const updatedAt = new Date();

        await updateOfferPayment(offer._id, {
          lastPixId: pixDataRaw.id,
          lastPixStatus: st,
          lastPixExpiresAt: toDateOrNull(expiresAtIso) || undefined,
          lastPixUpdatedAt: updatedAt,
        });

        if (!isProduct && booking?._id) {
          await Booking.updateOne(
            { _id: booking._id },
            {
              $set: {
                "payment.provider": "ABACATEPAY",
                "payment.providerPaymentId": pixDataRaw.id,
                "payment.status": st === "PAID" ? "PAID" : "PENDING",
                "payment.amountCents": amount,
              },
            },
            { strict: false },
          ).catch(() => {});
        }

        if (st === "PAID") {
          const paidAt = await markAsPaid({
            token,
            offerId: offer._id,
            bookingId: !isProduct ? booking?._id : null,
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
        // terminal: cai e cria outro
      }
    }

    // expiração:
    // - service: alinhada ao HOLD
    // - product: PIX_EXPIRES_IN
    let expiresIn = Math.max(60, PIX_EXPIRES_IN);
    if (!isProduct && booking?.holdExpiresAt) {
      const holdMs = new Date(booking.holdExpiresAt).getTime() - now.getTime();
      const remainingHoldSec = Math.max(60, Math.floor(holdMs / 1000));
      expiresIn = Math.min(
        Math.max(60, remainingHoldSec),
        Math.max(60, PIX_EXPIRES_IN),
      );
    }

    // metadata.externalId:
    // - service: bookingId (mongo _id)
    // - product: token (chave estável)
    const metadata = { externalId: String(!isProduct ? booking._id : token) };

    const ab = await abacateCreatePixQr({
      amount,
      expiresIn,
      description: shortDesc(offer?.title || "Pagamento via Pix"),
      customer: { name, cellphone, email, taxId },
      metadata,
    });

    const pixDataRaw = pickPixData(ab);
    if (!pixDataRaw?.id) {
      return res.status(502).json({ ok: false, error: "Falha ao gerar Pix." });
    }

    const st = normalizePixStatus(pixDataRaw.status || "PENDING");
    const expiresAtIso = computeExpiresAtIso(pixDataRaw, expiresIn);

    // persist no Offer
    await updateOfferPayment(offer._id, {
      lastPixId: pixDataRaw.id,
      lastPixStatus: st,
      lastPixExpiresAt: toDateOrNull(expiresAtIso) || undefined,
      lastPixUpdatedAt: new Date(),
    });

    // persist no Booking (service)
    if (!isProduct && booking?._id) {
      await Booking.updateOne(
        { _id: booking._id },
        {
          $set: {
            "payment.provider": "ABACATEPAY",
            "payment.providerPaymentId": pixDataRaw.id,
            "payment.amountCents": amount,
            "payment.status": "PENDING",
          },
        },
        { strict: false },
      ).catch(() => {});
    }

    upsertPixCharge({
      pixId: pixDataRaw.id,
      bookingId: !isProduct ? String(booking?._id) : null,
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

    const offer = await findOfferByPublicToken(token);
    if (!offer)
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

    await updateOfferPayment(offer._id, {
      lastPixId: pixDataRaw.id,
      lastPixStatus: st,
      lastPixExpiresAt: toDateOrNull(expiresAtIso) || undefined,
      lastPixUpdatedAt: updatedAt,
    });

    upsertPixCharge({
      pixId: pixDataRaw.id,
      bookingId: pickExternalId(pixDataRaw) || null,
      token,
      status: st,
      updatedAt: nowIso(),
      pix: { ...pixDataRaw, status: st, expiresAt: expiresAtIso },
    });

    let paidAt = null;
    let locked = false;

    if (st === "PAID") {
      locked = true;

      // tenta achar booking:
      // 1) metadata.externalId = bookingId (service)
      // 2) booking.payment.providerPaymentId == pixId
      const externalId = pickExternalId(pixDataRaw);

      let bookingId = null;

      if (externalId && mongoose.Types.ObjectId.isValid(externalId)) {
        const b = await Booking.findOne({
          _id: externalId,
          offerId: offer._id,
        })
          .select("_id")
          .lean();
        if (b?._id) bookingId = b._id;
      }

      if (!bookingId) {
        const b2 = await Booking.findOne({
          offerId: offer._id,
          "payment.providerPaymentId": pixId,
        })
          .select("_id")
          .lean();
        if (b2?._id) bookingId = b2._id;
      }

      paidAt = await markAsPaid({
        token,
        offerId: offer._id,
        bookingId,
        pix: { ...pixDataRaw, status: st, expiresAt: expiresAtIso },
      });
    }

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
