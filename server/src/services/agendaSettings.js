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

function isYYYYMMDD(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
}
function isHHMM(s) {
  return /^\d{2}:\d{2}$/.test(String(s || "").trim());
}
function clampInt(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  const x = Math.trunc(n);
  return Math.max(min, Math.min(max, x));
}
function uniq(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}

function parseHHMMToMin(hhmm) {
  if (!isHHMM(hhmm)) return null;
  const [h, m] = String(hhmm)
    .split(":")
    .map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23) return null;
  if (m < 0 || m > 59) return null;
  return h * 60 + m;
}

function fmtMinToHHMM(min) {
  const m = clampInt(min, 0, 24 * 60);
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
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

function normalizeSlots(slots) {
  const list = Array.isArray(slots) ? slots : [];
  const cleaned = list
    .map((s) => String(s || "").trim())
    .filter((s) => isHHMM(s) && parseHHMMToMin(s) != null)
    .map((s) => fmtMinToHHMM(parseHHMMToMin(s)));

  // ordena e remove duplicados
  const unique = uniq(cleaned);
  unique.sort((a, b) => parseHHMMToMin(a) - parseHHMMToMin(b));
  return unique;
}

function dayKeyForDateInTZ(dateISO, timeZone) {
  // usa meio-dia para evitar edge-case de mudança de data
  const d = zonedTimeToUtc(dateISO, "12:00", timeZone);
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  })
    .format(d)
    .toLowerCase(); // "mon"
  return DAY_KEYS.includes(wd) ? wd : "mon";
}

export function mergeAgenda(base, patch) {
  const b = base || {};
  const p = patch || {};

  const out = {
    timezone: p.timezone ?? b.timezone ?? DEFAULT_AGENDA.timezone,
    slotMinutes: p.slotMinutes ?? b.slotMinutes ?? DEFAULT_AGENDA.slotMinutes,
    defaultSlots:
      p.defaultSlots ?? b.defaultSlots ?? DEFAULT_AGENDA.defaultSlots,
    weeklyRules: { ...(b.weeklyRules || {}), ...(p.weeklyRules || {}) },
    dateBlocks: p.dateBlocks ?? b.dateBlocks ?? [],
    dateOverrides: p.dateOverrides ?? b.dateOverrides ?? [],
    holidays: p.holidays ?? b.holidays ?? [],
  };

  return out;
}

export function sanitizeAgendaPatch(input) {
  const raw = input || {};
  const patch = {};

  if (raw.timezone != null)
    patch.timezone = String(raw.timezone || "").trim() || DEFAULT_TIMEZONE;

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
    const out = [];
    for (const it of list) {
      const date = String(it?.date || "").trim();
      if (!isYYYYMMDD(date)) continue;
      out.push({ date, reason: String(it?.reason || "").trim() || undefined });
    }
    // unique por date
    const seen = new Set();
    patch.dateBlocks = out.filter((x) =>
      seen.has(x.date) ? false : (seen.add(x.date), true),
    );
  }

  if (raw.holidays != null) {
    const list = Array.isArray(raw.holidays) ? raw.holidays : [];
    const out = [];
    for (const it of list) {
      const date = String(it?.date || "").trim();
      if (!isYYYYMMDD(date)) continue;
      out.push({ date, name: String(it?.name || "").trim() || undefined });
    }
    const seen = new Set();
    patch.holidays = out.filter((x) =>
      seen.has(x.date) ? false : (seen.add(x.date), true),
    );
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
    const seen = new Set();
    patch.dateOverrides = out.filter((x) =>
      seen.has(x.date) ? false : (seen.add(x.date), true),
    );
  }

  return patch;
}

function isBlockedDate(agenda, dateISO) {
  const blocks = Array.isArray(agenda?.dateBlocks) ? agenda.dateBlocks : [];
  if (blocks.some((b) => String(b?.date || "").trim() === dateISO)) return true;

  const holidays = Array.isArray(agenda?.holidays) ? agenda.holidays : [];
  if (holidays.some((h) => String(h?.date || "").trim() === dateISO))
    return true;

  return false;
}

