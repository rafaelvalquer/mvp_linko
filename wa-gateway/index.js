// wa-gateway/index.js
import express from "express";
import dotenv from "dotenv";

import qrcodePkg from "qrcode-terminal";
import whatsappPkg from "whatsapp-web.js";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import {
  loadGatewayConfig,
  resolveChromePath as resolveChromePathFromConfig,
  validateGatewayConfig,
} from "./src/config.js";
import {
  getClientIp,
  isIpAllowed,
  maskKey as maskApiKeyFromModule,
  matchesApiKey,
} from "./src/security.js";
import {
  isLidUserId as isLidUserIdFromModule,
  normalizeInboundPhoneDigits as normalizeInboundPhoneDigitsFromModule,
  normalizeToBR as normalizeToBRFromModule,
} from "./src/phone.js";
import { createTelemetry } from "./src/telemetry.js";
import { startTypingHeartbeat } from "./src/typing.js";

dotenv.config();

const qrcode = qrcodePkg?.default ?? qrcodePkg;
const { Client, LocalAuth, MessageMedia } = whatsappPkg?.default ?? whatsappPkg;
const PACKAGE_VERSION = process.env.npm_package_version || "0.1.0";
const gatewayConfig = loadGatewayConfig();
const bootValidation = validateGatewayConfig(gatewayConfig);
const telemetry = createTelemetry({
  recentEventsLimit: gatewayConfig.telemetry.recentEventsLimit,
});
const startedAtMs = Date.now();

const PORT = gatewayConfig.port;
const API_KEY = gatewayConfig.auth.adminApiKey;
const SESSION_PATH_CONFIGURED = gatewayConfig.sessionPathConfigured;
const SESSION_PATH = gatewayConfig.sessionPath;
const CLIENT_ID = gatewayConfig.clientId;
const RECONNECT_BASE_MS = gatewayConfig.reconnect.baseMs;
const RECONNECT_MAX_MS = gatewayConfig.reconnect.maxMs;
const WA_INBOUND_FORWARD_ENABLED = gatewayConfig.inbound.forwardEnabled;
const SERVER_INTERNAL_WEBHOOK_URL = gatewayConfig.inbound.webhookUrl;
const SERVER_INTERNAL_WEBHOOK_KEY = gatewayConfig.inbound.webhookKey;
const WA_INBOUND_FORWARD_TIMEOUT_MS = gatewayConfig.inbound.timeoutMs;
const WA_INBOUND_DEDUPE_TTL_MS = gatewayConfig.inbound.dedupeTtlMs;
const WA_INBOUND_TYPING_ENABLED = gatewayConfig.inbound.typingEnabled;
const WA_INBOUND_TYPING_HEARTBEAT_MS =
  gatewayConfig.inbound.typingHeartbeatMs;

const HEADLESS = gatewayConfig.headless;

const QR_PUBLIC = gatewayConfig.auth.qrPublic;

const QR_KEY = gatewayConfig.auth.qrKey;

// Prioridade:
// 1) WA_CHROME_PATH
// 2) CHROME_BIN
// 3) PUPPETEER_EXECUTABLE_PATH
// 4) fallback padrão Linux container
const CHROME_PATH = gatewayConfig.chromePathConfigured;

let state = "INIT"; // INIT | STARTING | QR | READY | DISCONNECTED
let phone = null;
let lastSeen = new Date().toISOString();

let latestQr = null;
let latestQrAt = null;

let lastError = null;
let lastErrorAt = null;
let lastDisconnectReason = null;
let lastDisconnectAt = null;
let reconnectAttempts = 0;
let reconnectCount = 0;
let disconnectCount = 0;
let nextReconnectAt = null;
let reconnectDelayMs = null;
let reconnectTimer = null;
let clientGeneration = 0;
let waReady = false;
let readyAt = null;
let waSessionState = "INIT";
let forwardDegraded = false;
let lastForwardError = null;
let lastForwardErrorAt = null;
let lastForwardOkAt = null;
let watchdogTimer = null;
let lastWatchdogAt = null;
let lastWatchdogError = null;
let lastAckAt = null;

let waClient = null;
let isInitializing = false;
const recentInboundMessageIds = new Map();
const inflightInboundMessageIds = new Set();
const recentSendByChatId = new Map();

if (!bootValidation.ok && Array.isArray(bootValidation.errors) && bootValidation.errors.length) {
  state = String(bootValidation.errors[0]?.code || "MISCONFIGURED").toUpperCase();
  lastError = bootValidation.errors[0]?.message || "Configuracao invalida.";
  lastErrorAt = new Date().toISOString();
}

function nowISO() {
  return new Date().toISOString();
}

function nowMs() {
  return Date.now();
}

function touch() {
  lastSeen = nowISO();
}

function pruneRecentInboundMessages() {
  const cutoff = nowMs() - WA_INBOUND_DEDUPE_TTL_MS;
  for (const [messageId, seenAt] of recentInboundMessageIds.entries()) {
    if (seenAt < cutoff) {
      recentInboundMessageIds.delete(messageId);
    }
  }
}

function hasRecentInboundMessage(messageId) {
  pruneRecentInboundMessages();
  return recentInboundMessageIds.has(messageId);
}

