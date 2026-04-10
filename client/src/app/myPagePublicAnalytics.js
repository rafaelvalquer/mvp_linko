import { API_BASE } from "./api.js";

const VISITOR_STORAGE_KEY = "my_page_analytics_visitor_v1";
const SESSION_STORAGE_PREFIX = "my_page_analytics_session_v1:";
const LAST_TOUCH_STORAGE_PREFIX = "my_page_analytics_touch_v1:";
const VISITOR_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const SESSION_TTL_MS = 30 * 60 * 1000;
const TOUCH_EVENT_TYPES = new Set([
  "cta_click",
  "secondary_link_click",
  "catalog_item_open",
  "slot_select",
]);

function nowMs() {
  return Date.now();
}

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readStorage(key) {
  if (typeof window === "undefined") return null;
  try {
    return safeParse(window.localStorage.getItem(key));
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function buildId() {
  if (
    typeof crypto !== "undefined" &&
    crypto &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `mp_${nowMs().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function getVisitorRecord() {
  const current = readStorage(VISITOR_STORAGE_KEY);
  const valid =
    current &&
    typeof current === "object" &&
    String(current.id || "").trim() &&
    nowMs() - Number(current.updatedAt || 0) < VISITOR_TTL_MS;

  if (valid) {
    const next = {
      id: String(current.id),
      updatedAt: nowMs(),
    };
    writeStorage(VISITOR_STORAGE_KEY, next);
    return next;
  }

  const created = {
    id: buildId(),
    updatedAt: nowMs(),
  };
  writeStorage(VISITOR_STORAGE_KEY, created);
  return created;
}

function getSessionKey(slug) {
  return `${SESSION_STORAGE_PREFIX}${String(slug || "").trim().toLowerCase()}`;
}

function getLastTouchKey(slug) {
  return `${LAST_TOUCH_STORAGE_PREFIX}${String(slug || "").trim().toLowerCase()}`;
}

function getSessionRecord(slug) {
  const key = getSessionKey(slug);
  const current = readStorage(key);
  const valid =
    current &&
    typeof current === "object" &&
    String(current.id || "").trim() &&
    nowMs() - Number(current.lastSeenAt || 0) < SESSION_TTL_MS;

  if (valid) {
    const next = {
      id: String(current.id),
      startedAt: Number(current.startedAt || nowMs()),
      lastSeenAt: nowMs(),
    };
    writeStorage(key, next);
    return next;
  }

  const created = {
    id: buildId(),
    startedAt: nowMs(),
    lastSeenAt: nowMs(),
  };
  writeStorage(key, created);
  return created;
}

function getSearchParams() {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search || "");
}

function pickSearchValue(keys = []) {
  const params = getSearchParams();
  for (const key of keys) {
    const value = String(params.get(key) || "").trim();
    if (value) return value;
  }
  return "";
}

function getCurrentUtmData() {
  const params = getSearchParams();
  const utmSource = pickSearchValue(["utm_source"]);
  const utmMedium = pickSearchValue(["utm_medium"]);
  const utmCampaign = pickSearchValue(["utm_campaign"]);
  const utmContent = pickSearchValue(["utm_content"]);
  const utmTerm = pickSearchValue(["utm_term"]);
  const qrValue = String(params.get("qr") || "").trim().toLowerCase();

  return {
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    utmTerm,
    qr:
      qrValue === "1" ||
      qrValue === "true" ||
      utmSource === "qr" ||
      utmSource === "qr_code" ||
      utmMedium === "qr",
  };
}

function sanitizeTouchData(input = {}) {
  const current = input && typeof input === "object" ? input : {};
  return {
    pageKind: String(current.pageKind || "home").trim() || "home",
    blockKey: String(current.blockKey || "").trim(),
    buttonKey: String(current.buttonKey || "").trim(),
    buttonLabel: String(current.buttonLabel || "").trim(),
    buttonType: String(current.buttonType || "").trim(),
    contentKind: String(current.contentKind || "").trim(),
    contentId: String(current.contentId || "").trim(),
    contentLabel: String(current.contentLabel || "").trim(),
  };
}

export function getMyPageAnalyticsContext(slug, pageKind = "home", extras = {}) {
  const visitor = getVisitorRecord();
  const session = getSessionRecord(slug);
  const utm = getCurrentUtmData();

  return {
    visitorId: visitor.id,
    sessionId: session.id,
    referrer:
      typeof document !== "undefined" ? String(document.referrer || "") : "",
    language:
      typeof navigator !== "undefined" ? String(navigator.language || "") : "",
    pageKind: String(pageKind || extras?.pageKind || "home").trim() || "home",
    ...utm,
    ...(extras && typeof extras === "object" ? extras : {}),
  };
}

export function rememberMyPageLastTouch(slug, touch = {}) {
  const context = getMyPageAnalyticsContext(
    slug,
    touch?.pageKind || "home",
    sanitizeTouchData(touch),
  );
  const saved = {
    ...sanitizeTouchData(context),
    updatedAt: nowMs(),
  };
  writeStorage(getLastTouchKey(slug), saved);
  return saved;
}

function getLastTouch(slug) {
  const current = readStorage(getLastTouchKey(slug));
  if (!current || typeof current !== "object") return null;
  return sanitizeTouchData(current);
}

export function buildMyPageConversionContext(slug, pageKind = "home", extras = {}) {
  const base = getMyPageAnalyticsContext(slug, pageKind, extras);
  const lastTouch = getLastTouch(slug);
  if (!lastTouch) return base;

  return {
    ...base,
    blockKey: base.blockKey || lastTouch.blockKey || "",
    buttonKey: base.buttonKey || lastTouch.buttonKey || "",
    buttonLabel: base.buttonLabel || lastTouch.buttonLabel || "",
    buttonType: base.buttonType || lastTouch.buttonType || "",
    contentKind: base.contentKind || lastTouch.contentKind || "",
    contentId: base.contentId || lastTouch.contentId || "",
    contentLabel: base.contentLabel || lastTouch.contentLabel || "",
  };
}

export async function trackMyPageEvent(slug, payload = {}) {
  const current = payload && typeof payload === "object" ? payload : {};
  const eventType = String(current.eventType || "").trim();
  const body = getMyPageAnalyticsContext(
    slug,
    current.pageKind || "home",
    current,
  );

  if (!eventType) return;

  if (TOUCH_EVENT_TYPES.has(eventType)) {
    rememberMyPageLastTouch(slug, body);
  }

  try {
    await fetch(`${API_BASE}/my-page/public/${encodeURIComponent(slug)}/analytics/event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch {}
}
