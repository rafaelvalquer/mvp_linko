// server/src/models/Booking.js
import mongoose from "mongoose";

function normalizeStatus(s) {
  const up = String(s || "")
    .trim()
    .toUpperCase();
  if (up === "CANCELED") return "CANCELLED";
  return up;
}

const PaymentSchema = new mongoose.Schema(
  {
    provider: { type: String }, // "ABACATEPAY" etc
    providerPaymentId: { type: String }, // pixId
    amountCents: { type: Number },
    status: { type: String, enum: ["PENDING", "PAID", "FAILED"] },
    txid: { type: String },
    endToEndId: { type: String },
    paidAt: { type: Date },
  },
  { _id: false },
);

const BookingSchema = new mongoose.Schema(
  {
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
    offerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
      index: true,
      required: true,
      index: true,
    },
    publicToken: { type: String, index: true },

    customerName: { type: String },
    customerWhatsApp: { type: String },

    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["HOLD", "CONFIRMED", "EXPIRED", "CANCELLED", "CANCELED"],
      default: "HOLD",
      index: true,
    },
    holdExpiresAt: { type: Date, required: true, index: true },

    payment: { type: PaymentSchema },
  },
  { timestamps: true },
);

BookingSchema.pre("validate", function (next) {
  if (this.status) this.status = normalizeStatus(this.status);
  next();
});

BookingSchema.index({ workspaceId: 1, startAt: 1 });
BookingSchema.index({ offerId: 1, startAt: 1 });
BookingSchema.index({ holdExpiresAt: 1, status: 1 });
BookingSchema.index({ "payment.providerPaymentId": 1 });

BookingSchema.set("toJSON", {
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    return ret;
  },
});

// ✅ evita OverwriteModelError em reloads
const BookingModel =
  mongoose.models.Booking || mongoose.model("Booking", BookingSchema);

// ✅ suporta os dois jeitos de importar
export default BookingModel;
export const Booking = BookingModel;