function markRecentInboundMessage(messageId) {
  if (!messageId) return;
  recentInboundMessageIds.set(messageId, nowMs());
  syncTelemetryGauges();
}

function clearReconnectSchedule() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  nextReconnectAt = null;
  reconnectDelayMs = null;
  syncTelemetryGauges();
}

function resetReconnectState() {
  clearReconnectSchedule();
  reconnectAttempts = 0;
  syncTelemetryGauges();
}

function setLastError(where, err) {
  lastErrorAt = nowISO();
  lastError = `${where}: ${err?.message || String(err)}`;
  touch();
  console.error(`[wa] ERROR ${lastErrorAt} ${lastError}`);
  if (err?.stack) console.error(err.stack);
  logEvent("error", "runtime_error", {
    message: compactForLog(err?.message || String(err), 160),
    where,
  });
}

function markDisconnected(reason, nextState = "DISCONNECTED") {
  state = nextState;
  lastDisconnectAt = nowISO();
  lastDisconnectReason = String(reason?.message || reason || "unknown");
  disconnectCount += 1;
  waReady = false;
  readyAt = null;
  waSessionState = nextState;
  clearWatchdog();
  touch();
  syncTelemetryGauges();
}

function logEvent(level, event, details = {}) {
  return telemetry.log(level, event, {
    state,
    waSessionState,
    ready: waReady,
    phone,
    forwardDegraded,
    ...details,
  });
}

function syncTelemetryGauges() {
  telemetry.setGauge("wa_runtime_ready", waReady ? 1 : 0);
  telemetry.setGauge("wa_runtime_forward_degraded", forwardDegraded ? 1 : 0);
  telemetry.setGauge(
    "wa_runtime_inflight_inbound",
    inflightInboundMessageIds.size,
  );
  telemetry.setGauge(
    "wa_runtime_recent_inbound_dedupe",
    recentInboundMessageIds.size,
  );
  telemetry.setGauge("wa_runtime_reconnect_attempts", reconnectAttempts);
  telemetry.setGauge("wa_runtime_reconnect_count", reconnectCount);
  telemetry.setGauge("wa_runtime_disconnect_count", disconnectCount);
  telemetry.setGauge("wa_runtime_watchdog_active", watchdogTimer ? 1 : 0);
  telemetry.setGauge(
    "wa_runtime_boot_validation_ok",
    bootValidation.ok ? 1 : 0,
  );
}

function compactForLog(text, max = 280) {
  const s = String(text ?? "")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .trim();

  if (s.length <= max) return s;
  return `${s.slice(0, max)}...(+${s.length - max} chars)`;
}

function maskApiKey(value) {
  return maskApiKeyFromModule(value);
}

function ensureDir(dirPath) {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch (err) {
    console.error(`[fs] could not ensure dir ${dirPath}:`, err?.message || err);
  }
}

function fileExists(filePath) {
  try {
    return Boolean(filePath) && fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function resolveChromePath() {
  return resolveChromePathFromConfig();
}

function clearWatchdog() {
  if (!watchdogTimer) return;
  clearInterval(watchdogTimer);
  watchdogTimer = null;
  syncTelemetryGauges();
}

function scheduleReconnect(reason = "unknown") {
  if (!bootValidation.ok) {
    logEvent("warn", "reconnect_skipped_boot_validation", { reason });
    return;
  }

  clearReconnectSchedule();
  reconnectAttempts += 1;
  reconnectDelayMs = Math.min(
    RECONNECT_MAX_MS,
    RECONNECT_BASE_MS * 2 ** (reconnectAttempts - 1),
  );
  nextReconnectAt = new Date(Date.now() + reconnectDelayMs).toISOString();

  console.warn(
    `[wa] reconnect scheduled at=${nowISO()} reason="${compactForLog(
      reason,
      120,
    )}" attempt=${reconnectAttempts} delayMs=${reconnectDelayMs}`,
  );

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    nextReconnectAt = null;
    reconnectDelayMs = null;
    reconnectCount += 1;
    syncTelemetryGauges();
    initWhatsApp();
  }, reconnectDelayMs);
  syncTelemetryGauges();
}

async function checkClientHealth() {
  if (!waClient || isInitializing) return;

  try {
    const browserConnected =
      typeof waClient?.pupBrowser?.isConnected === "function"
        ? waClient.pupBrowser.isConnected()
        : true;
    const pageClosed =
      typeof waClient?.pupPage?.isClosed === "function"
        ? waClient.pupPage.isClosed()
        : false;

    if (typeof waClient.getState === "function") {
      waSessionState = String(
        (await waClient.getState()) || waSessionState || "UNKNOWN",
      );
    }

    lastWatchdogAt = nowISO();
    lastWatchdogError = null;
    telemetry.incrementCounter("wa_watchdog_success_total");
    syncTelemetryGauges();

    if (pageClosed || browserConnected === false) {
      throw new Error(
        `browser unhealthy (browserConnected=${browserConnected}, pageClosed=${pageClosed})`,
      );
    }
  } catch (error) {
    lastWatchdogAt = nowISO();
    lastWatchdogError = error?.message || String(error);
    telemetry.incrementCounter("wa_watchdog_failure_total");
    setLastError("watchdog", error);
    markDisconnected(error);
    await destroyClientSafe();
    scheduleReconnect("watchdog");
  }
}

