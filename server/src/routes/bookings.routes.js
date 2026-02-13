// server/src/routes/bookings.routes.js
import express from "express";
import mongoose from "mongoose";

import { ensureAuth, tenantFromUser } from "../middleware/auth.js";

import Booking from "../models/Booking.js";

const router = express.Router();

router.use(ensureAuth);
router.use(tenantFromUser);

/**
 * GET /api/bookings?from=ISO&to=ISO&status=HOLD,CONFIRMED
 */
router.get("/bookings", async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId)
      return res.status(401).json({ ok: false, error: "Unauthorized" });

    const from = String(req.query.from || "").trim();
    const to = String(req.query.to || "").trim();
    const statusRaw = String(req.query.status || "").trim();

    const q = { workspaceId: tenantId };

    if (from || to) {
      q.startAt = {};
      if (from) {
        const d = new Date(from);
        if (!Number.isNaN(d.getTime())) q.startAt.$gte = d;
      }
      if (to) {
        const d = new Date(to);
        if (!Number.isNaN(d.getTime())) q.startAt.$lte = d;
      }
      if (!Object.keys(q.startAt).length) delete q.startAt;
    }

    if (statusRaw) {
      const arr = statusRaw
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      if (arr.length) q.status = { $in: arr };
    }

    const docs = await Booking.find(q)
      .sort({ startAt: 1 })
      .populate("offerId", "_id title publicToken")
      .lean();

    const items = (docs || []).map((b) => ({
      _id: b._id,
      startAt: b.startAt,
      endAt: b.endAt,
      status: b.status,
      holdExpiresAt: b.holdExpiresAt || null,
      customerName: b.customerName || "",
      customerWhatsApp: b.customerWhatsApp || "",
      offer: b.offerId
        ? {
            _id: b.offerId._id,
            title: b.offerId.title,
            publicToken: b.offerId.publicToken,
          }
        : null,
    }));

    return res.json({ ok: true, items });
  } catch (e) {
    next(e);
  }
});

/**
 * PATCH /api/bookings/:id/cancel
 * -> status CANCELLED (tenant-aware)
 */
router.patch("/bookings/:id/cancel", async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    if (!tenantId)
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ ok: false, error: "ID inválido." });

    const doc = await Booking.findOneAndUpdate(
      { _id: id, workspaceId: tenantId },
      { $set: { status: "CANCELLED" } },
      { new: true },
    )
      .populate("offerId", "_id title publicToken")
      .lean();

    if (!doc)
      return res
        .status(404)
        .json({ ok: false, error: "Booking não encontrado." });

    return res.json({
      ok: true,
      booking: {
        _id: doc._id,
        startAt: doc.startAt,
        endAt: doc.endAt,
        status: doc.status,
        holdExpiresAt: doc.holdExpiresAt || null,
        customerName: doc.customerName || "",
        customerWhatsApp: doc.customerWhatsApp || "",
        offer: doc.offerId
          ? {
              _id: doc.offerId._id,
              title: doc.offerId.title,
              publicToken: doc.offerId.publicToken,
            }
          : null,
      },
    });
  } catch (e) {
    next(e);
  }
});

export default router;
