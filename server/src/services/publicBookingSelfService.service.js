import mongoose from "mongoose";

import { AppSettings } from "../models/AppSettings.js";
import Booking from "../models/Booking.js";
import { MessageLog } from "../models/MessageLog.js";
import { Offer } from "../models/Offer.js";
import { User } from "../models/User.js";
import {
  DEFAULT_AGENDA,
  DEFAULT_SELF_SERVICE_MINIMUM_NOTICE_MINUTES,
  buildSlotsForDate,
  dayRangeInTZ,
  mergeAgenda,
  resolveAgendaForDate,
} from "./agendaSettings.js";
import {
  getNotificationFeatureCapability,
  isEmailNotificationEnabled,
  resolveWorkspaceOwnerNotificationContext,
} from "./notificationSettings.js";
import { queueOrSendWhatsApp } from "./whatsappOutbox.service.js";
import { notifyResponsibleBookingChangeWhatsApp } from "./workspaceUserWhatsApp.service.js";

const DEFAULT_TIMEZONE = DEFAULT_AGENDA.timezone || "America/Sao_Paulo";
const RESEND_ENDPOINT = "https://api.resend.com/emails";

function badRequest(message, extra = {}) {
  const err = new Error(message);
  err.statusCode = 400;
  err.status = 400;
  Object.assign(err, extra);
  return err;
}

function notFound(message, extra = {}) {
  const err = new Error(message);
  err.statusCode = 404;
  err.status = 404;
  Object.assign(err, extra);
  return err;
}

function conflict(message, extra = {}) {
  const err = new Error(message);
  err.statusCode = 409;
  err.status = 409;
  Object.assign(err, extra);
  return err;
}

function normalizeOfferStatus(value) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();
  if (normalized === "CANCELED") return "CANCELLED";
  if (normalized === "PAID") return "CONFIRMED";
  return normalized;
}

function isPaidStatus(value) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();
  return normalized === "PAID" || normalized === "CONFIRMED";
}

function computePaymentStatus(offerRaw) {
  const explicit = String(offerRaw?.paymentStatus || "")
    .trim()
    .toUpperCase();
  if (explicit) return explicit;

  const status = String(offerRaw?.status || "")
    .trim()
    .toUpperCase();
  const lastPix = String(offerRaw?.payment?.lastPixStatus || "")
    .trim()
    .toUpperCase();

  if (
    isPaidStatus(status) ||
    !!offerRaw?.paidAt ||
    lastPix === "PAID" ||
    lastPix === "CONFIRMED"
  ) {
    return "PAID";
  }

  return "PENDING";
}

function inferOfferType(offerRaw) {
  const type = String(offerRaw?.offerType || "")
    .trim()
    .toLowerCase();
  if (type === "product") return "product";
  return "service";
}

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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function nl2br(value) {
  return escapeHtml(value).replace(/\n/g, "<br/>");
}

function dateToIsoString(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  return value.toISOString();
}

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatDateTime(value, timeZone = DEFAULT_TIMEZONE) {
  const date = toDate(value);
  if (!date) return "";

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

function formatDateIsoInTimeZone(value, timeZone = DEFAULT_TIMEZONE) {
  const date = toDate(value);
  if (!date) return "";

  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || DEFAULT_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);

    const map = {};
    for (const part of parts) {
      if (part.type !== "literal") map[part.type] = part.value;
    }

    if (map.year && map.month && map.day) {
      return `${map.year}-${map.month}-${map.day}`;
    }
  } catch {}

  return date.toISOString().slice(0, 10);
}

function formatNoticeLabel(minutes) {
  const value = Math.max(0, Number(minutes) || 0);
  if (value === 0) return "0 minutos";
  if (value % (24 * 60) === 0) {
    const days = value / (24 * 60);
    return days === 1 ? "24 horas" : `${days} dias`;
  }
  if (value % 60 === 0) {
    const hours = value / 60;
    return hours === 1 ? "1 hora" : `${hours} horas`;
  }
  return value === 1 ? "1 minuto" : `${value} minutos`;
}

function minutesUntil(target, now = new Date()) {
  const targetDate = toDate(target);
  const referenceDate = toDate(now) || new Date();
  if (!targetDate) return NaN;
  return (targetDate.getTime() - referenceDate.getTime()) / 60000;
}

function clampMinimumNotice(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_SELF_SERVICE_MINIMUM_NOTICE_MINUTES;
  }
  const truncated = Math.trunc(numeric);
  return Math.max(0, Math.min(30 * 24 * 60, truncated));
}

function isSameRange(aStart, aEnd, bStart, bEnd) {
  const firstStart = toDate(aStart);
  const firstEnd = toDate(aEnd);
  const secondStart = toDate(bStart);
  const secondEnd = toDate(bEnd);

  if (!firstStart || !firstEnd || !secondStart || !secondEnd) return false;
  return (
    firstStart.getTime() === secondStart.getTime() &&
    firstEnd.getTime() === secondEnd.getTime()
  );
}

function inferDurationMinutes(offerRaw, booking) {
  const explicit = Number(offerRaw?.durationMin);
  if (Number.isFinite(explicit) && explicit > 0) return Math.trunc(explicit);

  const startAt = toDate(booking?.startAt);
  const endAt = toDate(booking?.endAt);
  if (!startAt || !endAt) return 60;

  const diff = Math.round((endAt.getTime() - startAt.getTime()) / 60000);
  return diff > 0 ? diff : 60;
}

