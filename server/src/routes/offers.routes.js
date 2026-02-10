import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Offer } from "../models/Offer.js";
import { createOffer } from "../services/offers.service.js";

const r = Router();

r.get(
  "/offers",
  asyncHandler(async (_req, res) => {
    const items = await Offer.find().sort({ createdAt: -1 }).limit(200);
    res.json({ ok: true, items });
  }),
);

r.post(
  "/offers",
  asyncHandler(async (req, res) => {
    const { customerName, title, amountCents } = req.body || {};
    if (!customerName || !title || !Number.isFinite(amountCents)) {
      return res
        .status(400)
        .json({
          ok: false,
          error: "customerName, title, amountCents required",
        });
    }
    const offer = await createOffer(req.body);
    res.json({ ok: true, offer, publicUrl: `/p/${offer.publicToken}` });
  }),
);

export default r;
