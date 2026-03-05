// server/src/services/agendaSettings.js

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

export const DEFAULT_AGENDA = {
  timezone: DEFAULT_TIMEZONE,
  slotMinutes: 60,
  defaultSlots: ["09:00", "10:00", "14:00", "16:00", "18:00"],
  weeklyRules: {
    sun: { open: false, mode: "slots", slots: [], intervals: [] },
    mon: {
      open: true,
      mode: "slots",
      slots: ["09:00", "10:00", "14:00", "16:00", "18:00"],
      intervals: [],
    },
    tue: {
      open: true,
      mode: "slots",
      slots: ["09:00", "10:00", "14:00", "16:00", "18:00"],
      intervals: [],
    },
    wed: {
      open: true,
      mode: "slots",
      slots: ["09:00", "10:00", "14:00", "16:00", "18:00"],
      intervals: [],
    },
    thu: {
      open: true,
      mode: "slots",
      slots: ["09:00", "10:00", "14:00", "16:00", "18:00"],
      intervals: [],
    },
    fri: {
      open: true,
      mode: "slots",
      slots: ["09:00", "10:00", "14:00", "16:00", "18:00"],
      intervals: [],
    },
    sat: { open: false, mode: "slots", slots: [], intervals: [] },
  },
  dateBlocks: [],
  dateOverrides: [],
  holidays: [],
};

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  err.status = 400;
  return err;
}

function clampInt(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  const x = Math.trunc(n);
  return Math.max(min, Math.min(max, x));
}

function isYYYYMMDD(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
}

function isHHMM(s) {
  return /^\d{2}:\d{2}$/.test(String(s || "").trim());
}

function parseYMD(dateISO) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateISO || "").trim());
  if (!m) return null;
  return { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) };
}

