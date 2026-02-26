// server/src/models/Withdraw.js
import mongoose from "mongoose";

// ✅ mantém compat com o provedor + adiciona tipos do produto (EVP)
const PIX_TYPES = ["CPF", "CNPJ", "PHONE", "EMAIL", "EVP", "RANDOM", "BR_CODE"];

const PixSchema = new mongoose.Schema(
  {
    type: { type: String, enum: PIX_TYPES, required: true },
    key: { type: String, required: true, trim: true }, // ⚠️ para novos registros, salvar SEMPRE mascarada
    description: { type: String, default: "" },
  },
  { _id: false },
);

const WithdrawSchema = new mongoose.Schema(
  {
    // multi-tenant
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Quem solicitou
    requestedBy: {
      type: String,
      enum: ["USER", "AUTO"],
      default: "USER",
      index: true,
    },

    // referência interna (usada como externalId no gateway)
    externalId: { type: String, required: true, unique: true, index: true },

    method: { type: String, enum: ["PIX"], required: true, default: "PIX" },

    // valor solicitado (novo / MVP)
    amountCents: { type: Number, default: null },

    grossAmountCents: { type: Number, required: true },

    // ✅ compat: permanece, mas novos registros sempre 0
    feePct: { type: Number, required: true, default: 0 },
    feeCents: { type: Number, required: true, default: 0 },

    netAmountCents: { type: Number, required: true }, // enviado ao gateway

    // destino (mask) - preferir isso no front
    destinationPixKeyType: { type: String, default: null },
    destinationPixKeyMasked: { type: String, default: null },

    // compat: pix (para UI existente) - salvar mascarado nos novos
    pix: { type: PixSchema, required: true },

    description: { type: String, default: "" },

    provider: { type: String, default: "ABACATEPAY" },
    providerTransactionId: { type: String, index: true },

    status: {
      // superset: mantém estados do provedor e adiciona estados internos
      type: String,
      enum: [
        "PENDING",
        "PROCESSING",
        "PAID",
        "FAILED",
        "EXPIRED",
        "CANCELLED",
        "COMPLETE",
        "REFUNDED",
      ],
      default: "PENDING",
      index: true,
    },

    error: { type: String, default: "" },

    receiptUrl: { type: String, default: "" },
    devMode: { type: Boolean, default: false },

    // opcional (debug / auditoria)
    gateway: {
      rawCreateResponse: { type: mongoose.Schema.Types.Mixed },
      rawGetResponse: { type: mongoose.Schema.Types.Mixed },
      lastError: { type: mongoose.Schema.Types.Mixed },
    },
  },
  { timestamps: true },
);

WithdrawSchema.index({ workspaceId: 1, createdAt: -1 });

const Withdraw =
  mongoose.models.Withdraw || mongoose.model("Withdraw", WithdrawSchema);

export default Withdraw;
