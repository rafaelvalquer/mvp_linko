// server/src/routes/public.routes.js
import express from "express";
import crypto from "crypto";
import { Offer } from "../models/Offer.js";

import {
  acceptances,
  bookings,
  pixCharges,
  pixByBooking,
} from "../mvpStore.js";
import {
  abacateCreatePixQr,
  abacateCheckPix,
  abacateSimulatePixPayment,
} from "../services/abacatepayClient.js";

const router = express.Router();

const HOLD_MINUTES = 15;
const PIX_EXPIRES_IN = Number(process.env.PIX_EXPIRES_IN || 3600); // fallback (segundos)

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

function cleanupExpiredHolds() {
  const now = Date.now();
  for (let i = bookings.length - 1; i >= 0; i--) {
    const b = bookings[i];
    if (b.status === "HOLD" && b.expiresAt && b.expiresAt <= now) {
      bookings.splice(i, 1);
    }
  }
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

async function findOfferByPublicToken(token) {
  // ✅ evita vazar multi-tenant no público (mesmo que não exista ainda, é seguro)
  const projection = "-workspaceId -ownerUserId -__v";
  const offer =
    (await Offer.findOne({ publicToken: token }).select(projection).lean()) ||
    (await Offer.findOne({ token }).select(projection).lean()) ||
    (await Offer.findOne({ publicId: token }).select(projection).lean());
  return offer || null;
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

// pixByBooking pode ser Map ou objeto
function getPixByBooking(bookingId) {
  if (!pixByBooking) return null;
  if (typeof pixByBooking.get === "function")
    return pixByBooking.get(bookingId) || null;
  return pixByBooking[bookingId] || null;
}
function setPixByBooking(bookingId, val) {
  if (!pixByBooking) return;
  if (typeof pixByBooking.set === "function") pixByBooking.set(bookingId, val);
  else pixByBooking[bookingId] = val;
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

function findConfirmedBooking(token, bookingId) {
  if (bookingId) {
    return (
      bookings.find((b) => b.id === bookingId && b.token === token) || null
    );
  }
  return (
    bookings.find((b) => b.token === token && b.status === "CONFIRMED") ||
    bookings.find((b) => b.token === token && b.status === "HOLD") ||
    null
  );
}

/** -----------------------------
 *  Pix status helpers + persistência
 * ------------------------------ */
function normalizePixStatus(st) {
  const s = String(st || "")
    .trim()
    .toUpperCase();
  // compat: alguns gateways usam "CANCELED" (1 L)
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

async function markAsPaid({ token, offerId, booking, pix }) {
  const paidAt = nowIso();

  // booking -> CONFIRMED
  if (booking) {
    booking.status = "CONFIRMED";
    booking.paidAt = booking.paidAt || paidAt;
    booking.confirmedAt = booking.confirmedAt || paidAt;
  }

  // offer -> PAID + trava pública (done-only)
  if (offerId) {
    await Offer.updateOne(
      { _id: offerId },
      {
        $set: {
          status: "PAID",
          paidAt,
          publicDoneOnly: true,
          publicLockedAt: paidAt,
        },
      },
      { strict: false },
    ).catch(() => {});
  }

  // ✅ também mantém o rastro do Pix na seção payment.*
  await updateOfferPayment(offerId, {
    lastPixId: pix?.id,
    lastPixStatus: "PAID",
    lastPixExpiresAt: toDateOrNull(pix?.expiresAt) || undefined,
    lastPixUpdatedAt: new Date(paidAt),
  });

  // store in-memory
  const externalId = String(
    pix?.metadata?.externalId || pix?.metadata?.external_id || "",
  ).trim();

  if (externalId) {
    setPixByBooking(externalId, {
      pixId: pix?.id,
      status: "PAID",
      paidAt,
      token,
      pix,
    });
  }

  upsertPixCharge({
    pixId: pix?.id,
    bookingId: booking?.id || externalId || null,
    token,
    status: "PAID",
    paidAt,
    updatedAt: paidAt,
    pix,
  });

  return paidAt;
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

    const booking = findConfirmedBooking(token, bookingId);
    const offerType = offer?.offerType || inferOfferType(offer);

    const amounts = computeAmountCents(offer);
    const amountToChargeCents = amounts.amountCents;

    // paidAt do offer ou do booking
    const paidAt = offer?.paidAt || booking?.paidAt || null;

    const summary = {
      locked: offerLocked || booking?.status === "CONFIRMED",
      paidAt,
      // ✅ agora o /done consegue renderizar produtos/itens
      // ✅ mantém público (sem workspaceId/ownerUserId por causa do projection acima)
      offer: offer
        ? {
            ...offer,
            offerType,
            // compat extra: garante string
            customerName: offer?.customerName || offer?.customer?.name || "",
          }
        : null,
      booking: booking
        ? {
            id: booking.id,
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

    // se já pagou, não faz sentido aceitar de novo
    const offer = await findOfferByPublicToken(token);
    if (offer && isPaidStatus(offer?.status)) {
      return res
        .status(409)
        .json({ ok: false, error: "Proposta já concluída." });
    }

    acceptances.set(token, {
      agreeTerms: true,
      ackDeposit: !!ackDeposit,
      acceptedAt: acceptedAt || nowIso(),
    });

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
    cleanupExpiredHolds();

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

    const slots = buildDaySlots(date, durationMin).map((s) => {
      const conflict = bookings.find(
        (b) =>
          b.token === token &&
          (b.status === "HOLD" || b.status === "CONFIRMED") &&
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
    cleanupExpiredHolds();

    const { token } = req.params;
    const { startAt, endAt } = req.body || {};

    if (!token)
      return res.status(400).json({ ok: false, error: "Token inválido." });
    if (!startAt || !endAt) {
      return res
        .status(400)
        .json({ ok: false, error: "startAt/endAt obrigatórios." });
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

    const conflict = bookings.find(
      (b) =>
        b.token === token &&
        (b.status === "HOLD" || b.status === "CONFIRMED") &&
        overlaps(startAt, endAt, b.startAt, b.endAt),
    );
    if (conflict)
      return res
        .status(409)
        .json({ ok: false, error: "Horário indisponível." });

    const id = crypto.randomUUID();
    const now = Date.now();

    const booking = {
      id,
      token,
      startAt,
      endAt,
      status: "HOLD",
      createdAt: new Date(now).toISOString(),
      expiresAt: now + HOLD_MINUTES * 60 * 1000,
    };

    bookings.push(booking);

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
    cleanupExpiredHolds();

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

    // ✅ Produto: não exige bookingId (usa uma chave estável para idempotência)
    // ✅ Serviço: mantém obrigatório
    const effectiveBookingId = String(
      (bookingId && String(bookingId).trim()) || (isProduct ? token : ""),
    ).trim();

    if (!effectiveBookingId) {
      return res
        .status(400)
        .json({ ok: false, error: "bookingId obrigatório." });
    }

    // trava total se já pago
    if (isPaidStatus(offer?.status)) {
      return res.status(409).json({
        ok: false,
        error: "Pagamento já confirmado para esta reserva.",
        locked: true,
        doneOnly: true,
      });
    }

    // Serviço: valida HOLD do booking
    let booking = null;
    if (!isProduct) {
      booking = bookings.find(
        (b) => b.id === effectiveBookingId && b.token === token,
      );
      if (!booking || booking.status !== "HOLD") {
        return res.status(409).json({
          ok: false,
          error: "Reserva inválida/expirada. Refaça o agendamento.",
        });
      }
    }

    // idempotência: se já existe pix para esse "effectiveBookingId", reutiliza (se não terminal)
    const existing = getPixByBooking(effectiveBookingId);
    if (existing?.pixId) {
      const chk = await abacateCheckPix({ pixId: existing.pixId });
      const pixDataRaw = pickPixData(chk);
      if (pixDataRaw?.id) {
        const st = normalizePixStatus(pixDataRaw.status);
        const expiresAtIso = computeExpiresAtIso(pixDataRaw, PIX_EXPIRES_IN);
        const updatedAt = new Date();

        // atualiza store
        setPixByBooking(effectiveBookingId, {
          ...existing,
          pixId: pixDataRaw.id,
          status: st,
          pix: { ...pixDataRaw, status: st, expiresAt: expiresAtIso },
        });

        // ✅ persiste rastro do Pix no Offer
        await updateOfferPayment(offer._id, {
          lastPixId: pixDataRaw.id,
          lastPixStatus: st,
          lastPixExpiresAt: toDateOrNull(expiresAtIso) || undefined,
          lastPixUpdatedAt: updatedAt,
        });

        if (st === "PAID") {
          const paidAt = await markAsPaid({
            token,
            offerId: offer._id,
            booking,
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

        // ✅ se não é terminal, reutiliza; se é EXPIRED/CANCELLED/REFUNDED, cria outro
        if (!isTerminalPixStatus(st)) {
          noStore(res);
          return res.json({
            ok: true,
            pix: { ...pixDataRaw, status: st, expiresAt: expiresAtIso },
            reused: true,
          });
        }
        // terminal (EXPIRED/CANCELLED/REFUNDED): segue e cria outro
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

    const { amountCents } = computeAmountCents(offer);
    const amount = amountCents;

    if (!amount || amount <= 0) {
      return res
        .status(400)
        .json({ ok: false, error: "Valor inválido para cobrança." });
    }

    // expiração:
    // - service: alinhada com HOLD
    // - product: usa PIX_EXPIRES_IN (fallback), sem dependência de booking
    const now = Date.now();
    let expiresIn = Math.max(60, PIX_EXPIRES_IN);

    if (!isProduct && booking) {
      const remainingHoldSec = Math.max(
        60,
        Math.floor(
          ((booking.expiresAt || now + HOLD_MINUTES * 60 * 1000) - now) / 1000,
        ),
      );
      expiresIn = Math.min(
        Math.max(60, remainingHoldSec),
        Math.max(60, PIX_EXPIRES_IN),
      );
    }

    // metadata.externalId:
    // - service: bookingId
    // - product: token (chave estável)
    const metadata = { externalId: String(effectiveBookingId) };

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

    if (booking) booking.pixId = pixDataRaw.id;

    setPixByBooking(effectiveBookingId, {
      pixId: pixDataRaw.id,
      status: st,
      token,
      pix: { ...pixDataRaw, status: st, expiresAt: expiresAtIso },
    });

    upsertPixCharge({
      pixId: pixDataRaw.id,
      bookingId: isProduct ? null : effectiveBookingId, // mantém compat; produto não tem booking real
      token,
      status: st,
      updatedAt: nowIso(),
      pix: { ...pixDataRaw, status: st, expiresAt: expiresAtIso },
    });

    // ✅ persiste no Offer: payment.lastPixId/status/expiresAt/updatedAt
    await updateOfferPayment(offer._id, {
      lastPixId: pixDataRaw.id,
      lastPixStatus: st,
      lastPixExpiresAt: toDateOrNull(expiresAtIso) || undefined,
      lastPixUpdatedAt: new Date(),
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

    // ✅ atualiza payment.lastPixStatus e payment.lastPixUpdatedAt (e mantém id/expiresAt)
    await updateOfferPayment(offer._id, {
      lastPixId: pixDataRaw.id,
      lastPixStatus: st,
      lastPixExpiresAt: toDateOrNull(expiresAtIso) || undefined,
      lastPixUpdatedAt: updatedAt,
    });

    // atualiza store in-memory (se conseguir inferir externalId)
    const externalId = String(
      pixDataRaw?.metadata?.externalId ||
        pixDataRaw?.metadata?.external_id ||
        "",
    ).trim();
    if (externalId) {
      const prev = getPixByBooking(externalId) || {};
      setPixByBooking(externalId, {
        ...prev,
        pixId: pixDataRaw.id,
        status: st,
        token,
        pix: { ...pixDataRaw, status: st, expiresAt: expiresAtIso },
      });
    }

    upsertPixCharge({
      pixId: pixDataRaw.id,
      bookingId: externalId || null,
      token,
      status: st,
      updatedAt: nowIso(),
      pix: { ...pixDataRaw, status: st, expiresAt: expiresAtIso },
    });

    let paidAt = null;
    let locked = false;

    if (st === "PAID") {
      locked = true;

      // tenta achar booking pelo pixId; fallback pelo metadata.externalId
      const booking =
        bookings.find((b) => b.token === token && b.pixId === pixId) ||
        (externalId
          ? bookings.find((b) => b.token === token && b.id === externalId)
          : null) ||
        null;

      paidAt = await markAsPaid({
        token,
        offerId: offer._id,
        booking,
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
