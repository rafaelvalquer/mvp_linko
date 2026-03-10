// server/src/models/RecurringOffer.js
import mongoose from "mongoose";

const RecurringHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["generated", "sent", "skipped", "failed", "paused", "ended"],
      required: true,
      default: "generated",
    },
    source: {
      type: String,
      enum: ["creation", "automatic", "manual", "resume", "pause", "end", "duplicate"],
      default: "automatic",
    },
    ranAt: { type: Date, default: Date.now },
    offerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
      default: null,
    },
    recurringSequence: { type: Number, default: null },
    message: { type: String, default: "" },
    error: {
      message: { type: String, default: null },
      code: { type: String, default: null },
      details: { type: mongoose.Schema.Types.Mixed, default: null },
    },
    meta: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: true },
);

const RecurrenceSchema = new mongoose.Schema(
  {
    intervalDays: { type: Number, required: true, min: 1 },
    startsAt: { type: Date, required: true },
    nextRunAt: { type: Date, default: null, index: true },
    timeOfDay: { type: String, default: "09:00" },
    endMode: {
      type: String,
      enum: ["never", "until_date", "until_count"],
      default: "never",
    },
    endsAt: { type: Date, default: null },
    maxOccurrences: { type: Number, default: null, min: 1 },
  },
  { _id: false },
);

const AutomationSchema = new mongoose.Schema(
  {
    autoSendToCustomer: { type: Boolean, default: false },
    generateFirstNow: { type: Boolean, default: false },
  },
  { _id: false },
);

const RunnerSchema = new mongoose.Schema(
  {
    lockedAt: { type: Date, default: null },
    lockId: { type: String, default: null },
  },
  { _id: false },
);

const RecurringOfferSchema = new mongoose.Schema(
  {
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

    name: { type: String, required: true, trim: true },

    sellerName: { type: String, default: null },
    sellerEmail: { type: String, default: null },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      default: null,
      index: true,
    },
    customerName: { type: String, required: true, trim: true },
    customerEmail: { type: String, default: "" },
    customerDoc: { type: String, default: "" },
    customerWhatsApp: { type: String, default: "" },

    offerType: {
      type: String,
      enum: ["service", "product"],
      default: "service",
    },
    title: { type: String, default: "" },
    description: { type: String, default: "" },
    items: {
      type: [
        new mongoose.Schema(
          {
            description: { type: String, required: true, trim: true },
            qty: { type: Number, required: true, min: 1 },
            unitPriceCents: { type: Number, default: null },
            lineTotalCents: { type: Number, default: null },
          },
          { _id: false },
        ),
      ],
      default: [],
    },

    amountCents: { type: Number, required: true },
    subtotalCents: { type: Number, default: null },
    discountCents: { type: Number, default: null },
    freightCents: { type: Number, default: null },
    totalCents: { type: Number, default: null },

    depositEnabled: { type: Boolean, default: false },
    depositPct: { type: Number, default: 0 },

    durationEnabled: { type: Boolean, default: false },
    durationMin: { type: Number, default: null },

    validityEnabled: { type: Boolean, default: false },
    validityDays: { type: Number, default: null },

    deliveryEnabled: { type: Boolean, default: false },
    deliveryText: { type: String, default: null },

    warrantyEnabled: { type: Boolean, default: false },
    warrantyText: { type: String, default: null },

    notesEnabled: { type: Boolean, default: false },
    conditionsNotes: { type: String, default: null },

    discountEnabled: { type: Boolean, default: false },
    discountType: { type: String, default: null },
    discountValue: { type: mongoose.Schema.Types.Mixed, default: null },

    freightEnabled: { type: Boolean, default: false },
    freightValue: { type: mongoose.Schema.Types.Mixed, default: null },

    notifyWhatsAppOnPaid: { type: Boolean, default: false },

    recurrence: { type: RecurrenceSchema, required: true },
    automation: { type: AutomationSchema, default: () => ({}) },

    status: {
      type: String,
      enum: ["draft", "active", "paused", "ended", "error"],
      default: "active",
      index: true,
    },

    runCount: { type: Number, default: 0 },
    successCount: { type: Number, default: 0 },
    failureCount: { type: Number, default: 0 },

    lastRunAt: { type: Date, default: null },
    lastOfferId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
      default: null,
    },
    lastError: {
      message: { type: String, default: null },
      code: { type: String, default: null },
      details: { type: mongoose.Schema.Types.Mixed, default: null },
      at: { type: Date, default: null },
    },
    endedAt: { type: Date, default: null },

    runner: { type: RunnerSchema, default: () => ({}) },
    history: { type: [RecurringHistorySchema], default: [] },
  },
  { timestamps: true, collection: "recurring_offers" },
);

RecurringOfferSchema.index({ workspaceId: 1, ownerUserId: 1, createdAt: -1 });
RecurringOfferSchema.index({ workspaceId: 1, status: 1, "recurrence.nextRunAt": 1 });
RecurringOfferSchema.index({ workspaceId: 1, customerId: 1, status: 1 });

export const RecurringOffer =
  mongoose.models.RecurringOffer ||
  mongoose.model("RecurringOffer", RecurringOfferSchema);