function normalizeBookingStatusForSlots(value) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();
  if (normalized === "PAID") return "CONFIRMED";
  if (normalized === "CANCELED") return "CANCELLED";
  return normalized;
}

function bookingScopeFromOffer(offerRaw) {
  const query = {};
  if (offerRaw?.workspaceId) query.workspaceId = offerRaw.workspaceId;
  if (offerRaw?.ownerUserId) query.ownerUserId = offerRaw.ownerUserId;
  if (!query.workspaceId && !query.ownerUserId) query.offerId = offerRaw?._id;
  return query;
}

function sanitizeOfferPublic(offerRaw) {
  if (!offerRaw) return null;
  const { workspaceId, ownerUserId, __v, ...rest } = offerRaw;
  return rest;
}

function toPublicChangeHistoryEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  return {
    action: entry.action || "",
    actor: entry.actor || "",
    changedAt: dateToIsoString(toDate(entry.changedAt)),
    fromStartAt: dateToIsoString(toDate(entry.fromStartAt)),
    fromEndAt: dateToIsoString(toDate(entry.fromEndAt)),
    toStartAt: dateToIsoString(toDate(entry.toStartAt)),
    toEndAt: dateToIsoString(toDate(entry.toEndAt)),
    reason: entry.reason || "",
  };
}

function toPublicBooking(booking) {
  if (!booking) return null;

  const history = Array.isArray(booking.changeHistory)
    ? booking.changeHistory.map(toPublicChangeHistoryEntry).filter(Boolean)
    : [];

  return {
    id: String(booking._id),
    status: normalizeBookingStatusForSlots(booking.status),
    startAt: dateToIsoString(toDate(booking.startAt)),
    endAt: dateToIsoString(toDate(booking.endAt)),
    holdExpiresAt: dateToIsoString(toDate(booking.holdExpiresAt)),
    customerName: booking.customerName || "",
    customerWhatsApp: booking.customerWhatsApp || "",
    cancelledAt: dateToIsoString(toDate(booking.cancelledAt)),
    cancelledBy: booking.cancelledBy || "",
    cancelReason: booking.cancelReason || "",
    changeHistory: history,
  };
}

function getServiceName(offerRaw) {
  return String(offerRaw?.title || offerRaw?.name || "seu serviço").trim();
}

async function findOfferByPublicToken(token) {
  return (
    (await Offer.findOne({ publicToken: token }).select("-__v").lean()) ||
    (await Offer.findOne({ token }).select("-__v").lean()) ||
    (await Offer.findOne({ publicId: token }).select("-__v").lean()) ||
    null
  );
}

async function loadAgendaForWorkspace({ workspaceId, ownerUserId }) {
  if (!workspaceId || !ownerUserId) return mergeAgenda(DEFAULT_AGENDA, {});

  const doc = await AppSettings.findOne({ workspaceId, ownerUserId })
    .select("agenda")
    .lean()
    .catch(() => null);

  return mergeAgenda(DEFAULT_AGENDA, doc?.agenda || {});
}

function buildSelfServiceState({ offerRaw, booking, agenda, now = new Date() }) {
  const minimumNoticeMinutes = clampMinimumNotice(
    agenda?.selfServiceMinimumNoticeMinutes,
  );
  const minimumNoticeLabel = formatNoticeLabel(minimumNoticeMinutes);
  const bookingStatus = normalizeBookingStatusForSlots(booking?.status);

  const base = {
    eligible: false,
    canReschedule: false,
    canCancel: false,
    reason: "",
    minimumNoticeMinutes,
    minimumNoticeLabel,
    bookingStatus,
  };

  if (!offerRaw) {
    return { ...base, reason: "Proposta não encontrada." };
  }

  if (inferOfferType(offerRaw) !== "service") {
    return { ...base, reason: "Gerenciamento disponível apenas para serviços." };
  }

  const paymentStatus = computePaymentStatus(offerRaw);
  const paymentDone =
    isPaidStatus(offerRaw?.status) ||
    paymentStatus === "PAID" ||
    paymentStatus === "CONFIRMED" ||
    !!offerRaw?.paidAt;

  if (!paymentDone) {
    return {
      ...base,
      reason: "O gerenciamento do agendamento fica disponível após o pagamento.",
    };
  }

  if (!booking?._id) {
    return { ...base, reason: "Nenhum agendamento encontrado para este link." };
  }

  if (bookingStatus === "CANCELLED") {
    return { ...base, reason: "Este agendamento já foi cancelado." };
  }

  if (bookingStatus !== "CONFIRMED") {
    return {
      ...base,
      reason: "Este agendamento ainda não está confirmado para alterações.",
    };
  }

  const startAt = toDate(booking?.startAt);
  if (!startAt) {
    return { ...base, reason: "O horário do agendamento está inválido." };
  }

  const minutesLeft = minutesUntil(startAt, now);
  if (!Number.isFinite(minutesLeft) || minutesLeft <= 0) {
    return {
      ...base,
      reason: "Este agendamento já começou ou já passou.",
    };
  }

  if (minutesLeft < minimumNoticeMinutes) {
    return {
      ...base,
      reason: `Alterações self-service ficam disponíveis até ${minimumNoticeLabel} antes do horário.`,
    };
  }

  return {
    ...base,
    eligible: true,
    canReschedule: true,
    canCancel: true,
  };
}

