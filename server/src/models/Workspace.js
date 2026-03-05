//server/src/models/Workspace.js
import mongoose from "mongoose";

const PLANS = ["start", "pro", "business", "enterprise"];
const PLAN_STATUS = ["free", "pending", "active"];

const PIX_KEY_TYPES = ["CPF", "CNPJ", "PHONE", "EMAIL", "EVP"];

const PixUsageSchema = new mongoose.Schema(
  {
    cycleKey: { type: String, default: "" },
    used: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const SubscriptionSchema = new mongoose.Schema(
  {
    provider: { type: String, default: "stripe" },

    stripeCustomerId: { type: String, default: "" },
    stripeSubscriptionId: { type: String, default: "" },

    status: {
      type: String,
      enum: ["inactive", "active", "past_due", "canceled"],
      default: "inactive",
      index: true,
    },

    currentPeriodStart: { type: Date, default: null },
    currentPeriodEnd: { type: Date, default: null },

    priceId: { type: String, default: "" },
    planAtStripe: { type: String, default: "" },

    pendingPriceId: { type: String, default: "" },
    pendingPlan: { type: String, default: "" },
    pendingEffectiveAt: { type: Date, default: null },
    scheduleId: { type: String, default: "" },

    lastInvoiceId: { type: String, default: "" },
  },
  { _id: false },
);

const WorkspaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    plan: { type: String, enum: PLANS, default: "start", index: true },

    planStatus: {
      type: String,
      enum: PLAN_STATUS,
      default: "free",
      index: true,
    },

    // =========================================================
    // PIX QUOTA
    // =========================================================
    pixMonthlyLimit: { type: Number, default: 0, min: 0 },
    pixUsage: { type: PixUsageSchema, default: () => ({}) },

    // =========================================================
    // WALLET / SAQUE (legado)
    // =========================================================
    walletAvailableCents: { type: Number, default: 0, min: 0 },

    // =========================================================
    // ✅ CONTA PIX (novo fluxo manual)
    // =========================================================
    payoutPixKeyType: { type: String, enum: PIX_KEY_TYPES, default: null },
    payoutPixKey: { type: String, default: null }, // chave crua (backend only)
    payoutPixKeyMasked: { type: String, default: null }, // sempre retornar isso no app

    // opcionais para BRCode (EMV)
    pixReceiverName: { type: String, default: null, trim: true, maxlength: 25 },
    pixReceiverCity: { type: String, default: null, trim: true, maxlength: 15 },

    // se quiser permitir “desabilitar temporariamente”
    pixKeyEnabled: { type: Boolean, default: true },

    payoutUpdatedAt: { type: Date, default: null },

    // =========================================================
    // ASSINATURA
    // =========================================================
    subscription: { type: SubscriptionSchema, default: () => ({}) },
  },
  { timestamps: true },
);

WorkspaceSchema.index({ ownerUserId: 1, createdAt: -1 });
WorkspaceSchema.index(
  { "subscription.stripeSubscriptionId": 1 },
  { sparse: true },
);

export const Workspace =
  mongoose.models.Workspace || mongoose.model("Workspace", WorkspaceSchema);
