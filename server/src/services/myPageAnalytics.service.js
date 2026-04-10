import mongoose from "mongoose";

import { MyPage } from "../models/MyPage.js";
import { MyPageClick } from "../models/MyPageClick.js";
import { MyPageQuoteRequest } from "../models/MyPageQuoteRequest.js";
import { MyPageAnalyticsEvent } from "../models/MyPageAnalyticsEvent.js";
import { Offer } from "../models/Offer.js";
import Booking from "../models/Booking.js";

const GEO_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const GEO_REQUEST_TIMEOUT_MS = 2500;
const SOURCE_BUCKETS = [
  "Instagram",
  "Google",
  "Direto",
  "Anuncio",
  "QR Code",
  "Outros sites",
];
const EVENT_TYPES = new Set([
  "page_view",
  "geo_context_update",
  "block_view",
  "cta_click",
  "secondary_link_click",
  "catalog_item_open",
  "quote_form_view",
  "quote_submit",
  "schedule_view",
  "slot_select",
  "booking_submit",
  "pay_view",
  "sale_attributed",
]);
const PAGE_KINDS = new Set(["home", "catalog", "quote", "schedule", "pay"]);
const BLOCK_KEYS = new Set([
  "hero",
  "primary_buttons",
  "secondary_links",
  "catalog_items",
  "quote_form",
  "schedule_slots",
  "pay_panel",
]);
const TOUCH_EVENT_TYPES = new Set([
  "cta_click",
  "secondary_link_click",
  "catalog_item_open",
  "slot_select",
]);
const CLICK_EVENT_TYPES = ["cta_click", "secondary_link_click"];
const BROWSER_GEO_STATUSES = new Set([
  "granted",
  "denied",
  "unavailable",
  "timeout",
  "error",
  "pending",
]);
const GEO_DEBUG_ENABLED = /^(1|true|yes|on)$/i.test(
  String(process.env.MY_PAGE_GEO_DEBUG || "").trim(),
);
const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^::1$/,
  /^::ffff:127\./,
  /^fc/i,
  /^fd/i,
];
const PAGE_KIND_LABELS = {
  home: "Home",
  catalog: "Catalogo",
  quote: "Orcamento",
  schedule: "Agendamento",
  pay: "Pagamento",
};
const BLOCK_LABELS = {
  hero: "Hero",
  primary_buttons: "Botoes principais",
  secondary_links: "Redes e links",
  catalog_items: "Catalogo",
  quote_form: "Formulario de orcamento",
  schedule_slots: "Horarios",
  pay_panel: "Painel de pagamento",
};

const geoCache = new Map();

function logGeoDebug(stage, details = {}) {
  if (!GEO_DEBUG_ENABLED) return;
  console.log("[my-page-geo]", stage, details);
}

function buildPayloadBodyPreview(payload) {
  try {
    return JSON.stringify(payload).replace(/\s+/g, " ").slice(0, 400);
  } catch {
    return "[unserializable payload]";
  }
}

function getGeoPayloadSuccess(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (Object.prototype.hasOwnProperty.call(payload, "success")) {
    return payload.success !== false;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "error")) {
    return payload.error !== true;
  }
  return null;
}

function getGeoPayloadMessage(payload) {
  if (!payload || typeof payload !== "object") return "";
  const errorValue =
    typeof payload.error === "string" ? payload.error : payload.reason;
  return clampText(payload.message || errorValue || payload.reason || "", 240);
}

function buildGeoProviderUrls(normalizedIp) {
  const explicitProviderUrl = String(
    process.env.MY_PAGE_GEO_PROVIDER_URL || "",
  ).trim();
  const candidates = [
    explicitProviderUrl,
    `https://ipapi.co/${encodeURIComponent(normalizedIp)}/json/`,
  ].filter(Boolean);

  return candidates.filter(
    (candidate, index) => candidates.indexOf(candidate) === index,
  );
}

function parseGeoPayload(payload) {
  return {
    countryCode: clampText(
      payload?.country_code || payload?.countryCode || payload?.country || "",
      16,
    ),
    countryName: clampText(
      payload?.country_name || payload?.countryName || payload?.country || "",
      120,
    ),
    region: clampText(
      payload?.region || payload?.region_name || payload?.regionName || "",
      120,
    ),
    city: clampText(payload?.city || "", 120),
  };
}

function hasMinimumGeoFields(value) {
  return Boolean(
    value &&
      value.countryCode &&
      value.countryCode !== "unknown" &&
      value.countryName &&
      value.countryName !== "Desconhecido",
  );
}

function buildGeoFailureReason({
  response = null,
  payloadSuccess = null,
  payloadMessage = "",
  value = null,
  error = null,
}) {
  if (error) return clampText(error?.message || String(error), 240);
  if (response && !response.ok) {
    return clampText(
      `http_${response.status}${payloadMessage ? `:${payloadMessage}` : ""}`,
      240,
    );
  }
  if (payloadSuccess === false) {
    return clampText(
      `payload_error${payloadMessage ? `:${payloadMessage}` : ""}`,
      240,
    );
  }
  if (!hasMinimumGeoFields(value)) {
    return "missing_geo_fields";
  }
  return "unknown_failure";
}

function clampText(value, max = 120) {
  return String(value || "")
    .trim()
    .slice(0, max);
}

function normalizeIdToken(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 120);
}

function sanitizeUrl(value, max = 2000) {
  const text = clampText(value, max);
  if (!text) return "";
  try {
    const url = new URL(text);
    if (!/^https?:$/i.test(url.protocol)) return "";
    return url.toString().slice(0, max);
  } catch {
    return "";
  }
}

function sanitizeLanguage(value) {
  return clampText(String(value || "").split(",")[0], 80);
}

function sanitizeBrowserGeoStatus(value) {
  const key = clampText(value, 20).toLowerCase();
  return BROWSER_GEO_STATUSES.has(key) ? key : "";
}

function sanitizeIsoDate(value) {
  const text = clampText(value, 80);
  if (!text) return "";
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function sanitizeCoordinate(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric < min || numeric > max) return null;
  return numeric;
}

function normalizePageKind(value, fallback = "home") {
  const key = clampText(value, 40).toLowerCase();
  return PAGE_KINDS.has(key) ? key : fallback;
}

function normalizeBlockKey(value) {
  const key = clampText(value, 60).toLowerCase();
  return BLOCK_KEYS.has(key) ? key : "";
}

function normalizeEventType(value) {
  const key = clampText(value, 40).toLowerCase();
  return EVENT_TYPES.has(key) ? key : "";
}

function normalizeObjectId(value) {
  const raw = clampText(value, 64);
  return mongoose.Types.ObjectId.isValid(raw)
    ? new mongoose.Types.ObjectId(raw)
    : null;
}

function normalizeIp(ip) {
  const clean = String(ip || "").trim();
  if (!clean) return "";
  if (clean.startsWith("::ffff:")) return clean.slice(7);
  return clean;
}

function isPrivateIp(ip) {
  const clean = String(ip || "")
    .trim()
    .toLowerCase();
  if (!clean) return true;
  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(clean));
}

function extractRequestIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "")
    .split(",")
    .map((item) => normalizeIp(item))
    .find(Boolean);
  return (
    forwarded ||
    normalizeIp(req.ip) ||
    normalizeIp(req.socket?.remoteAddress) ||
    normalizeIp(req.connection?.remoteAddress) ||
    ""
  );
}

function detectDeviceType(userAgent) {
  const value = String(userAgent || "").toLowerCase();
  if (!value) return "other";
  if (/ipad|tablet|playbook|silk/i.test(value)) return "tablet";
  if (/mobi|android|iphone|ipod|phone/i.test(value)) return "mobile";
  if (/windows|macintosh|linux|x11|cros/i.test(value)) return "desktop";
  return "other";
}

