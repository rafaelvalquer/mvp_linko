import mongoose from "mongoose";

const ReminderErrorSchema = new mongoose.Schema(
  {
    message: { type: String, default: null },
    code: { type: String, default: null },
    details: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const OfferReminderLogSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    offerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
      required: true,
      index: true,
    },
    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    kind: {
      type: String,
      enum: ["manual", "after_24h", "after_3d", "due_date", "after_due_date"],
      required: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ["whatsapp"],
      default: "whatsapp",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "sent", "failed", "skipped"],
      default: "pending",
      required: true,
      index: true,
    },

    to: { type: String, default: "" },
    message: { type: String, default: "" },
    provider: { type: String, default: "whatsapp-web.js" },
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

    sentAt: { type: Date, default: null, index: true },
    error: { type: ReminderErrorSchema, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: null },

    triggerKey: { type: String, default: null },
  },
  { timestamps: true, collection: "offer_reminder_logs" },
);

OfferReminderLogSchema.index({ workspaceId: 1, offerId: 1, createdAt: -1 });
OfferReminderLogSchema.index(
  { providerMessageId: 1 },
  {
    partialFilterExpression: { providerMessageId: { $type: "string" } },
  },
);
OfferReminderLogSchema.index(
  { offerId: 1, triggerKey: 1 },
  {
    unique: true,
    partialFilterExpression: { triggerKey: { $type: "string" } },
  },
);

const OfferReminderLog =
  mongoose.models.OfferReminderLog ||
  mongoose.model("OfferReminderLog", OfferReminderLogSchema);

export default OfferReminderLog;