function handleFatalProcessError(where, error) {
  setLastError(where, error);
  markDisconnected(error);
  void destroyClientSafe();
  scheduleReconnect(where);
}

process.on("unhandledRejection", (reason) => {
  handleFatalProcessError("unhandledRejection", reason);
});

process.on("uncaughtException", (err) => {
  handleFatalProcessError("uncaughtException", err);
});

function respondError(res, statusCode, errorCode, details = null) {
  return res.status(statusCode).json({
    ok: false,
    error: errorCode,
    ...(gatewayConfig.isProduction || !details ? {} : { details }),
  });
}

function requireAdminAccess(req, res, next) {
  const ip = getClientIp(req);
  const key = req.header("x-api-key");

  if (!matchesApiKey(key, gatewayConfig.auth.adminApiKey)) {
    telemetry.incrementCounter("wa_auth_admin_denied_total");
    logEvent("warn", "admin_access_denied", {
      ip,
      reason: "BAD_API_KEY",
      route: req.path,
    });
    return respondError(res, 401, "UNAUTHORIZED");
  }

  if (!isIpAllowed(ip, gatewayConfig.auth.sensitiveIpAllowlist)) {
    telemetry.incrementCounter("wa_auth_ip_denied_total");
    logEvent("warn", "admin_access_denied", {
      ip,
      reason: "IP_NOT_ALLOWED",
      route: req.path,
    });
    return respondError(res, 403, "IP_NOT_ALLOWED");
  }

  return next();
}

function requireSendAccess(req, res, next) {
  const key = req.header("x-api-key");
  if (!matchesApiKey(key, gatewayConfig.auth.sendApiKey)) {
    telemetry.incrementCounter("wa_auth_send_denied_total");
    logEvent("warn", "send_access_denied", {
      ip: getClientIp(req),
      route: req.path,
    });
    return respondError(res, 401, "UNAUTHORIZED");
  }

  return next();
}

function allowQrAccess(req) {
  if (gatewayConfig.auth.qrPublic) return true;
  if (
    !isIpAllowed(getClientIp(req), gatewayConfig.auth.sensitiveIpAllowlist)
  ) {
    return false;
  }

  const key = String(req.query.key || req.header("x-api-key") || "");
  const expected = gatewayConfig.auth.qrKey || gatewayConfig.auth.adminApiKey;
  if (!expected) return false;

  return matchesApiKey(key, expected);
}

function normalizeToBR(toRaw) {
  return normalizeToBRFromModule(toRaw);
}

function normalizeInboundPhoneDigits(raw) {
  return normalizeInboundPhoneDigitsFromModule(raw);
}

function isLidUserId(raw) {
  return isLidUserIdFromModule(raw);
}

async function resolvePhoneDigitsFromLid(userId) {
  if (!userId || !waClient || typeof waClient.getContactLidAndPhone !== "function") {
    return "";
  }

  try {
    const results = await waClient.getContactLidAndPhone([userId]);
    const record = Array.isArray(results) ? results[0] : null;
    return normalizeInboundPhoneDigits(record?.pn || "");
  } catch (error) {
    console.warn(
      `[inbound] lid lookup failed userId=${userId} error="${compactForLog(
        error?.message || String(error),
        160,
      )}"`,
    );
    return "";
  }
}

async function resolvePhoneDigitsFromContact(message) {
  try {
    const contact = await message.getContact();
    const candidates = [
      contact?.number,
      contact?.phoneNumber,
      contact?.id?._serialized,
      contact?.id?.user,
      contact?._data?.id?._serialized,
      contact?._data?.id?.user,
      contact?._data?.phoneNumber,
      contact?._data?.userid,
      contact?._data?.verifiedName,
    ];

    for (const candidate of candidates) {
      const digits = normalizeInboundPhoneDigits(candidate);
      if (digits) return digits;
    }
  } catch (error) {
    console.warn(
      `[inbound] contact lookup failed messageId=${
        message?.id?._serialized || message?.id?.id || "unknown"
      } error="${compactForLog(error?.message || String(error), 160)}"`,
    );
  }

  return "";
}

async function resolveInboundPhoneDigits(message) {
  const rawFrom = String(message?.from || "").trim();
  const directDigits = normalizeInboundPhoneDigits(rawFrom);
  if (directDigits) return directDigits;

  if (isLidUserId(rawFrom)) {
    const lidDigits = await resolvePhoneDigitsFromLid(rawFrom);
    if (lidDigits) return lidDigits;
  }

  return resolvePhoneDigitsFromContact(message);
}

function normalizeMessageTimestamp(rawTimestamp) {
  const numeric = Number(rawTimestamp);
  if (Number.isFinite(numeric) && numeric > 0) {
    return new Date(numeric * 1000).toISOString();
  }

  return nowISO();
}

async function resolvePushName(message) {
  const direct = String(
    message?._data?.notifyName || message?.notifyName || "",
  ).trim();
  if (direct) return direct;

  try {
    const contact = await message.getContact();
    return String(
      contact?.pushname || contact?.name || contact?.shortName || "",
    ).trim();
  } catch {
    return "";
  }
}

