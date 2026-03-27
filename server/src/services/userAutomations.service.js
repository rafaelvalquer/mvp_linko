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
  listExpiringOffers,
  listOffersWaitingConfirmation,
  listPendingOffers,
  listRecentOffers,
} from "./whatsapp-ai/whatsappOfferOperations.service.js";
import {
  canUseAutomations,
  getAutomationPlanLimits,
  normalizePlan,
} from "../utils/planFeatures.js";
import { normalizeWhatsAppPhoneDigits } from "../utils/phone.js";
import { renderAutomationEmailHtml } from "./userAutomationEmailLayout.service.js";

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
    groupKey: "agenda",
    groupLabel: "Agenda",
    groupDescription: "Rotinas para acompanhar compromissos e organizar seu dia.",
  },
  {
    key: "next_day_agenda",
    label: "Minha agenda de amanha",
    description: "Envia no fim do dia a agenda do dia seguinte.",
    defaultName: "Minha agenda de amanha",
    groupKey: "agenda",
    groupLabel: "Agenda",
    groupDescription: "Rotinas para acompanhar compromissos e organizar seu dia.",
  },
  {
    key: "weekly_summary",
    label: "Resumo semanal",
    description: "Envia um resumo comercial da sua semana.",
    defaultName: "Resumo semanal",
    groupKey: "resumos",
    groupLabel: "Resumos",
    groupDescription: "Leituras consolidadas para revisar a operacao em poucos minutos.",
  },
  {
    key: "billing_pending",
    label: "Pendencias de cobranca",
    description: "Envia as propostas pendentes, atrasadas e follow-ups do dia.",
    defaultName: "Pendencias de cobranca",
    groupKey: "cobranca",
    groupLabel: "Cobranca",
    groupDescription: "Rotinas para acompanhar pagamentos, atrasos e follow-ups.",
  },
  {
    key: "billing_due_tomorrow",
    label: "Cobrancas de amanha",
    description: "Mostra as cobrancas que vencem amanha para acao antecipada.",
    defaultName: "Cobrancas de amanha",
    groupKey: "cobranca",
    groupLabel: "Cobranca",
    groupDescription: "Rotinas para acompanhar pagamentos, atrasos e follow-ups.",
  },
  {
    key: "waiting_confirmation",
    label: "Aguardando confirmacao",
    description: "Resume propostas com comprovante aguardando aprovacao.",
    defaultName: "Aguardando confirmacao",
    groupKey: "cobranca",
    groupLabel: "Cobranca",
    groupDescription: "Rotinas para acompanhar pagamentos, atrasos e follow-ups.",
  },
  {
    key: "daily_priorities",
    label: "Prioridades do dia",
    description: "Combina agenda, cobranca e pendencias abertas em um resumo curto.",
    defaultName: "Prioridades do dia",
    groupKey: "resumos",
    groupLabel: "Resumos",
    groupDescription: "Leituras consolidadas para revisar a operacao em poucos minutos.",
  },
  {
    key: "offer_expiring",
    label: "Propostas expirando",
    description: "Resume propostas que vencem hoje ou nos proximos 7 dias.",
    defaultName: "Propostas expirando",
    groupKey: "propostas",
    groupLabel: "Propostas",
    groupDescription: "Rotinas para revisar conversao e acompanhar oportunidades comerciais.",
  },
  {
    key: "offer_recent",
    label: "Propostas enviadas hoje",
    description: "Resume propostas criadas hoje para revisao comercial rapida.",
    defaultName: "Propostas enviadas hoje",
    groupKey: "propostas",
    groupLabel: "Propostas",
    groupDescription: "Rotinas para revisar conversao e acompanhar oportunidades comerciais.",
  },
  {
    key: "offer_stale_followup",
    label: "Propostas sem resposta",
    description: "Lista follow-ups parados e propostas sem resposta recente.",
    defaultName: "Propostas sem resposta",
    groupKey: "propostas",
    groupLabel: "Propostas",
    groupDescription: "Rotinas para revisar conversao e acompanhar oportunidades comerciais.",
  },
  {
    key: "finance_daily_summary",
    label: "Resumo financeiro do dia",
    description: "Resume recebido, pendente, atrasado e aguardando confirmacao no dia.",
    defaultName: "Resumo financeiro do dia",
    groupKey: "financeiro",
    groupLabel: "Financeiro",
    groupDescription: "Rotinas para acompanhar entradas, pendencias e saude financeira.",
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

function formatDate(value, timeZone = DEFAULT_TIMEZONE) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
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

function humanizeToken(value = "") {
  const normalized = normalizeText(value).toUpperCase();
  if (!normalized) return "";
  const map = {
    HOLD: "Reserva",
    CONFIRMED: "Confirmado",
    PAID: "Pago",
    PENDING: "Pendente",
    WAITING_CONFIRMATION: "Aguardando confirmacao",
    EXPIRED: "Expirada",
    CANCELLED: "Cancelada",
    CANCELED: "Cancelada",
  };
  if (map[normalized]) return map[normalized];
  return normalized
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function buildEmailStat(label, value) {
  const normalizedLabel = normalizeText(label);
  const normalizedValue = normalizeText(value);
  if (!normalizedLabel || !normalizedValue) return null;
  return { label: normalizedLabel, value: normalizedValue };
}

function buildEmailItem({ title = "", subtitle = "", meta = [] } = {}) {
  const normalizedTitle = normalizeText(title);
  const normalizedSubtitle = normalizeText(subtitle);
  const safeMeta = (Array.isArray(meta) ? meta : [])
    .map((entry) => ({
      label: normalizeText(entry?.label || ""),
      value: normalizeText(entry?.value || ""),
    }))
    .filter((entry) => entry.label && entry.value);

  if (!normalizedTitle && !normalizedSubtitle && !safeMeta.length) return null;
  return {
    title: normalizedTitle,
    subtitle: normalizedSubtitle,
    meta: safeMeta,
  };
}

function buildAgendaEmailItems(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) =>
      buildEmailItem({
        title: [normalizeText(item?.timeLabel || ""), normalizeText(item?.customerName || "")]
          .filter(Boolean)
          .join(" • "),
        subtitle: normalizeText(item?.offerTitle || "Servico"),
        meta: [{ label: "Status", value: humanizeToken(item?.statusLabel || item?.status) }],
      }),
    )
    .filter(Boolean);
}

