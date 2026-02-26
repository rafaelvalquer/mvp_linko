// server/src/models/PixDebit.js
import mongoose from "mongoose";

/**
 * Ledger/idempotência:
 * - Compatível com o uso legado (quota) via eventId/cycleKey/status DEBITED/SKIPPED_QUOTA
 * - Novo uso (wallet/withdraw) via key/kind/status APPLIED/REVERTED/FAILED
 */

const KINDS = [
  // novo (wallet / saques)
  "WALLET_CREDIT",
  "WALLET_DEBIT",
  "AUTO_PAYOUT",
  "MANUAL_WITHDRAW",

  // legado (quota)
  "PIX_QUOTA",
];

const STATUSES = [
  // novo
  "APPLIED",
  "REVERTED",
  "FAILED",

  // legado
  "DEBITED",
  "SKIPPED_QUOTA",
];

const PixDebitSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },

    // ===== novo =====
    offerId: { type: mongoose.Schema.Types.ObjectId, ref: "Offer", default: null },
    withdrawId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Withdraw",
      default: null,
    },
    paymentId: { type: String, default: null, trim: true },

    key: { type: String, required: true, trim: true }, // idempotency key
    kind: { type: String, enum: KINDS, default: "PIX_QUOTA", index: true },
    amountCents: { type: Number, default: 0 },

    status: {
      type: String,
      enum: STATUSES,
      default: function () {
        return this.kind === "PIX_QUOTA" ? "DEBITED" : "APPLIED";
      },
      index: true,
    },

    reason: { type: String, default: "" },

    // ===== legado =====
    /**
     * Identificador idempotente do pagamento:
     * - eventId do webhook (recomendado) OU chargeId do gateway
     */
    eventId: { type: String, default: null, trim: true },

    cycleKey: { type: String, default: "", trim: true }, // "YYYY-MM" (quota)

    // auditoria opcional (não obrigatório)
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true },
);

// ✅ compat: se algum código antigo ainda salvar apenas {eventId}, gere key automaticamente.
PixDebitSchema.pre("validate", function (next) {
  try {
    if (!this.key) {
      const ev = String(this.eventId || "").trim();
      if (ev) this.key = `legacy:event:${ev}`;
    }
    if (!this.kind) this.kind = "PIX_QUOTA";
    if (!this.status) this.status = this.kind === "PIX_QUOTA" ? "DEBITED" : "APPLIED";
  } catch {}
  next();
});

// ✅ idempotência forte (novo)
PixDebitSchema.index({ workspaceId: 1, key: 1 }, { unique: true });

// ✅ idempotência legado (quota) - mantém compatibilidade
PixDebitSchema.index({ workspaceId: 1, eventId: 1 }, { unique: true, sparse: true });
PixDebitSchema.index({ workspaceId: 1, cycleKey: 1, createdAt: -1 });

const PixDebit =
  mongoose.models.PixDebit || mongoose.model("PixDebit", PixDebitSchema);

export default PixDebit;