async function forwardInboundEvent(payload) {
  const startedAt = nowMs();
  telemetry.incrementCounter("wa_inbound_forward_attempt_total");

  if (!WA_INBOUND_FORWARD_ENABLED) {
    forwardDegraded = false;
    lastForwardError = null;
    lastForwardErrorAt = null;
    lastForwardOkAt = nowISO();
    syncTelemetryGauges();
    return { ok: true, status: "DISABLED", durationMs: 0 };
  }

  if (!SERVER_INTERNAL_WEBHOOK_URL || !SERVER_INTERNAL_WEBHOOK_KEY) {
    forwardDegraded = true;
    lastForwardError = "FORWARD_MISCONFIGURED";
    lastForwardErrorAt = nowISO();
    state = waReady ? "FORWARD_DEGRADED" : state;
    telemetry.incrementCounter("wa_inbound_forward_failure_total");
    syncTelemetryGauges();
    return { ok: false, status: "MISCONFIGURED", error: "FORWARD_MISCONFIGURED" };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), WA_INBOUND_FORWARD_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${SERVER_INTERNAL_WEBHOOK_URL}/api/internal/whatsapp/inbound`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-key": SERVER_INTERNAL_WEBHOOK_KEY,
        },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      },
    );

    const data = await response.json().catch(() => null);
    const durationMs = nowMs() - startedAt;
    telemetry.observeTiming("wa_inbound_forward_duration", durationMs);

    if (!response.ok || data?.ok === false) {
      forwardDegraded = true;
      lastForwardError = data?.error || data?.status || `HTTP_${response.status}`;
      lastForwardErrorAt = nowISO();
      state = waReady ? "FORWARD_DEGRADED" : state;
      telemetry.incrementCounter("wa_inbound_forward_failure_total");
      syncTelemetryGauges();
      return {
        ok: false,
        status: `HTTP_${response.status}`,
        error: data?.error || data?.status || "FORWARD_FAILED",
        durationMs,
      };
    }

    forwardDegraded = false;
    lastForwardError = null;
    lastForwardErrorAt = null;
    lastForwardOkAt = nowISO();
    state = waReady ? "READY" : state;
    telemetry.incrementCounter("wa_inbound_forward_success_total");
    syncTelemetryGauges();
    return {
      ok: true,
      status: String(data?.status || "FORWARDED"),
      durationMs,
    };
  } catch (error) {
    const durationMs = nowMs() - startedAt;
    telemetry.observeTiming("wa_inbound_forward_duration", durationMs);
    telemetry.incrementCounter("wa_inbound_forward_failure_total");
    forwardDegraded = true;
    lastForwardError = error?.message || String(error);
    lastForwardErrorAt = nowISO();
    state = waReady ? "FORWARD_DEGRADED" : state;
    syncTelemetryGauges();
    return {
      ok: false,
      status: error?.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR",
      error: error?.message || String(error),
      durationMs,
    };
  } finally {
    clearTimeout(timer);
  }
}

function createNoopTypingHandle() {
  return {
    active: false,
    async stop() {},
  };
}

async function startInboundTypingHeartbeat({
  message = null,
  messageId = "",
  fromPhoneDigits = "",
  type = "unknown",
}) {
  return startTypingHeartbeat({
    enabled: WA_INBOUND_TYPING_ENABLED,
    heartbeatMs: WA_INBOUND_TYPING_HEARTBEAT_MS,
    message,
    messageId,
    fromPhoneDigits,
    type,
    compactForLog,
    logWarn: (line) => console.warn(line),
  });
}

async function forwardInboundEventWithTyping({
  message = null,
  payload,
  messageId = "",
  fromPhoneDigits = "",
  type = "unknown",
}) {
  const typingHandle = await startInboundTypingHeartbeat({
    message,
    messageId,
    fromPhoneDigits,
    type,
  });

  try {
    return await forwardInboundEvent(payload);
  } finally {
    await typingHandle.stop();
  }
}

function shouldIgnoreInboundMessage(message) {
  const from = String(message?.from || "");
  if (message?.fromMe) return true;
  if (!from) return true;
  if (from === "status@broadcast") return true;
  if (from.endsWith("@broadcast")) return true;
  if (from.endsWith("@g.us")) return true;
  return false;
}

async function handleInboundMessage(message) {
  if (shouldIgnoreInboundMessage(message)) return;
  telemetry.incrementCounter("wa_inbound_received_total");

  const messageId =
    message?.id?._serialized || message?.id?.id || `msg-${Date.now()}`;
  if (inflightInboundMessageIds.has(messageId) || hasRecentInboundMessage(messageId)) {
    telemetry.incrementCounter("wa_inbound_duplicate_total");
    console.log(`[inbound] skipped duplicate messageId=${messageId}`);
    return;
  }

  inflightInboundMessageIds.add(messageId);
  syncTelemetryGauges();

  try {
    const rawFrom = String(message?.from || "").trim();
    const fromPhoneDigits = await resolveInboundPhoneDigits(message);

    if (!fromPhoneDigits) {
      telemetry.incrementCounter("wa_inbound_unresolved_phone_total");
      console.warn(
        `[inbound] skipped without phone messageId=${messageId} from="${compactForLog(
          rawFrom,
          120,
        )}" status=${isLidUserId(rawFrom) ? "LID_UNRESOLVED" : "PHONE_UNRESOLVED"}`,
      );
      return;
    }

    if (isLidUserId(rawFrom)) {
      console.log(
        `[inbound] resolved lid messageId=${messageId} from="${compactForLog(
          rawFrom,
          120,
        )}" phone=${fromPhoneDigits}`,
      );
    }

    const pushName = await resolvePushName(message);
    const timestamp = normalizeMessageTimestamp(message?.timestamp);
    const messageType = String(message?.type || "")
      .trim()
      .toLowerCase();

    if (messageType === "chat" || messageType === "text") {
      const text = String(message?.body || "").trim();
      if (!text) return;

      const result = await forwardInboundEventWithTyping({
        message,
        messageId,
        fromPhoneDigits,
        type: "text",
        payload: {
          messageId,
          fromPhoneDigits,
          pushName,
          type: "text",
          text,
          timestamp,
        },
      });

      if (result.ok) {
        telemetry.incrementCounter("wa_inbound_text_forwarded_total");
        markRecentInboundMessage(messageId);
        console.log(
          `[inbound] forwarded text ok messageId=${messageId} from=${fromPhoneDigits} status=${result.status}`,
        );
      } else {
        telemetry.incrementCounter("wa_inbound_text_failed_total");
        console.warn(
          `[inbound] forwarded text fail messageId=${messageId} from=${fromPhoneDigits} status=${result.status} error="${compactForLog(
            result.error,
            160,
          )}"`,
        );
      }

      return;
    }

    if (
      message?.hasMedia &&
      (messageType === "ptt" || messageType === "audio")
    ) {
      const media = await message.downloadMedia().catch((error) => {
        telemetry.incrementCounter("wa_inbound_audio_download_failed_total");
        console.warn(
          `[inbound] audio download failed messageId=${messageId} error="${compactForLog(
            error?.message || String(error),
            160,
          )}"`,
        );
        return null;
      });

      if (!media?.data || !media?.mimetype) {
        telemetry.incrementCounter("wa_inbound_audio_missing_media_total");
        return;
      }

      const result = await forwardInboundEventWithTyping({
        message,
        messageId,
        fromPhoneDigits,
        type: "audio",
        payload: {
          messageId,
          fromPhoneDigits,
          pushName,
          type: "audio",
          mimeType: media.mimetype,
          audioBase64: media.data,
          timestamp,
        },
      });

      if (result.ok) {
        telemetry.incrementCounter("wa_inbound_audio_forwarded_total");
        markRecentInboundMessage(messageId);
        console.log(
          `[inbound] forwarded audio ok messageId=${messageId} from=${fromPhoneDigits} status=${result.status}`,
        );
      } else {
        telemetry.incrementCounter("wa_inbound_audio_failed_total");
        console.warn(
          `[inbound] forwarded audio fail messageId=${messageId} from=${fromPhoneDigits} status=${result.status} error="${compactForLog(
            result.error,
            160,
          )}"`,
        );
      }
    }
  } finally {
    inflightInboundMessageIds.delete(messageId);
    syncTelemetryGauges();
  }
}