function buildOfferEmailItem(candidate = {}, timeZone = DEFAULT_TIMEZONE) {
  const customerName = normalizeText(candidate?.customerName || "Cliente");
  const title = normalizeText(candidate?.title || "Proposta");
  const total = formatMoney(candidate?.totalCents || 0);
  const status =
    humanizeToken(candidate?.paymentStatus || "") || humanizeToken(candidate?.status || "");
  const dueLabel = candidate?.expiresAt
    ? formatDate(candidate.expiresAt, timeZone)
    : candidate?.dueAt
      ? formatDate(candidate.dueAt, timeZone)
      : "";
  const createdLabel = candidate?.createdAt ? formatDate(candidate.createdAt, timeZone) : "";
  const proofLabel = normalizeText(candidate?.paymentProofOriginalName || "");
  const proofAt = candidate?.paymentProofUploadedAt
    ? formatDateTime(candidate.paymentProofUploadedAt, timeZone)
    : "";

  return buildEmailItem({
    title: `${customerName} • ${title}`,
    subtitle: total,
    meta: [
      status ? { label: "Status", value: status } : null,
      dueLabel ? { label: "Vencimento", value: dueLabel } : null,
      createdLabel ? { label: "Criada em", value: createdLabel } : null,
      proofLabel ? { label: "Comprovante", value: proofLabel } : null,
      proofAt ? { label: "Recebido em", value: proofAt } : null,
    ].filter(Boolean),
  });
}

function buildAutomationEmailFooter(templateKey = "") {
  const template = getTemplateConfig(templateKey);
  const templateLabel = normalizeText(template?.label || "Automacao");
  return `Voce esta recebendo a rotina automatica "${templateLabel}" da Lumina para acompanhar a sua carteira.`;
}

