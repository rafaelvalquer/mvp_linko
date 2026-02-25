// server/src/models/Withdraw.js
import mongoose from "mongoose";

// Tipos aceitos no provider (AbacatePay usa RANDOM para EVP)
const PIX_TYPES = ["CPF", "CNPJ", "PHONE", "EMAIL", "EVP", "RANDOM", "BR_CODE"];

const PixSchema = new mongoose.Schema(
  {
    type: { type: String, enum: PIX_TYPES, required: true },

    // ⚠️ por segurança, armazene apenas a chave mascarada
    // (o valor bruto fica somente em memória durante a chamada ao gateway)
    key: { type: String, required: true, trim: true },

    // campo extra opcional (não obrigatório)
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

    // id externo (idempotência + rastreio no gateway)
    externalId: { type: String, required: true, unique: true, index: true },

    idempotencyKey: { type: String, default: "", index: true },

    requestedBy: {
      type: String,
      enum: ["USER", "AUTO"],
      default: "USER",
      index: true,
    },

    method: { type: String, enum: ["PIX"], required: true, default: "PIX" },

    grossAmountCents: { type: Number, required: true },

    // ✅ compat: permanece, mas novos registros sempre 0
    feePct: { type: Number, required: true, default: 0 },
    feeCents: { type: Number, required: true, default: 0 },

    netAmountCents: { type: Number, required: true }, // enviado ao gateway

    // destino (sempre mascarado)
    destinationPixKeyType: {
      type: String,
      enum: ["CPF", "CNPJ", "PHONE", "EMAIL", "EVP"],
      default: null,
    },
    destinationPixKeyMasked: { type: String, default: "" },

    // mantido por compatibilidade (chave mascarada)
    pix: { type: PixSchema, required: true },

    description: { type: String, default: "" },

    provider: { type: String, default: "ABACATEPAY" },
    providerTransactionId: { type: String, index: true },

    // flags de ledger
    ledgerDebited: { type: Boolean, default: false },
    balanceReverted: { type: Boolean, default: false },

    // erro (quando falha)
    error: {
      code: { type: String, default: "" },
      message: { type: String, default: "" },
    },

    status: {
      type: String,
      enum: [
        "PENDING",
        "PROCESSING",
        "COMPLETE",
        "FAILED",
        "EXPIRED",
        "CANCELLED",
        "REFUNDED",
      ],
      default: "PENDING",
      index: true,
    },

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
WithdrawSchema.index({ workspaceId: 1, requestedBy: 1, createdAt: -1 });

const Withdraw =
  mongoose.models.Withdraw || mongoose.model("Withdraw", WithdrawSchema);

export default Withdraw;