const app = express();
app.use(express.json({ limit: "10mb" }));

app.get("/health", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({
    ok: true,
    at: nowISO(),
    state,
    isInitializing,
  });
});

app.get("/status", requireAdminAccess, (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({
    ok: true,
    state,
    ready: state === "READY",
    waReady,
    waSessionState,
    phone,
    lastSeen,
    hasLatestQr: !!latestQr,
    latestQrAt,
    lastError,
    lastErrorAt,
    lastDisconnectReason,
    lastDisconnectAt,
    isInitializing,
    clientId: CLIENT_ID,
    cwd: process.cwd(),
    chromePathConfigured: CHROME_PATH,
    chromePathResolved: resolveChromePath(),
    chromePathExists: gatewayConfig.chromePathExists,
    sessionPathConfigured: SESSION_PATH_CONFIGURED,
    sessionPath: SESSION_PATH,
    sessionPathIsAbsolute: path.isAbsolute(SESSION_PATH_CONFIGURED),
    version: PACKAGE_VERSION,
    uptimeMs: nowMs() - startedAtMs,
    reconnectAttempts,
    reconnectCount,
    disconnectCount,
    reconnectBaseMs: RECONNECT_BASE_MS,
    reconnectMaxMs: RECONNECT_MAX_MS,
    reconnectDelayMs,
    nextReconnectAt,
    forwardDegraded,
    lastForwardError,
    lastForwardErrorAt,
    lastForwardOkAt,
    typingEnabled: WA_INBOUND_TYPING_ENABLED,
    typingHeartbeatMs: WA_INBOUND_TYPING_HEARTBEAT_MS,
    dedupeTtlMs: WA_INBOUND_DEDUPE_TTL_MS,
    recentInboundMessageCount: recentInboundMessageIds.size,
    inflightInboundCount: inflightInboundMessageIds.size,
    sendChatThrottleMs: gatewayConfig.outbound.chatThrottleMs,
    sendMediaEnabled: gatewayConfig.outbound.allowMedia,
    recentSendThrottleCount: recentSendByChatId.size,
    watchdogEnabled: gatewayConfig.watchdog.enabled,
    watchdogIntervalMs: gatewayConfig.watchdog.intervalMs,
    lastWatchdogAt,
    lastWatchdogError,
    lastAckAt,
    bootValidation,
    sensitiveIpAllowlistCount: gatewayConfig.auth.sensitiveIpAllowlist.length,
    adminApiKeyMasked: maskApiKey(gatewayConfig.auth.adminApiKey),
    sendApiKeyMasked: maskApiKey(gatewayConfig.auth.sendApiKey),
    qrPublic: gatewayConfig.auth.qrPublic,
    telemetry: telemetry.getSnapshot(),
  });
});

