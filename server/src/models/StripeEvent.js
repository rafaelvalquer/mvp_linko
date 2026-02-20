import mongoose from "mongoose";

const StripeEventSchema = new mongoose.Schema(
  {
    provider: { type: String, default: "stripe" },
    eventId: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
    created: { type: Number },
    payload: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true },
);

StripeEventSchema.index({ eventId: 1 }, { unique: true });

export const StripeEvent =
  mongoose.models.StripeEvent ||
  mongoose.model("StripeEvent", StripeEventSchema);