function withAutomationEmailModel(templateKey = "", content = {}) {
  const template = getTemplateConfig(templateKey);
  const emailModel =
    content?.emailModel && typeof content.emailModel === "object" ? content.emailModel : {};

  return {
    ...content,
    emailModel: {
      accent: normalizeText(emailModel.accent || template?.groupKey || "default"),
      categoryLabel: normalizeText(emailModel.categoryLabel || template?.groupLabel || "Automacao"),
      footerNote: normalizeText(emailModel.footerNote || buildAutomationEmailFooter(templateKey)),
      ...emailModel,
    },
  };
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
    emailModel: {
      preheader: `Resumo semanal com faturamento confirmado de ${formatMoney(
        snapshot?.summary?.paidRevenueCents || 0,
      )}.`,
      headline: "Seu resumo semanal da Lumina",
      intro:
        "Organizei os principais sinais comerciais da sua carteira nos ultimos 7 dias para voce revisar em poucos minutos.",
      summaryStats: [
        buildEmailStat(
          "Faturamento confirmado",
          formatMoney(snapshot?.summary?.paidRevenueCents || 0),
        ),
        buildEmailStat("Propostas pagas", String(Number(snapshot?.summary?.paidCount || 0))),
        buildEmailStat(
          "Ticket medio",
          formatMoney(snapshot?.summary?.avgTicketCents || 0),
        ),
        buildEmailStat(
          "Conversao",
          `${Number(snapshot?.summary?.conversionPct || 0).toFixed(1)}%`,
        ),
      ].filter(Boolean),
      highlight:
        topClient?.customerName || topItem?.description
          ? {
              eyebrow: "Destaque da semana",
              title: topClient?.customerName
                ? `${topClient.customerName} liderou sua receita`
                : `${topItem?.description || "Produto"} puxou mais resultado`,
              body: [
                topClient?.customerName
                  ? `Receita confirmada: ${formatMoney(topClient?.paidRevenueCents || 0)}.`
                  : "",
                topItem?.description
                  ? `Produto com maior tracao: ${topItem.description} (${formatMoney(
                      topItem?.paidRevenueCents || 0,
                    )}).`
                  : "",
              ]
                .filter(Boolean)
                .join("\n"),
            }
          : null,
      sections: [
        {
          title: "Destaques comerciais",
          emptyText: "Ainda nao encontrei destaques comerciais suficientes nesta semana.",
          items: [
            topClient?.customerName
              ? buildEmailItem({
                  title: `Cliente com maior receita • ${topClient.customerName}`,
                  subtitle: formatMoney(topClient?.paidRevenueCents || 0),
                })
              : null,
            topItem?.description
              ? buildEmailItem({
                  title: `Produto com maior tracao • ${topItem.description}`,
                  subtitle: formatMoney(topItem?.paidRevenueCents || 0),
                })
              : null,
          ].filter(Boolean),
        },
      ],
    },
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
    emailModel: {
      preheader: `${pendingOffers.length} pendencias agora, ${overdueOffers.length} atrasadas e ${staleOffers.length} sem resposta recente.`,
      headline: "Pendencias de cobranca da sua carteira",
      intro:
        "Separei o que pede acao imediata para voce acompanhar a cobranca com mais clareza ao longo do dia.",
      summaryStats: [
        buildEmailStat("Pendentes agora", String(pendingOffers.length)),
        buildEmailStat("Atrasadas", String(overdueOffers.length)),
        buildEmailStat("Sem resposta recente", String(staleOffers.length)),
      ].filter(Boolean),
      highlight:
        overdueOffers[0]?.displayLabel || pendingOffers[0]?.displayLabel
          ? {
              eyebrow: "Mais urgente agora",
              title:
                overdueOffers[0]?.displayLabel ||
                pendingOffers[0]?.displayLabel ||
                "Ha uma cobranca prioritaria aguardando sua atencao.",
              body:
                overdueOffers.length > 0
                  ? "As cobrancas atrasadas devem ser priorizadas antes dos demais follow-ups."
                  : "Ha propostas pendentes que pedem acompanhamento ainda hoje.",
            }
          : null,
      sections: [
        {
          title: "Pendencias prioritarias",
          emptyText: "Nenhuma pendencia de cobranca aberta na sua carteira agora.",
          items: pendingOffers.slice(0, 5).map((offer) => buildOfferEmailItem(offer, timeZone)),
        },
        {
          title: "Follow-ups sem resposta",
          emptyText: "Nenhum follow-up parado neste momento.",
          items: staleOffers
            .slice(0, 4)
            .map((offer) => buildOfferEmailItem(offer, timeZone)),
        },
      ],
    },
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
    emailModel: {
      preheader: `${candidates.length} propostas com comprovante aguardando aprovacao.`,
      headline: "Propostas aguardando confirmacao",
      intro:
        candidates.length > 0
          ? "Encontrei comprovantes que ainda precisam da sua revisao na carteira."
          : "No momento nao ha comprovantes pendentes de aprovacao na sua carteira.",
      summaryStats: [buildEmailStat("Aguardando aprovacao", String(candidates.length))].filter(
        Boolean,
      ),
      highlight:
        candidates[0]?.displayLabel
          ? {
              eyebrow: "Primeira na fila",
              title: candidates[0].displayLabel,
              body:
                candidates[0]?.paymentProofUploadedAt
                  ? `Comprovante recebido em ${formatDateTime(
                      candidates[0].paymentProofUploadedAt,
                      timeZone,
                    )}.`
                  : "Ja existe um comprovante disponivel para revisao.",
            }
          : null,
      sections: [
        {
          title: "Comprovantes para revisar",
          emptyText: "Nenhum comprovante aguardando aprovacao agora.",
          items: candidates.slice(0, 5).map((candidate) => buildOfferEmailItem(candidate, timeZone)),
        },
      ],
    },
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
    emailModel: {
      preheader: `${Number(agenda?.summary?.total || 0)} compromissos previstos para hoje.`,
      headline: "Sua agenda do dia",
      intro:
        Number(agenda?.summary?.total || 0) > 0
          ? "Aqui esta a visao da sua agenda para hoje, com os compromissos que merecem atencao."
          : "Hoje sua agenda esta livre. A Lumina fica de olho e volta a avisar quando houver movimento.",
      summaryStats: [
        buildEmailStat("Compromissos", String(Number(agenda?.summary?.total || 0))),
        buildEmailStat("Confirmados", String(Number(agenda?.summary?.confirmed || 0))),
        buildEmailStat("Reservas", String(Number(agenda?.summary?.hold || 0))),
      ].filter(Boolean),
      highlight:
        Number(agenda?.summary?.hold || 0) > 0
          ? {
              eyebrow: "Atencao",
              title: `${Number(agenda?.summary?.hold || 0)} reserva(s) ainda pedem confirmacao`,
              body:
                "Vale acompanhar esses horarios para evitar buracos na agenda e garantir mais previsibilidade no dia.",
            }
          : null,
      sections: [
        {
          title: "Compromissos de hoje",
          emptyText: "Nenhum compromisso agendado para hoje.",
          items: buildAgendaEmailItems(agenda?.items || []),
        },
      ],
    },
  };
}

