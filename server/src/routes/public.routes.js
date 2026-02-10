import express from "express";
import crypto from "crypto";
import { Offer } from "../models/Offer.js";

const router = express.Router();

// MVP (in-memory)
const acceptances = new Map(); // token -> { agreeTerms, ackDeposit, acceptedAt }
const bookings = []; // { id, token, ownerKey, startAt, endAt, status, createdAt, expiresAt }

const HOLD_MINUTES = 15;

function nowIso() {
  return new Date().toISOString();
}

function safeMs(iso) {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : NaN;
}

function cleanupExpired() {
  const now = Date.now();
  for (let i = bookings.length - 1; i >= 0; i--) {
    const b = bookings[i];
    if (b.status === "HOLD" && b.expiresAt && b.expiresAt <= now) {
      bookings.splice(i, 1);
    }
  }
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  const as = safeMs(aStart);
  const ae = safeMs(aEnd);
  const bs = safeMs(bStart);
  const be = safeMs(bEnd);
  if (![as, ae, bs, be].every(Number.isFinite)) return false;
  return as < be && bs < ae;
}

// tenta achar por vários campos comuns (compatibilidade)
async function findOfferByToken(token) {
  if (!token) return null;

  let o = await Offer.findOne({ publicToken: token }).lean();
  if (o) return o;

  o = await Offer.findOne({ token }).lean();
  if (o) return o;

  o = await Offer.findOne({ publicId: token }).lean();
  if (o) return o;

  o = await Offer.findOne({ public_token: token }).lean();
  if (o) return o;

  return null;
}

// chave do “dono” (para conflito de agenda). Se não existir, cai no token (MVP).
function getOwnerKey(offer, token) {
  return (
    offer?.sellerId ||
    offer?.providerId ||
    offer?.vendorId ||
    offer?.ownerId ||
    offer?.userId ||
    token
  );
}

function buildDaySlots(dateStr, durationMin = 60) {
  // dateStr = YYYY-MM-DD
  const times = ["09:00", "10:00", "14:00", "16:00", "18:00"];
  const durMin =
    Number.isFinite(durationMin) && durationMin > 0 ? durationMin : 60;

  return times.map((hhmm) => {
    // ISO sem timezone => interpretado em horário local; toISOString converte para UTC.
    const start = new Date(`${dateStr}T${hhmm}:00`);
    const end = new Date(start.getTime() + durMin * 60 * 1000);
    return {
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      status: "FREE",
    };
  });
}

/**
 * GET /p/:token
 * Carrega a proposta pública (usado por PublicOffer e PublicSchedule)
 */
router.get("/p/:token", async (req, res, next) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ ok: false, error: "Token inválido." });
    }

    const offer = await findOfferByToken(token);
    if (!offer) {
      return res
        .status(404)
        .json({ ok: false, error: "Proposta não encontrada." });
    }

    return res.json({ ok: true, offer });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /p/:token/accept
 * Registra aceite (MVP). Também atualiza status no Mongo se possível.
 */
router.post("/p/:token/accept", async (req, res, next) => {
  try {
    const { token } = req.params;
    const { agreeTerms, ackDeposit, acceptedAt } = req.body || {};

    if (!token) {
      return res.status(400).json({ ok: false, error: "Token inválido." });
    }
    if (!agreeTerms) {
      return res.status(400).json({ ok: false, error: "Aceite obrigatório." });
    }

    const offer = await findOfferByToken(token);
    if (!offer) {
      return res
        .status(404)
        .json({ ok: false, error: "Proposta não encontrada." });
    }

    const acceptedIso = acceptedAt || nowIso();

    acceptances.set(token, {
      agreeTerms: true,
      ackDeposit: !!ackDeposit,
      acceptedAt: acceptedIso,
    });

    // tenta atualizar no banco sem depender do schema (Mongoose ignora campos inexistentes)
    await Offer.updateOne(
      { _id: offer._id },
      {
        $set: {
          status: "ACCEPTED",
          acceptedAt: acceptedIso,
          ackDeposit: !!ackDeposit,
        },
      },
    ).catch(() => {});

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /p/:token/slots?date=YYYY-MM-DD
 */
router.get("/p/:token/slots", async (req, res, next) => {
  try {
    cleanupExpired();

    const { token } = req.params;
    const date = String(req.query.date || "").trim();

    if (!token) {
      return res.status(400).json({ ok: false, error: "Token inválido." });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res
        .status(400)
        .json({ ok: false, error: "Informe date=YYYY-MM-DD." });
    }

    const offer = await findOfferByToken(token);
    if (!offer) {
      return res
        .status(404)
        .json({ ok: false, error: "Proposta não encontrada." });
    }

    const ownerKey = getOwnerKey(offer, token);

    const durationMin =
      Number.isFinite(offer?.durationMin) && offer.durationMin > 0
        ? offer.durationMin
        : 60;

    const slots = buildDaySlots(date, durationMin).map((s) => {
      const conflict = bookings.find(
        (b) =>
          b.ownerKey === ownerKey &&
          (b.status === "HOLD" || b.status === "CONFIRMED") &&
          overlaps(s.startAt, s.endAt, b.startAt, b.endAt),
      );

      if (!conflict) return s;

      return {
        ...s,
        status: conflict.status,
      };
    });

    return res.json({ ok: true, date, slots });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /p/:token/book
 * Body: { startAt, endAt, customerName?, customerWhatsApp? }
 */
router.post("/p/:token/book", async (req, res, next) => {
  try {
    cleanupExpired();

    const { token } = req.params;
    const { startAt, endAt } = req.body || {};

    if (!token) {
      return res.status(400).json({ ok: false, error: "Token inválido." });
    }
    if (!startAt || !endAt) {
      return res
        .status(400)
        .json({ ok: false, error: "startAt/endAt obrigatórios." });
    }

    const offer = await findOfferByToken(token);
    if (!offer) {
      return res
        .status(404)
        .json({ ok: false, error: "Proposta não encontrada." });
    }

    const ownerKey = getOwnerKey(offer, token);

    // conflito (HOLD/CONFIRMED) para o mesmo ownerKey
    const conflict = bookings.find(
      (b) =>
        b.ownerKey === ownerKey &&
        (b.status === "HOLD" || b.status === "CONFIRMED") &&
        overlaps(startAt, endAt, b.startAt, b.endAt),
    );
    if (conflict) {
      return res
        .status(409)
        .json({ ok: false, error: "Horário indisponível." });
    }

    const id = crypto.randomUUID();
    const now = Date.now();

    const booking = {
      id,
      token,
      ownerKey,
      startAt,
      endAt,
      status: "HOLD",
      createdAt: new Date(now).toISOString(),
      expiresAt: now + HOLD_MINUTES * 60 * 1000,
    };

    bookings.push(booking);

    return res.json({ ok: true, booking });
  } catch (err) {
    return next(err);
  }
});

export default router;
