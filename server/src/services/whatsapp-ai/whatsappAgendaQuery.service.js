import Booking from "../../models/Booking.js";
import { AppSettings } from "../../models/AppSettings.js";
import {
  DEFAULT_TIMEZONE,
  dayRangeInTZ,
} from "../agendaSettings.js";

function normalizeTimeZone(value) {
  const timeZone = String(value || "").trim();
  return timeZone || DEFAULT_TIMEZONE;
}

function getDatePartsInTimeZone(date, timeZone = DEFAULT_TIMEZONE) {
  const currentDate = date instanceof Date ? date : new Date(date);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: normalizeTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(currentDate);
  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }

  return {
    year: String(map.year || ""),
    month: String(map.month || ""),
    day: String(map.day || ""),
  };
}

export function getDateIsoForTimeZone(date, timeZone = DEFAULT_TIMEZONE) {
  const parts = getDatePartsInTimeZone(date, timeZone);
  if (!parts.year || !parts.month || !parts.day) return "";
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function shiftDateIso(dateISO, days = 0) {
  const value = String(dateISO || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";

  const base = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(base.getTime())) return "";
  base.setUTCDate(base.getUTCDate() + Number(days || 0));
  return base.toISOString().slice(0, 10);
}

export function resolveAgendaQueryDate({
  requestedDayKind,
  requestedDateIso,
  now = new Date(),
  timeZone = DEFAULT_TIMEZONE,
} = {}) {
  const todayIso = getDateIsoForTimeZone(now, timeZone);

  if (requestedDayKind === "explicit_date" && /^\d{4}-\d{2}-\d{2}$/.test(String(requestedDateIso || "").trim())) {
    return String(requestedDateIso || "").trim();
  }

  if (requestedDayKind === "tomorrow") {
    return shiftDateIso(todayIso, 1) || todayIso;
  }

  return todayIso;
}

function formatAgendaDate(dateISO, timeZone = DEFAULT_TIMEZONE) {
  const date = new Date(`${String(dateISO || "").trim()}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return String(dateISO || "").trim();

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: normalizeTimeZone(timeZone),
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function buildAgendaDayLabel({
  requestedDayKind,
  dateISO,
  now = new Date(),
  timeZone = DEFAULT_TIMEZONE,
} = {}) {
  const todayIso = getDateIsoForTimeZone(now, timeZone);
  const tomorrowIso = shiftDateIso(todayIso, 1);

  if (requestedDayKind === "today") return "hoje";
  if (requestedDayKind === "tomorrow") return "amanha";
  if (requestedDayKind === "explicit_date") {
    return formatAgendaDate(dateISO, timeZone);
  }

  if (dateISO && dateISO === todayIso) return "hoje";
  if (dateISO && dateISO === tomorrowIso) return "amanha";
  if (dateISO) return formatAgendaDate(dateISO, timeZone);
  return "hoje";
}

function formatTime(value, timeZone = DEFAULT_TIMEZONE) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: normalizeTimeZone(timeZone),
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeBookingStatus(value) {
  const status = String(value || "").trim().toUpperCase();
  if (status === "CONFIRMED") return "CONFIRMED";
  return "HOLD";
}

export async function getWorkspaceAgendaTimeZone(workspaceId) {
  if (!workspaceId) return DEFAULT_TIMEZONE;

  try {
    const settings = await AppSettings.findOne({ workspaceId })
      .select("agenda.timezone")
      .lean();

    return normalizeTimeZone(settings?.agenda?.timezone || DEFAULT_TIMEZONE);
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

export async function loadDailyAgendaForWorkspace({
  workspaceId,
  dateISO,
  timeZone = DEFAULT_TIMEZONE,
}) {
  const effectiveTimeZone = normalizeTimeZone(timeZone);
  const resolvedDateIso =
    /^\d{4}-\d{2}-\d{2}$/.test(String(dateISO || "").trim())
      ? String(dateISO || "").trim()
      : getDateIsoForTimeZone(new Date(), effectiveTimeZone);
  const { dayStart, dayEnd } = dayRangeInTZ(resolvedDateIso, effectiveTimeZone);

  const docs = await Booking.find({
    workspaceId,
    startAt: {
      $gte: dayStart,
      $lt: dayEnd,
    },
    status: { $in: ["HOLD", "CONFIRMED"] },
  })
    .sort({ startAt: 1 })
    .populate("offerId", "_id title publicToken")
    .lean();

  const items = (docs || []).map((booking) => {
    const status = normalizeBookingStatus(booking?.status);

    return {
      bookingId: booking?._id ? String(booking._id) : "",
      startAt: booking?.startAt || null,
      endAt: booking?.endAt || null,
      timeLabel: `${formatTime(booking?.startAt, effectiveTimeZone)} - ${formatTime(
        booking?.endAt,
        effectiveTimeZone,
      )}`,
      status,
      statusLabel: status === "CONFIRMED" ? "Confirmado" : "Reserva",
      customerName: String(booking?.customerName || "").trim() || "Cliente",
      offerTitle: String(booking?.offerId?.title || "").trim() || "Servico",
      publicToken: String(booking?.offerId?.publicToken || "").trim(),
    };
  });

  const summary = items.reduce(
    (acc, item) => {
      acc.total += 1;
      if (item.status === "CONFIRMED") acc.confirmed += 1;
      if (item.status === "HOLD") acc.hold += 1;
      return acc;
    },
    { confirmed: 0, hold: 0, total: 0 },
  );

  return {
    timeZone: effectiveTimeZone,
    dateISO: resolvedDateIso,
    summary,
    items,
  };
}
