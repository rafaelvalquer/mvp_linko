import Booking from "../../models/Booking.js";
import { AppSettings } from "../../models/AppSettings.js";
import {
  buildSlotsForDate,
  dayRangeInTZ,
  DEFAULT_AGENDA,
  mergeAgenda,
  resolveAgendaForDate,
  zonedTimeToUtc,
} from "../agendaSettings.js";
import { notifyWorkspaceBookingChange } from "../publicBookingSelfService.service.js";

function normalizeComparableText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeTimeZone(value) {
  return String(value || "").trim() || DEFAULT_AGENDA.timezone || "America/Sao_Paulo";
}

function toDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDateIsoForTimeZone(value, timeZone) {
  const date = toDate(value);
  if (!date) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: normalizeTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return map.year && map.month && map.day
    ? `${map.year}-${map.month}-${map.day}`
    : "";
}

function formatDateTime(value, timeZone) {
  const date = toDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: normalizeTimeZone(timeZone),
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatTime(value, timeZone) {
  const date = toDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: normalizeTimeZone(timeZone),
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeBookingStatus(value) {
  const status = String(value || "").trim().toUpperCase();
  if (status === "CANCELED") return "CANCELLED";
  return status;
}

function buildBookingCandidate(doc, timeZone) {
  const startAt = toDate(doc?.startAt);
  const endAt = toDate(doc?.endAt);
  const customerName = String(doc?.customerName || "").trim() || "Cliente";
  const offerTitle = String(doc?.offerId?.title || "").trim() || "Servico";
  const startLabel = formatDateTime(startAt, timeZone);

  return {
    bookingId: doc?._id ? String(doc._id) : "",
    offerId: doc?.offerId?._id ? String(doc.offerId._id) : "",
    ownerUserId: doc?.ownerUserId ? String(doc.ownerUserId) : "",
    customerName,
    offerTitle,
    status: normalizeBookingStatus(doc?.status),
    startAt,
    endAt,
    timeZone,
    displayLabel: `${startLabel} - ${customerName} - ${offerTitle}`,
    score: 0,
  };
}

async function loadAgendaForWorkspace(workspaceId) {
  const doc = workspaceId
    ? await AppSettings.findOne({ workspaceId }).select("agenda").lean().catch(() => null)
    : null;
  return mergeAgenda(DEFAULT_AGENDA, doc?.agenda || {});
}

async function loadBookingContext({ bookingId, workspaceId }) {
  const booking = await Booking.findOne({
    _id: bookingId,
    workspaceId,
  })
    .populate("offerId", "_id title publicToken customerName customerEmail customerWhatsApp workspaceId ownerUserId sellerEmail")
    .lean();

  if (!booking) {
    const err = new Error("Agendamento nao encontrado.");
    err.code = "BOOKING_NOT_FOUND";
    throw err;
  }

  const offerRaw = booking.offerId || null;
  if (!offerRaw?._id) {
    const err = new Error("Oferta vinculada ao agendamento nao encontrada.");
    err.code = "BOOKING_OFFER_NOT_FOUND";
    throw err;
  }

  const agenda = await loadAgendaForWorkspace(workspaceId);
  return {
    booking,
    offerRaw,
    agenda,
    timeZone: normalizeTimeZone(agenda?.timezone),
  };
}

function scoreCandidate(candidate, { targetCustomerName, targetDateIso, targetTimeHhmm }) {
  let score = 0;
  const normalizedCustomer = normalizeComparableText(targetCustomerName);
  const candidateCustomer = normalizeComparableText(candidate.customerName);

  if (normalizedCustomer) {
    if (candidateCustomer === normalizedCustomer) score += 6;
    else if (candidateCustomer.includes(normalizedCustomer)) score += 4;
    else return -1;
  }

  if (targetDateIso) {
    const candidateDateIso = getDateIsoForTimeZone(candidate.startAt, candidate.timeZone);
    if (candidateDateIso === targetDateIso) score += 4;
    else return -1;
  }

  if (targetTimeHhmm) {
    const candidateTime = formatTime(candidate.startAt, candidate.timeZone);
    if (candidateTime === targetTimeHhmm) score += 3;
    else return -1;
  }

  return score;
}

export async function listUpcomingBookingCandidates({
  workspaceId,
  from = new Date(),
  limit = 20,
}) {
  const agenda = await loadAgendaForWorkspace(workspaceId);
  const timeZone = normalizeTimeZone(agenda?.timezone);
  const docs = await Booking.find({
    workspaceId,
    status: { $in: ["HOLD", "CONFIRMED"] },
    startAt: { $gte: toDate(from) || new Date() },
  })
    .sort({ startAt: 1 })
    .limit(limit)
    .populate("offerId", "_id title publicToken")
    .lean();

  return docs.map((doc) => buildBookingCandidate(doc, timeZone));
}

export async function resolveBookingCandidates({
  workspaceId,
  targetCustomerName = "",
  targetDateIso = "",
  targetTimeHhmm = "",
  targetReference = "unspecified",
  now = new Date(),
  limit = 5,
}) {
  const candidates = await listUpcomingBookingCandidates({
    workspaceId,
    from: now,
    limit: Math.max(limit * 4, 20),
  });

  if (targetReference === "next") {
    return candidates.slice(0, 1);
  }

  const scored = candidates
    .map((candidate) => ({
      ...candidate,
      score: scoreCandidate(candidate, {
        targetCustomerName,
        targetDateIso,
        targetTimeHhmm,
      }),
    }))
    .filter((candidate) => candidate.score >= 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return new Date(left.startAt).getTime() - new Date(right.startAt).getTime();
    });

  if (scored.length) return scored.slice(0, limit);
  return candidates.slice(0, limit);
}

export function pickBookingCandidateByOrdinal(text, candidates = []) {
  const match = String(text || "").trim().match(/^(\d{1,2})$/);
  if (!match) return null;
  const index = Number(match[1]) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= candidates.length) {
    return null;
  }
  return candidates[index] || null;
}