function unknownGeo(deviceType = "other", userAgent = "") {
  return {
    countryCode: "unknown",
    countryName: "Desconhecido",
    region: "",
    city: "",
    geoSource: "unknown",
    deviceType,
    userAgent: clampText(userAgent, 1000),
  };
}

function readGeoCache(ip) {
  const cached = geoCache.get(ip);
  if (!cached) return null;
  if (Date.now() - cached.updatedAt > GEO_CACHE_TTL_MS) {
    geoCache.delete(ip);
    return null;
  }
  return cached.value;
}

function writeGeoCache(ip, value) {
  geoCache.set(ip, { updatedAt: Date.now(), value });
}

async function fetchGeoForIp(ip, userAgent = "") {
  const normalizedIp = normalizeIp(ip);
  const deviceType = detectDeviceType(userAgent);
  const privateIp = !normalizedIp || isPrivateIp(normalizedIp);

  logGeoDebug("lookup:start", {
    rawIp: String(ip || ""),
    normalizedIp,
    privateIp,
    deviceType,
  });

  if (privateIp) {
    logGeoDebug("lookup:skip-private", {
      normalizedIp,
      reason: !normalizedIp ? "empty_ip" : "private_ip",
    });
    return unknownGeo(deviceType, userAgent);
  }

  const cached = readGeoCache(normalizedIp);
  if (cached) {
    logGeoDebug("lookup:cache-hit", {
      normalizedIp,
      countryCode: cached.countryCode || "unknown",
      region: cached.region || "",
      city: cached.city || "",
    });
    return {
      ...cached,
      deviceType,
      userAgent: clampText(userAgent, 1000),
    };
  }

  const providerUrls = buildGeoProviderUrls(normalizedIp);
  const attemptedProviders = [];
  let lastFailureReason = "unknown_failure";

  for (let index = 0; index < providerUrls.length; index += 1) {
    const providerUrl = providerUrls[index];
    const nextProviderUrl = providerUrls[index + 1] || "";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEO_REQUEST_TIMEOUT_MS);

    logGeoDebug("lookup:provider-request", {
      normalizedIp,
      providerUrl,
    });

    try {
      const response = await fetch(providerUrl, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      const payloadSuccess = getGeoPayloadSuccess(payload);
      const payloadMessage = getGeoPayloadMessage(payload);
      const parsedValue = parseGeoPayload(payload);
      const value = hasMinimumGeoFields(parsedValue)
        ? parsedValue
        : {
            countryCode: "unknown",
            countryName: "Desconhecido",
            region: "",
            city: "",
          };

      logGeoDebug("lookup:provider-response", {
        normalizedIp,
        providerUrl,
        status: response.status,
        ok: response.ok,
        payloadSuccess,
        payloadMessage,
        payloadBodyPreview: buildPayloadBodyPreview(payload),
        countryCode: value.countryCode || "unknown",
        region: value.region || "",
        city: value.city || "",
      });

      attemptedProviders.push(providerUrl);
      if (response.ok && payloadSuccess !== false && hasMinimumGeoFields(parsedValue)) {
        writeGeoCache(normalizedIp, value);
        return {
          ...value,
          geoSource: "ip",
          deviceType,
          userAgent: clampText(userAgent, 1000),
        };
      }

      lastFailureReason = buildGeoFailureReason({
        response,
        payloadSuccess,
        payloadMessage,
        value: parsedValue,
      });
    } catch (error) {
      attemptedProviders.push(providerUrl);
      lastFailureReason = buildGeoFailureReason({ error });
      logGeoDebug("lookup:provider-error", {
        normalizedIp,
        providerUrl,
        error: error?.message || String(error),
      });
    } finally {
      clearTimeout(timeout);
    }

    if (nextProviderUrl) {
      logGeoDebug("lookup:provider-fallback", {
        normalizedIp,
        fromProviderUrl: providerUrl,
        toProviderUrl: nextProviderUrl,
        reason: lastFailureReason,
      });
    }
  }

  logGeoDebug("lookup:all-providers-failed", {
    normalizedIp,
    attemptedProviders,
    reason: lastFailureReason,
  });

  const fallbackValue = unknownGeo(deviceType, userAgent);
  writeGeoCache(normalizedIp, fallbackValue);
  return fallbackValue;
}

async function fetchGeoForCoordinates(lat, lng, userAgent = "") {
  const latitude = sanitizeCoordinate(lat, -90, 90);
  const longitude = sanitizeCoordinate(lng, -180, 180);
  const deviceType = detectDeviceType(userAgent);
  if (latitude === null || longitude === null) {
    return unknownGeo(deviceType, userAgent);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEO_REQUEST_TIMEOUT_MS);
  const providerUrl =
    "https://nominatim.openstreetmap.org/reverse" +
    `?format=jsonv2&lat=${encodeURIComponent(latitude)}` +
    `&lon=${encodeURIComponent(longitude)}&zoom=10&addressdetails=1`;

  try {
    const response = await fetch(providerUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "mvp-linko-my-page-analytics/1.0",
      },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    const address = payload?.address && typeof payload.address === "object"
      ? payload.address
      : {};
    const value = {
      countryCode: clampText(
        String(address.country_code || "").toUpperCase(),
        16,
      ),
      countryName: clampText(address.country || "", 120),
      region: clampText(
        address.state ||
          address.region ||
          address.state_district ||
          address.county ||
          "",
        120,
      ),
      city: clampText(
        address.city ||
          address.town ||
          address.village ||
          address.municipality ||
          address.county ||
          "",
        120,
      ),
      geoSource: "browser",
    };

    if (response.ok && hasMinimumGeoFields(value)) {
      return {
        ...value,
        deviceType,
        userAgent: clampText(userAgent, 1000),
      };
    }
  } catch {
    // Silent fallback to GeoIP.
  } finally {
    clearTimeout(timeout);
  }

  return unknownGeo(deviceType, userAgent);
}

async function resolvePreferredGeo({ context, req, userAgent }) {
  const browserGeoStatus = sanitizeBrowserGeoStatus(context?.browserGeoStatus);
  if (browserGeoStatus === "granted") {
    const directBrowserGeo = {
      countryCode: clampText(
        String(context?.browserGeoCountryCode || "").toUpperCase(),
        16,
      ),
      countryName: clampText(context?.browserGeoCountry || "", 120),
      region: clampText(context?.browserGeoRegion || "", 120),
      city: clampText(context?.browserGeoCity || "", 120),
      geoSource: "browser",
      deviceType: detectDeviceType(userAgent),
      userAgent: clampText(userAgent, 1000),
    };
    if (hasMinimumGeoFields(directBrowserGeo)) {
      return directBrowserGeo;
    }

    const browserLookupGeo = await fetchGeoForCoordinates(
      context?.browserGeoLat,
      context?.browserGeoLng,
      userAgent,
    );
    if (browserLookupGeo?.countryCode && browserLookupGeo.countryCode !== "unknown") {
      return browserLookupGeo;
    }
  }

  return fetchGeoForIp(extractRequestIp(req), userAgent);
}

function classifySourceBucket({
  qr = false,
  utmSource = "",
  utmMedium = "",
  referrer = "",
}) {
  const source = clampText(utmSource, 120).toLowerCase();
  const medium = clampText(utmMedium, 120).toLowerCase();
  const safeReferrer = sanitizeUrl(referrer, 2000);
  const referrerHost = safeReferrer
    ? new URL(safeReferrer).hostname.toLowerCase()
    : "";

  if (
    qr === true ||
    source === "qr" ||
    source === "qr_code" ||
    medium === "qr"
  ) {
    return "QR Code";
  }
  if (/^(cpc|paid|paid_social|display|ads)$/i.test(medium)) {
    return "Anuncio";
  }
  if (
    referrerHost.includes("instagram.com") ||
    referrerHost.includes("facebook.com")
  ) {
    return "Instagram";
  }
  if (referrerHost.includes("google.")) {
    return "Google";
  }
  if (!safeReferrer) {
    return "Direto";
  }
  return "Outros sites";
}

