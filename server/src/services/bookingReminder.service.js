import { env } from "../config/env.js";
import { AppSettings } from "../models/AppSettings.js";
import Booking from "../models/Booking.js";
import { MessageLog } from "../models/MessageLog.js";
import { DEFAULT_AGENDA } from "./agendaSettings.js";
import { queueOrSendWhatsApp } from "./whatsappOutbox.service.js";
import {
  canSendWhatsAppBookingReminders,
  getNotificationFeatureCapability,
  resolveWorkspaceNotificationContext,
} from "./notificationSettings.js";

const DEFAULT_TIMEZONE = DEFAULT_AGENDA.timezone || "America/Sao_Paulo";
const MS_IN_HOUR = 36e5;
const REMINDER_WINDOW_24H = "24h";
const REMINDER_WINDOW_2H = "2h";

function onlyDigits(value) {
  return String(value || "").replace(/\D+/g, "");
}

function normalizePhoneBR(raw) {
  const digits = onlyDigits(raw);
  if (!digits) return "";
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  return digits;
}

function firstName(name) {
  const value = String(name || "").trim();
  if (!value) return "";
  return value.split(/\s+/)[0] || "";
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/g, "");
}

function baseOrigin(origin) {
  const explicit = trimTrailingSlash(origin);
  if (explicit) return explicit;

  const fromEnv = trimTrailingSlash(String(env.corsOrigin || "").split(",")[0]);
  if (fromEnv) return fromEnv;

  return "http://localhost:5173";
}

function formatDateTimeBR(value, timeZone = DEFAULT_TIMEZONE) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: timeZone || DEFAULT_TIMEZONE,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: DEFAULT_TIMEZONE,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }
}

function getOfferDoc(booking) {
  if (booking?.offerId && typeof booking.offerId === "object" && booking.offerId._id) {
    return booking.offerId;
  }
  return null;
}

function getOfferId(booking) {
  const offer = getOfferDoc(booking);
  if (offer?._id) return offer._id;
  return booking?.offerId || null;
}

function getServiceName(booking) {
  const offer = getOfferDoc(booking);
  const title = String(offer?.title || offer?.name || "").trim();
  return title || "seu servico";
}

function buildBookingManageUrl(booking, origin = "") {
  const offer = getOfferDoc(booking);
  const token = String(offer?.publicToken || "").trim();
  const bookingId = String(booking?._id || "").trim();

  if (!token || !bookingId) return "";

  return `${baseOrigin(origin)}/p/${token}/manage?bookingId=${encodeURIComponent(
    bookingId,
  )}`;
}

async function loadWorkspaceTimeZone({ workspaceId, ownerUserId }) {
  if (!workspaceId || !ownerUserId) return DEFAULT_TIMEZONE;

  const doc = await AppSettings.findOne({ workspaceId, ownerUserId })
    .select("agenda.timezone")
    .lean()
    .catch(() => null);

  return String(doc?.agenda?.timezone || DEFAULT_TIMEZONE).trim() || DEFAULT_TIMEZONE;
}

function buildBookingReminderEventType(bookingId, kind) {
  return kind === REMINDER_WINDOW_2H
    ? `BOOKING_REMINDER_2H:${bookingId}`
    : `BOOKING_REMINDER_24H:${bookingId}`;
}

function hoursUntil(date, now = new Date()) {
  const target = date instanceof Date ? date : new Date(date);
  const reference = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(target.getTime()) || Number.isNaN(reference.getTime())) return NaN;
  return (target.getTime() - reference.getTime()) / MS_IN_HOUR;
}

function pickBookingReminderTrigger(booking, now = new Date()) {
  const hoursLeft = hoursUntil(booking?.startAt, now);
  if (!Number.isFinite(hoursLeft) || hoursLeft <= 0) return null;

  if (hoursLeft <= 2) {
    return {
      kind: REMINDER_WINDOW_2H,
      eventType: buildBookingReminderEventType(booking?._id, REMINDER_WINDOW_2H),
    };
  }

  if (hoursLeft <= 24) {
    return {
      kind: REMINDER_WINDOW_24H,
      eventType: buildBookingReminderEventType(booking?._id, REMINDER_WINDOW_24H),
    };
  }

  return null;
}

export function buildBookingReminderMessage({
  booking,
  kind = REMINDER_WINDOW_24H,
  timeZone = DEFAULT_TIMEZONE,
  manageUrl = "",
}) {
  const name = firstName(booking?.customerName);
  const when = formatDateTimeBR(booking?.startAt, timeZone);
  const serviceName = getServiceName(booking);
  const greeting = name ? `Oi, ${name}!` : "Oi!";
  const intro =
    kind === REMINDER_WINDOW_2H
      ? "Seu atendimento esta chegando:"
      : "Passando para lembrar do seu agendamento:";
  const closing =
    kind === REMINDER_WINDOW_2H
      ? "Estamos te lembrando com antecedencia para deixar tudo alinhado. Se precisar de algo, e so responder esta mensagem."
      : manageUrl
        ? `Se precisar reagendar, acesse o link: ${manageUrl}`
        : "Se precisar reagendar, acesse o link da sua proposta.";

  return [
    greeting,
    "",
    intro,
    "",
    `*Servico:* ${serviceName}`,
    `*Data e horario:* ${when}`,
    "",
    closing,
  ]
    .filter(Boolean)
    .join("\n");
}