export function resolveNextBookingSchedule({
  booking,
  newDateIso = "",
  newTimeHhmm = "",
  timeZone,
}) {
  const currentStart = toDate(booking?.startAt);
  const currentEnd = toDate(booking?.endAt);
  if (!currentStart || !currentEnd) return null;

  const effectiveDateIso =
    String(newDateIso || "").trim() || getDateIsoForTimeZone(currentStart, timeZone);
  const effectiveTimeHhmm = String(newTimeHhmm || "").trim();
  if (!effectiveDateIso || !effectiveTimeHhmm) return null;

  const startAt = zonedTimeToUtc(effectiveDateIso, effectiveTimeHhmm, timeZone);
  const durationMs = currentEnd.getTime() - currentStart.getTime();
  const endAt = new Date(startAt.getTime() + durationMs);

  return {
    dateISO: effectiveDateIso,
    timeHhmm: effectiveTimeHhmm,
    startAt,
    endAt,
  };
}

export async function previewBookingReschedule({
  bookingId,
  workspaceId,
  startAt,
  endAt,
  now = new Date(),
}) {
  const context = await loadBookingContext({ bookingId, workspaceId });
  const booking = context.booking;
  const currentStart = toDate(booking?.startAt);
  const currentEnd = toDate(booking?.endAt);
  const nextStart = toDate(startAt);
  const nextEnd = toDate(endAt);

  if (!nextStart || !nextEnd || nextEnd <= nextStart) {
    const err = new Error("Novo horario invalido.");
    err.code = "INVALID_NEW_BOOKING_TIME";
    throw err;
  }

  const currentStatus = normalizeBookingStatus(booking?.status);
  if (!["HOLD", "CONFIRMED"].includes(currentStatus)) {
    const err = new Error("Somente agendamentos HOLD ou CONFIRMED podem ser reagendados.");
    err.code = "BOOKING_STATUS_NOT_ALLOWED";
    throw err;
  }

  if (
    currentStart &&
    currentEnd &&
    currentStart.getTime() === nextStart.getTime() &&
    currentEnd.getTime() === nextEnd.getTime()
  ) {
    const err = new Error("O novo horario precisa ser diferente do horario atual.");
    err.code = "BOOKING_SAME_SCHEDULE";
    throw err;
  }

  const durationMin = Math.round((currentEnd.getTime() - currentStart.getTime()) / 60000);
  const targetDateIso = getDateIsoForTimeZone(nextStart, context.timeZone);
  const { dayStart, dayEnd } = dayRangeInTZ(targetDateIso, context.timeZone);

  const busy = await Booking.find({
    workspaceId,
    ownerUserId: booking.ownerUserId,
    _id: { $ne: booking._id },
    startAt: { $gte: dayStart, $lt: dayEnd },
    status: { $in: ["HOLD", "CONFIRMED"] },
  })
    .select("_id startAt endAt")
    .lean();

  const busyRanges = (busy || []).map((item) => ({
    startAt: toDate(item.startAt),
    endAt: toDate(item.endAt),
  }));

  const overlaps = busyRanges.some((range) => {
    if (!range.startAt || !range.endAt) return false;
    return nextStart < range.endAt && nextEnd > range.startAt;
  });
  if (overlaps) {
    const err = new Error("Esse horario nao esta disponivel na agenda.");
    err.code = "BOOKING_SLOT_CONFLICT";
    throw err;
  }

  const dayAgenda = resolveAgendaForDate(context.agenda, targetDateIso, {
    durationMin,
  });
  const slots = buildSlotsForDate({
    dayAgenda,
    date: targetDateIso,
    durationMin,
    tz: context.timeZone,
  });

  const slotMatch = slots.find((slot) => {
    const slotStart = toDate(slot.startAt);
    const slotEnd = toDate(slot.endAt);
    return (
      slotStart &&
      slotEnd &&
      slotStart.getTime() === nextStart.getTime() &&
      slotEnd.getTime() === nextEnd.getTime()
    );
  });

  if (!slotMatch) {
    const err = new Error("Esse horario nao pertence a agenda configurada para o dia.");
    err.code = "BOOKING_SLOT_OUTSIDE_AGENDA";
    throw err;
  }

  return {
    ...context,
    booking,
    currentStart,
    currentEnd,
    nextStart,
    nextEnd,
  };
}

