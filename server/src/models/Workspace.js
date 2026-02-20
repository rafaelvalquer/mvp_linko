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

    // ✅ novo: status do plano (cadastro -> free, checkout criado -> pending, pago -> active)
    planStatus: {
      type: String,
      enum: PLAN_STATUS,
      default: "free",
      index: true,
    },

    pixMonthlyLimit: { type: Number, default: 0, min: 0 },
    pixUsage: { type: PixUsageSchema, default: () => ({}) },

    subscription: { type: SubscriptionSchema, default: () => ({}) },
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
