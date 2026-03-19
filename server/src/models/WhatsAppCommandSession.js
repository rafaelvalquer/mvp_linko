import mongoose from "mongoose";

export const WHATSAPP_COMMAND_SESSION_STATES = [
  "NEW",
  "COLLECTING_FIELDS",
  "AWAITING_CUSTOMER_SELECTION",
  "AWAITING_PRODUCT_SELECTION",
  "AWAITING_DESTINATION_PHONE",
  "AWAITING_CONFIRMATION",
  "PROCESSING_CREATE",
  "COMPLETED",
  "CANCELLED",
  "ERROR",
  "EXPIRED",
];

const ErrorSchema = new mongoose.Schema(
  {
    message: { type: String, default: null },
    code: { type: String, default: null },
    details: { type: mongoose.Schema.Types.Mixed, default: null },
    at: { type: Date, default: null },
  },
  { _id: false },
);

const CandidateCustomerSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      default: null,
    },
    fullName: { type: String, default: "" },
    phone: { type: String, default: "" },
    phoneDigits: { type: String, default: "" },
    score: { type: Number, default: 0 },
  },
  { _id: false },
);

const CandidateProductSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    name: { type: String, default: "" },
    score: { type: Number, default: 0 },
  },
  { _id: false },
);

const WhatsAppCommandSessionSchema = new mongoose.Schema(
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
    requesterPhoneRaw: { type: String, default: "" },
    requesterPhoneDigits: { type: String, required: true, index: true },
    requesterPushName: { type: String, default: "" },
    sourceChannel: {
      type: String,
      enum: ["whatsapp"],
      default: "whatsapp",
    },
    sourceMessageIds: { type: [String], default: [] },
    originalInputType: {
      type: String,
      enum: ["text", "audio"],
      default: "text",
    },
    originalText: { type: String, default: "" },
    transcriptText: { type: String, default: "" },
    lastUserMessageText: { type: String, default: "" },
    state: {
      type: String,
      enum: WHATSAPP_COMMAND_SESSION_STATES,
      default: "NEW",
      index: true,
    },
    pendingFields: { type: [String], default: [] },
    extracted: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    resolved: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    candidateCustomers: { type: [CandidateCustomerSchema], default: [] },
    candidateProducts: { type: [CandidateProductSchema], default: [] },
    confirmationSummaryText: { type: String, default: "" },
    createdOfferId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
      default: null,
    },
    sentToCustomerAt: { type: Date, default: null },
    lastQuestionKey: { type: String, default: "" },
    lastQuestionText: { type: String, default: "" },
    lastError: { type: ErrorSchema, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
    collection: "whatsapp_command_sessions",
  },
);

WhatsAppCommandSessionSchema.index({ userId: 1, state: 1 });
WhatsAppCommandSessionSchema.index({ requesterPhoneDigits: 1, state: 1 });
WhatsAppCommandSessionSchema.index({ workspaceId: 1, createdAt: -1 });

export const WhatsAppCommandSession =
  mongoose.models.WhatsAppCommandSession ||
  mongoose.model("WhatsAppCommandSession", WhatsAppCommandSessionSchema);