function sanitizeAnalyticsContext(input = {}) {
  const current = input && typeof input === "object" ? input : {};
  return {
    visitorId: normalizeIdToken(current.visitorId),
    sessionId: normalizeIdToken(current.sessionId),
    referrer: sanitizeUrl(current.referrer),
    language: sanitizeLanguage(current.language),
    pageKind: normalizePageKind(current.pageKind, "home"),
    blockKey: normalizeBlockKey(current.blockKey),
    buttonKey: clampText(current.buttonKey, 120),
    buttonLabel: clampText(current.buttonLabel, 160),
    buttonType: clampText(current.buttonType, 80),
    contentKind: clampText(current.contentKind, 80),
    contentId: clampText(current.contentId, 120),
    contentLabel: clampText(current.contentLabel, 200),
    utmSource: clampText(current.utmSource, 120),
    utmMedium: clampText(current.utmMedium, 120),
    utmCampaign: clampText(current.utmCampaign, 160),
    utmContent: clampText(current.utmContent, 160),
    utmTerm: clampText(current.utmTerm, 160),
    browserGeoStatus: sanitizeBrowserGeoStatus(current.browserGeoStatus),
    browserGeoCapturedAt: sanitizeIsoDate(current.browserGeoCapturedAt),
    browserGeoCountryCode: clampText(
      String(current.browserGeoCountryCode || "").toUpperCase(),
      16,
    ),
    browserGeoCountry: clampText(current.browserGeoCountry, 120),
    browserGeoRegion: clampText(current.browserGeoRegion, 120),
    browserGeoCity: clampText(current.browserGeoCity, 120),
    browserGeoLat: sanitizeCoordinate(current.browserGeoLat, -90, 90),
    browserGeoLng: sanitizeCoordinate(current.browserGeoLng, -180, 180),
    qr:
      current.qr === true ||
      String(current.qr || "").trim() === "1" ||
      String(current.qr || "")
        .trim()
        .toLowerCase() === "true",
  };
}

function sanitizeAnalyticsPayload(input = {}) {
  const context = sanitizeAnalyticsContext(input);
  const eventType = normalizeEventType(input.eventType);
  if (!eventType) return null;
  return { ...context, eventType };
}

async function resolveSessionAcquisition(pageId, sessionId) {
  if (!pageId || !sessionId) return null;
  return MyPageAnalyticsEvent.findOne({
    pageId,
    sessionId,
    eventType: "page_view",
  })
    .sort({ eventAt: 1 })
    .lean();
}

async function resolveLastTouch(pageId, sessionId, eventAt) {
  if (!pageId || !sessionId) return null;
  return MyPageAnalyticsEvent.findOne({
    pageId,
    sessionId,
    eventType: { $in: Array.from(TOUCH_EVENT_TYPES) },
    eventAt: { $lte: eventAt || new Date() },
  })
    .sort({ eventAt: -1 })
    .lean();
}

function toAttributionSnapshot(snapshot = {}) {
  return {
    visitorId: clampText(snapshot.visitorId, 120),
    sessionId: clampText(snapshot.sessionId, 120),
    sourceBucket: SOURCE_BUCKETS.includes(snapshot.sourceBucket)
      ? snapshot.sourceBucket
      : "Outros sites",
    pageId: clampText(snapshot.pageId, 48),
    pageSlug: clampText(snapshot.pageSlug, 160),
    pageTitle: clampText(snapshot.pageTitle, 160),
    pageKind: normalizePageKind(snapshot.pageKind, "home"),
    blockKey: normalizeBlockKey(snapshot.blockKey),
    buttonKey: clampText(snapshot.buttonKey, 120),
    buttonLabel: clampText(snapshot.buttonLabel, 160),
    buttonType: clampText(snapshot.buttonType, 80),
    contentKind: clampText(snapshot.contentKind, 80),
    contentId: clampText(snapshot.contentId, 120),
    contentLabel: clampText(snapshot.contentLabel, 200),
    countryCode: clampText(snapshot.countryCode || "unknown", 16) || "unknown",
    countryName:
      clampText(snapshot.countryName || "Desconhecido", 120) || "Desconhecido",
    region: clampText(snapshot.region, 120),
    city: clampText(snapshot.city, 120),
    geoSource: clampText(snapshot.geoSource || "unknown", 20) || "unknown",
    browserGeoStatus: sanitizeBrowserGeoStatus(snapshot.browserGeoStatus),
    referrer: sanitizeUrl(snapshot.referrer),
    language: sanitizeLanguage(snapshot.language),
    deviceType: ["mobile", "desktop", "tablet", "other"].includes(
      String(snapshot.deviceType || ""),
    )
      ? snapshot.deviceType
      : "other",
    utmSource: clampText(snapshot.utmSource, 120),
    utmMedium: clampText(snapshot.utmMedium, 120),
    utmCampaign: clampText(snapshot.utmCampaign, 160),
    utmContent: clampText(snapshot.utmContent, 160),
    utmTerm: clampText(snapshot.utmTerm, 160),
    attributedAt: snapshot.attributedAt || new Date().toISOString(),
  };
}

function hasDetailedSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return false;
  return (
    String(snapshot.sessionId || "").trim().length > 0 ||
    String(snapshot.visitorId || "").trim().length > 0
  );
}

function mergeOfferOriginMeta(current, snapshot) {
  const base = current && typeof current === "object" ? current : {};
  return {
    ...base,
    myPage: {
      ...(base.myPage && typeof base.myPage === "object" ? base.myPage : {}),
      ...toAttributionSnapshot(snapshot),
    },
  };
}

function getOfferPaidAt(offer) {
  return (
    offer?.paidAt ||
    offer?.payment?.lastPixUpdatedAt ||
    offer?.updatedAt ||
    offer?.createdAt ||
    null
  );
}

function getOfferPaidCents(offer) {
  return Number(
    offer?.paidAmountCents ?? offer?.totalCents ?? offer?.amountCents ?? 0,
  );
}

function isOfferPaid(offer) {
  const paymentStatus = String(offer?.paymentStatus || "")
    .trim()
    .toUpperCase();
  const status = String(offer?.status || "")
    .trim()
    .toUpperCase();
  return (
    paymentStatus === "PAID" ||
    paymentStatus === "CONFIRMED" ||
    status === "PAID" ||
    status === "CONFIRMED" ||
    !!offer?.paidAt
  );
}

function buildEventDocument({
  page,
  payload,
  requestContext,
  geo,
  eventAt = new Date(),
  quoteRequestId = null,
  bookingId = null,
  offerId = null,
  revenueCents = null,
}) {
  return {
    pageId: page._id,
    workspaceId: page.workspaceId,
    ownerUserId: page.ownerUserId,
    pageSlug: clampText(page.slug, 160),
    pageTitle: clampText(page.title, 160),
    pageKind: payload.pageKind,
    visitorId: payload.visitorId,
    sessionId: payload.sessionId,
    eventType: payload.eventType,
    eventAt,
    referrer: payload.referrer || requestContext.referrer,
    sourceBucket: classifySourceBucket({
      qr: payload.qr,
      utmSource: payload.utmSource,
      utmMedium: payload.utmMedium,
      referrer: payload.referrer || requestContext.referrer,
    }),
    utmSource: payload.utmSource,
    utmMedium: payload.utmMedium,
    utmCampaign: payload.utmCampaign,
    utmContent: payload.utmContent,
    utmTerm: payload.utmTerm,
    language: payload.language || requestContext.language,
    deviceType: geo.deviceType,
    userAgent: geo.userAgent,
    countryCode: geo.countryCode || "unknown",
    countryName: geo.countryName || "Desconhecido",
    region: geo.region || "",
    city: geo.city || "",
    geoSource: clampText(geo.geoSource || "unknown", 20) || "unknown",
    browserGeoStatus: payload.browserGeoStatus || "",
    blockKey: payload.blockKey,
    buttonKey: payload.buttonKey,
    buttonLabel: payload.buttonLabel,
    buttonType: payload.buttonType,
    contentKind: payload.contentKind,
    contentId: payload.contentId,
    contentLabel: payload.contentLabel,
    quoteRequestId,
    bookingId,
    offerId,
    revenueCents:
      Number.isFinite(Number(revenueCents)) && Number(revenueCents) >= 0
        ? Number(revenueCents)
        : null,
  };
}