function assertSelfServiceAllowed(selfService, action) {
  if (!selfService) {
    throw conflict("Não foi possível validar o gerenciamento do agendamento.", {
      code: "SELF_SERVICE_UNAVAILABLE",
    });
  }

  const allowed =
    action === "reschedule"
      ? selfService.canReschedule === true
      : selfService.canCancel === true;

  if (!allowed) {
    throw conflict(
      selfService.reason ||
        "Este agendamento não pode ser alterado por este link.",
      {
        code: "SELF_SERVICE_BLOCKED",
        reason: selfService.reason || "",
        capability: {
          action,
          minimumNoticeMinutes: selfService.minimumNoticeMinutes,
        },
      },
    );
  }
}

async function loadPublicManageContext({ token, bookingId, now = new Date() }) {
  const publicToken = String(token || "").trim();
  const bookingValue = String(bookingId || "").trim();

  if (!publicToken) throw badRequest("Token inválido.");
  if (!bookingValue || !mongoose.isValidObjectId(bookingValue)) {
    throw badRequest("bookingId inválido.");
  }

  const offerRaw = await findOfferByPublicToken(publicToken);
  if (!offerRaw) throw notFound("Proposta não encontrada.");

  const booking = await Booking.findOne({
    _id: bookingValue,
    offerId: offerRaw._id,
  })
    .lean()
    .catch(() => null);

  if (!booking) throw notFound("Agendamento não encontrado.");

  const agenda = await loadAgendaForWorkspace({
    workspaceId: offerRaw?.workspaceId || null,
    ownerUserId: offerRaw?.ownerUserId || null,
  });

  const selfService = buildSelfServiceState({
    offerRaw,
    booking,
    agenda,
    now,
  });

  return {
    offerRaw,
    booking,
    agenda,
    selfService,
  };
}

function buildManageSummary({ offerRaw, booking, agenda, selfService }) {
  return {
    offer: sanitizeOfferPublic({
      ...offerRaw,
      offerType: offerRaw?.offerType || inferOfferType(offerRaw),
    }),
    booking: toPublicBooking(booking),
    selfService: {
      ...selfService,
      timeZone: agenda?.timezone || DEFAULT_TIMEZONE,
    },
  };
}

function buildSlotAvailability({
  slot,
  busyRanges,
  minimumNoticeMinutes,
  now,
}) {
  const slotStart = toDate(slot?.startAt);
  const slotEnd = toDate(slot?.endAt);
  if (!slotStart || !slotEnd) {
    return { ...slot, available: false, reason: "INVALID_SLOT" };
  }

  if (slotStart.getTime() <= (toDate(now) || new Date()).getTime()) {
    return { ...slot, available: false, reason: "PAST_SLOT" };
  }

  if (minutesUntil(slotStart, now) < minimumNoticeMinutes) {
    return {
      ...slot,
      available: false,
      reason: "MINIMUM_NOTICE",
    };
  }

  const overlaps = busyRanges.some((busy) => {
    const busyStart = toDate(busy?.startAt);
    const busyEnd = toDate(busy?.endAt);
    if (!busyStart || !busyEnd) return false;
    return slotStart < busyEnd && slotEnd > busyStart;
  });

  if (overlaps) {
    return { ...slot, available: false, reason: "OCCUPIED" };
  }

  return { ...slot, available: true, reason: "" };
}

async function computeManageSlotsForDate({
  offerRaw,
  booking,
  agenda,
  date,
  now = new Date(),
}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || "").trim())) {
    throw badRequest("Informe date=YYYY-MM-DD.");
  }

  const timeZone = agenda?.timezone || DEFAULT_TIMEZONE;
  const minimumNoticeMinutes = clampMinimumNotice(
    agenda?.selfServiceMinimumNoticeMinutes,
  );
  const durationMin = inferDurationMinutes(offerRaw, booking);
  const { dayStart, dayEnd } = dayRangeInTZ(date, timeZone);
  const scope = bookingScopeFromOffer(offerRaw);
  const referenceNow = toDate(now) || new Date();

  const busyBookings = await Booking.find({
    ...scope,
    _id: { $ne: booking?._id },
    startAt: { $gte: dayStart, $lt: dayEnd },
    $or: [
      { status: { $in: ["CONFIRMED", "PAID"] } },
      { status: "HOLD", holdExpiresAt: { $gt: referenceNow } },
    ],
  })
    .select("_id startAt endAt status holdExpiresAt")
    .lean()
    .catch(() => []);

  const busyRanges = busyBookings
    .map((item) => ({
      startAt: item.startAt,
      endAt: item.endAt,
      status: normalizeBookingStatusForSlots(item.status),
    }))
    .filter((item) => item.startAt && item.endAt);

  const dayAgenda = resolveAgendaForDate(agenda, date, { durationMin });
  const slots = buildSlotsForDate({
    dayAgenda,
    date,
    durationMin,
    tz: timeZone,
  });

  return slots.map((slot) =>
    buildSlotAvailability({
      slot,
      busyRanges,
      minimumNoticeMinutes,
      now: referenceNow,
    }),
  );
}

