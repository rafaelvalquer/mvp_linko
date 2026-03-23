// server/src/models/MessageLog.js
import mongoose from "mongoose";

const ErrorSchema = new mongoose.Schema(
  {
    message: { type: String, default: null },
    code: { type: String, default: null },
    details: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const MessageLogSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      default: null,
      index: true,
    },
    offerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
      required: true,
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
    },

    eventType: { type: String, required: true, default: "PIX_PAID" },
    channel: { type: String, required: true, default: "WHATSAPP" },
    provider: { type: String, required: true, default: "whatsapp-web.js" },

    to: { type: String, required: true, default: "" },
    message: { type: String, required: true, default: "" },

    status: {
      type: String,
      required: true,
      enum: ["PENDING", "SENT", "FAILED", "SKIPPED"],
      default: "PENDING",
      index: true,
    },

    providerMessageId: { type: String, default: null },
    deliveryState: {
      type: String,
      enum: ["ERROR", "PENDING", "SERVER", "DEVICE", "READ", "PLAYED"],
      default: null,
      index: true,
    },
    deliveryLastAckCode: { type: Number, default: null },
    deliveryLastAckAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
    playedAt: { type: Date, default: null },
    error: { type: ErrorSchema, default: null },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "message_logs" },
);

// Índices recomendados
MessageLogSchema.index({ workspaceId: 1, createdAt: -1 });
MessageLogSchema.index(
  { providerMessageId: 1 },
  {
    partialFilterExpression: { providerMessageId: { $type: "string" } },
  },
);

// ✅ Idempotência por evento (1 mensagem por offer por evento)
MessageLogSchema.index({ offerId: 1, eventType: 1 }, { unique: true });

export const MessageLog =
  mongoose.models.MessageLog || mongoose.model("MessageLog", MessageLogSchema);
