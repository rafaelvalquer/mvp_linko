import crypto from "crypto";

import { UserAutomation } from "../models/UserAutomation.js";
import { User } from "../models/User.js";
import { Workspace } from "../models/Workspace.js";
import { buildGeneralReportsSnapshot } from "./generalReports.service.js";
import { resolveWorkspaceNotificationContext } from "./notificationSettings.js";
import {
  buildWebAgentAutomationSummaryMessage,
  listWebAgentAutomationOfferCandidates,
} from "./webAgentAutomation.service.js";
import { queueOrSendWhatsApp } from "./whatsappOutbox.service.js";
import { dayRangeInTZ } from "./agendaSettings.js";
import {
  buildAgendaSummaryMessage,
  buildWeeklyAgendaMessage,
} from "./whatsapp-ai/whatsappQuestionBuilder.service.js";
import {
  getDateIsoForTimeZone,
  getWorkspaceAgendaTimeZone,
  loadDailyAgendaForWorkspace,
  loadWeeklyAgendaForWorkspace,
  shiftDateIso,
} from "./whatsapp-ai/whatsappAgendaQuery.service.js";
import {
  listOffersWaitingConfirmation,
  listPendingOffers,
} from "./whatsapp-ai/whatsappOfferOperations.service.js";
import {
  canUseAutomations,
  getAutomationPlanLimits,
  normalizePlan,
} from "../utils/planFeatures.js";
import { normalizeWhatsAppPhoneDigits } from "../utils/phone.js";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_TIME = "09:00";
const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const HISTORY_LIMIT = 200;
const RUNNER_LOCK_TTL_MS = Number(
  process.env.USER_AUTOMATIONS_RUNNER_LOCK_TTL_MS || 10 * 60 * 1000,
);

const USER_AUTOMATION_TEMPLATES = Object.freeze([
  {
    key: "daily_agenda",
    label: "Minha agenda diaria",
    description: "Envia a agenda do dia no horario configurado.",
    defaultName: "Minha agenda diaria",
  },
  {
    key: "weekly_summary",
    label: "Resumo semanal",
    description: "Envia um resumo comercial da sua semana.",
    defaultName: "Resumo semanal",
  },
  {
    key: "billing_pending",
    label: "Pendencias de cobranca",
    description: "Envia as propostas pendentes, atrasadas e follow-ups do dia.",
    defaultName: "Pendencias de cobranca",
  },
  {
    key: "waiting_confirmation",
    label: "Aguardando confirmacao",
    description: "Resume propostas com comprovante aguardando aprovacao.",
    defaultName: "Aguardando confirmacao",
  },
  {
    key: "daily_priorities",
    label: "Prioridades do dia",
    description: "Combina agenda, cobranca e pendencias abertas em um resumo curto.",
    defaultName: "Prioridades do dia",
  },
]);

const WEEKDAY_LABELS = Object.freeze({
  monday: "segunda-feira",
  tuesday: "terca-feira",
  wednesday: "quarta-feira",
  thursday: "quinta-feira",
  friday: "sexta-feira",
  saturday: "sabado",
  sunday: "domingo",
});