app.get("/events/recent", requireAdminAccess, (req, res) => {
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 50, 200));
  res.setHeader("Cache-Control", "no-store");
  res.json({
    ok: true,
    limit,
    events: telemetry.getRecentEvents(limit),
  });
});

app.get("/metrics", requireAdminAccess, (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.send(
    telemetry.renderPrometheusMetrics({
      wa_uptime_ms: nowMs() - startedAtMs,
      wa_forward_degraded: forwardDegraded ? 1 : 0,
      wa_ready: waReady ? 1 : 0,
      wa_recent_inbound_dedupe: recentInboundMessageIds.size,
      wa_inflight_inbound: inflightInboundMessageIds.size,
    }),
  );
});

app.get("/qr", async (req, res) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const ip =
    req.headers["x-forwarded-for"]?.toString()?.split(",")?.[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  const ua = req.headers["user-agent"] || "unknown";

  const authorized = allowQrAccess(req);
  const isReady = state === "READY";
  const hasQr = !!latestQr;

  console.log(
    `[qr] access ip=${ip} authorized=${authorized} state=${state} isReady=${isReady} hasQr=${hasQr} ua="${compactForLog(
      ua,
      160,
    )}" at=${nowISO()}`,
  );

  if (!authorized) {
    res.status(401).setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.send(
      "UNAUTHORIZED\n\nDefina WA_QR_PUBLIC=true ou acesse com ?key=SEU_TOKEN (ou header x-api-key).",
    );
  }

  if (isReady) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>WhatsApp QR</title>
  </head>
  <body style="font-family: system-ui; padding: 24px;">
    <h2>WhatsApp</h2>
    <p><b>Status:</b> ✅ LOGADO (READY)</p>
    <p><b>Número:</b> ${phone || "desconhecido"}</p>
    <p><b>Última atividade:</b> ${lastSeen}</p>
    ${
      lastError
        ? `<hr/><p style="color:#b45309"><b>Último erro:</b> ${lastError}<br/><b>Quando:</b> ${lastErrorAt}</p>`
        : ""
    }
  </body>
</html>`);
  }

  if (!latestQr) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="4" />
    <title>WhatsApp QR</title>
  </head>
  <body style="font-family: system-ui; padding: 24px;">
    <h2>WhatsApp</h2>
    <p><b>Status:</b> ${state}</p>
    <p>QR ainda não foi gerado. Aguarde alguns segundos... (atualiza sozinho)</p>
    <p><b>Última atividade:</b> ${lastSeen}</p>
    <p><b>Chrome configurado:</b> ${CHROME_PATH}</p>
    <p><b>Chrome resolvido:</b> ${resolveChromePath()}</p>
    ${
      lastError
        ? `<div style="margin-top:12px;padding:12px;border:1px solid #f59e0b;background:#fffbeb;border-radius:10px;">
             <b>Último erro:</b><br/>${lastError}<br/><small>${lastErrorAt}</small>
           </div>`
        : ""
    }
    <hr/>
    <p style="color:#666;font-size:13px;">
      Se o status ficar DISCONNECTED sem QR, normalmente é falha ao iniciar o Chrome/Puppeteer no container.
    </p>
  </body>
</html>`);
  }

  const dataUrl = await QRCode.toDataURL(latestQr, {
    margin: 1,
    scale: 8,
    errorCorrectionLevel: "M",
  });

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="6" />
    <title>WhatsApp QR</title>
  </head>
  <body style="font-family: system-ui; padding: 24px;">
    <h2>WhatsApp</h2>
    <p><b>Status:</b> ${state} (ainda não logado)</p>
    <p><b>Gerado em:</b> ${latestQrAt}</p>
    <img src="${dataUrl}" alt="QR Code" style="max-width: 320px; width: 100%; height: auto;" />
    <p style="margin-top:12px;color:#555">
      WhatsApp → <b>Dispositivos conectados</b> → <b>Conectar dispositivo</b>.
      Esta página atualiza sozinha.
    </p>
    <p><b>Última atividade:</b> ${lastSeen}</p>
    ${
      lastError
        ? `<hr/><p style="color:#b45309"><b>Último erro:</b> ${lastError}<br/><b>Quando:</b> ${lastErrorAt}</p>`
        : ""
    }
  </body>