async function buildNextDayAgendaContent({ user, timeZone, now }) {
  const todayIso = getDateIsoForTimeZone(now, timeZone);
  const tomorrowIso = shiftDateIso(todayIso, 1);
  const agenda = await loadDailyAgendaForWorkspace({
    workspaceId: user.workspaceId,
    dateISO: tomorrowIso,
    timeZone,
  });

  return {
    subject: "Sua agenda de amanha",
    text: buildAgendaSummaryMessage({
      dayLabel: "amanha",
      dateISO: agenda?.dateISO || tomorrowIso,
      timeZone,
      summary: agenda?.summary || {},
      items: agenda?.items || [],
    }),
    emailModel: {
      preheader: `${Number(agenda?.summary?.total || 0)} compromissos previstos para amanha.`,
      headline: "Sua agenda de amanha",
      intro:
        Number(agenda?.summary?.total || 0) > 0
          ? "Deixei a agenda de amanha pronta para voce se organizar com antecedencia."
          : "Amanha sua agenda ainda esta livre, o que pode abrir espaco para novas oportunidades.",
      summaryStats: [
        buildEmailStat("Compromissos", String(Number(agenda?.summary?.total || 0))),
        buildEmailStat("Confirmados", String(Number(agenda?.summary?.confirmed || 0))),
        buildEmailStat("Reservas", String(Number(agenda?.summary?.hold || 0))),
      ].filter(Boolean),
      highlight:
        Number(agenda?.summary?.hold || 0) > 0
          ? {
              eyebrow: "Planejamento",
              title: `${Number(agenda?.summary?.hold || 0)} reserva(s) seguem em aberto para amanha`,
              body:
                "Voce pode revisar essas reservas antes do dia comecar para deixar a operacao mais previsivel.",
            }
          : null,
      sections: [
        {
          title: "Compromissos de amanha",
          emptyText: "Nenhum compromisso agendado para amanha.",
          items: buildAgendaEmailItems(agenda?.items || []),
        },
      ],
    },
  };
}

