import mongoose from "mongoose";

const BookingSchema = new mongoose.Schema(
  {
    offerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
      index: true,
      required: true,
    },
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["HOLD", "CONFIRMED", "EXPIRED", "CANCELED"],
      default: "HOLD",
      index: true,
    },
    holdExpiresAt: { type: Date, required: true, index: true },

    // Pagamento (MVP placeholder – depois entra Mercado Pago)
    payment: {
      provider: { type: String, default: "MERCADO_PAGO" },
      providerPaymentId: { type: String, default: "" },
      amountCents: { type: Number, default: 0 },
      status: {
        type: String,
        enum: ["PENDING", "PAID", "FAILED"],
        default: "PENDING",
      },
    },
  },
  { timestamps: true },
);

export const Booking = mongoose.model("Booking", BookingSchema);
