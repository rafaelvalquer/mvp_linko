// server/src/routes/bookings.routes.js
import express from "express";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import { ensureAuth, tenantFromUser } from "../middleware/auth.js";

const router = express.Router();

function parseIso(s) {
  if (!s) return null;
  const d = new Date(String(s));
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseStatusList(v) {
  if (!v) return null;
  const list = String(v)
    .split(",")
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean);
  return list.length ? list : null;
}

router.get("/bookings", ensureAuth, tenantFromUser, async (req, res) => {
  try {
    const from = parseIso(req.query.from);
    const to = parseIso(req.query.to);
    const statusList = parseStatusList(req.query.status);

    const filter = { workspaceId: req.tenantId };

    if (statusList) filter.status = { $in: statusList };

    if (from || to) {
      filter.startAt = {};
      if (from) filter.startAt.$gte = from;
      if (to) filter.startAt.$lt = to;
    }

    const docs = await Booking.find(filter)
      .sort({ startAt: 1 })
      .limit(500)
      .populate({
        path: "offerId",
        select:
          "title customerName publicToken offerType totalCents amountCents status",
      })
      .lean();

    const items = docs.map((b) => ({
      id: String(b._id),
      offerId: b.offerId?._id ? String(b.offerId._id) : String(b.offerId),
      offer: b.offerId?._id ? b.offerId : null,
      startAt: b.startAt,
      endAt: b.endAt,
      status: b.status,
      holdExpiresAt: b.holdExpiresAt,
      payment: b.payment || null,
      customerName: b.customerName || "",
      customerWhatsApp: b.customerWhatsApp || "",
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    }));

    return res.json({ ok: true, items });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, error: e?.message || "Falha ao listar bookings." });
  }
});

router.patch("/bookings/:id", ensureAuth, tenantFromUser, async (req, res) => {
  try {
    const id = String(req.params.id || "");
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ ok: false, error: "ID inválido." });
    }

    const nextStatus = String(req.body?.status || "")
      .trim()
      .toUpperCase();
    if (nextStatus !== "CANCELLED") {
      return res
        .status(400)
        .json({ ok: false, error: "Apenas CANCELLED é permitido no MVP." });
    }

    const r = await Booking.updateOne(
      { _id: id, workspaceId: req.tenantId },
      { $set: { status: "CANCELLED" } },
    );

    if (!r?.matchedCount) {
      return res
        .status(404)
        .json({ ok: false, error: "Booking não encontrado." });
    }

    return res.json({ ok: true });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, error: e?.message || "Falha ao atualizar booking." });
  }
});

export default router;