async function buildExpiringOffersContent({ user, timeZone, now }) {
  const expiring = await listExpiringOffers({
    workspaceId: user.workspaceId,
    ownerUserId: user._id,
    limit: 8,
    now,
    timeZone,
    sourceText: "esta semana",
  });
  const items = Array.isArray(expiring?.items) ? expiring.items : [];
  const lines = [
    "Propostas expirando na sua carteira:",
    "",
    `- Vencendo hoje: ${Number(expiring?.dueTodayCount || 0)}`,
    `- Vencendo nos proximos 7 dias: ${Number(expiring?.dueThisWeekCount || 0)}`,
  ];

  if (items.length) {
    lines.push("");
    items.slice(0, 5).forEach((item, index) => {
      lines.push(`${index + 1}. ${item.displayLabel}`);
    });
  } else {
    lines.push("");
    lines.push("Nenhuma proposta expira hoje ou nos proximos 7 dias.");
  }

  return {
    subject: "Propostas expirando",
    text: lines.join("\n"),
    emailModel: {
      preheader: `${Number(expiring?.dueTodayCount || 0)} proposta(s) vencem hoje e ${Number(
        expiring?.dueThisWeekCount || 0,
      )} vencem nos proximos 7 dias.`,
      headline: "Propostas expirando",
      intro:
        items.length > 0
          ? "Estas propostas pedem revisao antes de virarem perda de timing comercial."
          : "No momento nao encontrei propostas expirando hoje ou nesta semana na sua carteira.",
      summaryStats: [
        buildEmailStat("Vencendo hoje", String(Number(expiring?.dueTodayCount || 0))),
        buildEmailStat(
          "Proximos 7 dias",
          String(Number(expiring?.dueThisWeekCount || 0)),
        ),
      ].filter(Boolean),
      highlight:
        items[0]?.displayLabel
          ? {
              eyebrow: "Mais proxima do vencimento",
              title: items[0].displayLabel,
              body:
                Number(expiring?.dueTodayCount || 0) > 0
                  ? "Ha propostas expirando ainda hoje. Vale priorizar o contato imediato."
                  : "Revise essas propostas antes que percam janela comercial nesta semana.",
            }
          : null,
      sections: [
        {
          title: "Propostas para revisar",
          emptyText: "Nenhuma proposta expira hoje ou nos proximos 7 dias.",
          items: items.slice(0, 5).map((item) => buildOfferEmailItem(item, timeZone)),
        },
      ],
    },
  };
}

async function buildRecentOffersContent({ user, timeZone, now }) {
  const recentOffers = await listRecentOffers({
    workspaceId: user.workspaceId,
    ownerUserId: user._id,
    limit: 8,
    now,
    timeZone,
  });
  const lines = [`Propostas enviadas hoje: ${recentOffers.length}`];

  if (recentOffers.length) {
    lines.push("");
    recentOffers.slice(0, 5).forEach((offer, index) => {
      lines.push(`${index + 1}. ${offer.displayLabel}`);
    });
  } else {
    lines.push("");
    lines.push("Nenhuma proposta foi criada hoje na sua carteira.");
  }

  return {
    subject: "Propostas enviadas hoje",
    text: lines.join("\n"),
    emailModel: {
      preheader: `${recentOffers.length} proposta(s) criada(s) hoje na sua carteira.`,
      headline: "Propostas enviadas hoje",
      intro:
        recentOffers.length > 0
          ? "Aqui esta a visao das propostas geradas hoje para voce acompanhar o ritmo comercial."
          : "Hoje ainda nao houve novas propostas criadas na sua carteira.",
      summaryStats: [buildEmailStat("Criadas hoje", String(recentOffers.length))].filter(Boolean),
      sections: [
        {
          title: "Propostas do dia",
          emptyText: "Nenhuma proposta foi criada hoje na sua carteira.",
          items: recentOffers.slice(0, 5).map((offer) => buildOfferEmailItem(offer, timeZone)),
        },
      ],
    },
  };
}