function parseHHMMToMin(hhmm) {
  if (!isHHMM(hhmm)) return null;
  const [h, m] = String(hhmm).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function fmtMinToHHMM(min) {
  const m = clampInt(min, 0, 24 * 60);
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function uniq(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}

function normalizeSlots(slots) {
  const list = Array.isArray(slots) ? slots : [];
  const cleaned = list
    .map((s) => String(s || "").trim())
    .filter((s) => isHHMM(s) && parseHHMMToMin(s) != null)
    .map((s) => fmtMinToHHMM(parseHHMMToMin(s)));

  const unique = uniq(cleaned);
  unique.sort((a, b) => parseHHMMToMin(a) - parseHHMMToMin(b));
  return unique;
}

function normalizeIntervals(intervals) {
  const list = Array.isArray(intervals) ? intervals : [];
  const out = [];
  for (const it of list) {
    const start = String(it?.start || "").trim();
    const end = String(it?.end || "").trim();
    const sMin = parseHHMMToMin(start);
    const eMin = parseHHMMToMin(end);
    if (sMin == null || eMin == null) continue;
    if (eMin <= sMin) continue;
    out.push({ start: fmtMinToHHMM(sMin), end: fmtMinToHHMM(eMin) });
  }
  return out;
}

function isValidIanaTimeZone(tz) {
  try {
    const z = String(tz || "").trim();
    if (!z) return false;
    Intl.DateTimeFormat("en-US", { timeZone: z }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function normalizeTimeZone(tz) {
  const z = String(tz || "").trim();
  return isValidIanaTimeZone(z) ? z : DEFAULT_TIMEZONE;
}

function normalizeDateISOInput(dateISO, timeZone) {
  const tz = normalizeTimeZone(timeZone);
  const v = dateISO;

  if (typeof v === "string") {
    const s = v.trim();
    if (isYYYYMMDD(s)) return s;
    if (s.length >= 10 && isYYYYMMDD(s.slice(0, 10))) return s.slice(0, 10);
  }

  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(v);

    const map = {};
    for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;
    return `${map.year}-${map.month}-${map.day}`;
  }

  const s2 = String(v || "").trim();
  const d = new Date(s2);
  if (!Number.isNaN(d.getTime())) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(d);

    const map = {};
    for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;
    return `${map.year}-${map.month}-${map.day}`;
  }

  throw badRequest(`Invalid dateISO (expected YYYY-MM-DD): ${String(v)}`);
}

function normalizeHHMMInput(hhmm) {
  const s = String(hhmm || "").trim();
  if (/^\d{2}:\d{2}$/.test(s)) return s;
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s.slice(0, 5);
  throw badRequest(`Invalid hhmm (expected HH:mm): ${String(hhmm)}`);
}

export function zonedTimeToUtc(dateISO, hhmm, timeZone = DEFAULT_TIMEZONE) {
  const tz = normalizeTimeZone(timeZone);
  const ymd = normalizeDateISOInput(dateISO, tz);
  const t = normalizeHHMMInput(hhmm);

  const p = parseYMD(ymd);
  if (!p)
    throw badRequest(
      `Invalid dateISO (expected YYYY-MM-DD): ${String(dateISO)}`,
    );

  const [H, M] = t.split(":").map(Number);
  if (!Number.isFinite(H) || !Number.isFinite(M)) {
    throw badRequest(`Invalid hhmm (expected HH:mm): ${String(hhmm)}`);
  }

  const utcGuess = new Date(Date.UTC(p.y, p.mo - 1, p.d, H, M, 0));
  if (Number.isNaN(utcGuess.getTime())) {
    throw badRequest(
      `Invalid time value (dateISO=${String(dateISO)}, hhmm=${String(hhmm)})`,
    );
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(utcGuess);

  const map = {};
  for (const part of parts)
    if (part.type !== "literal") map[part.type] = part.value;

  const asIfUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );

  const offsetMs = asIfUtc - utcGuess.getTime();
  return new Date(utcGuess.getTime() - offsetMs);
}

function addDaysISO(dateISO, days) {
  const p = parseYMD(dateISO);
  if (!p)
    throw badRequest(
      `Invalid dateISO (expected YYYY-MM-DD): ${String(dateISO)}`,
    );
  const base = new Date(Date.UTC(p.y, p.mo - 1, p.d, 0, 0, 0));
  base.setUTCDate(base.getUTCDate() + Number(days || 0));
  return base.toISOString().slice(0, 10);
}

export function dayRangeInTZ(dateISO, timeZone = DEFAULT_TIMEZONE) {
  const tz = normalizeTimeZone(timeZone);
  const ymd = normalizeDateISOInput(dateISO, tz);

  const dayStart = zonedTimeToUtc(ymd, "00:00", tz);
  const next = addDaysISO(ymd, 1);
  const dayEnd = zonedTimeToUtc(next, "00:00", tz);

  return { dayStart, dayEnd };
}

function isBlockedDate(agenda, dateISO) {
  const blocks = Array.isArray(agenda?.dateBlocks) ? agenda.dateBlocks : [];
  if (blocks.some((b) => String(b?.date || "").trim() === dateISO)) return true;

  const holidays = Array.isArray(agenda?.holidays) ? agenda.holidays : [];
  if (holidays.some((h) => String(h?.date || "").trim() === dateISO))
    return true;

  return false;
}

function dayKeyForDateInTZ(dateISO, timeZone) {
  const tz = normalizeTimeZone(timeZone);
  const ymd = normalizeDateISOInput(dateISO, tz);

  const d = zonedTimeToUtc(ymd, "12:00", tz);
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  })
    .format(d)
    .toLowerCase();

  return DAY_KEYS.includes(wd) ? wd : "mon";
}

// ✅ EXPORTADO (settings.routes.js importa)
export function mergeAgenda(base, patch) {
  const b = base || {};
  const p = patch || {};

  return {
    timezone: normalizeTimeZone(p.timezone ?? b.timezone ?? DEFAULT_TIMEZONE),
    slotMinutes: p.slotMinutes ?? b.slotMinutes ?? DEFAULT_AGENDA.slotMinutes,
    defaultSlots:
      p.defaultSlots ?? b.defaultSlots ?? DEFAULT_AGENDA.defaultSlots,
    weeklyRules: { ...(b.weeklyRules || {}), ...(p.weeklyRules || {}) },
    dateBlocks: p.dateBlocks ?? b.dateBlocks ?? [],
    dateOverrides: p.dateOverrides ?? b.dateOverrides ?? [],
    holidays: p.holidays ?? b.holidays ?? [],
  };
}

// ✅ EXPORTADO (muito comum em settings.routes.js)
export function sanitizeAgendaPatch(input) {
  const raw = input || {};
  const patch = {};

  if (raw.timezone != null) {
    const z = String(raw.timezone || "").trim();
    patch.timezone = isValidIanaTimeZone(z) ? z : DEFAULT_TIMEZONE;
  }

  if (raw.slotMinutes != null)
    patch.slotMinutes = clampInt(raw.slotMinutes, 5, 12 * 60);

  if (raw.defaultSlots != null)
    patch.defaultSlots = normalizeSlots(raw.defaultSlots);

  if (raw.weeklyRules != null && typeof raw.weeklyRules === "object") {
    const wr = {};
    for (const k of DAY_KEYS) {
      if (raw.weeklyRules[k] == null) continue;
      const r = raw.weeklyRules[k] || {};
      const mode = r.mode === "intervals" ? "intervals" : "slots";
      wr[k] = {
        open: r.open === true,
        mode,
        slots: mode === "slots" ? normalizeSlots(r.slots) : [],
        intervals: mode === "intervals" ? normalizeIntervals(r.intervals) : [],
      };
    }
    patch.weeklyRules = wr;
  }

  if (raw.dateBlocks != null) {
    const list = Array.isArray(raw.dateBlocks) ? raw.dateBlocks : [];
    patch.dateBlocks = uniq(
      list
        .map((x) => String(x?.date || "").trim())
        .filter((d) => isYYYYMMDD(d)),
    ).map((date) => ({ date }));
  }

  if (raw.holidays != null) {
    const list = Array.isArray(raw.holidays) ? raw.holidays : [];
    patch.holidays = uniq(
      list
        .map((x) => String(x?.date || "").trim())
        .filter((d) => isYYYYMMDD(d)),
    ).map((date) => ({ date }));
  }

  if (raw.dateOverrides != null) {
    const list = Array.isArray(raw.dateOverrides) ? raw.dateOverrides : [];
    const out = [];
    for (const it of list) {
      const date = String(it?.date || "").trim();
      if (!isYYYYMMDD(date)) continue;

      const closed = it?.closed === true;
      const mode = it?.mode === "intervals" ? "intervals" : "slots";

      out.push({
        date,
        closed,
        mode,
        slots: !closed && mode === "slots" ? normalizeSlots(it?.slots) : [],
        intervals:
          !closed && mode === "intervals"
            ? normalizeIntervals(it?.intervals)
            : [],
      });
    }
    patch.dateOverrides = out;
  }

  return patch;
}

function resolveTimeStringsFromRule(rule, { slotMinutes, durationMin }) {
  if (!rule || rule.open !== true) return [];

  const mode = rule.mode === "intervals" ? "intervals" : "slots";

  if (mode === "slots") return normalizeSlots(rule.slots);

  const intervals = normalizeIntervals(rule.intervals);
  const step = clampInt(slotMinutes, 5, 12 * 60);
  const dur = clampInt(durationMin || 60, 1, 24 * 60);

  const times = [];
  for (const it of intervals) {
    const sMin = parseHHMMToMin(it.start);
    const eMin = parseHHMMToMin(it.end);
    if (sMin == null || eMin == null) continue;

    const lastStart = eMin - dur;
    for (let t = sMin; t <= lastStart; t += step) {
      times.push(fmtMinToHHMM(t));
    }
  }

  return normalizeSlots(times);
}

export function resolveAgendaForDate(
  agendaInput,
  dateISO,
  { durationMin } = {},
) {
  const agenda = mergeAgenda(DEFAULT_AGENDA, agendaInput || {});
  const tz = normalizeTimeZone(agenda.timezone || DEFAULT_TIMEZONE);
  agenda.timezone = tz;

  const ymd = isYYYYMMDD(String(dateISO || ""))
    ? String(dateISO).trim()
    : normalizeDateISOInput(dateISO, tz);

  if (isBlockedDate(agenda, ymd)) {
    return { slots: [], isWorkingDay: false, ruleApplied: "blocked" };
  }

  const overrides = Array.isArray(agenda.dateOverrides)
    ? agenda.dateOverrides
    : [];
  const ov = overrides.find((x) => String(x?.date || "").trim() === ymd);
  if (ov) {
    if (ov.closed === true)
      return {
        slots: [],
        isWorkingDay: false,
        ruleApplied: "dateOverride.closed",
      };

    const mode = ov.mode === "intervals" ? "intervals" : "slots";
    const slots = resolveTimeStringsFromRule(
      { open: true, mode, slots: ov.slots, intervals: ov.intervals },
      { slotMinutes: agenda.slotMinutes, durationMin },
    );

    return {
      slots,
      isWorkingDay: slots.length > 0,
      ruleApplied: "dateOverride",
    };
  }

  const dk = dayKeyForDateInTZ(ymd, tz);
  const rule = (agenda.weeklyRules && agenda.weeklyRules[dk]) || null;

  const slotsFromRule = resolveTimeStringsFromRule(rule, {
    slotMinutes: agenda.slotMinutes,
    durationMin,
  });

  if (slotsFromRule.length > 0) {
    return {
      slots: slotsFromRule,
      isWorkingDay: true,
      ruleApplied: `weekly.${dk}`,
    };
  }

  const fallbackSlots = normalizeSlots(agenda.defaultSlots);
  return {
    slots: fallbackSlots,
    isWorkingDay: fallbackSlots.length > 0,
    ruleApplied: "defaultSlots",
  };
}

/** buildSlotsForDate compatível (assinatura antiga por objeto + nova por params) */

function isPlainObject(v) {
  return (
    v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)
  );
}

