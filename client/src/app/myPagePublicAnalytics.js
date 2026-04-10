import { API_BASE } from "./api.js";

const VISITOR_STORAGE_KEY = "my_page_analytics_visitor_v1";
const SESSION_STORAGE_PREFIX = "my_page_analytics_session_v1:";
const LAST_TOUCH_STORAGE_PREFIX = "my_page_analytics_touch_v1:";
const BROWSER_GEO_STORAGE_PREFIX = "my_page_analytics_browser_geo_v1:";
const VISITOR_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const SESSION_TTL_MS = 30 * 60 * 1000;
const BROWSER_GEO_TIMEOUT_MS = 8000;
const BROWSER_GEO_STATUSES = new Set([
  "granted",
  "denied",
  "unavailable",
  "timeout",
  "error",
  "pending",
]);
const TOUCH_EVENT_TYPES = new Set([
  "cta_click",
  "secondary_link_click",
  "catalog_item_open",
  "slot_select",
]);
const browserGeoRequestMap = new Map();

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

function getBrowserGeoKey(slug) {
  return `${BROWSER_GEO_STORAGE_PREFIX}${String(slug || "").trim().toLowerCase()}`;
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

function sanitizeBrowserGeoStatus(value) {
  const key = String(value || "").trim().toLowerCase();
  return BROWSER_GEO_STATUSES.has(key) ? key : "";
}

function sanitizeIsoDate(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function sanitizeBrowserGeoRecord(record = {}, sessionId = "") {
  const current = record && typeof record === "object" ? record : {};
  return {
    sessionId: String(current.sessionId || sessionId || "").trim(),
    status: sanitizeBrowserGeoStatus(current.status),
    capturedAt: sanitizeIsoDate(current.capturedAt),
    countryCode: String(current.countryCode || "").trim().toUpperCase().slice(0, 16),
    country: String(current.country || "").trim().slice(0, 120),
    region: String(current.region || "").trim().slice(0, 120),
    city: String(current.city || "").trim().slice(0, 120),
  };
}

function readBrowserGeoRecord(slug, sessionId = "") {
  const current = readStorage(getBrowserGeoKey(slug));
  if (!current || typeof current !== "object") return null;
  const sanitized = sanitizeBrowserGeoRecord(current, sessionId);
  if (!sanitized.sessionId || sanitized.sessionId !== String(sessionId || "").trim()) {
    return null;
  }
  return sanitized;
}

function writeBrowserGeoRecord(slug, sessionId, record = {}) {
  const next = sanitizeBrowserGeoRecord(
    {
      ...record,
      sessionId,
    },
    sessionId,
  );
  writeStorage(getBrowserGeoKey(slug), next);
  return next;
}

function buildBrowserGeoPayload(record) {
  if (!record || typeof record !== "object") return {};
  return {
    browserGeoStatus: sanitizeBrowserGeoStatus(record.status),
    browserGeoCapturedAt: sanitizeIsoDate(record.capturedAt),
    browserGeoCountryCode: String(record.countryCode || "").trim().toUpperCase().slice(0, 16),
    browserGeoCountry: String(record.country || "").trim().slice(0, 120),
    browserGeoRegion: String(record.region || "").trim().slice(0, 120),
    browserGeoCity: String(record.city || "").trim().slice(0, 120),
  };
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
  const currentExtras =
    extras && typeof extras === "object" ? { ...extras } : {};
  const skipBrowserGeoEnsure = currentExtras.__skipBrowserGeoEnsure === true;
  delete currentExtras.__skipBrowserGeoEnsure;
  const browserGeo = readBrowserGeoRecord(slug, session.id);

  if (!skipBrowserGeoEnsure) {
    void ensureMyPageBrowserGeo(slug, pageKind);
  }

  return {
    visitorId: visitor.id,
    sessionId: session.id,
    referrer:
      typeof document !== "undefined" ? String(document.referrer || "") : "",
    language:
      typeof navigator !== "undefined" ? String(navigator.language || "") : "",
    pageKind: String(pageKind || extras?.pageKind || "home").trim() || "home",
    ...utm,
    ...buildBrowserGeoPayload(browserGeo),
    ...currentExtras,
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

function getBrowserGeoErrorStatus(error) {
  if (!error || typeof error !== "object") return "error";
  if (Number(error.code) === 1) return "denied";
  if (Number(error.code) === 3) return "timeout";
  return "error";
}

async function postMyPageEvent(slug, body = {}) {
  const response = await fetch(
    `${API_BASE}/my-page/public/${encodeURIComponent(slug)}/analytics/event`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      keepalive: true,
    },
  );

  return response.json().catch(() => ({ ok: response.ok }));
}

async function syncBrowserGeoEvent(slug, pageKind, payload = {}, sessionId = "") {
  try {
    const response = await trackMyPageEvent(slug, {
      eventType: "geo_context_update",
      pageKind: String(pageKind || "home").trim() || "home",
      __skipBrowserGeoEnsure: true,
      ...payload,
    });
    const geo = response?.geo && typeof response.geo === "object" ? response.geo : null;
    const status = sanitizeBrowserGeoStatus(
      payload.browserGeoStatus || geo?.browserGeoStatus,
    );
    return writeBrowserGeoRecord(slug, sessionId, {
      status,
      capturedAt: payload.browserGeoCapturedAt || new Date().toISOString(),
      countryCode: geo?.countryCode || payload.browserGeoCountryCode || "",
      country: geo?.countryName || payload.browserGeoCountry || "",
      region: geo?.region || payload.browserGeoRegion || "",
      city: geo?.city || payload.browserGeoCity || "",
    });
  } catch {
    return writeBrowserGeoRecord(slug, sessionId, {
      status: payload.browserGeoStatus || "error",
      capturedAt: payload.browserGeoCapturedAt || new Date().toISOString(),
    });
  }
}

export function ensureMyPageBrowserGeo(slug, pageKind = "home") {
  if (typeof window === "undefined") return Promise.resolve(null);
  const session = getSessionRecord(slug);
  const requestKey = `${String(slug || "").trim().toLowerCase()}:${session.id}`;
  const current = readBrowserGeoRecord(slug, session.id);

  if (current && current.status && current.status !== "pending") {
    return Promise.resolve(current);
  }
  if (browserGeoRequestMap.has(requestKey)) {
    return browserGeoRequestMap.get(requestKey);
  }

  if (
    typeof navigator === "undefined" ||
    !navigator ||
    !navigator.geolocation ||
    typeof navigator.geolocation.getCurrentPosition !== "function"
  ) {
    const fallbackRecord = writeBrowserGeoRecord(slug, session.id, {
      status: "unavailable",
      capturedAt: new Date().toISOString(),
    });
    const promise = syncBrowserGeoEvent(
      slug,
      pageKind,
      {
        browserGeoStatus: "unavailable",
        browserGeoCapturedAt: fallbackRecord.capturedAt,
      },
      session.id,
    ).finally(() => {
      browserGeoRequestMap.delete(requestKey);
    });
    browserGeoRequestMap.set(requestKey, promise);
    return promise;
  }

  writeBrowserGeoRecord(slug, session.id, {
    status: "pending",
    capturedAt: new Date().toISOString(),
  });

  const promise = new Promise((resolve) => {
    const startLookup = () => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const capturedAt = new Date().toISOString();
          void syncBrowserGeoEvent(
            slug,
            pageKind,
            {
              browserGeoStatus: "granted",
              browserGeoCapturedAt: capturedAt,
              browserGeoLat: Number(position?.coords?.latitude),
              browserGeoLng: Number(position?.coords?.longitude),
            },
            session.id,
          ).then(resolve);
        },
        (error) => {
          const status = getBrowserGeoErrorStatus(error);
          const capturedAt = new Date().toISOString();
          void syncBrowserGeoEvent(
            slug,
            pageKind,
            {
              browserGeoStatus: status,
              browserGeoCapturedAt: capturedAt,
            },
            session.id,
          ).then(resolve);
        },
        {
          enableHighAccuracy: false,
          timeout: BROWSER_GEO_TIMEOUT_MS,
          maximumAge: 0,
        },
      );
    };

    if (
      navigator.permissions &&
      typeof navigator.permissions.query === "function"
    ) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((result) => {
          const state = String(result?.state || "").trim().toLowerCase();
          if (state === "denied") {
            const capturedAt = new Date().toISOString();
            void syncBrowserGeoEvent(
              slug,
              pageKind,
              {
                browserGeoStatus: "denied",
                browserGeoCapturedAt: capturedAt,
              },
              session.id,
            ).then(resolve);
            return;
          }
          startLookup();
        })
        .catch(startLookup);
      return;
    }

    startLookup();
  }).finally(() => {
    browserGeoRequestMap.delete(requestKey);
  });

  browserGeoRequestMap.set(requestKey, promise);
  return promise;
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
    return await postMyPageEvent(slug, body);
  } catch {
    return null;
  }
}