</html>`);
});

app.post("/restart", requireAdminAccess, async (req, res) => {
  try {
    logEvent("warn", "manual_restart_requested", { at: nowISO() });
    await destroyClientSafe();
    await initWhatsApp();
    return res.json({ ok: true, state, at: nowISO() });
  } catch (err) {
    setLastError("restart", err);
    return respondError(res, 500, "RESTART_FAILED", err?.message || String(err));
  }
});

async function destroyClientSafe() {
  clearWatchdog();

  try {
    if (waClient) {
      const current = waClient;
      waClient = null;
      current.removeAllListeners();
      await current.destroy();
    }
  } catch (err) {
    console.error(`[wa] destroy warning: ${err?.message || err}`);
  } finally {
    syncTelemetryGauges();
  }
}

function ackCodeToState(ack) {
  const numeric = Number(ack);
  switch (numeric) {
    case -1:
      return "ERROR";
    case 0:
      return "PENDING";
    case 1:
      return "SERVER";
    case 2:
      return "DEVICE";
    case 3:
      return "READ";
    case 4:
      return "PLAYED";
    default:
      return `ACK_${numeric}`;
  }
}

function clearSendThrottleEntries() {
  if (!gatewayConfig.outbound.chatThrottleMs) return;
  const cutoff = nowMs() - gatewayConfig.outbound.chatThrottleMs;
  for (const [chatId, sentAt] of recentSendByChatId.entries()) {
    if (sentAt < cutoff) {
      recentSendByChatId.delete(chatId);
    }
  }
}

function isChatThrottled(chatId) {
  clearSendThrottleEntries();
  if (!gatewayConfig.outbound.chatThrottleMs) return false;
  const lastSentAt = recentSendByChatId.get(chatId);
  if (!lastSentAt) return false;
  return nowMs() - lastSentAt < gatewayConfig.outbound.chatThrottleMs;
}

function markChatSend(chatId) {
  if (!chatId) return;
  recentSendByChatId.set(chatId, nowMs());
}

async function initWhatsApp() {
  if (isInitializing) {
    logEvent("info", "init_skipped_already_running");
    return;
  }

  if (!bootValidation.ok) {
    logEvent("error", "boot_validation_failed", {
      errors: bootValidation.errors,
      warnings: bootValidation.warnings,
    });
    return;
  }

  isInitializing = true;
  state = "STARTING";
  touch();
  clearReconnectSchedule();
  ensureDir(SESSION_PATH);
  syncTelemetryGauges();

  const resolvedChromePath = resolveChromePath();
  const generation = ++clientGeneration;

  logEvent("info", "init_started", {
    adminApiKey: maskApiKey(API_KEY),
    chromeConfigured: CHROME_PATH,
    chromeResolved: resolvedChromePath,
    clientId: CLIENT_ID,
    port: PORT,
    qrPublic: QR_PUBLIC,
    sendApiKey: maskApiKey(gatewayConfig.auth.sendApiKey),
    sessionPath: SESSION_PATH,
    typingEnabled: WA_INBOUND_TYPING_ENABLED,
    version: PACKAGE_VERSION,
  });

  if (!fileExists(resolvedChromePath)) {
    const error = new Error(`Chrome not found at ${resolvedChromePath}`);
    setLastError("initWhatsApp", error);
    markDisconnected(error, "CHROME_MISSING");
    isInitializing = false;
    return;
  }

  try {
    await destroyClientSafe();

    waClient = new Client({
      authStrategy: new LocalAuth({
        dataPath: SESSION_PATH,
        clientId: CLIENT_ID,
      }),
      puppeteer: {
        headless: HEADLESS,
        executablePath: resolvedChromePath,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
          "--disable-features=site-per-process",
        ],
      },
    });

    waClient.on("qr", (qr) => {
      if (generation !== clientGeneration) return;
      state = "QR";
      waSessionState = "QR";
      waReady = false;
      readyAt = null;
      touch();
      latestQr = qr;
      latestQrAt = nowISO();
      telemetry.incrementCounter("wa_qr_generated_total");
      syncTelemetryGauges();

      console.log("\n================ WHATSAPP QR (RAW) ================\n");
      console.log(qr);
      console.log("\n================ WHATSAPP QR (ASCII) ==============\n");
      qrcode.generate(qr, { small: true }, (out) => console.log(out));
      logEvent("info", "qr_generated", { qrAt: latestQrAt });
    });

    waClient.on("ready", () => {
      if (generation !== clientGeneration) return;
      state = forwardDegraded ? "FORWARD_DEGRADED" : "READY";
      waReady = true;
      waSessionState = "READY";
      readyAt = nowISO();
      touch();
      resetReconnectState();

      const widUser =
        waClient?.info?.wid?.user || waClient?.info?.me?.user || null;

      phone = widUser ? `${widUser}`.replace(/\D/g, "") : widUser;
      latestQr = null;
      latestQrAt = null;
      lastError = null;
      lastErrorAt = null;
      lastDisconnectReason = null;
      lastDisconnectAt = null;
      lastWatchdogAt = nowISO();
      lastWatchdogError = null;
      telemetry.incrementCounter("wa_ready_total");

      if (gatewayConfig.watchdog.enabled && !watchdogTimer) {
        watchdogTimer = setInterval(() => {
          void checkClientHealth();
        }, gatewayConfig.watchdog.intervalMs);
      }

      syncTelemetryGauges();
      logEvent("info", "ready", { phone: phone || widUser || null });
    });

    waClient.on("authenticated", () => {
      if (generation !== clientGeneration) return;
      waSessionState = "AUTHENTICATED";
      touch();
      telemetry.incrementCounter("wa_authenticated_total");
      logEvent("info", "authenticated");
    });

    waClient.on("loading_screen", (percent, message) => {
      if (generation !== clientGeneration) return;
      touch();
      logEvent("info", "loading_screen", {
        message: compactForLog(message, 120),
        percent,
      });
    });

    waClient.on("change_state", (nextState) => {
      if (generation !== clientGeneration) return;
      waSessionState = String(nextState || waSessionState || "UNKNOWN");
      touch();
      telemetry.incrementCounter("wa_change_state_total");
      syncTelemetryGauges();
      logEvent("info", "change_state", { nextState: waSessionState });
    });

    waClient.on("auth_failure", async (msg) => {
      if (generation !== clientGeneration) return;
      telemetry.incrementCounter("wa_auth_failure_total");
      setLastError("auth_failure", msg);
      markDisconnected(msg, "AUTH_FAILURE");
      await destroyClientSafe();
      scheduleReconnect("auth_failure");
    });

    waClient.on("disconnected", async (reason) => {
      if (generation !== clientGeneration) return;
      telemetry.incrementCounter("wa_disconnected_total");
      setLastError("disconnected", reason);
      markDisconnected(reason);
      await destroyClientSafe();
      scheduleReconnect("disconnected");
    });

    waClient.on("message_ack", (message, ack) => {
      if (generation !== clientGeneration) return;
      const ackState = ackCodeToState(ack);
      lastAckAt = nowISO();
      telemetry.incrementCounter("wa_message_ack_total");
      telemetry.incrementCounter(
        `wa_message_ack_${ackState.toLowerCase()}_total`,
      );
      logEvent("info", "message_ack", {
        ack,
        ackState,
        chatId: message?.from || message?.to || null,
        providerMessageId: message?.id?._serialized || message?.id?.id || null,
      });
    });

    waClient.on("message", (message) => {
      if (generation !== clientGeneration) return;
      touch();
      Promise.resolve(handleInboundMessage(message)).catch((error) => {
        telemetry.incrementCounter("wa_inbound_unhandled_failure_total");
        logEvent("error", "inbound_unhandled_failure", {
          message: compactForLog(error?.message || String(error), 160),
        });
      });
    });

    await waClient.initialize();
  } catch (e) {
    setLastError("initWhatsApp", e);
    markDisconnected(
      e,
      /chrome|executable/i.test(String(e?.message || ""))
        ? "CHROME_MISSING"
        : "DISCONNECTED",
    );
    await destroyClientSafe();
    scheduleReconnect("initWhatsApp");
  } finally {
    isInitializing = false;
    syncTelemetryGauges();
  }
}

app.post("/send", requireSendAccess, async (req, res) => {
  const startedAt = nowMs();

  try {
    const { to, message, mediaBase64, mediaMimeType, mediaFileName } = req.body || {};

    if (!to || (!message && !mediaBase64)) {
      return respondError(res, 400, "INVALID_BODY");
    }

    const toNorm = normalizeToBR(to);
    if (!toNorm) {
      return respondError(res, 400, "INVALID_TO");
    }

    if (!waReady || !waClient) {
      return res.status(503).json({
        ok: false,
        error: "WHATSAPP_NOT_READY",
        state,
        lastError,
        lastErrorAt,
      });
    }

    const chatId = `${toNorm}@c.us`;
    if (isChatThrottled(chatId)) {
      telemetry.incrementCounter("wa_outbound_throttled_total");
      return respondError(
        res,
        429,
        "CHAT_THROTTLED",
        `Chat throttled for ${gatewayConfig.outbound.chatThrottleMs}ms.`,
      );
    }

    const msg = String(message || "");
    const hasMedia = Boolean(mediaBase64 && mediaMimeType);
    if (hasMedia && !gatewayConfig.outbound.allowMedia) {
      return respondError(res, 403, "MEDIA_DISABLED");
    }

    logEvent("info", "send_attempt", {
      chatId,
      chars: msg.length,
      hasMedia,
      to: toNorm,
    });

    let result = null;
    if (hasMedia) {
      const media = new MessageMedia(
        String(mediaMimeType),
        String(mediaBase64),
        String(mediaFileName || "attachment"),
      );
      result = await waClient.sendMessage(chatId, media, msg ? { caption: msg } : {});
    } else {
      result = await waClient.sendMessage(chatId, msg);
    }

    const providerMessageId = result?.id?._serialized || result?.id?.id || null;
    const durationMs = nowMs() - startedAt;

    markChatSend(chatId);
    telemetry.incrementCounter("wa_outbound_success_total");
    telemetry.observeTiming("wa_outbound_send_duration", durationMs);
    touch();
    syncTelemetryGauges();
    logEvent("info", "send_success", {
      chatId,
      durationMs,
      providerMessageId,
      to: toNorm,
    });

    return res.json({ ok: true, providerMessageId });
  } catch (err) {
    const durationMs = nowMs() - startedAt;
    telemetry.incrementCounter("wa_outbound_failure_total");
    telemetry.observeTiming("wa_outbound_send_duration", durationMs);
    setLastError("send", err);
    logEvent("error", "send_failed", {
      durationMs,
      message: compactForLog(err?.message || String(err), 160),
    });
    return respondError(res, 500, "SEND_FAILED", err?.message || String(err));
  }
});

for (const warning of bootValidation.warnings || []) {
  logEvent("warn", "boot_validation_warning", warning);
}

app.listen(PORT, "0.0.0.0", () => {
  logEvent("info", "gateway_listening", { port: PORT, version: PACKAGE_VERSION });
  initWhatsApp();
});
