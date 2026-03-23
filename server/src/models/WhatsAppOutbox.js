import mongoose from "mongoose";

const WhatsAppOutboxErrorSchema = new mongoose.Schema(
  {
    message: { type: String, default: null },
    code: { type: String, default: null },
    details: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const WhatsAppOutboxSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      default: null,
      index: true,
    },
    to: { type: String, required: true, trim: true },
    message: { type: String, required: true, default: "" },
    status: {
      type: String,
      enum: ["queued", "processing", "sent", "failed", "cancelled"],
      required: true,
      default: "queued",
      index: true,
    },
    attempts: { type: Number, default: 0, min: 0 },
    maxAttempts: { type: Number, default: 8, min: 1 },
    nextAttemptAt: { type: Date, default: Date.now, index: true },
    lastAttemptAt: { type: Date, default: null },
    lockedAt: { type: Date, default: null },
    lockId: { type: String, default: null },
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
    lastError: { type: WhatsAppOutboxErrorSchema, default: null },
    sentAt: { type: Date, default: null },
    dedupeKey: { type: String, default: null },
    sourceType: { type: String, default: null },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    meta: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true, collection: "whatsapp_outbox" },
);

WhatsAppOutboxSchema.index({ status: 1, nextAttemptAt: 1, createdAt: 1 });
WhatsAppOutboxSchema.index({ lockedAt: 1 });
WhatsAppOutboxSchema.index({ sourceType: 1, sourceId: 1, createdAt: -1 });
WhatsAppOutboxSchema.index(
  { providerMessageId: 1 },
  {
    partialFilterExpression: { providerMessageId: { $type: "string" } },
  },
);
WhatsAppOutboxSchema.index(
  { dedupeKey: 1 },
  {
    unique: true,
    partialFilterExpression: { dedupeKey: { $type: "string" } },
  },
);

export const WhatsAppOutbox =
  mongoose.models.WhatsAppOutbox ||
  mongoose.model("WhatsAppOutbox", WhatsAppOutboxSchema);
