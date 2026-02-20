//server/src/models/Workspace.js

import mongoose from "mongoose";

const PLANS = ["start", "pro", "business", "enterprise"];

const PixUsageSchema = new mongoose.Schema(
  {
    /**
     * cycleKey do CICLO DA ASSINATURA (não do mês calendário)
     * Formato: "YYYY-MM-DD" em America/Sao_Paulo
     * Ex.: 2026-02-19 (anchor day)
     */
    cycleKey: { type: String, default: "" },
    used: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const SubscriptionSchema = new mongoose.Schema(
  {
    provider: { type: String, enum: ["stripe"], default: "stripe" },

    stripeCustomerId: { type: String, default: "", index: true },
    stripeSubscriptionId: { type: String, default: "", index: true },

    status: {
      type: String,
      enum: ["inactive", "active", "past_due", "canceled"],
      default: "inactive",
      index: true,
    },

    currentPeriodStart: { type: Date },
    currentPeriodEnd: { type: Date },

    priceId: { type: String, default: "" },
    planAtStripe: { type: String, default: "" },

    lastInvoiceId: { type: String, default: "" },
  },
  { _id: false },
);

const WorkspaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // opcional, mas único quando existir (sparse permite múltiplos null/undefined)
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

    // ✅ Novo modelo de planos
    plan: {
      type: String,
      enum: PLANS,
      default: "start",
      index: true,
    },

    /**
     * Limite por ciclo de assinatura
     * - start: 20
     * - pro: 50
     * - business: 120
     * - enterprise: configurável
     */
    pixMonthlyLimit: { type: Number, default: 20, min: 0 },

    pixUsage: { type: PixUsageSchema, default: () => ({}) },

    subscription: { type: SubscriptionSchema, default: () => ({}) },
  },
  { timestamps: true },
);

WorkspaceSchema.index({ ownerUserId: 1, createdAt: -1 });

// opcional (não unique para evitar problemas em dados antigos):
WorkspaceSchema.index(
  { "subscription.stripeSubscriptionId": 1 },
  { sparse: true },
);

export const Workspace =
  mongoose.models.Workspace || mongoose.model("Workspace", WorkspaceSchema);