export async function recordMyPageAnalyticsEvent({
  page,
  req,
  payload,
  eventAt = new Date(),
  quoteRequestId = null,
  bookingId = null,
  offerId = null,
  revenueCents = null,
}) {
  const normalized = sanitizeAnalyticsPayload(payload);
  if (!normalized?.eventType) {
    const error = new Error("Evento invalido para analytics da Minha Pagina.");
    error.statusCode = 400;
    throw error;
  }
  if (!normalized.visitorId || !normalized.sessionId) {
    const error = new Error("visitorId e sessionId sao obrigatorios.");
    error.statusCode = 400;
    throw error;
  }

  const userAgent = clampText(req.headers["user-agent"], 1000);
  const requestContext = {
    referrer: sanitizeUrl(req.headers.referer || ""),
    language: sanitizeLanguage(req.headers["accept-language"] || ""),
  };
  const geo = await resolvePreferredGeo({
    context: normalized,
    req,
    userAgent,
  });
  const event = buildEventDocument({
    page,
    payload: normalized,
    requestContext,
    geo,
    eventAt,
    quoteRequestId: normalizeObjectId(quoteRequestId),
    bookingId: normalizeObjectId(bookingId),
    offerId: normalizeObjectId(offerId),
    revenueCents,
  });

  return MyPageAnalyticsEvent.create(event);
}

export async function buildMyPageAttributionSnapshot({
  page,
  req,
  analyticsContext,
  fallback = {},
}) {
  const context = sanitizeAnalyticsContext(analyticsContext);
  if (!context.visitorId || !context.sessionId) return null;

  const eventAt = new Date();
  const [acquisition, lastTouch] = await Promise.all([
    resolveSessionAcquisition(page._id, context.sessionId),
    resolveLastTouch(page._id, context.sessionId, eventAt),
  ]);
  const userAgent = clampText(req.headers["user-agent"], 1000);
  const geo = await resolvePreferredGeo({
    context,
    req,
    userAgent,
  });

  return toAttributionSnapshot({
    visitorId: context.visitorId,
    sessionId: context.sessionId,
    sourceBucket:
      acquisition?.sourceBucket ||
      classifySourceBucket({
        qr: context.qr,
        utmSource: context.utmSource,
        utmMedium: context.utmMedium,
        referrer: context.referrer || req.headers.referer || "",
      }),
    pageId: String(page._id),
    pageSlug: page.slug || "",
    pageTitle: page.title || "",
    pageKind:
      normalizePageKind(fallback.pageKind, "") ||
      normalizePageKind(lastTouch?.pageKind, "") ||
      normalizePageKind(context.pageKind, "home"),
    blockKey:
      normalizeBlockKey(fallback.blockKey) ||
      normalizeBlockKey(lastTouch?.blockKey) ||
      normalizeBlockKey(context.blockKey),
    buttonKey: clampText(
      fallback.buttonKey || lastTouch?.buttonKey || context.buttonKey,
      120,
    ),
    buttonLabel: clampText(
      fallback.buttonLabel || lastTouch?.buttonLabel || context.buttonLabel,
      160,
    ),
    buttonType: clampText(
      fallback.buttonType || lastTouch?.buttonType || context.buttonType,
      80,
    ),
    contentKind: clampText(
      fallback.contentKind || lastTouch?.contentKind || context.contentKind,
      80,
    ),
    contentId: clampText(
      fallback.contentId || lastTouch?.contentId || context.contentId,
      120,
    ),
    contentLabel: clampText(
      fallback.contentLabel || lastTouch?.contentLabel || context.contentLabel,
      200,
    ),
    countryCode:
      geo.countryCode !== "unknown"
        ? geo.countryCode
        : clampText(
            acquisition?.countryCode || lastTouch?.countryCode || "unknown",
            16,
          ),
    countryName:
      geo.countryCode !== "unknown"
        ? geo.countryName
        : clampText(
            acquisition?.countryName ||
              lastTouch?.countryName ||
              "Desconhecido",
            120,
          ),
    region: clampText(
      geo.region || acquisition?.region || lastTouch?.region || "",
      120,
    ),
    city: clampText(
      geo.city || acquisition?.city || lastTouch?.city || "",
      120,
    ),
    geoSource:
      clampText(
        geo.geoSource || acquisition?.geoSource || lastTouch?.geoSource || "unknown",
        20,
      ) || "unknown",
    browserGeoStatus:
      context.browserGeoStatus ||
      sanitizeBrowserGeoStatus(lastTouch?.browserGeoStatus) ||
      sanitizeBrowserGeoStatus(acquisition?.browserGeoStatus) ||
      "",
    referrer:
      context.referrer ||
      acquisition?.referrer ||
      lastTouch?.referrer ||
      sanitizeUrl(req.headers.referer || ""),
    language:
      context.language ||
      acquisition?.language ||
      lastTouch?.language ||
      sanitizeLanguage(req.headers["accept-language"] || ""),
    deviceType:
      geo.deviceType ||
      acquisition?.deviceType ||
      lastTouch?.deviceType ||
      "other",
    utmSource: context.utmSource || acquisition?.utmSource || "",
    utmMedium: context.utmMedium || acquisition?.utmMedium || "",
    utmCampaign: context.utmCampaign || acquisition?.utmCampaign || "",
    utmContent: context.utmContent || acquisition?.utmContent || "",
    utmTerm: context.utmTerm || acquisition?.utmTerm || "",
    attributedAt: eventAt.toISOString(),
  });
}

export async function attachMyPageAttributionToOffer({
  offerId,
  snapshot,
  merge = true,
}) {
  const normalizedOfferId = normalizeObjectId(offerId);
  const normalizedSnapshot = snapshot ? toAttributionSnapshot(snapshot) : null;
  if (!normalizedOfferId || !normalizedSnapshot) return null;

  const offer = await Offer.findById(normalizedOfferId).lean();
  if (!offer) return null;

  const nextOriginMeta = merge
    ? mergeOfferOriginMeta(offer.originMeta, normalizedSnapshot)
    : { myPage: normalizedSnapshot };

  await Offer.updateOne(
    { _id: normalizedOfferId },
    { $set: { originMeta: nextOriginMeta } },
    { strict: false },
  );

  return nextOriginMeta;
}

