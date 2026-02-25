//server/src/models/Workspace.js
import mongoose from "mongoose";

const PLANS = ["start", "pro", "business", "enterprise"];
const PLAN_STATUS = ["free", "pending", "active"];

const PixUsageSchema = new mongoose.Schema(
  {
    // ciclo por âncora (YYYY-MM-DD em America/Sao_Paulo)
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

    // Mudança de plano agendada (ex.: downgrade no fim do ciclo)
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

    // ✅ status do plano (cadastro -> free, checkout criado -> pending, pago -> active)
    planStatus: {
      type: String,
      enum: PLAN_STATUS,
      default: "free",
      index: true,
    },

    pixMonthlyLimit: { type: Number, default: 0, min: 0 },
    pixUsage: { type: PixUsageSchema, default: () => ({}) },

    subscription: { type: SubscriptionSchema, default: () => ({}) },

    // ======================================================
    // ✅ Wallet / Saques
    // ======================================================

    // saldo disponível para saque
    walletAvailableCents: { type: Number, default: 0, min: 0 },

    payoutPixKeyType: {
      type: String,
      enum: ["CPF", "CNPJ", "PHONE", "EMAIL", "EVP"],
      default: null,
    },

    // ⚠️ por segurança, não retorna em queries padrão
    // (para usar, selecione explicitamente com +payoutPixKey)
    payoutPixKey: { type: String, default: null, select: false },

    // sempre retornar a masked no frontend
    payoutPixKeyMasked: { type: String, default: null },

    autoPayoutEnabled: { type: Boolean, default: false },

    // evita auto-saque pequeno (0 = desativado)
    autoPayoutMinCents: { type: Number, default: 0, min: 0 },

    payoutUpdatedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

WorkspaceSchema.index({ ownerUserId: 1, createdAt: -1 });

// evita warning duplicado: índice só aqui
WorkspaceSchema.index(
  { "subscription.stripeSubscriptionId": 1 },
  { sparse: true },
);

export const Workspace =
  mongoose.models.Workspace || mongoose.model("Workspace", WorkspaceSchema);