async function buildStaleOfferFollowupContent({ user, timeZone, now }) {
  const staleOffers = await listWebAgentAutomationOfferCandidates({
    user,
    automationType: "stale_followup",
    limit: 8,
    now,
  });
  const lines = [`Propostas sem resposta recente: ${staleOffers.length}`];

  if (staleOffers.length) {
    lines.push("");
    staleOffers.slice(0, 5).forEach((candidate, index) => {
      lines.push(`${index + 1}. ${candidate.displayLabel}`);
    });
  } else {
    lines.push("");
    lines.push("Nenhuma proposta pede follow-up parado neste momento.");
  }

  return {
    subject: "Propostas sem resposta",
    text: lines.join("\n"),
    emailModel: {
      preheader: `${staleOffers.length} proposta(s) pedem follow-up por falta de resposta recente.`,
      headline: "Propostas sem resposta",
      intro:
        staleOffers.length > 0
          ? "Separei as oportunidades que esfriaram e podem precisar de retomada."
          : "No momento nao ha propostas sem resposta recente na sua carteira.",
      summaryStats: [buildEmailStat("Sem resposta recente", String(staleOffers.length))].filter(
        Boolean,
      ),
      highlight:
        staleOffers[0]?.displayLabel
          ? {
              eyebrow: "Retomada sugerida",
              title: staleOffers[0].displayLabel,
              body:
                "Uma retomada bem feita agora pode recuperar a conversa antes que a oportunidade esfrie ainda mais.",
            }
          : null,
      sections: [
        {
          title: "Follow-ups para retomar",
          emptyText: "Nenhuma proposta pede follow-up parado neste momento.",
          items: staleOffers.slice(0, 5).map((offer) => buildOfferEmailItem(offer, timeZone)),
        },
      ],
    },
  };
}

async function buildTomorrowBillingContent({ user, timeZone, now }) {
  const todayIso = getDateIsoForTimeZone(now, timeZone);
  const tomorrowIso = shiftDateIso(todayIso, 1);
  const pendingOffers = await listPendingOffers({
    workspaceId: user.workspaceId,
    ownerUserId: user._id,
    limit: 120,
    timeZone,
  });
  const dueTomorrow = pendingOffers
    .filter((offer) => {
      if (!offer?.expiresAt) return false;
      return getDateIsoForTimeZone(offer.expiresAt, timeZone) === tomorrowIso;
    })
    .sort(
      (left, right) =>
        new Date(left?.expiresAt || 0).getTime() - new Date(right?.expiresAt || 0).getTime(),
    );
  const lines = [
    `Cobrancas de amanha: ${dueTomorrow.length}`,
    "",
    `Data de vencimento: ${formatDate(dayRangeInTZ(tomorrowIso, timeZone).dayStart, timeZone)}`,
  ];

  if (dueTomorrow.length) {
    lines.push("");
    dueTomorrow.slice(0, 5).forEach((offer, index) => {
      lines.push(`${index + 1}. ${offer.displayLabel}`);
    });
  } else {
    lines.push("");
    lines.push("Nao encontrei cobrancas vencendo amanha na sua carteira.");
  }

  return {
    subject: "Cobrancas de amanha",
    text: lines.join("\n"),
    emailModel: {
      preheader: `${dueTomorrow.length} cobranca(s) vencem amanha na sua carteira.`,
      headline: "Cobrancas de amanha",
      intro:
        dueTomorrow.length > 0
          ? "Revise os vencimentos de amanha com antecedencia para organizar seus proximos contatos."
          : "Amanha nao ha cobrancas vencendo na sua carteira.",
      summaryStats: [
        buildEmailStat("Vencem amanha", String(dueTomorrow.length)),
        buildEmailStat(
          "Data de vencimento",
          formatDate(dayRangeInTZ(tomorrowIso, timeZone).dayStart, timeZone),
        ),
      ].filter(Boolean),
      highlight:
        dueTomorrow[0]?.displayLabel
          ? {
              eyebrow: "Primeira cobranca da fila",
              title: dueTomorrow[0].displayLabel,
              body:
                "Antecipar essa abordagem pode ajudar a reduzir atrasos e dar mais previsibilidade ao caixa.",
            }
          : null,
      sections: [
        {
          title: "Vencimentos de amanha",
          emptyText: "Nao encontrei cobrancas vencendo amanha na sua carteira.",
          items: dueTomorrow.slice(0, 5).map((offer) => buildOfferEmailItem(offer, timeZone)),
        },
      ],
    },
  };
}

