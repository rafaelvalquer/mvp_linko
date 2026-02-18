// server/src/models/Offer.js
import mongoose from "mongoose";

const ItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },
    qty: { type: Number, required: true, min: 1 },
    unitPriceCents: { type: Number, default: null },
    lineTotalCents: { type: Number, default: null },
  },
  { _id: false },
);

const OfferSchema = new mongoose.Schema(
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

    // ✅ Vendedor (persistido para notificações)
    sellerEmail: { type: String, trim: true, lowercase: true, default: null },
    sellerName: { type: String, trim: true, default: null },

    // Cliente (snapshot)
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      default: null,
    },
    customerName: { type: String, required: true, trim: true },
    customerEmail: { type: String, trim: true, lowercase: true, default: "" },
    customerDoc: { type: String, trim: true, default: "" }, // apenas dígitos
    customerWhatsApp: { type: String, trim: true, default: "" },

    offerType: { type: String, trim: true, default: "service" }, // service|product
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },

    items: { type: [ItemSchema], default: [] },

    amountCents: { type: Number, required: true, min: 0 }, // compat
    subtotalCents: { type: Number, default: null },
    discountCents: { type: Number, default: null },
    freightCents: { type: Number, default: null },
    totalCents: { type: Number, default: null },

    depositEnabled: { type: Boolean, default: true },
    depositPct: { type: Number, default: 0, min: 0, max: 100 },

    durationEnabled: { type: Boolean, default: false },
    durationMin: { type: Number, default: null },

    validityEnabled: { type: Boolean, default: false },
    validityDays: { type: Number, default: null },

    deliveryEnabled: { type: Boolean, default: false },
    deliveryText: { type: String, default: null },

    warrantyEnabled: { type: Boolean, default: false },
    warrantyText: { type: String, default: null },

    notesEnabled: { type: Boolean, default: false },
    conditionsNotes: { type: String, default: null },

    discountEnabled: { type: Boolean, default: false },
    discountType: { type: String, default: null },
    discountValue: { type: mongoose.Schema.Types.Mixed, default: null },

    freightEnabled: { type: Boolean, default: false },
    freightValue: { type: mongoose.Schema.Types.Mixed, default: null },

    publicToken: { type: String, required: true, unique: true, index: true },
    token: { type: String, default: null, index: true }, // legado
    publicId: { type: String, default: null, index: true }, // legado
    expiresAt: { type: Date, required: true, index: true },

    status: { type: String, default: "PUBLIC", index: true },
    acceptedAt: { type: Date, default: null },

    publicDoneOnly: { type: Boolean, default: false },
    publicLockedAt: { type: Date, default: null },

    // ✅ pagamento concluído
    paidAt: { type: Date, default: null },
    paidAmountCents: { type: Number, default: null },

    // ✅ idempotência / notificação
    paymentNotifiedAt: { type: Date, default: null },
    paymentNotifiedTo: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    paymentNotifiedPixId: { type: String, trim: true, default: null },
    paymentNotifiedKey: { type: String, trim: true, default: null },

    payment: {
      lastPixId: { type: String, default: null },
      lastPixStatus: { type: String, default: null },
      lastPixExpiresAt: { type: Date, default: null },
      lastPixUpdatedAt: { type: Date, default: null },
    },
  },
  { timestamps: true },
);

OfferSchema.index({ workspaceId: 1, ownerUserId: 1, createdAt: -1 });
OfferSchema.index({ workspaceId: 1, status: 1, createdAt: -1 });

export const Offer =
  mongoose.models.Offer || mongoose.model("Offer", OfferSchema);
