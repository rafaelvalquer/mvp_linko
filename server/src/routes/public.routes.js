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
const PIX_EXPIRES_IN = Number(process.env.PIX_EXPIRES_IN || 3600); // 1h

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
  let offer =
    (await Offer.findOne({ publicToken: token }).lean()) ||
    (await Offer.findOne({ token }).lean()) ||
    (await Offer.findOne({ publicId: token }).lean());

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

// -------------------------
// Helpers de store (Map/Array/Object safe)
// -------------------------
function getFromStore(store, key) {
  if (!store || !key) return null;
  if (typeof store.get === "function") return store.get(key) || null;
  if (Array.isArray(store)) return store.find((x) => x?.id === key) || null;
  if (typeof store === "object") return store[key] || null;
  return null;
}

function setInStore(store, key, value) {
  if (!store || !key) return;
  if (typeof store.set === "function") {
    store.set(key, value);
    return;
  }
  if (Array.isArray(store)) {
    const idx = store.findIndex((x) => x?.id === key);
    if (idx >= 0) store[idx] = value;
    else store.push(value);
    return;
  }
  if (typeof store === "object") {
    store[key] = value;
  }
}

function getPixIdByBookingId(bookingId) {
  return getFromStore(pixByBooking, bookingId);
}

function setPixIdByBookingId(bookingId, pixId) {
  setInStore(pixByBooking, bookingId, pixId);
}

function getPixChargeById(pixId) {
  return getFromStore(pixCharges, pixId);
}

function setPixChargeById(pixId, payload) {
  setInStore(pixCharges, pixId, payload);
}

function noStore(res) {
  res.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.set("Surrogate-Control", "no-store");
}

/**
 * GET /p/:token  -> retorna offer pública
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

    return res.json({ ok: true, offer });
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

    acceptances.set(token, {
      agreeTerms: true,
      ackDeposit: !!ackDeposit,
      acceptedAt: acceptedAt || new Date().toISOString(),
    });

    try {
      await Offer.updateOne(
        { publicToken: token },
        {
          $set: {
            status: "ACCEPTED",
            acceptedAt: acceptedAt || new Date().toISOString(),
          },
        },
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
 * Body: { bookingId, customer: { name, cellphone, email, taxId } }
 *
 * Regras:
 * - Idempotência: se já existir Pix para bookingId (PENDING e válido), retorna o mesmo.
 * - Se já estiver PAID/CONFIRMED, bloqueia duplicação.
 * - Se já existir Pix PAID para bookingId, retorna o existente (sem recriar).
 */
