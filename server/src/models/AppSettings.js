// server/src/models/AppSettings.js
import mongoose from "mongoose";

const AgendaIntervalSchema = new mongoose.Schema(
  {
    start: { type: String, trim: true }, // "HH:mm"
    end: { type: String, trim: true }, // "HH:mm"
  },
  { _id: false },
);

const AgendaDayRuleSchema = new mongoose.Schema(
  {
    open: { type: Boolean, default: false },
    // "slots" = lista de horários; "intervals" = intervalos (gerados por slotMinutes)
    mode: { type: String, enum: ["slots", "intervals"], default: "slots" },
    slots: { type: [String], default: () => [] }, // ["09:00","10:00"...]
    intervals: { type: [AgendaIntervalSchema], default: () => [] }, // [{start,end}]
  },
  { _id: false },
);

const WeeklyRulesSchema = new mongoose.Schema(
  {
    sun: { type: AgendaDayRuleSchema, default: () => ({ open: false }) },
    mon: { type: AgendaDayRuleSchema, default: () => ({ open: true }) },
    tue: { type: AgendaDayRuleSchema, default: () => ({ open: true }) },
    wed: { type: AgendaDayRuleSchema, default: () => ({ open: true }) },
    thu: { type: AgendaDayRuleSchema, default: () => ({ open: true }) },
    fri: { type: AgendaDayRuleSchema, default: () => ({ open: true }) },
    sat: { type: AgendaDayRuleSchema, default: () => ({ open: false }) },
  },
  { _id: false },
);

const AgendaDateBlockSchema = new mongoose.Schema(
  {
    date: { type: String, trim: true }, // "YYYY-MM-DD"
    reason: { type: String, trim: true },
  },
  { _id: false },
);

const AgendaHolidaySchema = new mongoose.Schema(
  {
    date: { type: String, trim: true }, // "YYYY-MM-DD"
    name: { type: String, trim: true },
  },
  { _id: false },
);

const AgendaDateOverrideSchema = new mongoose.Schema(
  {
    date: { type: String, trim: true }, // "YYYY-MM-DD"
    closed: { type: Boolean, default: false },

    mode: { type: String, enum: ["slots", "intervals"], default: "slots" },
    slots: { type: [String], default: () => [] },
    intervals: { type: [AgendaIntervalSchema], default: () => [] },
  },
  { _id: false },
);

const AgendaSchema = new mongoose.Schema(
  {
    timezone: { type: String, default: "America/Sao_Paulo" },
    slotMinutes: { type: Number, default: 60 }, // passo p/ gerar slots em "intervals"
    selfServiceMinimumNoticeMinutes: { type: Number, default: 24 * 60 },

    // fallback global (compatível com o comportamento atual do backend)
    defaultSlots: {
      type: [String],
      default: () => ["09:00", "10:00", "14:00", "16:00", "18:00"],
    },

    weeklyRules: { type: WeeklyRulesSchema, default: () => ({}) },

    // exceções / overrides por data
    dateBlocks: { type: [AgendaDateBlockSchema], default: () => [] }, // sem expediente
    dateOverrides: { type: [AgendaDateOverrideSchema], default: () => [] }, // horários específicos
    holidays: { type: [AgendaHolidaySchema], default: () => [] }, // feriados manuais
  },
  { _id: false },
);

const NotificationReminderDefaultsSchema = new mongoose.Schema(
  {
    enabled24h: { type: Boolean, default: false },
    enabled3d: { type: Boolean, default: false },
    enabledDueDate: { type: Boolean, default: false },
    enabledAfterDueDate: { type: Boolean, default: false },
  },
  { _id: false },
);

const NotificationPaymentRemindersSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
    defaults: {
      type: NotificationReminderDefaultsSchema,
      default: () => ({}),
    },
  },
  { _id: false },
);

const NotificationBookingRemindersSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
  },
  { _id: false },
);

const NotificationBookingChangesSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
  },
  { _id: false },
);

const NotificationEmailSchema = new mongoose.Schema(
  {
    sellerProofSubmitted: { type: Boolean, default: true },
    sellerPixPaid: { type: Boolean, default: true },
    sellerPlatformConfirmed: { type: Boolean, default: true },
    bookingChanges: {
      type: NotificationBookingChangesSchema,
      default: () => ({}),
    },
  },
  { _id: false },
);

const NotificationWhatsAppSchema = new mongoose.Schema(
  {
    masterEnabled: { type: Boolean, default: true },
    paymentStatusUpdatesEnabled: { type: Boolean, default: true },
    offerCancelledEnabled: { type: Boolean, default: false },
    recurringAutoSendDefault: { type: Boolean, default: false },
    bookingReminders: {
      type: NotificationBookingRemindersSchema,
      default: () => ({}),
    },
    bookingChanges: {
      type: NotificationBookingChangesSchema,
      default: () => ({}),
    },
    paymentReminders: {
      type: NotificationPaymentRemindersSchema,
      default: () => ({}),
    },
  },
  { _id: false },
);

const NotificationAgentSchema = new mongoose.Schema(
  {
    passiveEnabled: { type: Boolean, default: true },
  },
  { _id: false },
);

const NotificationSettingsSchema = new mongoose.Schema(
  {
    email: { type: NotificationEmailSchema, default: () => ({}) },
    whatsapp: { type: NotificationWhatsAppSchema, default: () => ({}) },
    agent: { type: NotificationAgentSchema, default: () => ({}) },
  },
  { _id: false },
);

const AppSettingsSchema = new mongoose.Schema(
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

    // configurações atuais
    agenda: { type: AgendaSchema, default: () => ({}) },
    notifications: { type: NotificationSettingsSchema, default: () => ({}) },

    // extensível p/ futuras configurações
    data: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    version: { type: Number, default: 1 },
  },
  { timestamps: true },
);

AppSettingsSchema.index({ workspaceId: 1, ownerUserId: 1 }, { unique: true });

export const AppSettings =
  mongoose.models.AppSettings ||
  mongoose.model("AppSettings", AppSettingsSchema);
