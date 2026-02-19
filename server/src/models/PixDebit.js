// server/src/models/PixDebit.js
import mongoose from "mongoose";

const PixDebitSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },

    /**
     * Identificador idempotente do pagamento:
     * - eventId do webhook (recomendado) OU chargeId do gateway
     */
    eventId: { type: String, required: true, trim: true },

    cycleKey: { type: String, required: true, trim: true }, // "YYYY-MM"

    status: {
      type: String,
      enum: ["DEBITED", "SKIPPED_QUOTA"],
      required: true,
      default: "DEBITED",
    },

    reason: { type: String, default: "" },

    // auditoria opcional (não obrigatório)
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true },
);

// ✅ idempotência forte
PixDebitSchema.index({ workspaceId: 1, eventId: 1 }, { unique: true });
PixDebitSchema.index({ workspaceId: 1, cycleKey: 1, createdAt: -1 });

const PixDebit =
  mongoose.models.PixDebit || mongoose.model("PixDebit", PixDebitSchema);

export default PixDebit;