async function buildDailyFinanceSummaryContent({ user, timeZone, now }) {
  const todayIso = getDateIsoForTimeZone(now, timeZone);
  const todayRange = dayRangeInTZ(todayIso, timeZone);
  const [snapshot, pendingOffers, waitingConfirmation, overdueOffers] = await Promise.all([
    buildGeneralReportsSnapshot({
      tenantId: user.workspaceId,
      userId: user._id,
      start: todayRange.dayStart,
      end: todayRange.dayEnd,
      fromYMD: todayIso,
      toYMD: todayIso,
    }),
    listPendingOffers({
      workspaceId: user.workspaceId,
      ownerUserId: user._id,
      limit: 120,
      timeZone,
    }),
    listOffersWaitingConfirmation({
      workspaceId: user.workspaceId,
      ownerUserId: user._id,
      limit: 120,
      timeZone,
    }),
    listWebAgentAutomationOfferCandidates({
      user,
      automationType: "overdue",
      limit: 120,
      now,
    }),
  ]);
  const priorityCandidate =
    overdueOffers[0] || waitingConfirmation[0] || pendingOffers[0] || null;
  const lines = [
    "Resumo financeiro do dia:",
    "",
    `- Recebido hoje: ${formatMoney(snapshot?.summary?.paidRevenueCents || 0)}`,
    `- Pagamentos confirmados hoje: ${Number(snapshot?.summary?.paidCount || 0)}`,
    `- Pendentes agora: ${pendingOffers.length}`,
    `- Atrasadas: ${overdueOffers.length}`,
    `- Aguardando confirmacao: ${waitingConfirmation.length}`,
    `- Ticket medio confirmado: ${formatMoney(snapshot?.summary?.avgTicketCents || 0)}`,
  ];

  if (priorityCandidate?.displayLabel) {
    lines.push("");
    lines.push(`Ponto de atencao agora: ${priorityCandidate.displayLabel}`);
  }

  const financePriorityItems = [
    ...overdueOffers.slice(0, 2),
    ...waitingConfirmation.slice(0, 2),
    ...pendingOffers.slice(0, 2),
  ]
    .filter(Boolean)
    .slice(0, 5);

  return {
    subject: "Seu resumo financeiro do dia",
    text: lines.join("\n"),
    emailModel: {
      preheader: `Recebido hoje: ${formatMoney(
        snapshot?.summary?.paidRevenueCents || 0,
      )}. Pendentes: ${pendingOffers.length}.`,
      headline: "Seu resumo financeiro do dia",
      intro:
        "Organizei a leitura financeira principal do dia para voce acompanhar entradas, pendencias e o que merece atencao agora.",
      summaryStats: [
        buildEmailStat(
          "Recebido hoje",
          formatMoney(snapshot?.summary?.paidRevenueCents || 0),
        ),
        buildEmailStat(
          "Pagamentos confirmados",
          String(Number(snapshot?.summary?.paidCount || 0)),
        ),
        buildEmailStat("Pendentes", String(pendingOffers.length)),
        buildEmailStat("Atrasadas", String(overdueOffers.length)),
      ].filter(Boolean),
      highlight:
        priorityCandidate?.displayLabel
          ? {
              eyebrow: "Ponto de atencao agora",
              title: priorityCandidate.displayLabel,
              body:
                waitingConfirmation.length > 0
                  ? `${waitingConfirmation.length} proposta(s) aguardam confirmacao manual no momento.`
                  : "Esse e o principal item que pode afetar seu ritmo financeiro agora.",
            }
          : null,
      sections: [
        {
          title: "Pendencias financeiras prioritarias",
          emptyText: "Nao encontrei pendencias financeiras relevantes neste momento.",
          items: financePriorityItems.map((item) => buildOfferEmailItem(item, timeZone)),
        },
      ],
    },
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
    emailModel: {
      preheader: `${Number(agenda?.summary?.total || 0)} compromissos, ${pendingOffers.length} pendencias e ${overdueOffers.length} atrasadas hoje.`,
      headline: "Suas prioridades do dia",
      intro:
        "Este digest combina agenda, cobranca e pendencias abertas para ajudar voce a decidir por onde comecar.",
      summaryStats: [
        buildEmailStat("Compromissos", String(Number(agenda?.summary?.total || 0))),
        buildEmailStat("Pendentes", String(pendingOffers.length)),
        buildEmailStat("Atrasadas", String(overdueOffers.length)),
        buildEmailStat("Aguardando confirmacao", String(waitingConfirmation.length)),
      ].filter(Boolean),
      highlight: summaryMessage
        ? {
            eyebrow: "Leitura rapida",
            title: "O que merece sua atencao agora",
            body: summaryMessage,
          }
        : null,
      sections: [
        {
          title: "Agenda do dia",
          emptyText: "Nenhum compromisso agendado para hoje.",
          items: buildAgendaEmailItems((agenda?.items || []).slice(0, 4)),
        },
        {
          title: "Pendencias de cobranca",
          emptyText: "Nenhuma pendencia de cobranca relevante agora.",
          items: [...overdueOffers.slice(0, 2), ...pendingOffers.slice(0, 3)]
            .slice(0, 5)
            .map((item) => buildOfferEmailItem(item, timeZone)),
        },
      ],
    },
  };
}