async function sendResendEmail({
  to,
  subject,
  html,
  text,
  idempotencyKey,
}) {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const from = String(process.env.RESEND_FROM || "").trim();
  const recipient = String(to || "").trim();

  if (!recipient) {
    return { ok: false, skipped: true, reason: "missing_to" };
  }

  if (!apiKey) {
    return { ok: false, skipped: true, reason: "missing_api_key" };
  }

  if (!from) {
    return { ok: false, skipped: true, reason: "missing_from" };
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  if (String(idempotencyKey || "").trim()) {
    headers["Idempotency-Key"] = String(idempotencyKey).trim();
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({
      from,
      to: recipient,
      subject,
      html,
      text,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      data?.message || data?.error || `Resend error (${response.status})`,
    );
    error.statusCode = response.status;
    error.data = data;
    throw error;
  }

  return {
    ok: true,
    id: data?.id || data?.data?.id || null,
    to: recipient,
  };
}

function buildCustomerWhatsAppMessage({
  type,
  offerRaw,
  bookingBefore,
  bookingAfter,
  timeZone,
  reason = "",
}) {
  const serviceName = getServiceName(offerRaw);
  const name = firstName(
    bookingAfter?.customerName ||
      bookingBefore?.customerName ||
      offerRaw?.customerName ||
      "",
  );
  const greeting = name ? `Oi, ${name}!` : "Oi!";

  if (type === "cancel") {
    const when = formatDateTime(
      bookingAfter?.startAt || bookingBefore?.startAt,
      timeZone,
    );
    return [
      greeting,
      "",
      `Seu agendamento de *${serviceName}* em *${when}* foi cancelado conforme sua solicitação.`,
      reason ? `*Motivo informado:* ${reason}` : "",
      "",
      "Se precisar de ajuda para remarcar, é só responder esta mensagem.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const previousWhen = formatDateTime(bookingBefore?.startAt, timeZone);
  const nextWhen = formatDateTime(bookingAfter?.startAt, timeZone);

  return [
    greeting,
    "",
    "Seu agendamento foi atualizado com sucesso.",
    "",
    `*Serviço:* ${serviceName}`,
    `*Antes:* ${previousWhen}`,
    `*Novo horário:* ${nextWhen}`,
    "",
    "Se precisar alinhar mais algum detalhe, é só responder esta mensagem.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildCustomerEmail({
  type,
  offerRaw,
  bookingBefore,
  bookingAfter,
  timeZone,
  reason = "",
}) {
  const serviceName = getServiceName(offerRaw);
  const fullName =
    String(
      bookingAfter?.customerName ||
        bookingBefore?.customerName ||
        offerRaw?.customerName ||
        "",
    ).trim() || "Cliente";
  const first = firstName(fullName);
  const greeting = first ? `Olá, ${escapeHtml(first)}!` : "Olá!";

  if (type === "cancel") {
    const when = formatDateTime(
      bookingAfter?.startAt || bookingBefore?.startAt,
      timeZone,
    );
    return {
      subject: `Agendamento cancelado • ${serviceName}`,
      html: `
        <div style="background:#f4f4f5; padding:24px;">
          <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e4e4e7; border-radius:18px; overflow:hidden; font-family:ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color:#18181b;">
            <div style="padding:28px 24px 10px;">
              <div style="font-size:22px; font-weight:800;">Agendamento cancelado</div>
              <div style="margin-top:10px; font-size:14px; line-height:1.6; color:#52525b;">
                ${greeting}<br/>
                Confirmamos o cancelamento do seu agendamento.
              </div>
            </div>
            <div style="padding:0 24px 12px; font-size:14px; line-height:1.7; color:#27272a;">
              <strong>Serviço:</strong> ${escapeHtml(serviceName)}<br/>
              <strong>Data e horário:</strong> ${escapeHtml(when)}
            </div>
            ${
              reason
                ? `<div style="padding:0 24px 12px; font-size:14px; line-height:1.7; color:#27272a;">
                    <strong>Motivo informado:</strong><br/>
                    ${nl2br(reason)}
                  </div>`
                : ""
            }
            <div style="padding:0 24px 24px; font-size:14px; line-height:1.7; color:#52525b;">
              Se quiser remarcar, basta responder este e-mail ou falar com a equipe pelo canal habitual.
            </div>
          </div>
        </div>`,
      text: [
        "Agendamento cancelado",
        "",
        `Serviço: ${serviceName}`,
        `Data e horário: ${when}`,
        reason ? `Motivo informado: ${reason}` : "",
        "",
        "Se quiser remarcar, basta responder este e-mail ou falar com a equipe.",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  const previousWhen = formatDateTime(bookingBefore?.startAt, timeZone);
  const nextWhen = formatDateTime(bookingAfter?.startAt, timeZone);

  return {
    subject: `Agendamento reagendado • ${serviceName}`,
    html: `
      <div style="background:#f4f4f5; padding:24px;">
        <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e4e4e7; border-radius:18px; overflow:hidden; font-family:ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color:#18181b;">
          <div style="padding:28px 24px 10px;">
            <div style="font-size:22px; font-weight:800;">Agendamento atualizado</div>
            <div style="margin-top:10px; font-size:14px; line-height:1.6; color:#52525b;">
              ${greeting}<br/>
              Seu reagendamento foi confirmado com sucesso.
            </div>
          </div>
          <div style="padding:0 24px 12px; font-size:14px; line-height:1.7; color:#27272a;">
            <strong>Serviço:</strong> ${escapeHtml(serviceName)}<br/>
            <strong>Horário anterior:</strong> ${escapeHtml(previousWhen)}<br/>
            <strong>Novo horário:</strong> ${escapeHtml(nextWhen)}
          </div>
          <div style="padding:0 24px 24px; font-size:14px; line-height:1.7; color:#52525b;">
            Se precisar ajustar mais algum detalhe, é só responder este e-mail.
          </div>
        </div>
      </div>`,
    text: [
      "Agendamento reagendado",
      "",
      `Serviço: ${serviceName}`,
      `Horário anterior: ${previousWhen}`,
      `Novo horário: ${nextWhen}`,
      "",
      "Se precisar ajustar mais algum detalhe, basta responder este e-mail.",
    ].join("\n"),
  };
}

function buildWorkspaceEmail({
  type,
  offerRaw,
  bookingBefore,
  bookingAfter,
  timeZone,
  reason = "",
}) {
  const serviceName = getServiceName(offerRaw);
  const customerName = String(
    bookingAfter?.customerName ||
      bookingBefore?.customerName ||
      offerRaw?.customerName ||
      "Cliente",
  ).trim();

  if (type === "cancel") {
    const when = formatDateTime(
      bookingAfter?.startAt || bookingBefore?.startAt,
      timeZone,
    );

    return {
      subject: `Cliente cancelou o agendamento • ${serviceName}`,
      html: `
        <div style="background:#f4f4f5; padding:24px;">
          <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e4e4e7; border-radius:18px; overflow:hidden; font-family:ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color:#18181b;">
            <div style="padding:28px 24px 10px;">
              <div style="font-size:22px; font-weight:800;">Cancelamento realizado pelo cliente</div>
            </div>
            <div style="padding:0 24px 12px; font-size:14px; line-height:1.7; color:#27272a;">
              <strong>Cliente:</strong> ${escapeHtml(customerName)}<br/>
              <strong>Serviço:</strong> ${escapeHtml(serviceName)}<br/>
              <strong>Horário cancelado:</strong> ${escapeHtml(when)}
            </div>
            ${
              reason
                ? `<div style="padding:0 24px 12px; font-size:14px; line-height:1.7; color:#27272a;">
                    <strong>Motivo informado:</strong><br/>
                    ${nl2br(reason)}
                  </div>`
                : ""
            }
            <div style="padding:0 24px 24px; font-size:14px; line-height:1.7; color:#52525b;">
              O pagamento e a proposta foram mantidos; apenas o booking foi cancelado.
            </div>
          </div>
        </div>`,
      text: [
        "Cancelamento realizado pelo cliente",
        "",
        `Cliente: ${customerName}`,
        `Serviço: ${serviceName}`,
        `Horário cancelado: ${when}`,
        reason ? `Motivo informado: ${reason}` : "",
        "",
        "O pagamento e a proposta foram mantidos; apenas o booking foi cancelado.",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  const previousWhen = formatDateTime(bookingBefore?.startAt, timeZone);
  const nextWhen = formatDateTime(bookingAfter?.startAt, timeZone);

  return {
    subject: `Cliente reagendou o serviço • ${serviceName}`,
    html: `
      <div style="background:#f4f4f5; padding:24px;">
        <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e4e4e7; border-radius:18px; overflow:hidden; font-family:ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color:#18181b;">
          <div style="padding:28px 24px 10px;">
            <div style="font-size:22px; font-weight:800;">Reagendamento realizado pelo cliente</div>
          </div>
          <div style="padding:0 24px 24px; font-size:14px; line-height:1.7; color:#27272a;">
            <strong>Cliente:</strong> ${escapeHtml(customerName)}<br/>
            <strong>Serviço:</strong> ${escapeHtml(serviceName)}<br/>
            <strong>Horário anterior:</strong> ${escapeHtml(previousWhen)}<br/>
            <strong>Novo horário:</strong> ${escapeHtml(nextWhen)}
          </div>
        </div>
      </div>`,
    text: [
      "Reagendamento realizado pelo cliente",
      "",
      `Cliente: ${customerName}`,
      `Serviço: ${serviceName}`,
      `Horário anterior: ${previousWhen}`,
      `Novo horário: ${nextWhen}`,
    ].join("\n"),
  };
}

async function sendCustomerWhatsAppNotification({
  offerRaw,
  booking,
  eventType,
  message,
  meta = null,
}) {
  const to = normalizePhoneBR(
    booking?.customerWhatsApp ||
      offerRaw?.customerWhatsApp ||
      offerRaw?.customer?.phone ||
      "",
  );

  if (!to) {
    return { ok: false, status: "SKIPPED", reason: "NO_PHONE" };
  }

  const raw = await MessageLog.findOneAndUpdate(
    { offerId: offerRaw._id, eventType },
    {
      $setOnInsert: {
        workspaceId: offerRaw?.workspaceId || null,
        offerId: offerRaw._id,
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
    return { ok: true, status: "SKIPPED", reason: "IDEMPOTENT", log: doc };
  }

  const result = await queueOrSendWhatsApp({
    workspaceId: offerRaw?.workspaceId || null,
    to,
    message,
    dedupeKey: `booking:self-service:${eventType}`,
    sourceType: "message_log",
    sourceId: doc?._id || null,
    meta: {
      ...(meta && typeof meta === "object" ? meta : {}),
      offerId: String(offerRaw?._id || ""),
      bookingId: String(booking?._id || ""),
      eventType,
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
    reason: result?.error?.message || "Falha ao enviar WhatsApp",
    log: freshLog,
  };
}

async function resolveWorkspaceEmail(offerRaw) {
  const sellerEmail = String(offerRaw?.sellerEmail || "").trim();
  if (sellerEmail) return sellerEmail;

  if (!offerRaw?.ownerUserId) return "";

  const owner = await User.findById(offerRaw.ownerUserId)
    .select("email")
    .lean()
    .catch(() => null);

  return String(owner?.email || "").trim();
}

async function notifyBookingChange({
  type,
  offerRaw,
  bookingBefore,
  bookingAfter,
  reason = "",
  timeZone = DEFAULT_TIMEZONE,
}) {
  const notificationContext = await resolveWorkspaceOwnerNotificationContext({
    workspaceId: offerRaw?.workspaceId || null,
  });
  const emailEnabled = isEmailNotificationEnabled(
    notificationContext,
    "bookingChanges",
  );
  const whatsappCapability = getNotificationFeatureCapability(
    notificationContext,
    "whatsappBookingChanges",
  );
  const whatsappEnabled = whatsappCapability?.available === true;
  const eventType =
    type === "cancel"
      ? `BOOKING_CANCELLED_BY_CUSTOMER:${String(bookingAfter?._id || bookingBefore?._id || "")}`
      : `BOOKING_RESCHEDULED_BY_CUSTOMER:${String(bookingAfter?._id || bookingBefore?._id || "")}:${dateToIsoString(toDate(bookingAfter?.startAt)) || ""}`;

  const customerMessage = buildCustomerWhatsAppMessage({
    type,
    offerRaw,
    bookingBefore,
    bookingAfter,
    timeZone,
    reason,
  });

  const customerEmailPayload = buildCustomerEmail({
    type,
    offerRaw,
    bookingBefore,
    bookingAfter,
    timeZone,
    reason,
  });

  const workspaceEmailPayload = buildWorkspaceEmail({
    type,
    offerRaw,
    bookingBefore,
    bookingAfter,
    timeZone,
    reason,
  });

  const customerEmail = String(offerRaw?.customerEmail || "").trim();
  const workspaceEmail = await resolveWorkspaceEmail(offerRaw);

  const [
    customerWhatsApp,
    customerEmailResult,
    workspaceEmailResult,
    workspaceWhatsAppResult,
  ] =
    await Promise.all([
      whatsappEnabled
        ? sendCustomerWhatsAppNotification({
            offerRaw,
            booking: bookingAfter || bookingBefore,
            eventType,
            message: customerMessage,
            meta: { type, reason: reason || null },
          }).catch((error) => ({
            ok: false,
            status: "FAILED",
            reason: error?.message || "Falha ao enviar WhatsApp",
          }))
        : Promise.resolve({
            ok: false,
            skipped: true,
            reason: whatsappCapability?.code || "whatsapp_booking_changes_disabled",
          }),
      emailEnabled && customerEmail
        ? sendResendEmail({
            to: customerEmail,
            subject: customerEmailPayload.subject,
            html: customerEmailPayload.html,
            text: customerEmailPayload.text,
            idempotencyKey: `${eventType}:customer-email`,
          }).catch((error) => ({
            ok: false,
            failed: true,
            reason: error?.message || "Falha ao enviar e-mail ao cliente",
          }))
        : Promise.resolve({
            ok: false,
            skipped: true,
            reason: emailEnabled ? "missing_customer_email" : "email_booking_changes_disabled",
          }),
      emailEnabled && workspaceEmail
        ? sendResendEmail({
            to: workspaceEmail,
            subject: workspaceEmailPayload.subject,
            html: workspaceEmailPayload.html,
            text: workspaceEmailPayload.text,
            idempotencyKey: `${eventType}:workspace-email`,
          }).catch((error) => ({
            ok: false,
            failed: true,
            reason: error?.message || "Falha ao enviar e-mail ao workspace",
          }))
        : Promise.resolve({
            ok: false,
            skipped: true,
            reason: emailEnabled ? "missing_workspace_email" : "email_booking_changes_disabled",
          }),
      notifyResponsibleBookingChangeWhatsApp({
        type,
        offerRaw,
        bookingBefore,
        bookingAfter,
        reason,
        timeZone,
        notificationContext,
      }).catch((error) => ({
        ok: false,
        status: "FAILED",
        reason: error?.message || "Falha ao enviar WhatsApp ao responsavel",
      })),
    ]);

  return {
    eventType,
    notificationSettings: {
      emailEnabled,
      whatsappEnabled,
      whatsappCode: whatsappCapability?.code || "",
    },
    customerWhatsApp,
    customerEmail: customerEmailResult,
    workspaceEmail: workspaceEmailResult,
    workspaceWhatsApp: workspaceWhatsAppResult,
  };
}

export async function buildPublicBookingSelfServiceState({
  offerRaw,
  booking,
  agenda = null,
  now = new Date(),
}) {
  const resolvedAgenda =
    agenda ||
    (await loadAgendaForWorkspace({
      workspaceId: offerRaw?.workspaceId || null,
      ownerUserId: offerRaw?.ownerUserId || null,
    }));

  return buildSelfServiceState({
    offerRaw,
    booking,
    agenda: resolvedAgenda,
    now,
  });
}

export async function getPublicBookingManageSummary({
  token,
  bookingId,
  now = new Date(),
}) {
  const context = await loadPublicManageContext({ token, bookingId, now });
  return buildManageSummary(context);
}

export async function listPublicBookingManageSlots({
  token,
  bookingId,
  date,
  now = new Date(),
}) {
  const context = await loadPublicManageContext({ token, bookingId, now });
  assertSelfServiceAllowed(context.selfService, "reschedule");

  const slots = await computeManageSlotsForDate({
    offerRaw: context.offerRaw,
    booking: context.booking,
    agenda: context.agenda,
    date,
    now,
  });

  return {
    slots,
    now: (toDate(now) || new Date()).toISOString(),
    selfService: {
      ...context.selfService,
      timeZone: context.agenda?.timezone || DEFAULT_TIMEZONE,
    },
  };
}

export async function reschedulePublicBooking({
  token,
  bookingId,
  startAt,
  endAt,
  now = new Date(),
}) {
  const actionAt = toDate(now) || new Date();
  const context = await loadPublicManageContext({
    token,
    bookingId,
    now: actionAt,
  });
  assertSelfServiceAllowed(context.selfService, "reschedule");

  const nextStartAt = toDate(startAt);
  const nextEndAt = toDate(endAt);
  if (!nextStartAt || !nextEndAt || nextEndAt <= nextStartAt) {
    throw badRequest("Horário inválido.");
  }

  if (
    isSameRange(
      context.booking.startAt,
      context.booking.endAt,
      nextStartAt,
      nextEndAt,
    )
  ) {
    return {
      changed: false,
      booking: toPublicBooking(context.booking),
      selfService: {
        ...context.selfService,
        timeZone: context.agenda?.timezone || DEFAULT_TIMEZONE,
      },
      notifications: null,
    };
  }

  const expectedDurationMin = inferDurationMinutes(
    context.offerRaw,
    context.booking,
  );
  const requestedDurationMin = Math.round(
    (nextEndAt.getTime() - nextStartAt.getTime()) / 60000,
  );

  if (requestedDurationMin !== expectedDurationMin) {
    throw badRequest("O novo horário não corresponde à duração do serviço.");
  }

  const date = formatDateIsoInTimeZone(
    nextStartAt,
    context.agenda?.timezone || DEFAULT_TIMEZONE,
  );
  const slots = await computeManageSlotsForDate({
    offerRaw: context.offerRaw,
    booking: context.booking,
    agenda: context.agenda,
    date,
    now: actionAt,
  });

  const matchingSlot = slots.find((slot) =>
    isSameRange(slot.startAt, slot.endAt, nextStartAt, nextEndAt),
  );

  if (!matchingSlot) {
    throw conflict("O horário escolhido não pertence à agenda disponível.", {
      code: "INVALID_SLOT",
    });
  }

  if (matchingSlot.available !== true) {
    throw conflict("Este horário não está mais disponível.", {
      code: "SLOT_UNAVAILABLE",
      reason: matchingSlot.reason || "",
    });
  }

  const updated = await Booking.findOneAndUpdate(
    {
      _id: context.booking._id,
      offerId: context.offerRaw._id,
      status: { $in: ["CONFIRMED", "PAID"] },
      updatedAt: context.booking.updatedAt,
    },
    {
      $set: {
        startAt: nextStartAt,
        endAt: nextEndAt,
        holdExpiresAt: null,
        cancelledAt: null,
        cancelledBy: null,
        cancelReason: null,
      },
      $push: {
        changeHistory: {
          action: "reschedule",
          actor: "customer",
          changedAt: actionAt,
          fromStartAt: context.booking.startAt,
          fromEndAt: context.booking.endAt,
          toStartAt: nextStartAt,
          toEndAt: nextEndAt,
          reason: null,
        },
      },
    },
    { new: true, strict: false },
  ).lean();

  if (!updated) {
    const latest = await Booking.findOne({
      _id: context.booking._id,
      offerId: context.offerRaw._id,
    })
      .lean()
      .catch(() => null);

    if (
      latest &&
      isSameRange(latest.startAt, latest.endAt, nextStartAt, nextEndAt)
    ) {
      const selfService = buildSelfServiceState({
        offerRaw: context.offerRaw,
        booking: latest,
        agenda: context.agenda,
        now: actionAt,
      });
      return {
        changed: false,
        booking: toPublicBooking(latest),
        selfService: {
          ...selfService,
          timeZone: context.agenda?.timezone || DEFAULT_TIMEZONE,
        },
        notifications: null,
      };
    }

    throw conflict(
      "O agendamento foi atualizado por outro processo. Recarregue a página e tente novamente.",
      { code: "BOOKING_CHANGED" },
    );
  }

  const notifications = await notifyBookingChange({
    type: "reschedule",
    offerRaw: context.offerRaw,
    bookingBefore: context.booking,
    bookingAfter: updated,
    timeZone: context.agenda?.timezone || DEFAULT_TIMEZONE,
  });

  const selfService = buildSelfServiceState({
    offerRaw: context.offerRaw,
    booking: updated,
    agenda: context.agenda,
    now: actionAt,
  });

  return {
    changed: true,
    booking: toPublicBooking(updated),
    selfService: {
      ...selfService,
      timeZone: context.agenda?.timezone || DEFAULT_TIMEZONE,
    },
    notifications,
  };
}

export async function cancelPublicBooking({
  token,
  bookingId,
  reason = "",
  now = new Date(),
}) {
  const actionAt = toDate(now) || new Date();
  const context = await loadPublicManageContext({
    token,
    bookingId,
    now: actionAt,
  });

  if (normalizeBookingStatusForSlots(context.booking?.status) === "CANCELLED") {
    return {
      changed: false,
      booking: toPublicBooking(context.booking),
      selfService: {
        ...context.selfService,
        timeZone: context.agenda?.timezone || DEFAULT_TIMEZONE,
      },
      notifications: null,
    };
  }

  assertSelfServiceAllowed(context.selfService, "cancel");

  const cleanReason = String(reason || "").trim().slice(0, 1000) || null;
  const updated = await Booking.findOneAndUpdate(
    {
      _id: context.booking._id,
      offerId: context.offerRaw._id,
      status: { $in: ["CONFIRMED", "PAID"] },
      updatedAt: context.booking.updatedAt,
    },
    {
      $set: {
        status: "CANCELLED",
        holdExpiresAt: null,
        cancelledAt: actionAt,
        cancelledBy: "customer",
        cancelReason: cleanReason,
      },
      $push: {
        changeHistory: {
          action: "cancel",
          actor: "customer",
          changedAt: actionAt,
          fromStartAt: context.booking.startAt,
          fromEndAt: context.booking.endAt,
          toStartAt: null,
          toEndAt: null,
          reason: cleanReason,
        },
      },
    },
    { new: true, strict: false },
  ).lean();

  if (!updated) {
    const latest = await Booking.findOne({
      _id: context.booking._id,
      offerId: context.offerRaw._id,
    })
      .lean()
      .catch(() => null);

    if (normalizeBookingStatusForSlots(latest?.status) === "CANCELLED") {
      const selfService = buildSelfServiceState({
        offerRaw: context.offerRaw,
        booking: latest,
        agenda: context.agenda,
        now: actionAt,
      });
      return {
        changed: false,
        booking: toPublicBooking(latest),
        selfService: {
          ...selfService,
          timeZone: context.agenda?.timezone || DEFAULT_TIMEZONE,
        },
        notifications: null,
      };
    }

    throw conflict(
      "O agendamento foi atualizado por outro processo. Recarregue a página e tente novamente.",
      { code: "BOOKING_CHANGED" },
    );
  }

  const notifications = await notifyBookingChange({
    type: "cancel",
    offerRaw: context.offerRaw,
    bookingBefore: context.booking,
    bookingAfter: updated,
    reason: cleanReason || "",
    timeZone: context.agenda?.timezone || DEFAULT_TIMEZONE,
  });

  const selfService = buildSelfServiceState({
    offerRaw: context.offerRaw,
    booking: updated,
    agenda: context.agenda,
    now: actionAt,
  });

  return {
    changed: true,
    booking: toPublicBooking(updated),
    selfService: {
      ...selfService,
      timeZone: context.agenda?.timezone || DEFAULT_TIMEZONE,
    },
    notifications,
  };
}

export async function notifyWorkspaceBookingChange({
  type,
  offerRaw,
  bookingBefore,
  bookingAfter,
  reason = "",
  timeZone = DEFAULT_TIMEZONE,
}) {
  const notificationContext = await resolveWorkspaceOwnerNotificationContext({
    workspaceId: offerRaw?.workspaceId || null,
  });
  const whatsappCapability = getNotificationFeatureCapability(
    notificationContext,
    "whatsappBookingChanges",
  );
  const whatsappEnabled = whatsappCapability?.available === true;
  const customerName = String(
    bookingAfter?.customerName ||
      bookingBefore?.customerName ||
      offerRaw?.customerName ||
      "Cliente",
  ).trim();
  const serviceName = getServiceName(offerRaw);
  const currentWhen = formatDateTime(
    bookingAfter?.startAt || bookingBefore?.startAt,
    timeZone,
  );
  const previousWhen = formatDateTime(bookingBefore?.startAt, timeZone);
  const nextWhen = formatDateTime(bookingAfter?.startAt, timeZone);
  const first = firstName(customerName);
  const greeting = first ? `Oi, ${first}!` : "Oi!";
  const eventType =
    type === "cancel"
      ? `BOOKING_CANCELLED_BY_WORKSPACE:${String(bookingAfter?._id || bookingBefore?._id || "")}`
      : `BOOKING_RESCHEDULED_BY_WORKSPACE:${String(bookingAfter?._id || bookingBefore?._id || "")}:${dateToIsoString(toDate(bookingAfter?.startAt)) || ""}`;

  const message =
    type === "cancel"
      ? [
          greeting,
          "",
          `Seu agendamento de *${serviceName}* em *${currentWhen}* foi cancelado pela equipe responsavel.`,
          reason ? `*Motivo informado:* ${reason}` : "",
          "",
          "Se precisar reagendar, e so responder esta mensagem.",
        ]
          .filter(Boolean)
          .join("\n")
      : [
          greeting,
          "",
          "Seu agendamento foi atualizado pela equipe responsavel.",
          "",
          `*Servico:* ${serviceName}`,
          `*Antes:* ${previousWhen}`,
          `*Novo horario:* ${nextWhen}`,
          "",
          "Se precisar alinhar mais algum detalhe, e so responder esta mensagem.",
        ]
          .filter(Boolean)
          .join("\n");

  const customerWhatsApp = whatsappEnabled
    ? await sendCustomerWhatsAppNotification({
        offerRaw,
        booking: bookingAfter || bookingBefore,
        eventType,
        message,
        meta: {
          type,
          reason: reason || null,
          initiator: "workspace",
        },
      }).catch((error) => ({
        ok: false,
        status: "FAILED",
        reason: error?.message || "Falha ao enviar WhatsApp",
      }))
    : {
        ok: false,
        skipped: true,
        reason: whatsappCapability?.code || "whatsapp_booking_changes_disabled",
      };

  return {
    eventType,
    notificationSettings: {
      whatsappEnabled,
      whatsappCode: whatsappCapability?.code || "",
    },
    customerWhatsApp,
  };
}
