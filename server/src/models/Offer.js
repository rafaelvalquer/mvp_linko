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

const PaymentProofSchema = new mongoose.Schema(
  {
    storage: {
      provider: { type: String, default: "local" }, // local|s3
      key: { type: String, default: null }, // nome do arquivo (local) ou key (s3)
      path: { type: String, default: null }, // opcional (local)
      url: { type: String, default: null }, // opcional (s3/presigned)
    },
    originalName: { type: String, default: null },
    mimeType: { type: String, default: null },
    size: { type: Number, default: null },
    uploadedAt: { type: Date, default: null },
    uploadedBy: { type: String, default: "public" }, // public|user
    note: { type: String, default: null },
  },
  { _id: false },
);

const OfferSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      index: true,
      default: null,
    },
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },

    sellerEmail: { type: String, default: null },
    sellerName: { type: String, default: null },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      default: null,
    },
    customerName: { type: String, required: true, trim: true },
    customerEmail: { type: String, default: "" },
    customerDoc: { type: String, default: "" },
    customerWhatsApp: { type: String, default: "" },

    notifyWhatsAppOnPaid: { type: Boolean, default: false },

    offerType: {
      type: String,
      enum: ["service", "product"],
      default: "service",
    },

    title: { type: String, default: "" },
    description: { type: String, default: "" },

    items: { type: [ItemSchema], default: [] },

    amountCents: { type: Number, required: true },
    subtotalCents: { type: Number, default: null },
    discountCents: { type: Number, default: null },
    freightCents: { type: Number, default: null },
    totalCents: { type: Number, default: null },

    depositEnabled: { type: Boolean, default: false },
    depositPct: { type: Number, default: 0 },

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

    publicToken: { type: String, index: true, unique: true, sparse: true },
    expiresAt: { type: Date, default: null },

    status: { type: String, default: "PUBLIC", index: true },
    acceptedAt: { type: Date, default: null },

    // ✅ status de pagamento separado do status de fluxo (compat)
    paymentStatus: { type: String, default: "PENDING", index: true },

    // ✅ método de pagamento (novo MVP sem intermediador)
    paymentMethod: { type: String, default: "MANUAL_PIX", index: true },

    // ✅ comprovante de pagamento (manual)
    paymentProof: { type: PaymentProofSchema, default: null },

    // ✅ confirmação manual (pelo dono do workspace)
    confirmedAt: { type: Date, default: null },
    confirmedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // ✅ recusa manual (opcional)
    rejectedAt: { type: Date, default: null },
    rejectedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    rejectionNote: { type: String, default: null },

    // compat legado (AbacatePay)
    payment: {
      provider: { type: String, default: null },
      lastPixId: { type: String, default: null },
      lastPixStatus: { type: String, default: null },
      lastPixExpiresAt: { type: Date, default: null },
      lastPixUpdatedAt: { type: Date, default: null },
    },

    paidAt: { type: Date, default: null },
    paidAmountCents: { type: Number, default: null },

    // e-mail (pago confirmado)
    paymentNotifiedAt: { type: Date, default: null },
    paymentNotifiedTo: { type: String, default: null },
    paymentNotifiedPixId: { type: String, default: null },
    paymentNotifiedKey: { type: String, default: null },

    // e-mail (comprovante enviado)
    proofNotifiedAt: { type: Date, default: null },
    proofNotifiedTo: { type: String, default: null },
    proofNotifiedKey: { type: String, default: null },
    proofNotifiedFileKey: { type: String, default: null },

    // flags públicos (compat)
    publicDoneOnly: { type: Boolean, default: false },
    publicLockedAt: { type: String, default: null },
  },
  { timestamps: true },
);

export const Offer = mongoose.model("Offer", OfferSchema);