export async function ensureMyPageSaleAttributedEvent(offerInput) {
  const offer =
    offerInput && offerInput._id
      ? offerInput
      : normalizeObjectId(offerInput)
        ? await Offer.findById(offerInput).lean()
        : null;
  if (!offer || !isOfferPaid(offer)) return null;

  const snapshot =
    offer?.originMeta?.myPage && typeof offer.originMeta.myPage === "object"
      ? toAttributionSnapshot(offer.originMeta.myPage)
      : null;
  if (!snapshot?.sessionId || !snapshot?.pageId) return null;

  const pageId = normalizeObjectId(snapshot.pageId);
  if (!pageId) return null;

  const existing = await MyPageAnalyticsEvent.findOne({
    offerId: offer._id,
    eventType: "sale_attributed",
  })
    .select("_id")
    .lean();
  if (existing?._id) return existing;

  return MyPageAnalyticsEvent.create({
    pageId,
    workspaceId: offer.workspaceId,
    ownerUserId: offer.ownerUserId,
    pageSlug: snapshot.pageSlug || "",
    pageTitle: snapshot.pageTitle || "",
    pageKind: normalizePageKind(snapshot.pageKind, "pay"),
    visitorId: snapshot.visitorId || "",
    sessionId: snapshot.sessionId || "",
    eventType: "sale_attributed",
    eventAt: getOfferPaidAt(offer) || new Date(),
    referrer: snapshot.referrer || "",
    sourceBucket: snapshot.sourceBucket || "Outros sites",
    utmSource: snapshot.utmSource || "",
    utmMedium: snapshot.utmMedium || "",
    utmCampaign: snapshot.utmCampaign || "",
    utmContent: snapshot.utmContent || "",
    utmTerm: snapshot.utmTerm || "",
    language: snapshot.language || "",
    deviceType: snapshot.deviceType || "other",
    userAgent: "",
    countryCode: snapshot.countryCode || "unknown",
    countryName: snapshot.countryName || "Desconhecido",
    region: snapshot.region || "",
    city: snapshot.city || "",
    blockKey: snapshot.blockKey || "",
    buttonKey: snapshot.buttonKey || "",
    buttonLabel: snapshot.buttonLabel || "",
    buttonType: snapshot.buttonType || "",
    contentKind: snapshot.contentKind || "",
    contentId: snapshot.contentId || "",
    contentLabel: snapshot.contentLabel || offer.title || "",
    offerId: offer._id,
    revenueCents: getOfferPaidCents(offer),
  });
}

function buildCountMap(rows, keyField = "_id", valueField = "count") {
  return new Map(
    (rows || []).map((row) => [
      String(row?.[keyField] || ""),
      Number(row?.[valueField] || 0),
    ]),
  );
}

function getCoverageNotice(startedAt) {
  if (!startedAt) {
    return "Os dados detalhados aparecem a partir da implantacao do novo tracking da Minha Pagina.";
  }
  return `Os dados detalhados por origem, geo, mapa, blocos e funil estao disponiveis a partir de ${new Date(startedAt).toLocaleDateString("pt-BR")}.`;
}

function buildPageKindLabel(value) {
  const key = String(value || "")
    .trim()
    .toLowerCase();
  return PAGE_KIND_LABELS[key] || key || "Pagina";
}

function buildBlockLabel(value) {
  const key = String(value || "")
    .trim()
    .toLowerCase();
  return BLOCK_LABELS[key] || key || "Bloco";
}

function buildOfferPaidMatch(start, end) {
  return {
    $or: [
      { paidAt: { $gte: start, $lt: end } },
      {
        paidAt: { $in: [null] },
        updatedAt: { $gte: start, $lt: end },
        paymentStatus: { $in: ["PAID", "CONFIRMED"] },
      },
    ],
  };
}

async function loadAttributedPaidOffers({
  tenantId,
  ownerUserId = null,
  pageIds = [],
  start,
  end,
}) {
  const pageIdStrings = pageIds.map((item) => String(item));
  const quoteQuery = {
    workspaceId: tenantId,
    pageId: { $in: pageIds },
    createdOfferId: { $ne: null },
  };
  if (ownerUserId) quoteQuery.ownerUserId = ownerUserId;

  const quoteRequests = await MyPageQuoteRequest.find(quoteQuery)
    .select("createdOfferId analyticsSnapshot selectedProducts pageId")
    .lean();

  const quoteSnapshotByOfferId = new Map();
  for (const request of quoteRequests) {
    const offerId = String(request?.createdOfferId || "");
    if (!offerId) continue;
    quoteSnapshotByOfferId.set(offerId, request);
  }

  const orClauses = [];
  const quoteOfferIds = Array.from(quoteSnapshotByOfferId.keys())
    .filter((item) => mongoose.Types.ObjectId.isValid(item))
    .map((item) => new mongoose.Types.ObjectId(item));

  if (quoteOfferIds.length) {
    orClauses.push({ _id: { $in: quoteOfferIds } });
  }
  if (pageIdStrings.length) {
    orClauses.push({ "originMeta.myPage.pageId": { $in: pageIdStrings } });
  }
  if (!orClauses.length) return [];

  const offerQuery = {
    workspaceId: tenantId,
    ...buildOfferPaidMatch(start, end),
    $or: orClauses,
  };
  if (ownerUserId) offerQuery.ownerUserId = ownerUserId;

  const offers = await Offer.find(offerQuery)
    .select(
      "_id workspaceId ownerUserId title paidAt updatedAt paidAmountCents totalCents amountCents paymentStatus status originMeta",
    )
    .lean();

  return offers.map((offer) => {
    const quoteRequest = quoteSnapshotByOfferId.get(String(offer._id)) || null;
    return {
      offer,
      quoteRequest,
      snapshot:
        (offer?.originMeta?.myPage &&
          typeof offer.originMeta.myPage === "object" &&
          toAttributionSnapshot(offer.originMeta.myPage)) ||
        (quoteRequest?.analyticsSnapshot &&
          toAttributionSnapshot(quoteRequest.analyticsSnapshot)) ||
        null,
    };
  });
}