function resolveTimeStringsFromRule(rule, { slotMinutes, durationMin }) {
  if (!rule || rule.open !== true) return [];

  const mode = rule.mode === "intervals" ? "intervals" : "slots";

  if (mode === "slots") {
    return normalizeSlots(rule.slots);
  }

  // intervals => gerar start times por slotMinutes, respeitando durationMin
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

/**
 * resolveAgendaForDate(agenda, dateISO, {durationMin})
 * - aplica: dateBlocks/holidays -> fechado
 * - aplica: dateOverrides -> override tem prioridade
 * - aplica: weeklyRules -> regra do dia da semana
 * - fallback: defaultSlots (compat)
 */
export function resolveAgendaForDate(
  agendaInput,
  dateISO,
  { durationMin } = {},
) {
  const agenda = mergeAgenda(DEFAULT_AGENDA, agendaInput || {});
  const tz = agenda.timezone || DEFAULT_TIMEZONE;

  if (!isYYYYMMDD(dateISO)) {
    return {
      slots: normalizeSlots(agenda.defaultSlots),
      isWorkingDay: true,
      ruleApplied: "defaultSlots",
    };
  }

  if (isBlockedDate(agenda, dateISO)) {
    return { slots: [], isWorkingDay: false, ruleApplied: "blocked" };
  }

  const overrides = Array.isArray(agenda.dateOverrides)
    ? agenda.dateOverrides
    : [];
  const ov = overrides.find((x) => String(x?.date || "").trim() === dateISO);
  if (ov) {
    if (ov.closed === true) {
      return {
        slots: [],
        isWorkingDay: false,
        ruleApplied: "dateOverride.closed",
      };
    }
    const slots = resolveTimeStringsFromRule(
      { open: true, mode: ov.mode, slots: ov.slots, intervals: ov.intervals },
      { slotMinutes: agenda.slotMinutes, durationMin },
    );
    return {
      slots,
      isWorkingDay: slots.length > 0,
      ruleApplied: "dateOverride",
    };
  }

  const dk = dayKeyForDateInTZ(dateISO, tz);
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

  // fallback compat
  const fallbackSlots = normalizeSlots(agenda.defaultSlots);
  return {
    slots: fallbackSlots,
    isWorkingDay: fallbackSlots.length > 0,
    ruleApplied: "defaultSlots",
  };
}

/**
 * Converte (dateISO + HH:mm) interpretado no timeZone para Date em UTC.
 * Sem libs externas.
 */
export function zonedTimeToUtc(dateISO, hhmm, timeZone = DEFAULT_TIMEZONE) {
  const [y, mo, d] = String(dateISO)
    .split("-")
    .map((x) => Number(x));
  const [hh, mm] = String(hhmm)
    .split(":")
    .map((x) => Number(x));
  const utcGuess = new Date(Date.UTC(y, mo - 1, d, hh, mm, 0));

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(utcGuess);

  const map = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }

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
  const base = new Date(`${dateISO}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export function dayRangeInTZ(dateISO, timeZone = DEFAULT_TIMEZONE) {
  const start = zonedTimeToUtc(dateISO, "00:00", timeZone);
  const next = addDaysISO(dateISO, 1);
  const end = zonedTimeToUtc(next, "00:00", timeZone);
  return { dayStart: start, dayEnd: end };
}

export function buildSlotsForDate(
  dateISO,
  timeStrings,
  durationMin,
  timeZone = DEFAULT_TIMEZONE,
) {
  const dur = clampInt(durationMin || 60, 1, 24 * 60);
  const times = normalizeSlots(timeStrings);

  const { dayEnd } = dayRangeInTZ(dateISO, timeZone);

  const out = [];
  for (const hhmm of times) {
    const start = zonedTimeToUtc(dateISO, hhmm, timeZone);
    const end = new Date(start.getTime() + dur * 60 * 1000);

    // não atravessar o dia local
    if (end.getTime() > dayEnd.getTime()) continue;

    out.push({
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      status: "FREE",
    });
  }

  return out;
}