async function upsertSkippedMessageLog({
  booking,
  eventType,
  message,
  code,
  errorMessage,
  details = null,
}) {
  const offerId = getOfferId(booking);
  if (!offerId) return null;

  const raw = await MessageLog.findOneAndUpdate(
    { offerId, eventType },
    {
      $setOnInsert: {
        workspaceId: booking?.workspaceId || null,
        offerId,
        bookingId: booking?._id || null,
        eventType,
        channel: "WHATSAPP",
        provider: "whatsapp-web.js",
        to: normalizePhoneBR(booking?.customerWhatsApp),
        message,
        status: "SKIPPED",
        providerMessageId: null,
        error: {
          message: errorMessage,
          code,
          details,
        },
        sentAt: null,
      },
    },
    {
      upsert: true,
      new: true,
      includeResultMetadata: true,
      strict: false,
    },
  ).catch(() => null);

  return raw?.value ?? null;
}

export async function dispatchBookingReminder({
  booking,
  kind = REMINDER_WINDOW_24H,
  origin = "",
}) {
  const offerId = getOfferId(booking);
  if (!booking?._id || !offerId) {
    throw Object.assign(new Error("Booking invalido para lembrete."), {
      code: "BOOKING_INVALID",
      status: 400,
    });
  }

  const eventType = buildBookingReminderEventType(booking._id, kind);
  const timeZone = await loadWorkspaceTimeZone({
    workspaceId: booking?.workspaceId || null,
    ownerUserId: booking?.ownerUserId || null,
  });
  const manageUrl =
    kind === REMINDER_WINDOW_24H ? buildBookingManageUrl(booking, origin) : "";
  const message = buildBookingReminderMessage({
    booking,
    kind,
    timeZone,
    manageUrl,
  });
  const notificationContext = await resolveWorkspaceNotificationContext({
    workspaceId: booking?.workspaceId || null,
    ownerUserId: booking?.ownerUserId || null,
  });

  if (!canSendWhatsAppBookingReminders(notificationContext)) {
    const capability = getNotificationFeatureCapability(
      notificationContext,
      "whatsappBookingReminders",
    );
    const log = await upsertSkippedMessageLog({
      booking,
      eventType,
      message,
      code: capability?.code || "FEATURE_NOT_AVAILABLE",
      errorMessage: capability?.reason || "Recurso indisponivel.",
      details: {
        kind,
        featureKey: "whatsappBookingReminders",
      },
    });

    return {
      ok: false,
      status: "SKIPPED",
      reason: capability?.code || "FEATURE_NOT_AVAILABLE",
      log,
    };
  }

  const to = normalizePhoneBR(booking?.customerWhatsApp);
  if (!to) {
    const log = await upsertSkippedMessageLog({
      booking,
      eventType,
      message,
      code: "NO_PHONE",
      errorMessage: "Cliente sem WhatsApp valido para receber lembrete.",
      details: { kind },
    });

    return {
      ok: false,
      status: "SKIPPED",
      reason: "NO_PHONE",
      log,
    };
  }

  const raw = await MessageLog.findOneAndUpdate(
    { offerId, eventType },
    {
      $setOnInsert: {
        workspaceId: booking?.workspaceId || null,
        offerId,
        bookingId: booking?._id || null,
        eventType,
        channel: "WHATSAPP",
        provider: "whatsapp-web.js",
        to,
        message,
        status: "PENDING",
        providerMessageId: null,
        error: null,
        sentAt: null,
      },
    },
    {
      upsert: true,
      new: true,
      includeResultMetadata: true,
      strict: false,
    },
  );

  const created = raw?.lastErrorObject?.updatedExisting === false;
  const doc = raw?.value ?? null;
  if (!created) {
    return {
      ok: true,
      status: "SKIPPED",
      reason: "IDEMPOTENT",
      log: doc,
    };
  }

  const result = await queueOrSendWhatsApp({
    workspaceId: booking?.workspaceId || null,
    to,
    message,
    dedupeKey: `booking:${booking._id}:${kind}`,
    sourceType: "message_log",
    sourceId: doc?._id || null,
    meta: {
      bookingId: booking?._id || null,
      offerId,
      eventType,
      kind,
      manageUrl,
      timeZone,
    },
  });

  const freshLog = doc?._id ? await MessageLog.findById(doc._id).lean() : null;
  if (result?.status === "sent") {
    return { ok: true, status: "SENT", log: freshLog };
  }
  if (result?.status === "queued") {
    return { ok: true, status: "QUEUED", log: freshLog };
  }
  return {
    ok: false,
    status: "FAILED",
    error: result?.error || new Error("Falha ao enfileirar lembrete."),
    log: freshLog,
  };
}

export async function processAutomaticBookingReminders({
  now = new Date(),
  limit = 200,
  origin = "",
} = {}) {
  const bookingLimit = Math.max(1, Math.min(500, Number(limit) || 200));
  const upperBound = new Date(
    (now instanceof Date ? now : new Date(now)).getTime() + 24 * MS_IN_HOUR,
  );

  const bookings = await Booking.find({
    status: "CONFIRMED",
    startAt: {
      $gt: now instanceof Date ? now : new Date(now),
      $lte: upperBound,
    },
  })
    .sort({ startAt: 1 })
    .limit(bookingLimit)
    .populate("offerId", "_id title name publicToken")
    .lean();

  const summary = {
    scanned: bookings.length,
    sent: 0,
    queued: 0,
    failed: 0,
    skipped: 0,
    items: [],
  };

  for (const booking of bookings) {
    const trigger = pickBookingReminderTrigger(booking, now);
    if (!trigger) continue;

    const result = await dispatchBookingReminder({
      booking,
      kind: trigger.kind,
      origin,
    });

    summary.items.push({
      bookingId: String(booking._id),
      kind: trigger.kind,
      status: result.status,
      reason: result.reason || result.error?.message || "",
    });

    if (result.status === "SENT") summary.sent += 1;
    else if (result.status === "QUEUED") summary.queued += 1;
    else if (result.status === "FAILED") summary.failed += 1;
    else summary.skipped += 1;
  }

  return summary;
}
