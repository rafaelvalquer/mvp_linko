import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * PixDebit: ledger para:
 * - WALLET_CREDIT (crédito de wallet após pagamento confirmado)
 * - WITHDRAW (débito para saque)
 * - AUTO_PAYOUT (saque automático)
 * - MANUAL_WITHDRAW (saque manual)
 */
const PixDebitSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true, index: true },
    offerId: { type: Schema.Types.ObjectId, default: null, index: true },
    withdrawId: { type: Schema.Types.ObjectId, default: null, index: true },

    paymentId: { type: String, default: null, index: true },

    kind: {
      type: String,
      enum: ["WALLET_CREDIT", "WITHDRAW", "AUTO_PAYOUT", "MANUAL_WITHDRAW"],
      default: undefined,
      index: true,
    },

    amountCents: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["DEBITED", "APPLIED", "PENDING", "FAILED", "REVERTED"],
      default: "DEBITED",
      index: true,
    },

    reason: { type: String, default: "" },

    // compat/idempotência legado
    eventId: { type: String, default: undefined, index: true },

    // idempotência forte por workspace
    key: { type: String, required: true },

    meta: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

PixDebitSchema.index({ workspaceId: 1, key: 1 }, { unique: true });
PixDebitSchema.index(
  { workspaceId: 1, eventId: 1 },
  { unique: true, sparse: true },
);
PixDebitSchema.index({ workspaceId: 1, kind: 1, createdAt: -1 });

PixDebitSchema.pre("validate", function (next) {
  try {
    if (
      this.eventId === null ||
      this.eventId === "" ||
      this.eventId === false
    ) {
      this.eventId = undefined;
    }

    if (!this.key) {
      const ev = String(this.eventId || "").trim();
      if (ev) this.key = `legacy:event:${ev}`;
    }

    if (!this.paymentId) {
      const ev = String(this.eventId || "").trim();
      if (ev) this.paymentId = ev;
    }

    if (!this.status) {
      this.status = this.kind === "WALLET_CREDIT" ? "APPLIED" : "DEBITED";
    }
  } catch {}
  next();
});

export default mongoose.models.PixDebit ||
  mongoose.model("PixDebit", PixDebitSchema);
