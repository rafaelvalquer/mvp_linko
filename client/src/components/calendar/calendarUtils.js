const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const FALLBACK_START_MINUTES = 8 * 60;
const FALLBACK_END_MINUTES = 20 * 60;
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function asUtcNoon(day) {
  const value = String(day || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildDateKey(parts) {
  if (!parts?.year || !parts?.month || !parts?.day) return "";
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getDateParts(value, timeZone, extra = {}) {
  const date = safeDate(value);
  if (!date) return null;

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: getCalendarTimeZone(timeZone),
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      ...extra,
    }).formatToParts(date);

    return parts.reduce((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});
  } catch {
    return null;
  }
}

function floorToHalfHour(minute) {
  return Math.floor(minute / 30) * 30;
}

function ceilToHalfHour(minute) {
  return Math.ceil(minute / 30) * 30;
}

function normalizeSlotMinutes(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0) return 60;
  return Math.min(240, Math.max(15, Math.round(minutes)));
}

function normalizeSlots(slots) {
  return [...new Set((Array.isArray(slots) ? slots : []).filter(isHHmm))].sort(
    (a, b) => parseHHmmToMinutes(a) - parseHHmmToMinutes(b),
  );
}

function getEventBounds(items, day, timeZone, slotMinutes) {
  let minStart = Infinity;
  let maxEnd = -Infinity;

  for (const item of items || []) {
    const start = safeDate(item?.startAt);
    const end = safeDate(item?.endAt);
    if (!start || !end) continue;
    if (formatDateKey(start, timeZone) !== day) continue;

    const startMin = getMinutesOfDay(start, timeZone);
    const endMin = getMinutesOfDay(end, timeZone);
    if (!Number.isFinite(startMin) || !Number.isFinite(endMin)) continue;

    minStart = Math.min(minStart, startMin);
    maxEnd = Math.max(maxEnd, endMin > startMin ? endMin : startMin + slotMinutes);
  }

  if (!Number.isFinite(minStart) || !Number.isFinite(maxEnd)) return null;

  return {
    startMin: floorToHalfHour(minStart),
    endMin: ceilToHalfHour(maxEnd),
  };
}

export function safeDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getCalendarTimeZone(value) {
  const timeZone = String(value || "").trim() || DEFAULT_TIMEZONE;

  try {
    Intl.DateTimeFormat("pt-BR", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

export function formatDateKey(value, timeZone = DEFAULT_TIMEZONE) {
  return buildDateKey(getDateParts(value, timeZone));
}

export function getTodayDateKey(timeZone = DEFAULT_TIMEZONE) {
  return formatDateKey(new Date(), timeZone) || new Date().toISOString().slice(0, 10);
}

export function shiftDateKey(day, delta) {
  const base = asUtcNoon(day);
  if (!base) return day;
  base.setUTCDate(base.getUTCDate() + Number(delta || 0));
  return base.toISOString().slice(0, 10);
}

export function formatDayLabel(day, options = {}) {
  const date = asUtcNoon(day);
  if (!date) return String(day || "");

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    ...options,
  }).format(date);
}

export function formatTime(value, timeZone = DEFAULT_TIMEZONE) {
  const date = safeDate(value);
  if (!date) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: getCalendarTimeZone(timeZone),
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDate(value, timeZone = DEFAULT_TIMEZONE, options = {}) {
  const date = safeDate(value);
  if (!date) return "";

  const config = Object.keys(options).length ? options : { dateStyle: "short" };
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: getCalendarTimeZone(timeZone),
    ...config,
  }).format(date);
}

export function formatDateTime(
  value,
  timeZone = DEFAULT_TIMEZONE,
  options = {},
) {
  const date = safeDate(value);
  if (!date) return "";

  const config = Object.keys(options).length
    ? options
    : {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      };

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: getCalendarTimeZone(timeZone),
    ...config,
  }).format(date);
}

export function getMinutesOfDay(value, timeZone = DEFAULT_TIMEZONE) {
  const parts = getDateParts(value, timeZone, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  if (!parts?.hour || !parts?.minute) return null;

  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;

  return hour * 60 + minute;
}

export function holdRemaining(holdExpiresAt, nowMs = Date.now()) {
  const date = safeDate(holdExpiresAt);
  if (!date) return null;

  const minutes = Math.floor((date.getTime() - nowMs) / 60000);
  if (minutes <= 0) return { label: "HOLD expirado", tone: "text-red-700" };
  if (minutes === 1) return { label: "Expira em 1 min", tone: "text-amber-900" };
  return { label: `Expira em ${minutes} min`, tone: "text-amber-900" };
}

export function isHHmm(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || "").trim());
}

export function parseHHmmToMinutes(value) {
  if (!isHHmm(value)) return null;
  const [hour, minute] = String(value).split(":").map(Number);
  return hour * 60 + minute;
}

export function formatMinutesLabel(totalMinutes) {
  const safeMinutes = Math.max(0, Math.min(24 * 60, Math.round(totalMinutes)));
  const hour = String(Math.floor(safeMinutes / 60)).padStart(2, "0");
  const minute = String(safeMinutes % 60).padStart(2, "0");
  return `${hour}:${minute}`;
}

export function getWeekDayKey(day) {
  const date = asUtcNoon(day);
  if (!date) return "mon";
  return DAY_KEYS[date.getUTCDay()] || "mon";
}

export function getVisibleRange(
  agendaSettings,
  day,
  items = [],
  timeZone = DEFAULT_TIMEZONE,
) {
  const slotMinutes = normalizeSlotMinutes(agendaSettings?.slotMinutes);
  const weeklyRule = agendaSettings?.weeklyRules?.[getWeekDayKey(day)];
  const weeklySlots = weeklyRule?.open ? normalizeSlots(weeklyRule?.slots) : [];
  const defaultSlots = normalizeSlots(agendaSettings?.defaultSlots);
  const configuredSlots = weeklySlots.length ? weeklySlots : defaultSlots;

  let startMin = FALLBACK_START_MINUTES;
  let endMin = FALLBACK_END_MINUTES;
  let source = "fallback";

  if (configuredSlots.length) {
    const slotMinutesList = configuredSlots
      .map(parseHHmmToMinutes)
      .filter(Number.isFinite);

    if (slotMinutesList.length) {
      startMin = floorToHalfHour(Math.min(...slotMinutesList));
      endMin = ceilToHalfHour(Math.max(...slotMinutesList) + slotMinutes);
      source = weeklySlots.length ? "weeklyRules" : "defaultSlots";
    }
  }

  const eventBounds = getEventBounds(items, day, timeZone, slotMinutes);
  if (eventBounds) {
    startMin = Math.min(startMin, eventBounds.startMin);
    endMin = Math.max(endMin, eventBounds.endMin);
    if (source === "fallback") source = "events";
  }

  if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) {
    return {
      startMin: FALLBACK_START_MINUTES,
      endMin: FALLBACK_END_MINUTES,
      slotMinutes,
      source: "fallback",
    };
  }

  return {
    startMin: Math.max(0, startMin),
    endMin: Math.min(24 * 60, Math.max(endMin, startMin + slotMinutes)),
    slotMinutes,
    source,
  };
}
