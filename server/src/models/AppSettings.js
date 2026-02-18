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