export async function buildMyPageAnalyticsReport({
  tenantId,
  ownerUserId = null,
  start,
  end,
  pageId = "all",
}) {
  const pageQuery = { workspaceId: tenantId };
  if (ownerUserId) pageQuery.ownerUserId = ownerUserId;

  const pages = await MyPage.find(pageQuery)
    .select("_id slug title ownerUserId workspaceId")
    .lean();
  const filteredPages =
    pageId && pageId !== "all" && mongoose.Types.ObjectId.isValid(pageId)
      ? pages.filter((item) => String(item?._id || "") === String(pageId))
      : pages;
  const pageIds = filteredPages.map((item) => item._id);

  if (!pageIds.length) {
    return {
      pages: pages.map((item) => ({
        _id: String(item._id),
        slug: item.slug || "",
        title: item.title || "",
      })),
      overview: {
        visits: 0,
        uniqueVisitors: 0,
        clicks: 0,
        quoteRequests: 0,
        bookings: 0,
        sales: 0,
        revenueCents: 0,
      },
      sources: [],
      topButtons: [],
      topBlocks: [],
      topProducts: [],
      topPages: [],
      funnel: [],
      geography: { countries: [], cities: [] },
      notices: [getCoverageNotice(null)],
      coverage: { startedAt: null },
    };
  }

  const scopedMatch = {
    workspaceId: tenantId,
    pageId: { $in: pageIds },
    eventAt: { $gte: start, $lt: end },
  };
  if (ownerUserId) scopedMatch.ownerUserId = ownerUserId;

  const earliestEvent = await MyPageAnalyticsEvent.findOne({
    workspaceId: tenantId,
    pageId: { $in: pageIds },
    ...(ownerUserId ? { ownerUserId } : {}),
  })
    .sort({ eventAt: 1 })
    .select("eventAt")
    .lean();
  const detailedTrackingStartedAt = earliestEvent?.eventAt || null;
  const detailedStart =
    detailedTrackingStartedAt instanceof Date
      ? detailedTrackingStartedAt
      : null;
  const legacyEnd =
    detailedStart && start < detailedStart
      ? new Date(Math.min(end.getTime(), detailedStart.getTime()))
      : null;

  const [
    visitSessions,
    uniqueVisitors,
    clickEventsCount,
    quoteSubmitCount,
    bookingSubmitCount,
    sourceSessionRows,
    topButtonsRows,
    blockViewRows,
    blockLeadRows,
    pageViewRows,
    pageLeadRows,
    funnelPageViewSessions,
    funnelClickSessions,
    funnelIntentSessions,
    funnelMidSessions,
    countryVisitRows,
    countryClickRows,
    cityClickRows,
  ] = await Promise.all([
    MyPageAnalyticsEvent.distinct("sessionId", {
      ...scopedMatch,
      eventType: "page_view",
      sessionId: { $ne: "" },
    }),
    MyPageAnalyticsEvent.distinct("visitorId", {
      ...scopedMatch,
      eventType: "page_view",
      visitorId: { $ne: "" },
    }),
    MyPageAnalyticsEvent.countDocuments({
      ...scopedMatch,
      eventType: { $in: CLICK_EVENT_TYPES },
    }),
    MyPageAnalyticsEvent.countDocuments({
      ...scopedMatch,
      eventType: "quote_submit",
    }),
    MyPageAnalyticsEvent.countDocuments({
      ...scopedMatch,
      eventType: "booking_submit",
    }),
    MyPageAnalyticsEvent.aggregate([
      {
        $match: {
          ...scopedMatch,
          eventType: "page_view",
          sessionId: { $ne: "" },
        },
      },
      {
        $group: {
          _id: { sourceBucket: "$sourceBucket", sessionId: "$sessionId" },
        },
      },
      { $group: { _id: "$_id.sourceBucket", count: { $sum: 1 } } },
    ]),
    MyPageAnalyticsEvent.aggregate([
      { $match: { ...scopedMatch, eventType: { $in: CLICK_EVENT_TYPES } } },
      {
        $group: {
          _id: {
            buttonKey: "$buttonKey",
            buttonLabel: "$buttonLabel",
            buttonType: "$buttonType",
          },
          clicks: { $sum: 1 },
        },
      },
      { $sort: { clicks: -1 } },
      { $limit: 8 },
    ]),
    MyPageAnalyticsEvent.aggregate([
      {
        $match: {
          ...scopedMatch,
          eventType: "block_view",
          blockKey: { $ne: "" },
        },
      },
      { $group: { _id: { blockKey: "$blockKey", sessionId: "$sessionId" } } },
      { $group: { _id: "$_id.blockKey", views: { $sum: 1 } } },
    ]),
    MyPageAnalyticsEvent.aggregate([
      {
        $match: {
          ...scopedMatch,
          eventType: {
            $in: ["quote_submit", "booking_submit", "sale_attributed"],
          },
          blockKey: { $ne: "" },
        },
      },
      {
        $group: {
          _id: "$blockKey",
          leads: {
            $sum: {
              $cond: [
                { $in: ["$eventType", ["quote_submit", "booking_submit"]] },
                1,
                0,
              ],
            },
          },
          sales: {
            $sum: { $cond: [{ $eq: ["$eventType", "sale_attributed"] }, 1, 0] },
          },
        },
      },
    ]),
    MyPageAnalyticsEvent.aggregate([
      {
        $match: {
          ...scopedMatch,
          eventType: "page_view",
          sessionId: { $ne: "" },
        },
      },
      {
        $group: {
          _id: {
            pageId: "$pageId",
            pageTitle: "$pageTitle",
            pageSlug: "$pageSlug",
            pageKind: "$pageKind",
            sessionId: "$sessionId",
          },
        },
      },
      {
        $group: {
          _id: {
            pageId: "$_id.pageId",
            pageTitle: "$_id.pageTitle",
            pageSlug: "$_id.pageSlug",
            pageKind: "$_id.pageKind",
          },
          visits: { $sum: 1 },
        },
      },
    ]),
    MyPageAnalyticsEvent.aggregate([
      {
        $match: {
          ...scopedMatch,
          eventType: { $in: ["quote_submit", "booking_submit"] },
          pageId: { $ne: null },
        },
      },
      {
        $group: {
          _id: {
            pageId: "$pageId",
            pageTitle: "$pageTitle",
            pageSlug: "$pageSlug",
            pageKind: "$pageKind",
          },
          leads: { $sum: 1 },
        },
      },
    ]),
    MyPageAnalyticsEvent.distinct("sessionId", {
      ...scopedMatch,
      eventType: "page_view",
      sessionId: { $ne: "" },
    }),
    MyPageAnalyticsEvent.distinct("sessionId", {
      ...scopedMatch,
      eventType: { $in: CLICK_EVENT_TYPES },
      sessionId: { $ne: "" },
    }),
    MyPageAnalyticsEvent.distinct("sessionId", {
      ...scopedMatch,
      eventType: { $in: ["quote_form_view", "schedule_view", "pay_view"] },
      sessionId: { $ne: "" },
    }),
    MyPageAnalyticsEvent.distinct("sessionId", {
      ...scopedMatch,
      eventType: { $in: ["quote_submit", "slot_select"] },
      sessionId: { $ne: "" },
    }),
    MyPageAnalyticsEvent.aggregate([
      {
        $match: {
          ...scopedMatch,
          sessionId: { $ne: "" },
          countryCode: { $nin: ["", "unknown"] },
        },
      },
      { $sort: { eventAt: -1 } },
      {
        $group: {
          _id: "$sessionId",
          countryCode: { $first: "$countryCode" },
          countryName: { $first: "$countryName" },
        },
      },
      {
        $group: {
          _id: {
            countryCode: "$countryCode",
            countryName: "$countryName",
          },
          visits: { $sum: 1 },
        },
      },
    ]),
    MyPageAnalyticsEvent.aggregate([
      {
        $match: {
          ...scopedMatch,
          eventType: { $in: CLICK_EVENT_TYPES },
          countryCode: { $ne: "" },
        },
      },
      {
        $group: {
          _id: { countryCode: "$countryCode", countryName: "$countryName" },
          clicks: { $sum: 1 },
        },
      },
    ]),
    MyPageAnalyticsEvent.aggregate([
      {
        $match: {
          ...scopedMatch,
          eventType: { $in: CLICK_EVENT_TYPES },
          city: { $ne: "" },
        },
      },
      {
        $group: {
          _id: {
            city: "$city",
            region: "$region",
            countryCode: "$countryCode",
            countryName: "$countryName",
          },
          clicks: { $sum: 1 },
        },
      },
      { $sort: { clicks: -1 } },
      { $limit: 12 },
    ]),
  ]);

  const [legacyClicks, legacyQuoteRequests, legacyBookings, paidOffers] =
    await Promise.all([
      legacyEnd && start < legacyEnd
        ? MyPageClick.countDocuments({
            pageId: { $in: pageIds },
            createdAt: { $gte: start, $lt: legacyEnd },
          })
        : Promise.resolve(0),
      legacyEnd && start < legacyEnd
        ? MyPageQuoteRequest.countDocuments({
            workspaceId: tenantId,
            pageId: { $in: pageIds },
            ...(ownerUserId ? { ownerUserId } : {}),
            createdAt: { $gte: start, $lt: legacyEnd },
          })
        : Promise.resolve(0),
      legacyEnd && start < legacyEnd
        ? Booking.countDocuments({
            workspaceId: tenantId,
            myPageId: { $in: pageIds },
            ...(ownerUserId ? { ownerUserId } : {}),
            sourceType: "my_page",
            createdAt: { $gte: start, $lt: legacyEnd },
          })
        : Promise.resolve(0),
      loadAttributedPaidOffers({
        tenantId,
        ownerUserId,
        pageIds,
        start,
        end,
      }),
    ]);

  const saleSessions = new Set();
  for (const item of paidOffers) {
    const sessionId = String(item?.snapshot?.sessionId || "").trim();
    if (sessionId) saleSessions.add(sessionId);
  }

  const overview = {
    visits: visitSessions.length,
    uniqueVisitors: uniqueVisitors.length,
    clicks: Number(legacyClicks || 0) + Number(clickEventsCount || 0),
    quoteRequests:
      Number(legacyQuoteRequests || 0) + Number(quoteSubmitCount || 0),
    bookings: Number(legacyBookings || 0) + Number(bookingSubmitCount || 0),
    sales: paidOffers.length,
    revenueCents: paidOffers.reduce(
      (sum, item) => sum + getOfferPaidCents(item.offer),
      0,
    ),
  };

  const sourceVisitMap = buildCountMap(sourceSessionRows);
  const sourceLeadMap = new Map();
  const sourceSaleMap = new Map();
  const sourceRevenueMap = new Map();

  const quoteRequestsForRange = await MyPageQuoteRequest.find({
    workspaceId: tenantId,
    pageId: { $in: pageIds },
    ...(ownerUserId ? { ownerUserId } : {}),
    createdAt: { $gte: start, $lt: end },
  })
    .select("analyticsSnapshot selectedProducts createdOfferId")
    .lean();

  const bookingsForRange = await Booking.find({
    workspaceId: tenantId,
    myPageId: { $in: pageIds },
    ...(ownerUserId ? { ownerUserId } : {}),
    sourceType: "my_page",
    createdAt: { $gte: start, $lt: end },
  })
    .select("analyticsSnapshot")
    .lean();

  for (const request of quoteRequestsForRange) {
    if (!hasDetailedSnapshot(request?.analyticsSnapshot)) continue;
    const sourceBucket = toAttributionSnapshot(
      request.analyticsSnapshot,
    ).sourceBucket;
    sourceLeadMap.set(sourceBucket, (sourceLeadMap.get(sourceBucket) || 0) + 1);
  }

  for (const booking of bookingsForRange) {
    if (!hasDetailedSnapshot(booking?.analyticsSnapshot)) continue;
    const sourceBucket = toAttributionSnapshot(
      booking.analyticsSnapshot,
    ).sourceBucket;
    sourceLeadMap.set(sourceBucket, (sourceLeadMap.get(sourceBucket) || 0) + 1);
  }

  for (const item of paidOffers) {
    if (!hasDetailedSnapshot(item?.snapshot)) continue;
    const sourceBucket = item?.snapshot?.sourceBucket || "Outros sites";
    sourceSaleMap.set(sourceBucket, (sourceSaleMap.get(sourceBucket) || 0) + 1);
    sourceRevenueMap.set(
      sourceBucket,
      (sourceRevenueMap.get(sourceBucket) || 0) + getOfferPaidCents(item.offer),
    );
  }

  const sources = SOURCE_BUCKETS.map((sourceBucket) => ({
    sourceBucket,
    visits: sourceVisitMap.get(sourceBucket) || 0,
    leads: sourceLeadMap.get(sourceBucket) || 0,
    sales: sourceSaleMap.get(sourceBucket) || 0,
    revenueCents: sourceRevenueMap.get(sourceBucket) || 0,
  }));

  const topButtons = (topButtonsRows || []).map((row) => ({
    buttonKey: row?._id?.buttonKey || "",
    buttonLabel: row?._id?.buttonLabel || "Botao sem nome",
    buttonType: row?._id?.buttonType || "",
    clicks: Number(row?.clicks || 0),
  }));

  const blockViewMap = buildCountMap(blockViewRows, "_id", "views");
  const topBlocks = (blockLeadRows || [])
    .map((row) => {
      const blockKey = String(row?._id || "");
      const views = blockViewMap.get(blockKey) || 0;
      const leads = Number(row?.leads || 0);
      return {
        blockKey,
        label: buildBlockLabel(blockKey),
        views,
        leads,
        sales: Number(row?.sales || 0),
        conversionRate:
          views > 0 ? Number(((leads / views) * 100).toFixed(2)) : 0,
      };
    })
    .sort((a, b) => b.leads - a.leads || b.views - a.views)
    .slice(0, 8);

  const pageTitleMap = new Map(
    pages.map((item) => [
      String(item._id),
      {
        title: item.title || "",
        slug: item.slug || "",
      },
    ]),
  );
  const pageVisitMap = new Map();
  const pageLeadMap = new Map();
  const pageKindMap = new Map();
  for (const row of pageViewRows || []) {
    const pageKey = String(row?._id?.pageId || "");
    if (!pageKey) continue;
    pageVisitMap.set(pageKey, Number(row?.visits || 0));
    pageKindMap.set(pageKey, normalizePageKind(row?._id?.pageKind, "home"));
    if (!pageTitleMap.has(pageKey)) {
      pageTitleMap.set(pageKey, {
        title: row?._id?.pageTitle || "",
        slug: row?._id?.pageSlug || "",
      });
    }
  }
  for (const row of pageLeadRows || []) {
    const pageKey = String(row?._id?.pageId || "");
    if (!pageKey) continue;
    pageLeadMap.set(pageKey, Number(row?.leads || 0));
    pageKindMap.set(pageKey, normalizePageKind(row?._id?.pageKind, "home"));
    if (!pageTitleMap.has(pageKey)) {
      pageTitleMap.set(pageKey, {
        title: row?._id?.pageTitle || "",
        slug: row?._id?.pageSlug || "",
      });
    }
  }
  const pageSalesMap = new Map();
  const pageRevenueMap = new Map();
  for (const item of paidOffers) {
    if (!hasDetailedSnapshot(item?.snapshot)) continue;
    const pageKey = String(item?.snapshot?.pageId || "").trim();
    if (!pageKey) continue;
    pageKindMap.set(
      pageKey,
      normalizePageKind(item?.snapshot?.pageKind, "home"),
    );
    if (!pageTitleMap.has(pageKey)) {
      pageTitleMap.set(pageKey, {
        title: item?.snapshot?.pageTitle || "",
        slug: item?.snapshot?.pageSlug || "",
      });
    }
    pageSalesMap.set(pageKey, (pageSalesMap.get(pageKey) || 0) + 1);
    pageRevenueMap.set(
      pageKey,
      (pageRevenueMap.get(pageKey) || 0) + getOfferPaidCents(item.offer),
    );
  }
  const topPages = Array.from(
    new Set([
      ...Array.from(pageVisitMap.keys()),
      ...Array.from(pageLeadMap.keys()),
      ...Array.from(pageSalesMap.keys()),
    ]),
  )
    .map((pageKey) => {
      const pageMeta = pageTitleMap.get(pageKey) || { title: "", slug: "" };
      const pageKind = pageKindMap.get(pageKey) || "home";
      const label =
        pageMeta.title ||
        (pageMeta.slug ? `/u/${pageMeta.slug}` : "") ||
        buildPageKindLabel(pageKind);
      return {
        pageId: pageKey,
        pageKind,
        label,
        subtitle: pageMeta.slug
          ? `/u/${pageMeta.slug}`
          : buildPageKindLabel(pageKind),
        visits: pageVisitMap.get(pageKey) || 0,
        leads: pageLeadMap.get(pageKey) || 0,
        sales: pageSalesMap.get(pageKey) || 0,
        revenueCents: pageRevenueMap.get(pageKey) || 0,
      };
    })
    .sort((a, b) => b.leads - a.leads || b.visits - a.visits)
    .slice(0, 8);

  const topServiceMap = new Map();
  function ensureFlowBucket(snapshot) {
    if (!hasDetailedSnapshot(snapshot)) return null;
    const normalized = toAttributionSnapshot(snapshot);
    const label =
      normalized.contentLabel ||
      normalized.buttonLabel ||
      buildPageKindLabel(normalized.pageKind);
    const key =
      `${normalized.contentKind || normalized.pageKind || "flow"}:` +
      `${normalized.contentId || label}`;
    if (!topServiceMap.has(key)) {
      topServiceMap.set(key, {
        key,
        label,
        kind: normalized.contentKind || normalized.pageKind || "flow",
        leads: 0,
        sales: 0,
        revenueCents: 0,
      });
    }
    return topServiceMap.get(key);
  }

  for (const request of quoteRequestsForRange) {
    const bucket = ensureFlowBucket(request?.analyticsSnapshot);
    if (!bucket) continue;
    bucket.leads += 1;
  }
  for (const booking of bookingsForRange) {
    const bucket = ensureFlowBucket(booking?.analyticsSnapshot);
    if (!bucket) continue;
    bucket.leads += 1;
  }
  for (const item of paidOffers) {
    const bucket = ensureFlowBucket(item?.snapshot);
    if (!bucket) continue;
    bucket.sales += 1;
    bucket.revenueCents += getOfferPaidCents(item.offer);
  }

  const topServices = Array.from(topServiceMap.values())
    .sort(
      (a, b) =>
        b.sales - a.sales ||
        b.leads - a.leads ||
        b.revenueCents - a.revenueCents,
    )
    .slice(0, 8);

  const productOpenMap = new Map();
  const productLeadMap = new Map();
  const productSalesMap = new Map();
  const productRevenueMap = new Map();
  const productLabelMap = new Map();

  const productOpens = await MyPageAnalyticsEvent.aggregate([
    {
      $match: {
        ...scopedMatch,
        eventType: "catalog_item_open",
        contentId: { $ne: "" },
      },
    },
    {
      $group: {
        _id: "$contentId",
        opens: { $sum: 1 },
        label: { $first: "$contentLabel" },
      },
    },
  ]);

  for (const row of productOpens || []) {
    const key = String(row?._id || "");
    if (!key) continue;
    productOpenMap.set(key, Number(row?.opens || 0));
    productLabelMap.set(key, row?.label || "Produto");
  }

  for (const request of quoteRequestsForRange) {
    const products = Array.isArray(request?.selectedProducts)
      ? request.selectedProducts
      : [];
    const paidOffer = paidOffers.find(
      (item) =>
        String(item?.offer?._id || "") ===
        String(request?.createdOfferId || ""),
    );
    const revenueShare =
      paidOffer && products.length > 0
        ? getOfferPaidCents(paidOffer.offer) / products.length
        : 0;

    for (const product of products) {
      const key = clampText(product?.productId || "", 120);
      if (!key) continue;
      productLabelMap.set(
        key,
        product?.name || productLabelMap.get(key) || "Produto",
      );
      productLeadMap.set(key, (productLeadMap.get(key) || 0) + 1);
      if (paidOffer) {
        productSalesMap.set(key, (productSalesMap.get(key) || 0) + 1);
        productRevenueMap.set(
          key,
          (productRevenueMap.get(key) || 0) + revenueShare,
        );
      }
    }
  }

  const topProducts = Array.from(
    new Set([
      ...Array.from(productOpenMap.keys()),
      ...Array.from(productLeadMap.keys()),
      ...Array.from(productSalesMap.keys()),
    ]),
  )
    .map((productId) => ({
      productId,
      label: productLabelMap.get(productId) || "Produto",
      opens: productOpenMap.get(productId) || 0,
      leads: productLeadMap.get(productId) || 0,
      sales: productSalesMap.get(productId) || 0,
      revenueCents: Math.round(productRevenueMap.get(productId) || 0),
    }))
    .sort((a, b) => b.sales - a.sales || b.leads - a.leads || b.opens - a.opens)
    .slice(0, 8);

  const funnel = [
    {
      key: "page_view",
      label: "Page view",
      sessions: funnelPageViewSessions.length,
    },
    {
      key: "cta_click",
      label: "Clique em CTA",
      sessions: funnelClickSessions.length,
    },
    {
      key: "intent_view",
      label: "Quote / Schedule / Pay",
      sessions: funnelIntentSessions.length,
    },
    {
      key: "mid_conversion",
      label: "Quote submit / Slot select",
      sessions: funnelMidSessions.length,
    },
    {
      key: "final_conversion",
      label: "Booking / Sale",
      sessions: saleSessions.size + bookingSubmitCount,
    },
  ].map((item, index, list) => {
    const previous = index === 0 ? item.sessions : list[index - 1].sessions;
    const dropoffCount =
      index === 0 ? 0 : Math.max(previous - item.sessions, 0);
    return {
      ...item,
      dropoffCount,
      dropoffPct:
        index === 0 || previous <= 0
          ? 0
          : Number(((dropoffCount / previous) * 100).toFixed(2)),
    };
  });

  const countryMap = new Map();
  for (const row of countryVisitRows || []) {
    const key = String(row?._id?.countryCode || "unknown");
    countryMap.set(key, {
      countryCode: key,
      countryName: row?._id?.countryName || "Desconhecido",
      visits: Number(row?.visits || 0),
      clicks: 0,
      leads: 0,
      sales: 0,
    });
  }
  for (const row of countryClickRows || []) {
    const key = String(row?._id?.countryCode || "unknown");
    const current = countryMap.get(key) || {
      countryCode: key,
      countryName: row?._id?.countryName || "Desconhecido",
      visits: 0,
      clicks: 0,
      leads: 0,
      sales: 0,
    };
    current.clicks = Number(row?.clicks || 0);
    countryMap.set(key, current);
  }
  for (const request of quoteRequestsForRange) {
    if (!hasDetailedSnapshot(request?.analyticsSnapshot)) continue;
    const snapshot = toAttributionSnapshot(request?.analyticsSnapshot);
    const key = snapshot.countryCode || "unknown";
    const current = countryMap.get(key) || {
      countryCode: key,
      countryName: snapshot.countryName || "Desconhecido",
      visits: 0,
      clicks: 0,
      leads: 0,
      sales: 0,
    };
    current.leads += 1;
    countryMap.set(key, current);
  }
  for (const booking of bookingsForRange) {
    if (!hasDetailedSnapshot(booking?.analyticsSnapshot)) continue;
    const snapshot = toAttributionSnapshot(booking?.analyticsSnapshot);
    const key = snapshot.countryCode || "unknown";
    const current = countryMap.get(key) || {
      countryCode: key,
      countryName: snapshot.countryName || "Desconhecido",
      visits: 0,
      clicks: 0,
      leads: 0,
      sales: 0,
    };
    current.leads += 1;
    countryMap.set(key, current);
  }
  for (const item of paidOffers) {
    if (!hasDetailedSnapshot(item?.snapshot)) continue;
    const snapshot = item?.snapshot || {};
    const key = snapshot.countryCode || "unknown";
    const current = countryMap.get(key) || {
      countryCode: key,
      countryName: snapshot.countryName || "Desconhecido",
      visits: 0,
      clicks: 0,
      leads: 0,
      sales: 0,
    };
    current.sales += 1;
    countryMap.set(key, current);
  }

  const countries = Array.from(countryMap.values())
    .sort((a, b) => b.clicks - a.clicks || b.visits - a.visits)
    .slice(0, 60);

  const cities = (cityClickRows || [])
    .map((row) => ({
      city: row?._id?.city || "",
      region: row?._id?.region || "",
      countryCode: row?._id?.countryCode || "unknown",
      countryName: row?._id?.countryName || "Desconhecido",
      clicks: Number(row?.clicks || 0),
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 12);

  return {
    pages: pages.map((item) => ({
      _id: String(item._id),
      slug: item.slug || "",
      title: item.title || "",
    })),
    overview,
    sources,
    topButtons,
    topBlocks,
    topServices,
    topProducts,
    topPages,
    funnel,
    geography: { countries, cities },
    notices: [getCoverageNotice(detailedTrackingStartedAt)],
    coverage: { startedAt: detailedTrackingStartedAt },
  };
}
