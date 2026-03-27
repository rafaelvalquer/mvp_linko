import mongoose from "mongoose";

const CHANNELS = ["whatsapp", "email", "both"];
const FREQUENCIES = ["daily", "weekly"];
const STATUSES = ["active", "paused", "error"];
const WEEK_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const AutomationHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["sent", "failed", "skipped", "queued"],
      default: "queued",
    },
    source: {
      type: String,
      enum: ["automatic", "manual"],
      default: "automatic",
    },
    ranAt: { type: Date, default: null },
    message: { type: String, default: "" },
    channels: { type: [String], default: [] },
    error: {
      message: { type: String, default: null },
      code: { type: String, default: null },
      details: { type: mongoose.Schema.Types.Mixed, default: null },
    },
    meta: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const UserAutomationSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    templateKey: { type: String, required: true, trim: true, maxlength: 80 },
    channel: {
      type: String,
      enum: CHANNELS,
      default: "whatsapp",
      index: true,
    },
    frequency: {
      type: String,
      enum: FREQUENCIES,
      default: "daily",
      index: true,
    },
    dayOfWeek: {
      type: String,
      enum: ["", ...WEEK_DAYS],
      default: "",
    },
    timeOfDay: {
      type: String,
      default: "09:00",
    },
    timeZone: {
      type: String,
      default: "America/Sao_Paulo",
    },
    status: {
      type: String,
      enum: STATUSES,
      default: "active",
      index: true,
    },
    destinationMode: {
      type: String,
      enum: ["default", "override"],
      default: "default",
    },
    emailRecipients: { type: [String], default: [] },
    whatsappRecipients: { type: [String], default: [] },
    nextRunAt: { type: Date, default: null, index: true },
    lastRunAt: { type: Date, default: null },
    lastSuccessfulRunAt: { type: Date, default: null },
    lastFailedRunAt: { type: Date, default: null },
    runCount: { type: Number, default: 0 },
    successCount: { type: Number, default: 0 },
    failureCount: { type: Number, default: 0 },
    lastError: {
      message: { type: String, default: null },
      code: { type: String, default: null },
      details: { type: mongoose.Schema.Types.Mixed, default: null },
      at: { type: Date, default: null },
    },
    history: { type: [AutomationHistorySchema], default: [] },
    runner: {
      lockedAt: { type: Date, default: null },
      lockId: { type: String, default: null },
    },
  },
  {
    timestamps: true,
    collection: "user_automations",
  },
);

UserAutomationSchema.index({ workspaceId: 1, userId: 1, status: 1 });
UserAutomationSchema.index({ userId: 1, updatedAt: -1 });
UserAutomationSchema.index({ status: 1, nextRunAt: 1 });
UserAutomationSchema.index(
  { userId: 1, templateKey: 1, name: 1 },
  { collation: { locale: "en", strength: 2 } },
);

export const UserAutomation =
  mongoose.models.UserAutomation ||
  mongoose.model("UserAutomation", UserAutomationSchema);
