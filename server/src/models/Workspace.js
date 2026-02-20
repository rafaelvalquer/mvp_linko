//server/src/models/Workspace.js

import mongoose from "mongoose";

/**
 * Compatibilidade:
 * - "free" -> "start"
 * - "premium" -> "pro"
 * Mantemos no enum por enquanto para não quebrar workspaces antigos ainda não migrados.
 */
const PLANS = ["start", "pro", "business", "enterprise"];

const PixUsageSchema = new mongoose.Schema(
  {
    cycleKey: { type: String, default: "" }, // "YYYY-MM"
    used: { type: Number, default: 0, min: 0 },
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
      enum: ["start", "pro", "business", "enterprise"],
      default: "start",
      index: true,
    },

    /**
     * Limite mensal de Pix (cota do ciclo)
     * - start: 20
     * - pro: 50
     * - business: 120
     * - enterprise: configurável
     */
    pixMonthlyLimit: { type: Number, default: 20, min: 0 },

    /**
     * Uso por ciclo mensal (YYYY-MM), em America/Sao_Paulo
     */
    pixUsage: { type: PixUsageSchema, default: () => ({}) },
  },
  { timestamps: true },
);

WorkspaceSchema.index({ ownerUserId: 1, createdAt: -1 });

export const Workspace =
  mongoose.models.Workspace || mongoose.model("Workspace", WorkspaceSchema);
