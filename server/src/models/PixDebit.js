// server/src/models/PixDebit.js
import mongoose from "mongoose";

/**
 * PixDebit hoje é usado em 2 frentes:
 * 1) Quota de Pix (eventId + cycleKey)  -> status: DEBITED | SKIPPED_QUOTA
 * 2) Ledger de Wallet/Saques (key + kind) -> status: CREATED | APPLIED | REVERTED | FAILED
 *
 * Mantido em um único model por compatibilidade com a base atual.
 */

const STATUS = [
  "DEBITED",
  "SKIPPED_QUOTA",
  "CREATED",
  "APPLIED",
  "REVERTED",
  "FAILED",
];

const KIND = [
  "WALLET_CREDIT",
  "WALLET_DEBIT",
  "AUTO_PAYOUT",
  "MANUAL_WITHDRAW",
];

const PixDebitSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },

    // ======================================================
    // ✅ (1) Quota Pix (legado)
    // ======================================================

    /**
     * Identificador idempotente do pagamento:
     * - paymentId / pixId do gateway
     */
    eventId: { type: String, trim: true, default: null },

    // "YYYY-MM-DD" em America/Sao_Paulo (legado)
    cycleKey: { type: String, trim: true, default: "" },

    // ======================================================
    // ✅ (2) Wallet ledger (novo)
    // ======================================================

    kind: { type: String, enum: KIND, default: null },

    /**
     * Idempotency key (ex.: credit:pixPaid:<paymentId>)
     */
    key: { type: String, trim: true, default: null },

    offerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
      default: null,
    },
    paymentId: { type: String, trim: true, default: null },
    withdrawId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Withdraw",
      default: null,
    },

    amountCents: { type: Number, default: 0 },

    status: {
      type: String,
      enum: STATUS,
      required: true,
      default: "DEBITED",
    },

    reason: { type: String, default: "" },

    // auditoria opcional
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true },
);

// ✅ idempotência forte (quota)
PixDebitSchema.index(
  { workspaceId: 1, eventId: 1 },
  { unique: true, sparse: true },
);

// ✅ idempotência forte (wallet/saques)
PixDebitSchema.index(
  { workspaceId: 1, key: 1 },
  { unique: true, sparse: true },
);

PixDebitSchema.index({ workspaceId: 1, cycleKey: 1, createdAt: -1 });
PixDebitSchema.index({ workspaceId: 1, kind: 1, createdAt: -1 });

const PixDebit =
  mongoose.models.PixDebit || mongoose.model("PixDebit", PixDebitSchema);

export default PixDebit;