router.post("/p/:token/pix/create", async (req, res, next) => {
  try {
    cleanupExpiredHolds();

    const { token } = req.params;
    const { bookingId, customer } = req.body || {};

    if (!token)
      return res.status(400).json({ ok: false, error: "Token inválido." });
    if (!bookingId)
      return res
        .status(400)
        .json({ ok: false, error: "bookingId obrigatório." });

    const offer = await findOfferByPublicToken(token);
    if (!offer)
      return res
        .status(404)
        .json({ ok: false, error: "Proposta não encontrada." });

    const offerStatus = String(offer?.status || "").toUpperCase();

    const bookingAny = bookings.find(
      (b) => b.id === bookingId && b.token === token,
    );
    if (!bookingAny) {
      return res.status(409).json({
        ok: false,
        error: "Reserva inválida/expirada. Refaça o agendamento.",
      });
    }

    // 1) Se já existe Pix vinculado ao bookingId, aplica idempotência
    const existingPixId = getPixIdByBookingId(bookingId);
    if (existingPixId) {
      const existingCharge = getPixChargeById(existingPixId);

      // Se já pago, retorna o existente (evita UX ruim em reload)
      if (
        existingCharge &&
        String(existingCharge.status || "").toUpperCase() === "PAID"
      ) {
        noStore(res);
        return res.json({
          ok: true,
          pix: existingCharge,
          locked: true,
          paidAt:
            existingCharge.paidAt ||
            offer?.paidAt ||
            bookingAny?.paidAt ||
            null,
        });
      }

      // Se ainda pendente e não expirou, retorna o mesmo pix
      if (
        existingCharge &&
        String(existingCharge.status || "").toUpperCase() === "PENDING"
      ) {
        const exp = existingCharge?.expiresAt
          ? new Date(existingCharge.expiresAt).getTime()
          : null;
        if (!exp || exp > Date.now()) {
          noStore(res);
          return res.json({ ok: true, pix: existingCharge });
        }
      }
    }

    // 2) Se oferta/booking já confirmados, bloqueia criação
    const bookingStatus = String(bookingAny?.status || "").toUpperCase();
    if (
      offerStatus === "PAID" ||
      offerStatus === "CONFIRMED" ||
      bookingStatus === "CONFIRMED"
    ) {
      return res.status(409).json({
        ok: false,
        error: "Pagamento já confirmado para esta reserva.",
      });
    }

    // 3) Só cria pix se booking ainda for HOLD (e não expirado)
    const booking = bookings.find(
      (b) => b.id === bookingId && b.token === token && b.status === "HOLD",
    );
    if (!booking) {
      return res.status(409).json({
        ok: false,
        error: "Reserva inválida/expirada. Refaça o agendamento.",
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

    // expiração alinhada com o HOLD (e respeita PIX_EXPIRES_IN como teto)
    const now = Date.now();
    const holdLeftSec = Math.max(
      60,
      Math.floor(
        ((booking.expiresAt || now + HOLD_MINUTES * 60 * 1000) - now) / 1000,
      ),
    );
    const expiresIn = Math.min(holdLeftSec, PIX_EXPIRES_IN);

    // metadata precisa ser OBJETO
    const metadata = { externalId: String(bookingId) };

    const ab = await abacateCreatePixQr({
      amount,
      expiresIn,
      description: shortDesc(offer?.title || "Pagamento via Pix"),
      customer: { name, cellphone, email, taxId },
      metadata,
    });

    // suporte a wrappers que retornam {success,data}
    const pixData = ab?.data || ab;

    if (!pixData?.id) {
      return res.status(502).json({ ok: false, error: "Falha ao gerar Pix." });
    }

    // vincula para controle
    booking.pixId = pixData.id;
    booking.pixStatus = pixData.status || "PENDING";

    setPixIdByBookingId(bookingId, pixData.id);
    setPixChargeById(pixData.id, {
      ...pixData,
      bookingId,
      token,
      customer: { name, cellphone, email, taxId },
    });

    noStore(res);
    return res.json({ ok: true, pix: pixData });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /p/:token/pix/status?pixId=...
 * Retorna também: locked + paidAt quando PAID
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
    const pixData = ab?.data || ab;

    if (!pixData?.id) {
      return res
        .status(502)
        .json({ ok: false, error: "Falha ao consultar status do Pix." });
    }

    const st = String(pixData.status || "").toUpperCase();

    // tenta inferir bookingId por metadata.externalId (se houver)
    const bookingIdFromMeta = pixData?.metadata?.externalId
      ? String(pixData.metadata.externalId)
      : null;

    if (bookingIdFromMeta) {
      setPixIdByBookingId(bookingIdFromMeta, pixId);
    }

    // atualiza store local
    setPixChargeById(pixId, {
      ...(getPixChargeById(pixId) || {}),
      ...pixData,
      token,
      bookingId: bookingIdFromMeta || getPixChargeById(pixId)?.bookingId,
    });

    let locked = false;
    let paidAt = null;

    if (st === "PAID") {
      locked = true;
      paidAt =
        offer?.paidAt ||
        getPixChargeById(pixId)?.paidAt ||
        pixData?.paidAt ||
        new Date().toISOString();

      // booking: HOLD -> CONFIRMED
      const b = bookings.find((x) => x.token === token && x.pixId === pixId);
      if (b) {
        b.status = "CONFIRMED";
        b.paidAt = paidAt;
        b.confirmedAt = paidAt;
        b.pixStatus = "PAID";
      }

      // oferta -> PAID
      await Offer.updateOne(
        { _id: offer._id },
        { $set: { status: "PAID", paidAt } },
        { strict: false },
      ).catch(() => {});

      // grava paidAt no store também
      const prev = getPixChargeById(pixId) || {};
      setPixChargeById(pixId, { ...prev, status: "PAID", paidAt });
    }

    noStore(res);
    return res.json({ ok: true, pix: pixData, locked, paidAt });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /p/:token/summary?bookingId=...
 * Página final (somente leitura). Exige pagamento confirmado.
 */
router.get("/p/:token/summary", async (req, res, next) => {
  try {
    cleanupExpiredHolds();

    const { token } = req.params;
    const bookingId = String(req.query.bookingId || "").trim();

    if (!token)
      return res.status(400).json({ ok: false, error: "Token inválido." });
    if (!bookingId)
      return res
        .status(400)
        .json({ ok: false, error: "bookingId obrigatório." });

    const offer = await findOfferByPublicToken(token);
    if (!offer)
      return res
        .status(404)
        .json({ ok: false, error: "Proposta não encontrada." });

    const booking =
      bookings.find((b) => b.id === bookingId && b.token === token) || null;

    const offerStatus = String(offer?.status || "").toUpperCase();
    const bookingStatus = String(booking?.status || "").toUpperCase();

    // tenta encontrar pix associado
    const pixId = getPixIdByBookingId(bookingId) || booking?.pixId || null;
    const pix = pixId ? getPixChargeById(pixId) : null;
    const pixStatus = String(pix?.status || "").toUpperCase();

    const locked =
      offerStatus === "PAID" ||
      offerStatus === "CONFIRMED" ||
      bookingStatus === "CONFIRMED" ||
      pixStatus === "PAID";
    const paidAt = offer?.paidAt || booking?.paidAt || pix?.paidAt || null;

    if (!locked) {
      return res.status(409).json({
        ok: false,
        error: "Pagamento ainda não confirmado para esta reserva.",
      });
    }

    noStore(res);
    return res.json({
      ok: true,
      locked: true,
      paidAt,
      offer,
      booking,
      pix: pix || null,
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