function buildSlotsForDateCore(
  dateISO,
  timeStrings,
  durationMin,
  timeZone = DEFAULT_TIMEZONE,
) {
  const tz = normalizeTimeZone(timeZone);
  const ymd = normalizeDateISOInput(dateISO, tz);

  const dur = clampInt(durationMin || 60, 1, 24 * 60);
  const times = normalizeSlots(timeStrings);

  const { dayEnd } = dayRangeInTZ(ymd, tz);

  const out = [];
  for (const hhmm of times) {
    const start = zonedTimeToUtc(ymd, hhmm, tz);
    const end = new Date(start.getTime() + dur * 60 * 1000);
    if (end.getTime() > dayEnd.getTime()) continue;

    out.push({
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      status: "FREE",
    });
  }

  return out;
}

export function buildSlotsForDate(a, b, c, d) {
  if (
    isPlainObject(a) &&
    (a.date || a.dateISO || a.dayAgenda || a.tz || a.timezone)
  ) {
    const dateISO = a.dateISO || a.date;
    const tz = a.tz || a.timezone || a.timeZone || DEFAULT_TIMEZONE;
    const durationMin = a.durationMin || a.duration || 60;

    const slots =
      (a.dayAgenda && Array.isArray(a.dayAgenda.slots) && a.dayAgenda.slots) ||
      (Array.isArray(a.slots) && a.slots) ||
      (Array.isArray(a.timeStrings) && a.timeStrings) ||
      [];

    return buildSlotsForDateCore(dateISO, slots, durationMin, tz);
  }

  return buildSlotsForDateCore(a, b, c, d);
}
