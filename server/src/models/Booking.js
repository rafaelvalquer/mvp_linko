// server/src/models/Booking.js
import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema(
  {
    provider: { type: String, default: "ABACATEPAY" },
    providerPaymentId: { type: String }, // pixId
    amountCents: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED"],
      default: "PENDING",
    },
    paidAt: { type: Date },
  },
  { _id: false },
);

const BookingSchema = new mongoose.Schema(
  {
    offerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
      required: true,
      index: true,
    },

    // multi-tenant (derivado da Offer)
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    publicToken: { type: String, index: true },

    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },

    status: {
      type: String,
      enum: ["HOLD", "CONFIRMED", "EXPIRED", "CANCELLED", "CANCELED"],
      default: "HOLD",
      index: true,
    },

    holdExpiresAt: { type: Date, index: true },

    customerName: { type: String },
    customerWhatsApp: { type: String },

    payment: { type: PaymentSchema, default: () => ({}) },
  },
  { timestamps: true },
);

// normaliza legado
BookingSchema.pre("validate", function (next) {
  if (this.status === "CANCELED") this.status = "CANCELLED";
  next();
});

// índices recomendados
BookingSchema.index({ workspaceId: 1, startAt: 1 });
BookingSchema.index({ offerId: 1, startAt: 1 });
BookingSchema.index({ holdExpiresAt: 1, status: 1 });
BookingSchema.index({ "payment.providerPaymentId": 1 });

const Booking = mongoose.model("Booking", BookingSchema);
export default Booking;
