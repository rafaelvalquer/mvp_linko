// server/src/models/StripeEvent.js
import mongoose from "mongoose";

const StripeEventSchema = new mongoose.Schema(
  {
    provider: { type: String, default: "stripe", index: true },
    eventId: { type: String, required: true, trim: true, unique: true },
    type: { type: String, required: true, trim: true },
    created: { type: Number }, // timestamp Stripe (segundos)
    payload: { type: mongoose.Schema.Types.Mixed }, // opcional
  },
  { timestamps: true },
);

StripeEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

export const StripeEvent =
  mongoose.models.StripeEvent ||
  mongoose.model("StripeEvent", StripeEventSchema);