const WEEKDAY_ORDER = Object.freeze([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeComparableText(value) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function nl2br(value) {
  return escapeHtml(value).replace(/\n/g, "<br/>");
}

function formatDateTime(value, timeZone = DEFAULT_TIMEZONE) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatMoney(cents) {
  const value = Number(cents);
  if (!Number.isFinite(value)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

function formatChannelLabel(channel = "") {
  if (channel === "email") return "E-mail";
  if (channel === "both") return "WhatsApp + E-mail";
  return "WhatsApp";
}

function formatFrequencyLabel(frequency = "", dayOfWeek = "") {
  if (frequency === "weekly") {
    return `Semanal${dayOfWeek ? ` (${WEEKDAY_LABELS[dayOfWeek] || dayOfWeek})` : ""}`;
  }
  return "Diaria";
}

function normalizeTimeOfDay(value) {
  const raw = normalizeText(value) || DEFAULT_TIME;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(raw) ? raw : DEFAULT_TIME;
}

function normalizeChannel(value) {
  const raw = normalizeComparableText(value);
  if (["2", "email", "e-mail", "correio"].includes(raw)) return "email";
  if (["3", "both", "ambos", "todos", "whatsapp e email", "email e whatsapp"].includes(raw)) {
    return "both";
  }
  return "whatsapp";
}

function normalizeFrequency(value) {
  const raw = normalizeComparableText(value);
  if (["2", "weekly", "semanal", "semana"].includes(raw)) return "weekly";
  return "daily";
}

function normalizeWeekDay(value) {
  const raw = normalizeComparableText(value);
  const aliases = {
    "1": "monday",
    monday: "monday",
    segunda: "monday",
    "segunda-feira": "monday",
    "2": "tuesday",
    tuesday: "tuesday",
    terca: "tuesday",
    "terca-feira": "tuesday",
    "terça": "tuesday",
    "terça-feira": "tuesday",
    "3": "wednesday",
    wednesday: "wednesday",
    quarta: "wednesday",
    "quarta-feira": "wednesday",
    "4": "thursday",
    thursday: "thursday",
    quinta: "thursday",
    "quinta-feira": "thursday",
    "5": "friday",
    friday: "friday",
    sexta: "friday",
    "sexta-feira": "friday",
    "6": "saturday",
    saturday: "saturday",
    sabado: "saturday",
    sábado: "saturday",
    "7": "sunday",
    sunday: "sunday",
    domingo: "sunday",
  };

  return aliases[raw] || "";
}

function getTemplateConfig(templateKey = "") {
  return (
    USER_AUTOMATION_TEMPLATES.find(
      (template) => template.key === String(templateKey || "").trim(),
    ) || null
  );
}

function parseDailyTimeInput(value = "") {
  const normalized = normalizeComparableText(value)
    .replace(/\s+/g, "")
    .replace("h", ":");

  if (/^\d{1,2}:\d{2}$/.test(normalized)) {
    const [hours, minutes] = normalized.split(":").map((part) => Number(part));
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }
  }

  if (/^\d{3,4}$/.test(normalized)) {
    const compact = normalized.padStart(4, "0");
    const hours = Number(compact.slice(0, 2));
    const minutes = Number(compact.slice(2, 4));
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }
  }

  return "";
}

function getDayOfWeekFromDateIso(dateISO = "") {
  const date = new Date(`${String(dateISO || "").trim()}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return "monday";
  const day = date.getUTCDay();
  const index = day === 0 ? 6 : day - 1;
  return WEEKDAY_ORDER[index] || "monday";
}

function combineDateIsoAndTime(dateISO, timeOfDay = DEFAULT_TIME, timeZone = DEFAULT_TIMEZONE) {
  const normalizedDate = normalizeText(dateISO);
  const normalizedTime = normalizeTimeOfDay(timeOfDay);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) return null;

  const [hours, minutes] = normalizedTime.split(":").map((part) => Number(part));
  const { dayStart } = dayRangeInTZ(normalizedDate, timeZone);

  return new Date(
    dayStart.getTime() +
      (Number.isFinite(hours) ? hours : 9) * 60 * 60 * 1000 +
      (Number.isFinite(minutes) ? minutes : 0) * 60 * 1000,
  );
}

function resolveNextRunAt({
  now = new Date(),
  frequency = "daily",
  dayOfWeek = "",
  timeOfDay = DEFAULT_TIME,
  timeZone = DEFAULT_TIMEZONE,
}) {
  const todayIso = getDateIsoForTimeZone(now, timeZone);

  if (frequency === "weekly") {
    const desiredDay = normalizeWeekDay(dayOfWeek) || "monday";
    for (let index = 0; index < 8; index += 1) {
      const candidateDateIso = shiftDateIso(todayIso, index);
      const candidateDay = getDayOfWeekFromDateIso(candidateDateIso);
      if (candidateDay !== desiredDay) continue;

      const candidateRunAt = combineDateIsoAndTime(candidateDateIso, timeOfDay, timeZone);
      if (candidateRunAt && candidateRunAt.getTime() > now.getTime()) {
        return candidateRunAt;
      }
    }

    return combineDateIsoAndTime(shiftDateIso(todayIso, 7), timeOfDay, timeZone);
  }

  const todayRunAt = combineDateIsoAndTime(todayIso, timeOfDay, timeZone);
  if (todayRunAt && todayRunAt.getTime() > now.getTime()) {
    return todayRunAt;
  }

  return combineDateIsoAndTime(shiftDateIso(todayIso, 1), timeOfDay, timeZone);
}

function pushHistory(history = [], entry = {}, maxEntries = HISTORY_LIMIT) {
  const next = [entry, ...(Array.isArray(history) ? history : [])];
  return next.slice(0, Math.max(10, Number(maxEntries) || HISTORY_LIMIT));
}

function pruneHistoryByRetention(history = [], historyDays = 15, now = new Date()) {
  const maxAgeMs = Math.max(1, Number(historyDays) || 15) * 24 * 60 * 60 * 1000;
  const cutoff = now.getTime() - maxAgeMs;
  return (Array.isArray(history) ? history : []).filter((item) => {
    const ranAt = item?.ranAt ? new Date(item.ranAt) : null;
    if (!ranAt || Number.isNaN(ranAt.getTime())) return true;
    return ranAt.getTime() >= cutoff;
  });
}

function normalizeEmailRecipients(recipients = [], maxCount = 1) {
  return Array.from(
    new Set(
      (Array.isArray(recipients) ? recipients : [])
        .map((item) => normalizeText(item).toLowerCase())
        .filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item)),
    ),
  ).slice(0, Math.max(0, Number(maxCount) || 0));
}

function normalizeWhatsAppRecipients(recipients = [], maxCount = 1) {
  return Array.from(
    new Set(
      (Array.isArray(recipients) ? recipients : [])
        .map((item) => normalizeWhatsAppPhoneDigits(item))
        .filter(Boolean),
    ),
  ).slice(0, Math.max(0, Number(maxCount) || 0));
}

function buildAutomationName({ templateKey = "", timeOfDay = DEFAULT_TIME } = {}) {
  const template = getTemplateConfig(templateKey);
  if (!template) return "Automacao";
  return `${template.defaultName} ${timeOfDay}`;
}

function buildHistoryMeta(automation = null) {
  return {
    automationId: automation?._id ? String(automation._id) : "",
    automationName: normalizeText(automation?.name || ""),
    templateKey: normalizeText(automation?.templateKey || ""),
  };
}

function assertAutomationPlanAllowed(planValue) {
  const plan = normalizePlan(planValue);
  if (canUseAutomations(plan)) return plan;

  const error = new Error(
    "Automações da Lumina ficam disponíveis apenas nos planos Pro, Business e Enterprise.",
  );
  error.status = 403;
  error.statusCode = 403;
  error.code = "AUTOMATIONS_PLAN_NOT_ALLOWED";
  throw error;
}

export function listUserAutomationTemplates() {
  return USER_AUTOMATION_TEMPLATES.map((template) => ({ ...template }));
}

export function getUserAutomationPlanSummary(planValue = "start") {
  const plan = normalizePlan(planValue);
  const limits = getAutomationPlanLimits(plan);
  return {
    enabled: canUseAutomations(plan),
    ...limits,
  };
}

export function buildAutomationCandidate(automation = {}) {
  const template = getTemplateConfig(automation?.templateKey);
  return {
    automationId: automation?._id ? String(automation._id) : "",
    name: normalizeText(automation?.name || template?.defaultName || "Automacao"),
    templateKey: normalizeText(automation?.templateKey || ""),
    templateLabel: normalizeText(template?.label || "Template"),
    channel: normalizeText(automation?.channel || "whatsapp") || "whatsapp",
    frequency: normalizeText(automation?.frequency || "daily") || "daily",
    dayOfWeek: normalizeText(automation?.dayOfWeek || ""),
    timeOfDay: normalizeTimeOfDay(automation?.timeOfDay || DEFAULT_TIME),
    status: normalizeText(automation?.status || "active") || "active",
    nextRunAt: automation?.nextRunAt || null,
    lastRunAt: automation?.lastRunAt || null,
    displayLabel: [
      normalizeText(automation?.name || template?.defaultName || "Automacao"),
      template?.label || "Template",
      formatChannelLabel(automation?.channel),
      `${formatFrequencyLabel(automation?.frequency, automation?.dayOfWeek)} as ${
        normalizeTimeOfDay(automation?.timeOfDay || DEFAULT_TIME)
      }`,
      automation?.status === "paused"
        ? "pausada"
        : automation?.status === "error"
          ? "com erro"
          : "ativa",
    ]
      .filter(Boolean)
      .join(" - "),
  };
}

export function buildAutomationSummaryMessage(automation = {}) {
  const candidate = buildAutomationCandidate(automation);
  const lines = [
    `Automacao: ${candidate.name}`,
    `Template: ${candidate.templateLabel}`,
    `Canal: ${formatChannelLabel(candidate.channel)}`,
    `Frequencia: ${formatFrequencyLabel(candidate.frequency, candidate.dayOfWeek)}`,
    `Horario: ${candidate.timeOfDay}`,
    `Status: ${
      candidate.status === "paused"
        ? "pausada"
        : candidate.status === "error"
          ? "com erro"
          : "ativa"
    }`,
  ];

  const nextRunLabel = candidate.nextRunAt
    ? formatDateTime(candidate.nextRunAt, automation?.timeZone || DEFAULT_TIMEZONE)
    : "";
  const lastRunLabel = candidate.lastRunAt
    ? formatDateTime(candidate.lastRunAt, automation?.timeZone || DEFAULT_TIMEZONE)
    : "";

  if (nextRunLabel) lines.push(`Proxima execucao: ${nextRunLabel}`);
  if (lastRunLabel) lines.push(`Ultima execucao: ${lastRunLabel}`);

  return lines.join("\n");
}

function buildConfirmationSummary({ templateKey, channel, frequency, dayOfWeek, timeOfDay }) {
  const template = getTemplateConfig(templateKey);
  const lines = [
    "Confirma a criacao desta automacao?",
    "",
    `Template: ${template?.label || "Template"}`,
    `Canal: ${formatChannelLabel(channel)}`,
    `Frequencia: ${formatFrequencyLabel(frequency, dayOfWeek)}`,
    `Horario: ${normalizeTimeOfDay(timeOfDay || DEFAULT_TIME)}`,
  ];
  return lines.join("\n");
}

async function loadWorkspacePlan(workspaceId) {
  if (!workspaceId) return "start";
  const workspace = await Workspace.findById(workspaceId).select("plan").lean();
  return normalizePlan(workspace?.plan);
}

async function resolveAutomationUser(userId) {
  if (!userId) return null;
  return User.findById(userId)
    .select("_id workspaceId name email whatsappPhone whatsappPhoneDigits")
    .lean();
}

async function resolveAutomationRecipients({
  automation,
  user,
  limits,
}) {
  const destinationMode = normalizeText(automation?.destinationMode || "default") || "default";
  const maxRecipients = Number(limits?.recipientsPerChannel || 1) || 1;
  const emailRecipients =
    destinationMode === "override"
      ? normalizeEmailRecipients(automation?.emailRecipients || [], maxRecipients)
      : normalizeEmailRecipients([user?.email || ""], maxRecipients);
  const whatsappRecipients =
    destinationMode === "override"
      ? normalizeWhatsAppRecipients(automation?.whatsappRecipients || [], maxRecipients)
      : normalizeWhatsAppRecipients(
          [user?.whatsappPhoneDigits || user?.whatsappPhone || ""],
          maxRecipients,
        );

  return {
    emailRecipients,
    whatsappRecipients,
  };
}

function ensureRecipientsForChannel({
  channel = "whatsapp",
  emailRecipients = [],
  whatsappRecipients = [],
}) {
  if (channel === "email" && !emailRecipients.length) {
    const error = new Error("Nao encontrei um e-mail valido para essa automacao.");
    error.status = 409;
    error.statusCode = 409;
    error.code = "AUTOMATION_EMAIL_REQUIRED";
    throw error;
  }

  if (channel === "whatsapp" && !whatsappRecipients.length) {
    const error = new Error("Nao encontrei um WhatsApp valido para essa automacao.");
    error.status = 409;
    error.statusCode = 409;
    error.code = "AUTOMATION_WHATSAPP_REQUIRED";
    throw error;
  }

  if (channel === "both" && (!emailRecipients.length || !whatsappRecipients.length)) {
    const error = new Error(
      "Para usar ambos os canais, preciso de um e-mail e um WhatsApp validos no seu cadastro.",
    );
    error.status = 409;
    error.statusCode = 409;
    error.code = "AUTOMATION_BOTH_CHANNELS_REQUIRED";
    throw error;
  }
}

export async function countActiveUserAutomations({
  userId,
}) {
  if (!userId) return 0;
  return UserAutomation.countDocuments({
    userId,
    status: "active",
  });
}

export async function listUserAutomations({
  userId,
  workspaceId = null,
  statuses = [],
  limit = 30,
}) {
  if (!userId) return [];
  const query = { userId };
  if (workspaceId) query.workspaceId = workspaceId;

  if (Array.isArray(statuses) && statuses.length) {
    query.status = { $in: statuses };
  }

  return UserAutomation.find(query)
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(Math.max(1, Math.min(100, Number(limit) || 30)))
    .lean();
}

export async function getUserAutomationById({
  automationId,
  userId,
  workspaceId = null,
}) {
  if (!automationId || !userId) return null;
  const query = {
    _id: automationId,
    userId,
  };
  if (workspaceId) query.workspaceId = workspaceId;
  return UserAutomation.findOne(query).lean();
}

export async function createUserAutomation({
  user,
  templateKey,
  channel,
  frequency,
  dayOfWeek = "",
  timeOfDay = DEFAULT_TIME,
  destinationMode = "default",
  emailRecipients = [],
  whatsappRecipients = [],
  status = "active",
  now = new Date(),
}) {
  if (!user?._id || !user?.workspaceId) {
    const error = new Error("Usuario invalido para criar automacao.");
    error.status = 400;
    error.statusCode = 400;
    error.code = "AUTOMATION_USER_REQUIRED";
    throw error;
  }

  const plan = assertAutomationPlanAllowed(user?.workspacePlan || "start");
  const limits = getAutomationPlanLimits(plan);
  const template = getTemplateConfig(templateKey);

  if (!template) {
    const error = new Error("Template de automacao nao reconhecido.");
    error.status = 400;
    error.statusCode = 400;
    error.code = "AUTOMATION_TEMPLATE_INVALID";
    throw error;
  }

  const normalizedChannel = normalizeChannel(channel);
  const normalizedFrequency = normalizeFrequency(frequency);
  const normalizedDayOfWeek =
    normalizedFrequency === "weekly" ? normalizeWeekDay(dayOfWeek) || "monday" : "";
  const normalizedTimeOfDay = normalizeTimeOfDay(timeOfDay);
  const normalizedStatus = normalizeComparableText(status) === "paused" ? "paused" : "active";

  const activeCount = await countActiveUserAutomations({ userId: user._id });
  if (normalizedStatus === "active" && activeCount >= Number(limits.activeLimit || 0)) {
    const error = new Error(
      `Seu plano ${plan.toUpperCase()} permite ate ${limits.activeLimit} automacoes ativas.`,
    );
    error.status = 409;
    error.statusCode = 409;
    error.code = "AUTOMATION_LIMIT_REACHED";
    throw error;
  }

  const normalizedEmailRecipients = normalizeEmailRecipients(
    emailRecipients,
    limits.recipientsPerChannel,
  );
  const normalizedWhatsAppRecipients = normalizeWhatsAppRecipients(
    whatsappRecipients,
    limits.recipientsPerChannel,
  );
  const effectiveTimeZone = await getWorkspaceAgendaTimeZone(user.workspaceId);
  const recipientState = await resolveAutomationRecipients({
    automation: {
      destinationMode,
      emailRecipients: normalizedEmailRecipients,
      whatsappRecipients: normalizedWhatsAppRecipients,
    },
    user,
    limits,
  });
  ensureRecipientsForChannel({
    channel: normalizedChannel,
    ...recipientState,
  });

  return UserAutomation.create({
    workspaceId: user.workspaceId,
    userId: user._id,
    name: buildAutomationName({
      templateKey: template.key,
      timeOfDay: normalizedTimeOfDay,
    }),
    templateKey: template.key,
    channel: normalizedChannel,
    frequency: normalizedFrequency,
    dayOfWeek: normalizedDayOfWeek,
    timeOfDay: normalizedTimeOfDay,
    timeZone: effectiveTimeZone || DEFAULT_TIMEZONE,
    destinationMode: normalizeComparableText(destinationMode) === "override" ? "override" : "default",
    emailRecipients: normalizedEmailRecipients,
    whatsappRecipients: normalizedWhatsAppRecipients,
    status: normalizedStatus,
    nextRunAt:
      normalizedStatus === "active"
        ? resolveNextRunAt({
            now,
            frequency: normalizedFrequency,
            dayOfWeek: normalizedDayOfWeek,
            timeOfDay: normalizedTimeOfDay,
            timeZone: effectiveTimeZone || DEFAULT_TIMEZONE,
          })
        : null,
  });
}

export async function pauseUserAutomation({
  automationId,
  user,
}) {
  const automation = await getUserAutomationById({
    automationId,
    userId: user?._id,
    workspaceId: user?.workspaceId,
  });

  if (!automation?._id) {
    const error = new Error("Automacao nao encontrada.");
    error.status = 404;
    error.statusCode = 404;
    error.code = "AUTOMATION_NOT_FOUND";
    throw error;
  }

  await UserAutomation.updateOne(
    { _id: automation._id },
    {
      $set: {
        status: "paused",
        nextRunAt: null,
        lastError: { message: null, code: null, details: null, at: null },
      },
    },
  );

  return UserAutomation.findById(automation._id).lean();
}

export async function resumeUserAutomation({
  automationId,
  user,
  now = new Date(),
}) {
  const automation = await getUserAutomationById({
    automationId,
    userId: user?._id,
    workspaceId: user?.workspaceId,
  });

  if (!automation?._id) {
    const error = new Error("Automacao nao encontrada.");
    error.status = 404;
    error.statusCode = 404;
    error.code = "AUTOMATION_NOT_FOUND";
    throw error;
  }

  const plan = assertAutomationPlanAllowed(user?.workspacePlan || "start");
  const limits = getAutomationPlanLimits(plan);
  const activeCount = await countActiveUserAutomations({ userId: user._id });
  if (automation.status !== "active" && activeCount >= Number(limits.activeLimit || 0)) {
    const error = new Error(
      `Seu plano ${plan.toUpperCase()} permite ate ${limits.activeLimit} automacoes ativas.`,
    );
    error.status = 409;
    error.statusCode = 409;
    error.code = "AUTOMATION_LIMIT_REACHED";
    throw error;
  }

  await UserAutomation.updateOne(
    { _id: automation._id },
    {
      $set: {
        status: "active",
        nextRunAt: resolveNextRunAt({
          now,
          frequency: automation.frequency,
          dayOfWeek: automation.dayOfWeek,
          timeOfDay: automation.timeOfDay,
          timeZone: automation.timeZone || DEFAULT_TIMEZONE,
        }),
      },
    },
  );

  return UserAutomation.findById(automation._id).lean();
}

export async function deleteUserAutomation({
  automationId,
  user,
}) {
  const automation = await getUserAutomationById({
    automationId,
    userId: user?._id,
    workspaceId: user?.workspaceId,
  });

  if (!automation?._id) {
    const error = new Error("Automacao nao encontrada.");
    error.status = 404;
    error.statusCode = 404;
    error.code = "AUTOMATION_NOT_FOUND";
    throw error;
  }

  await UserAutomation.deleteOne({ _id: automation._id });
  return automation;
}

export async function duplicateUserAutomation({
  automationId,
  user,
  now = new Date(),
}) {
  const automation = await getUserAutomationById({
    automationId,
    userId: user?._id,
    workspaceId: user?.workspaceId,
  });

  if (!automation?._id) {
    const error = new Error("Automacao nao encontrada.");
    error.status = 404;
    error.statusCode = 404;
    error.code = "AUTOMATION_NOT_FOUND";
    throw error;
  }

  const created = await createUserAutomation({
    user,
    templateKey: automation.templateKey,
    channel: automation.channel,
    frequency: automation.frequency,
    dayOfWeek: automation.dayOfWeek,
    timeOfDay: automation.timeOfDay,
    destinationMode: automation.destinationMode,
    emailRecipients: automation.emailRecipients,
    whatsappRecipients: automation.whatsappRecipients,
    status: "active",
    now,
  });

  await UserAutomation.updateOne(
    { _id: created._id },
    {
      $set: {
        name: `${normalizeText(automation.name || "Automacao")} (copia)`,
      },
    },
  );

  return UserAutomation.findById(created._id).lean();
}

async function sendAutomationEmail({
  to = [],
  subject = "",
  text = "",
  html = "",
  idempotencyKey = "",
}) {
  const apiKey = normalizeText(process.env.RESEND_API_KEY || "");
  const from = normalizeText(process.env.RESEND_FROM || "");
  const recipients = normalizeEmailRecipients(to, 10);

  if (!apiKey) {
    const error = new Error("RESEND_API_KEY ausente.");
    error.code = "RESEND_API_KEY_MISSING";
    throw error;
  }

  if (!from) {
    const error = new Error("RESEND_FROM ausente.");
    error.code = "RESEND_FROM_MISSING";
    throw error;
  }

  if (!recipients.length) {
    const error = new Error("Nenhum destinatario de e-mail valido.");
    error.code = "AUTOMATION_EMAIL_RECIPIENT_MISSING";
    throw error;
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject,
      text,
      html,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      data?.message || data?.error || `Resend error (${response.status})`,
    );
    error.statusCode = response.status;
    error.code = "AUTOMATION_EMAIL_SEND_FAILED";
    error.details = data;
    throw error;
  }

  return {
    ok: true,
    status: "sent",
    providerMessageId: data?.id || null,
    data,
  };
}

async function buildWeeklySummaryContent({ user, timeZone, now }) {
  const end = now instanceof Date ? new Date(now) : new Date(now);
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  const snapshot = await buildGeneralReportsSnapshot({
    tenantId: user.workspaceId,
    userId: user._id,
    start,
    end,
    fromYMD: getDateIsoForTimeZone(start, timeZone),
    toYMD: getDateIsoForTimeZone(end, timeZone),
  });
  const topClient = Array.isArray(snapshot?.topClients) ? snapshot.topClients[0] : null;
  const topItem = Array.isArray(snapshot?.topItems) ? snapshot.topItems[0] : null;

  const lines = [
    "Resumo semanal da sua carteira:",
    "",
    `- Faturamento confirmado: ${formatMoney(snapshot?.summary?.paidRevenueCents || 0)}`,
    `- Propostas pagas: ${Number(snapshot?.summary?.paidCount || 0)}`,
    `- Propostas criadas: ${Number(snapshot?.summary?.createdCount || 0)}`,
    `- Ticket medio: ${formatMoney(snapshot?.summary?.avgTicketCents || 0)}`,
    `- Conversao: ${Number(snapshot?.summary?.conversionPct || 0).toFixed(1)}%`,
  ];

  if (topClient?.customerName) {
    lines.push(
      `- Cliente com maior receita: ${topClient.customerName} (${formatMoney(
        topClient.paidRevenueCents || 0,
      )})`,
    );
  }

  if (topItem?.description) {
    lines.push(
      `- Produto com maior tracao: ${topItem.description} (${formatMoney(
        topItem.paidRevenueCents || 0,
      )})`,
    );
  }

  return {
    subject: "Seu resumo semanal da Lumina",
    text: lines.join("\n"),
  };
}

async function buildBillingPendingContent({ user, timeZone, now }) {
  const pendingOffers = await listPendingOffers({
    workspaceId: user.workspaceId,
    ownerUserId: user._id,
    limit: 8,
    timeZone,
  });
  const overdueOffers = await listWebAgentAutomationOfferCandidates({
    user,
    automationType: "overdue",
    limit: 8,
    now,
  });
  const staleOffers = await listWebAgentAutomationOfferCandidates({
    user,
    automationType: "stale_followup",
    limit: 8,
    now,
  });

  const lines = [
    "Pendencias de cobranca da sua carteira:",
    "",
    `- Pendentes agora: ${pendingOffers.length}`,
    `- Atrasadas: ${overdueOffers.length}`,
    `- Sem resposta recente: ${staleOffers.length}`,
  ];

  if (pendingOffers[0]?.displayLabel) {
    lines.push("");
    lines.push(`Primeira pendencia: ${pendingOffers[0].displayLabel}`);
  }

  return {
    subject: "Pendencias de cobranca da Lumina",
    text: lines.join("\n"),
  };
}

async function buildWaitingConfirmationContent({ user, timeZone }) {
  const candidates = await listOffersWaitingConfirmation({
    workspaceId: user.workspaceId,
    ownerUserId: user._id,
    limit: 8,
    timeZone,
  });

  const lines = [`Propostas aguardando confirmacao: ${candidates.length}`];

  if (candidates.length) {
    lines.push("");
    candidates.slice(0, 5).forEach((candidate, index) => {
      lines.push(`${index + 1}. ${candidate.displayLabel}`);
    });
  } else {
    lines.push("");
    lines.push("Nenhum comprovante aguardando aprovacao agora.");
  }

  return {
    subject: "Propostas aguardando confirmacao",
    text: lines.join("\n"),
  };
}

async function buildDailyAgendaContent({ user, timeZone, now }) {
  const dateISO = getDateIsoForTimeZone(now, timeZone);
  const agenda = await loadDailyAgendaForWorkspace({
    workspaceId: user.workspaceId,
    dateISO,
    timeZone,
  });

  return {
    subject: "Sua agenda do dia",
    text: buildAgendaSummaryMessage({
      dayLabel: "hoje",
      dateISO: agenda?.dateISO || dateISO,
      timeZone,
      summary: agenda?.summary || {},
      items: agenda?.items || [],
    }),
  };
}

async function buildDailyPrioritiesContent({ user, timeZone, now }) {
  const dateISO = getDateIsoForTimeZone(now, timeZone);
  const agenda = await loadDailyAgendaForWorkspace({
    workspaceId: user.workspaceId,
    dateISO,
    timeZone,
  });
  const pendingOffers = await listPendingOffers({
    workspaceId: user.workspaceId,
    ownerUserId: user._id,
    limit: 10,
    timeZone,
  });
  const waitingConfirmation = await listOffersWaitingConfirmation({
    workspaceId: user.workspaceId,
    ownerUserId: user._id,
    limit: 10,
    timeZone,
  });
  const overdueOffers = await listWebAgentAutomationOfferCandidates({
    user,
    automationType: "overdue",
    limit: 10,
    now,
  });

  const lines = [
    "Prioridades do dia:",
    "",
    `- Compromissos de hoje: ${Number(agenda?.summary?.total || 0)}`,
    `- Propostas pendentes: ${pendingOffers.length}`,
    `- Atrasadas: ${overdueOffers.length}`,
    `- Aguardando confirmacao: ${waitingConfirmation.length}`,
  ];

  const summaryMessage = await buildWebAgentAutomationSummaryMessage({
    user,
    automationType: "billing_priorities",
    now,
  });

  if (summaryMessage) {
    lines.push("");
    lines.push(summaryMessage.replace(/\n{2,}/g, "\n"));
  }

  return {
    subject: "Suas prioridades do dia",
    text: lines.join("\n"),
  };
}

async function buildAutomationContent({
  automation,
  user,
  now = new Date(),
}) {
  const timeZone = normalizeText(automation?.timeZone || "") || DEFAULT_TIMEZONE;

  if (automation?.templateKey === "daily_agenda") {
    return buildDailyAgendaContent({ user, timeZone, now });
  }

  if (automation?.templateKey === "weekly_summary") {
    return buildWeeklySummaryContent({ user, timeZone, now });
  }

  if (automation?.templateKey === "billing_pending") {
    return buildBillingPendingContent({ user, timeZone, now });
  }

  if (automation?.templateKey === "waiting_confirmation") {
    return buildWaitingConfirmationContent({ user, timeZone });
  }

  if (automation?.templateKey === "daily_priorities") {
    return buildDailyPrioritiesContent({ user, timeZone, now });
  }

  const weeklyAgenda = await loadWeeklyAgendaForWorkspace({
    workspaceId: user.workspaceId,
    startDateISO: getDateIsoForTimeZone(now, timeZone),
    days: 7,
    timeZone,
  });

  return {
    subject: "Atualizacao automatica da Lumina",
    text: buildWeeklyAgendaMessage({
      startDateISO: weeklyAgenda?.startDateISO || "",
      endDateISO: weeklyAgenda?.endDateISO || "",
      days: weeklyAgenda?.days || [],
      timeZone,
    }),
  };
}

async function sendAutomationThroughChannels({
  automation,
  user,
  content,
  limits,
  executionKey,
}) {
  const notificationContext = await resolveWorkspaceNotificationContext({
    workspaceId: automation.workspaceId,
    ownerUserId: user?._id || null,
    workspacePlan: await loadWorkspacePlan(automation.workspaceId),
  });
  const recipients = await resolveAutomationRecipients({
    automation,
    user,
    limits,
  });
  ensureRecipientsForChannel({
    channel: automation.channel,
    ...recipients,
  });

  const results = [];
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;">${nl2br(
    content.text || "",
  )}</div>`;

  if (automation.channel === "whatsapp" || automation.channel === "both") {
    const whatsappEnvAvailable =
      notificationContext?.capabilities?.environment?.whatsapp?.available === true &&
      notificationContext?.settings?.whatsapp?.masterEnabled === true;

    if (!whatsappEnvAvailable) {
      const error = new Error(
        notificationContext?.capabilities?.environment?.whatsapp?.reason ||
          "WhatsApp indisponivel para automacoes.",
      );
      error.code = "AUTOMATION_WHATSAPP_UNAVAILABLE";
      throw error;
    }

    for (const to of recipients.whatsappRecipients) {
      // eslint-disable-next-line no-await-in-loop
      const result = await queueOrSendWhatsApp({
        workspaceId: automation.workspaceId,
        to,
        message: content.text || "",
        dedupeKey: `${executionKey}:wa:${to}`,
        sourceType: "user_automation",
        sourceId: automation?._id || null,
        meta: {
          automationId: automation?._id || null,
          automationName: automation?.name || "",
          templateKey: automation?.templateKey || "",
        },
      });
      results.push({
        channel: "whatsapp",
        to,
        status: result?.status || "failed",
        providerMessageId: result?.providerMessageId || null,
      });
    }
  }

  if (automation.channel === "email" || automation.channel === "both") {
    const emailResult = await sendAutomationEmail({
      to: recipients.emailRecipients,
      subject: content.subject || "Atualizacao da Lumina",
      text: content.text || "",
      html,
      idempotencyKey: `${executionKey}:email`,
    });
    results.push({
      channel: "email",
      to: recipients.emailRecipients.join(","),
      status: emailResult?.status || "sent",
      providerMessageId: emailResult?.providerMessageId || null,
    });
  }

  return results;
}

async function acquireAutomationRunLock(automationId) {
  const now = new Date();
  const staleLockDate = new Date(now.getTime() - RUNNER_LOCK_TTL_MS);
  const lockId = crypto.randomUUID();

  const automation = await UserAutomation.findOneAndUpdate(
    {
      _id: automationId,
      $or: [
        { "runner.lockedAt": null },
        { "runner.lockedAt": { $lt: staleLockDate } },
      ],
    },
    {
      $set: {
        "runner.lockedAt": now,
        "runner.lockId": lockId,
      },
    },
    { new: true },
  ).lean();

  if (!automation?._id) return null;
  return { automation, lockId };
}

async function releaseAutomationRunLock(automationId, lockId) {
  if (!automationId || !lockId) return;
  await UserAutomation.updateOne(
    { _id: automationId, "runner.lockId": lockId },
    {
      $set: {
        "runner.lockedAt": null,
        "runner.lockId": null,
      },
    },
  );
}

async function appendAutomationHistory(automationId, entry, patch = {}) {
  const automation = await UserAutomation.findById(automationId).lean();
  if (!automation?._id) return null;

  const plan = await loadWorkspacePlan(automation.workspaceId);
  const limits = getAutomationPlanLimits(plan);
  const prunedHistory = pruneHistoryByRetention(
    automation.history,
    limits.historyDays,
    entry?.ranAt || new Date(),
  );
  const history = pushHistory(prunedHistory, entry, HISTORY_LIMIT);

  await UserAutomation.updateOne(
    { _id: automationId },
    {
      $set: {
        history,
        ...patch,
      },
    },
  );

  return UserAutomation.findById(automationId).lean();
}

export async function executeUserAutomation({
  automationId,
  source = "manual",
  now = new Date(),
  bypassSchedule = false,
}) {
  const locked = await acquireAutomationRunLock(automationId);
  if (!locked?.automation?._id) {
    const error = new Error("Nao foi possivel bloquear a automacao para execucao.");
    error.code = "AUTOMATION_LOCK_UNAVAILABLE";
    throw error;
  }

  const lockId = locked.lockId;
  const automation = locked.automation;

  try {
    if (!["active", "paused", "error"].includes(String(automation?.status || ""))) {
      return {
        automation,
        execution: {
          status: "skipped",
          message: "Automacao em status nao executavel.",
        },
      };
    }

    if (
      bypassSchedule !== true &&
      source === "automatic" &&
      automation?.nextRunAt &&
      new Date(automation.nextRunAt).getTime() > now.getTime()
    ) {
      return {
        automation,
        execution: {
          status: "skipped",
          message: "Automacao ainda nao esta agendada para agora.",
        },
      };
    }

    const user = await resolveAutomationUser(automation.userId);
    if (!user?._id) {
      const error = new Error("Usuario da automacao nao encontrado.");
      error.code = "AUTOMATION_USER_NOT_FOUND";
      throw error;
    }

    const workspacePlan = await loadWorkspacePlan(automation.workspaceId);
    assertAutomationPlanAllowed(workspacePlan);
    const limits = getAutomationPlanLimits(workspacePlan);
    const content = await buildAutomationContent({
      automation,
      user,
      now,
    });
    const executionKey = `automation:${String(automation._id)}:${now.toISOString()}:${source}`;
    const channelResults = await sendAutomationThroughChannels({
      automation,
      user,
      content,
      limits,
      executionKey,
    });
    const successfulChannels = channelResults.filter((item) =>
      ["sent", "queued"].includes(String(item?.status || "")),
    );

    const nextRunAt =
      source === "automatic"
        ? resolveNextRunAt({
            now,
            frequency: automation.frequency,
            dayOfWeek: automation.dayOfWeek,
            timeOfDay: automation.timeOfDay,
            timeZone: automation.timeZone || DEFAULT_TIMEZONE,
          })
        : automation.nextRunAt || null;

    const updated = await appendAutomationHistory(
      automation._id,
      {
        status: successfulChannels.length ? "sent" : "failed",
        source: source === "automatic" ? "automatic" : "manual",
        ranAt: now,
        message: successfulChannels.length
          ? `Automacao enviada por ${successfulChannels
              .map((item) => item.channel)
              .join(" e ")}.`
          : "Falha ao enviar a automacao.",
        channels: channelResults.map((item) => item.channel),
        error: {
          message: null,
          code: null,
          details: null,
        },
        meta: {
          ...buildHistoryMeta(automation),
          subject: content.subject || "",
          results: channelResults,
        },
      },
      {
        runCount: Number(automation.runCount || 0) + 1,
        successCount: Number(automation.successCount || 0) + 1,
        lastRunAt: now,
        lastSuccessfulRunAt: now,
        lastError: {
          message: null,
          code: null,
          details: null,
          at: null,
        },
        status: automation.status === "paused" && source === "manual" ? "paused" : "active",
        nextRunAt,
      },
    );

    return {
      automation: updated,
      execution: {
        status: successfulChannels.length ? "sent" : "failed",
        message: successfulChannels.length
          ? "Automacao executada com sucesso."
          : "Falha ao enviar a automacao.",
        results: channelResults,
      },
    };
  } catch (error) {
    const failedAt = new Date();
    const automationAfterFailure = await appendAutomationHistory(
      automation._id,
      {
        status: "failed",
        source: source === "automatic" ? "automatic" : "manual",
        ranAt: failedAt,
        message: "Falha ao executar automacao.",
        channels: [],
        error: {
          message: String(error?.message || "Erro ao executar automacao"),
          code: String(error?.code || "AUTOMATION_EXECUTION_FAILED"),
          details: error?.details || null,
        },
        meta: buildHistoryMeta(automation),
      },
      {
        runCount: Number(automation.runCount || 0) + 1,
        failureCount: Number(automation.failureCount || 0) + 1,
        lastRunAt: failedAt,
        lastFailedRunAt: failedAt,
        status: "error",
        lastError: {
          message: String(error?.message || "Erro ao executar automacao"),
          code: String(error?.code || "AUTOMATION_EXECUTION_FAILED"),
          details: error?.details || null,
          at: failedAt,
        },
      },
    );

    const wrapped = new Error(String(error?.message || "Erro ao executar automacao"));
    wrapped.status = Number(error?.statusCode || error?.status) || 500;
    wrapped.statusCode = wrapped.status;
    wrapped.code = String(error?.code || "AUTOMATION_EXECUTION_FAILED");
    wrapped.details = { automation: automationAfterFailure };
    throw wrapped;
  } finally {
    await releaseAutomationRunLock(automationId, lockId);
  }
}

export async function runUserAutomationNow({
  automationId,
  user,
  now = new Date(),
}) {
  const automation = await getUserAutomationById({
    automationId,
    userId: user?._id,
    workspaceId: user?.workspaceId,
  });

  if (!automation?._id) {
    const error = new Error("Automacao nao encontrada.");
    error.status = 404;
    error.statusCode = 404;
    error.code = "AUTOMATION_NOT_FOUND";
    throw error;
  }

  return executeUserAutomation({
    automationId: automation._id,
    source: "manual",
    now,
    bypassSchedule: true,
  });
}

export async function processDueUserAutomations({
  now = new Date(),
} = {}) {
  const allowedWorkspaceRows = await Workspace.find({
    plan: { $in: ["pro", "business", "enterprise"] },
  })
    .select("_id plan")
    .lean();

  const allowedWorkspaceIds = allowedWorkspaceRows
    .filter((row) => canUseAutomations(row?.plan))
    .map((row) => row._id);

  if (!allowedWorkspaceIds.length) {
    return {
      ok: true,
      scanned: 0,
      items: [],
    };
  }

  const dueRows = await UserAutomation.find({
    workspaceId: { $in: allowedWorkspaceIds },
    status: "active",
    nextRunAt: { $ne: null, $lte: now },
  })
    .select("_id")
    .sort({ nextRunAt: 1 })
    .limit(50)
    .lean();

  const items = [];
  for (const row of dueRows) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await executeUserAutomation({
        automationId: row._id,
        source: "automatic",
        now,
        bypassSchedule: false,
      });

      items.push({
        automationId: String(row._id),
        status: result?.execution?.status || "sent",
      });
    } catch (error) {
      items.push({
        automationId: String(row._id),
        status: "failed",
        error: String(error?.message || "Erro ao executar automacao"),
      });
    }
  }

  return {
    ok: true,
    scanned: dueRows.length,
    items,
  };
}

export function buildAutomationDraftTemplateQuestion() {
  const lines = [
    "Qual automacao voce quer criar?",
    "",
  ];

  USER_AUTOMATION_TEMPLATES.forEach((template, index) => {
    lines.push(`${index + 1}. ${template.label}`);
  });

  lines.push("");
  lines.push("Escolha uma opcao abaixo ou responda em texto.");
  return lines.join("\n");
}

export function buildAutomationDraftChannelQuestion() {
  return [
    "Por qual canal devo enviar essa automacao?",
    "",
    "1. WhatsApp",
    "2. E-mail",
    "3. Ambos",
    "",
    "Escolha uma opcao abaixo ou responda em texto.",
  ].join("\n");
}

export function buildAutomationDraftFrequencyQuestion() {
  return [
    "Com qual frequencia devo enviar?",
    "",
    "1. Diaria",
    "2. Semanal",
    "",
    "Escolha uma opcao abaixo ou responda em texto.",
  ].join("\n");
}

export function buildAutomationDraftWeekDayQuestion() {
  return [
    "Em qual dia da semana devo enviar?",
    "",
    "1. Segunda-feira",
    "2. Terca-feira",
    "3. Quarta-feira",
    "4. Quinta-feira",
    "5. Sexta-feira",
    "6. Sabado",
    "7. Domingo",
    "",
    "Escolha uma opcao abaixo ou responda em texto.",
  ].join("\n");
}

export function buildAutomationDraftTimeQuestion() {
  return "Qual horario devo usar? Exemplo: 09:00";
}

export function buildAutomationListMessage(automations = [], { emptyText = "" } = {}) {
  const safeItems = Array.isArray(automations) ? automations : [];
  if (!safeItems.length) {
    return normalizeText(emptyText || "Voce ainda nao tem automacoes cadastradas.");
  }

  const lines = [
    `Encontrei ${safeItems.length} automacoes para voce:`,
    "",
  ];

  safeItems.forEach((automation, index) => {
    lines.push(`${index + 1}. ${buildAutomationCandidate(automation).displayLabel}`);
  });

  lines.push("");
  lines.push("Escolha uma opcao abaixo ou responda em texto.");
  return lines.join("\n");
}

export function resolveAutomationTemplateSelection(value = "") {
  const normalized = normalizeComparableText(value);
  const ordinal = Number.parseInt(normalized, 10);
  if (Number.isFinite(ordinal) && ordinal >= 1 && ordinal <= USER_AUTOMATION_TEMPLATES.length) {
    return USER_AUTOMATION_TEMPLATES[ordinal - 1]?.key || "";
  }

  const template = USER_AUTOMATION_TEMPLATES.find((item) => {
    const label = normalizeComparableText(item.label);
    return normalized === label || normalized.includes(label);
  });

  return template?.key || "";
}

export function resolveAutomationActionSelection(value = "", automation = null) {
  const normalized = normalizeComparableText(value);
  const candidates = [
    automation?.status === "paused"
      ? { key: "resume", matches: ["1", "retomar", "ativar", "continuar"] }
      : { key: "pause", matches: ["1", "pausar", "pausa"] },
    { key: "run_now", matches: ["2", "executar", "executar agora", "rodar", "run now"] },
    { key: "duplicate", matches: ["3", "duplicar", "duplicar automacao", "copiar"] },
    { key: "delete", matches: ["4", "excluir", "apagar", "remover"] },
    { key: "cancel", matches: ["cancelar", "cancela", "0"] },
  ].filter(Boolean);

  const found = candidates.find((item) => item.matches.includes(normalized));
  return found?.key || "";
}

export function buildAutomationActionQuestion(automation = {}) {
  const isPaused = String(automation?.status || "").trim() === "paused";
  return [
    `${buildAutomationSummaryMessage(automation)}`,
    "",
    `1. ${isPaused ? "Retomar" : "Pausar"}`,
    "2. Executar agora",
    "3. Duplicar",
    "4. Excluir",
    "",
    "Escolha uma opcao abaixo ou responda em texto.",
  ].join("\n");
}

export function buildAutomationActionConfirmation({
  automation = null,
  action = "",
} = {}) {
  const actionLabelMap = {
    pause: "pausar",
    resume: "retomar",
    run_now: "executar agora",
    duplicate: "duplicar",
    delete: "excluir",
    create: "criar",
  };

  const actionLabel = actionLabelMap[String(action || "").trim()] || "confirmar";
  return [
    `Confirma ${actionLabel} esta automacao?`,
    "",
    buildAutomationSummaryMessage(automation),
    "",
    "Escolha CONFIRMAR ou CANCELAR abaixo, ou responda em texto.",
  ].join("\n");
}

export function buildAutomationCreateConfirmation({
  templateKey = "",
  channel = "whatsapp",
  frequency = "daily",
  dayOfWeek = "",
  timeOfDay = DEFAULT_TIME,
} = {}) {
  return buildConfirmationSummary({
    templateKey,
    channel,
    frequency,
    dayOfWeek,
    timeOfDay,
  });
}

export function buildAutomationResultMessage({
  action = "",
  automation = null,
  execution = null,
} = {}) {
  if (action === "create") {
    return `Automacao criada com sucesso.\n\n${buildAutomationSummaryMessage(automation)}`;
  }

  if (action === "pause") {
    return `Automacao pausada com sucesso.\n\n${buildAutomationSummaryMessage(automation)}`;
  }

  if (action === "resume") {
    return `Automacao retomada com sucesso.\n\n${buildAutomationSummaryMessage(automation)}`;
  }

  if (action === "duplicate") {
    return `Criei uma copia da automacao.\n\n${buildAutomationSummaryMessage(automation)}`;
  }

  if (action === "delete") {
    return `Automacao excluida com sucesso.\n\n${buildAutomationSummaryMessage(automation)}`;
  }

  if (action === "run_now") {
    return [
      execution?.status === "sent"
        ? "Automacao executada agora com sucesso."
        : "A automacao foi executada agora.",
      "",
      buildAutomationSummaryMessage(automation),
    ].join("\n");
  }

  return buildAutomationSummaryMessage(automation);
}

export {
  USER_AUTOMATION_TEMPLATES,
  parseDailyTimeInput,
};
