import mongoose from "mongoose";

/*
  Offer model
  - Persiste campos de proposta (serviço/produto)
  - Persiste condições opcionais COM flags (enabled) para o front respeitar o que foi "ticado"
  - Mantém compatibilidade com campos já usados no front (amountCents, totalCents, etc.)
*/

const ItemSchema = new mongoose.Schema(
  {
    description: { type: String, default: "" },
    qty: { type: Number, default: 1 },
    unitPriceCents: { type: Number, default: 0 },
    lineTotalCents: { type: Number, default: 0 },
  },
  { _id: false },
);

const OfferSchema = new mongoose.Schema(
  {
    // Multi-tenant
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

    // ✅ Cliente (snapshot para página pública)
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      default: null,
      index: true,
    },

    customerEmail: { type: String, trim: true, default: "" },
    customerDoc: { type: String, trim: true, default: "" }, // salvar só dígitos
    customerWhatsApp: { type: String, trim: true, default: "" },
    // Identificação
    customerName: { type: String, required: true, trim: true },

    // Público
    publicToken: { type: String, required: true, unique: true, index: true },
    // Expiração técnica do link (não confundir com validade comercial)
    expiresAt: { type: Date, required: true, index: true },

    // Status
    status: { type: String, default: "PUBLIC" },
    acceptedAt: { type: Date },
    agreeTerms: { type: Boolean, default: false },
    ackDeposit: { type: Boolean, default: false },

    // ✅ Status/infos da última tentativa de cobrança Pix
    payment: {
      lastPixId: { type: String, default: "" },
      lastPixStatus: { type: String, default: "" }, // PENDING/PAID/EXPIRED/CANCELLED/REFUNDED
      lastPixExpiresAt: { type: Date },
      lastPixUpdatedAt: { type: Date },
    },

    // Tipo
    offerType: {
      type: String,
      enum: ["service", "product"],
      default: "service",
      index: true,
    },

    // Conteúdo
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },

    // Produtos
    items: { type: [ItemSchema], default: undefined },

    // Valores
    amountCents: { type: Number, required: true }, // compat: valor final
    subtotalCents: { type: Number, default: null },
    discountCents: { type: Number, default: null },
    freightCents: { type: Number, default: null },
    totalCents: { type: Number, default: null },

    // Pagamento
    depositEnabled: { type: Boolean, default: false },
    depositPct: { type: Number, default: 0 },

    /* =========================
       Condições opcionais (com flags)
    ========================= */

    // Duração (serviço)
    durationEnabled: { type: Boolean, default: false },
    durationMin: { type: Number, default: null },

    // Validade comercial
    validityEnabled: { type: Boolean, default: false },
    validityDays: { type: Number, default: null },
    validityUntil: { type: Date, default: null },

    // Prazo de entrega
    deliveryEnabled: { type: Boolean, default: false },
    deliveryText: { type: String, default: null },

    // Garantia
    warrantyEnabled: { type: Boolean, default: false },
    warrantyText: { type: String, default: null },

    // Observações/condições
    notesEnabled: { type: Boolean, default: false },
    conditionsNotes: { type: String, default: null },

    // Desconto
    discountEnabled: { type: Boolean, default: false },
    discountType: { type: String, enum: ["fixed", "pct"], default: "fixed" },
    discountValue: { type: Number, default: null }, // cents (fixed) ou número (pct), conforme discountType

    // Frete
    freightEnabled: { type: Boolean, default: false },
    freightValue: { type: Number, default: null }, // cents

    // Campos legados/compat
    discount: { type: mongoose.Schema.Types.Mixed, default: null },
    freight: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

// Índices para performance por tenant
OfferSchema.index({ workspaceId: 1, createdAt: -1 });
OfferSchema.index({ workspaceId: 1, publicToken: 1 });

export const Offer =
  mongoose.models.Offer || mongoose.model("Offer", OfferSchema);
