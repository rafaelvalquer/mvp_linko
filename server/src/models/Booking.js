// server/src/models/Booking.js
import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema(
  {
    provider: { type: String, default: "MANUAL_PIX" },
    providerPaymentId: { type: String }, // legado: id externo do gateway, se existir
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

const BookingChangeHistorySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ["reschedule", "cancel"],
      required: true,
    },
    actor: {
      type: String,
      enum: ["customer", "workspace"],
      required: true,
    },
    changedAt: { type: Date, required: true },
    fromStartAt: { type: Date, default: null },
    fromEndAt: { type: Date, default: null },
    toStartAt: { type: Date, default: null },
    toEndAt: { type: Date, default: null },
    reason: { type: String, default: null },
  },
  { _id: false },
);

const BookingSchema = new mongoose.Schema(
  {
    offerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
      default: null,
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

    sourceType: {
      type: String,
      enum: ["offer", "my_page"],
      default: "offer",
      index: true,
    },
    myPageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MyPage",
      default: null,
      index: true,
    },
    serviceLabel: { type: String, default: "", trim: true },

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
    analyticsSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    cancelledAt: { type: Date, default: null },
    cancelledBy: {
      type: String,
      enum: ["customer", "workspace", null],
      default: null,
    },
    cancelReason: { type: String, default: null },
    changeHistory: {
      type: [BookingChangeHistorySchema],
      default: () => [],
    },

    payment: { type: PaymentSchema, default: () => ({}) },
  },
  { timestamps: true },
);

// normaliza legado
BookingSchema.pre("validate", function (next) {
  if (this.status === "CANCELED") this.status = "CANCELLED";
  if (this.sourceType !== "my_page" && !this.offerId) {
    this.invalidate("offerId", "offerId is required for offer bookings");
  }
  if (this.sourceType === "my_page" && !this.myPageId) {
    this.invalidate("myPageId", "myPageId is required for my_page bookings");
  }
  next();
});

// índices recomendados
BookingSchema.index({ workspaceId: 1, startAt: 1 });
BookingSchema.index({ offerId: 1, startAt: 1 });
BookingSchema.index({ holdExpiresAt: 1, status: 1 });
BookingSchema.index({ "payment.providerPaymentId": 1 });

const Booking = mongoose.model("Booking", BookingSchema);
export default Booking;