async function buildAutomationContent({
  automation,
  user,
  now = new Date(),
}) {
  const timeZone = normalizeText(automation?.timeZone || "") || DEFAULT_TIMEZONE;

  if (automation?.templateKey === "daily_agenda") {
    return withAutomationEmailModel(
      automation?.templateKey,
      await buildDailyAgendaContent({ user, timeZone, now }),
    );
  }

  if (automation?.templateKey === "next_day_agenda") {
    return withAutomationEmailModel(
      automation?.templateKey,
      await buildNextDayAgendaContent({ user, timeZone, now }),
    );
  }

  if (automation?.templateKey === "weekly_summary") {
    return withAutomationEmailModel(
      automation?.templateKey,
      await buildWeeklySummaryContent({ user, timeZone, now }),
    );
  }

  if (automation?.templateKey === "billing_pending") {
    return withAutomationEmailModel(
      automation?.templateKey,
      await buildBillingPendingContent({ user, timeZone, now }),
    );
  }

  if (automation?.templateKey === "billing_due_tomorrow") {
    return withAutomationEmailModel(
      automation?.templateKey,
      await buildTomorrowBillingContent({ user, timeZone, now }),
    );
  }

  if (automation?.templateKey === "waiting_confirmation") {
    return withAutomationEmailModel(
      automation?.templateKey,
      await buildWaitingConfirmationContent({ user, timeZone }),
    );
  }

  if (automation?.templateKey === "daily_priorities") {
    return withAutomationEmailModel(
      automation?.templateKey,
      await buildDailyPrioritiesContent({ user, timeZone, now }),
    );
  }

  if (automation?.templateKey === "offer_expiring") {
    return withAutomationEmailModel(
      automation?.templateKey,
      await buildExpiringOffersContent({ user, timeZone, now }),
    );
  }

  if (automation?.templateKey === "offer_recent") {
    return withAutomationEmailModel(
      automation?.templateKey,
      await buildRecentOffersContent({ user, timeZone, now }),
    );
  }

  if (automation?.templateKey === "offer_stale_followup") {
    return withAutomationEmailModel(
      automation?.templateKey,
      await buildStaleOfferFollowupContent({ user, timeZone, now }),
    );
  }

  if (automation?.templateKey === "finance_daily_summary") {
    return withAutomationEmailModel(
      automation?.templateKey,
      await buildDailyFinanceSummaryContent({ user, timeZone, now }),
    );
  }

  const weeklyAgenda = await loadWeeklyAgendaForWorkspace({
    workspaceId: user.workspaceId,
    startDateISO: getDateIsoForTimeZone(now, timeZone),
    days: 7,
    timeZone,
  });

  return withAutomationEmailModel(automation?.templateKey, {
    subject: "Atualizacao automatica da Lumina",
    text: buildWeeklyAgendaMessage({
      startDateISO: weeklyAgenda?.startDateISO || "",
      endDateISO: weeklyAgenda?.endDateISO || "",
      days: weeklyAgenda?.days || [],
      timeZone,
    }),
    emailModel: {
      preheader: "Atualizacao automatica da Lumina com a visao da sua carteira.",
      headline: "Atualizacao automatica da Lumina",
      intro:
        "A Lumina organizou uma leitura rapida da sua carteira para voce acompanhar os principais movimentos.",
      emptyState: {
        title: "Resumo disponivel em texto",
        body: buildWeeklyAgendaMessage({
          startDateISO: weeklyAgenda?.startDateISO || "",
          endDateISO: weeklyAgenda?.endDateISO || "",
          days: weeklyAgenda?.days || [],
          timeZone,
        }),
      },
    },
  });
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
  const html =
    content?.emailModel && typeof content.emailModel === "object"
      ? renderAutomationEmailHtml(content.emailModel)
      : renderAutomationEmailHtml({
          headline: content.subject || "Atualizacao da Lumina",
          intro: "",
          emptyState: {
            title: "Resumo da automacao",
            body: content.text || "",
          },
        });

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
