import { Router } from "express";
import mongoose from "mongoose";
import { ensureAuth, tenantFromUser } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Offer } from "../models/Offer.js";
import {
  listOfferReminderHistory,
  sendManualPaymentReminder,
  updateOfferPaymentReminderSettings,
} from "../services/paymentReminder.service.js";

const r = Router();

function buildOfferScope(req, id) {
  const q = { _id: id, workspaceId: req.tenantId };
  if (req.user?._id) q.ownerUserId = req.user._id;
  return q;
}

function parseBool(v) {
  return v === true;
}

r.use(ensureAuth, tenantFromUser);

r.post(
  "/offers/:id/send-payment-reminder",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ ok: false, error: "invalid id" });
    }

    const scope = buildOfferScope(req, id);
    const offer = await Offer.findOne(scope).select("_id").lean();
    if (!offer) {
      return res.status(404).json({ ok: false, error: "Offer not found" });
    }

    const result = await sendManualPaymentReminder({
      offerId: id,
      workspaceId: req.tenantId,
      ownerUserId: req.user?._id,
      userId: req.user?._id || null,
      origin: req.headers.origin || req.headers.referer || "",
    });

    return res.json({
      ok: true,
      result: {
        status: result.status,
        reason: result.reason || "",
        error: result.error
          ? String(result.error?.message || result.error)
          : "",
      },
      log: result.log || null,
      offer: result.offer || null,
    });
  }),
);

r.patch(
  "/offers/:id/payment-reminders",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ ok: false, error: "invalid id" });
    }

    const scope = buildOfferScope(req, id);
    const existing = await Offer.findOne(scope).select("_id").lean();
    if (!existing) {
      return res.status(404).json({ ok: false, error: "Offer not found" });
    }

    const offer = await updateOfferPaymentReminderSettings({
      offerId: id,
      workspaceId: req.tenantId,
      ownerUserId: req.user?._id,
      patch: {
        enabled24h: parseBool(req.body?.enabled24h),
        enabled3d: parseBool(req.body?.enabled3d),
        enabledDueDate: parseBool(req.body?.enabledDueDate),
        enabledAfterDueDate: parseBool(req.body?.enabledAfterDueDate),
      },
    });

    return res.json({ ok: true, offer });
  }),
);

r.get(
  "/offers/:id/payment-reminders/history",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ ok: false, error: "invalid id" });
    }

    const items = await listOfferReminderHistory({
      offerId: id,
      workspaceId: req.tenantId,
      ownerUserId: req.user?._id,
      limit: Number(req.query?.limit || 50),
    });

    if (items === null) {
      return res.status(404).json({ ok: false, error: "Offer not found" });
    }

    return res.json({ ok: true, items });
  }),
);

export default r;
