import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * PixDebit: ledger para:
 * - PIX_QUOTA (1 por pagamento Pix confirmado)
 * - WALLET_CREDIT (crédito de wallet após PAID)
 * - AUTO_PAYOUT (saque automático)
 * - WITHDRAW (débito para saque)
 */
const PixDebitSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true, index: true },
    offerId: { type: Schema.Types.ObjectId, default: null, index: true },
    withdrawId: { type: Schema.Types.ObjectId, default: null, index: true },

    // id do pagamento (pixId/txid/chargeId/logId)
    paymentId: { type: String, default: null, index: true },

    kind: {
      type: String,
      enum: [
        "PIX_QUOTA",
        "WALLET_CREDIT",
        "WITHDRAW",
        "AUTO_PAYOUT",
        "MANUAL_WITHDRAW",
      ],
      default: "PIX_QUOTA",
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

    // ✅ compat legado
    // IMPORTANTE: não usar default:null para não “participar” do unique+sparse
    eventId: { type: String, default: undefined, index: true },
    cycleKey: { type: String, default: undefined, index: true }, // YYYY-MM-DD (uso atual)

    // idempotência forte por workspace
    key: { type: String, required: true },

    meta: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

// idempotência principal
PixDebitSchema.index({ workspaceId: 1, key: 1 }, { unique: true });

// compat/idempotência legado
PixDebitSchema.index(
  { workspaceId: 1, eventId: 1 },
  { unique: true, sparse: true },
);

// acessos comuns
PixDebitSchema.index({ workspaceId: 1, kind: 1, createdAt: -1 });

PixDebitSchema.pre("validate", function (next) {
  try {
    // ✅ garanta que eventId vazio vire “ausente”
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

    // ✅ compat: se código legado enviar só eventId (quota), derive paymentId
    if (!this.paymentId) {
      const ev = String(this.eventId || "").trim();
      if (ev) this.paymentId = ev;
    }

    if (!this.kind) this.kind = "PIX_QUOTA";
    if (!this.status)
      this.status = this.kind === "PIX_QUOTA" ? "DEBITED" : "APPLIED";
  } catch {}
  next();
});

export default mongoose.models.PixDebit ||
  mongoose.model("PixDebit", PixDebitSchema);