export async function rescheduleBookingByWorkspace({
  bookingId,
  workspaceId,
  startAt,
  endAt,
  now = new Date(),
}) {
  const preview = await previewBookingReschedule({
    bookingId,
    workspaceId,
    startAt,
    endAt,
    now,
  });
  const actionAt = toDate(now) || new Date();

  const updated = await Booking.findOneAndUpdate(
    {
      _id: preview.booking._id,
      workspaceId,
      updatedAt: preview.booking.updatedAt,
      status: { $in: ["HOLD", "CONFIRMED"] },
    },
    {
      $set: {
        startAt: preview.nextStart,
        endAt: preview.nextEnd,
      },
      $push: {
        changeHistory: {
          action: "reschedule",
          actor: "workspace",
          changedAt: actionAt,
          fromStartAt: preview.currentStart,
          fromEndAt: preview.currentEnd,
          toStartAt: preview.nextStart,
          toEndAt: preview.nextEnd,
          reason: null,
        },
      },
    },
    { new: true, strict: false },
  ).lean();

  if (!updated) {
    const err = new Error("O agendamento foi alterado por outro processo. Tente novamente.");
    err.code = "BOOKING_CHANGED";
    throw err;
  }

  const notifications = await notifyWorkspaceBookingChange({
    type: "reschedule",
    offerRaw: preview.offerRaw,
    bookingBefore: preview.booking,
    bookingAfter: updated,
    timeZone: preview.timeZone,
  });

  return {
    booking: updated,
    offerRaw: preview.offerRaw,
    timeZone: preview.timeZone,
    notifications,
  };
}

export async function cancelBookingByWorkspace({
  bookingId,
  workspaceId,
  reason = "",
  now = new Date(),
}) {
  const context = await loadBookingContext({ bookingId, workspaceId });
  const status = normalizeBookingStatus(context.booking?.status);
  if (!["HOLD", "CONFIRMED"].includes(status)) {
    const err = new Error("Somente agendamentos HOLD ou CONFIRMED podem ser cancelados.");
    err.code = "BOOKING_STATUS_NOT_ALLOWED";
    throw err;
  }

  const actionAt = toDate(now) || new Date();
  const cleanReason = String(reason || "").trim().slice(0, 1000) || null;
  const updated = await Booking.findOneAndUpdate(
    {
      _id: context.booking._id,
      workspaceId,
      updatedAt: context.booking.updatedAt,
      status: { $in: ["HOLD", "CONFIRMED"] },
    },
    {
      $set: {
        status: "CANCELLED",
        cancelledAt: actionAt,
        cancelledBy: "workspace",
        cancelReason: cleanReason,
      },
      $push: {
        changeHistory: {
          action: "cancel",
          actor: "workspace",
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
    const err = new Error("O agendamento foi alterado por outro processo. Tente novamente.");
    err.code = "BOOKING_CHANGED";
    throw err;
  }

  const notifications = await notifyWorkspaceBookingChange({
    type: "cancel",
    offerRaw: context.offerRaw,
    bookingBefore: context.booking,
    bookingAfter: updated,
    reason: cleanReason || "",
    timeZone: context.timeZone,
  });

  return {
    booking: updated,
    offerRaw: context.offerRaw,
    timeZone: context.timeZone,
    notifications,
  };
}
