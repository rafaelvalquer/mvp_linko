// wa-gateway/index.js
import express from "express";
import dotenv from "dotenv";

import qrcodePkg from "qrcode-terminal";
import whatsappPkg from "whatsapp-web.js";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";

dotenv.config();

const qrcode = qrcodePkg?.default ?? qrcodePkg;
const { Client, LocalAuth } = whatsappPkg?.default ?? whatsappPkg;

const PORT = Number(process.env.PORT || process.env.WA_PORT || 3010);
const DEFAULT_WINDOWS_SESSION_PATH = "C:\\LuminorPay\\wa-session";
const DEFAULT_WINDOWS_CHROME_PATH =
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const API_KEY = process.env.WA_API_KEY || "";
const SESSION_PATH_CONFIGURED =
  process.env.WA_SESSION_PATH ||
  (process.platform === "win32" ? DEFAULT_WINDOWS_SESSION_PATH : "./wa-session");
const SESSION_PATH = path.resolve(SESSION_PATH_CONFIGURED);
const CLIENT_ID =
  String(process.env.WA_CLIENT_ID || "luminorpay-windows").trim() ||
  "luminorpay-windows";
const RECONNECT_BASE_MS = Math.max(
  1000,
  Number(process.env.WA_RECONNECT_BASE_MS || 5000) || 5000,
);
const RECONNECT_MAX_MS = Math.max(
  RECONNECT_BASE_MS,
  Number(process.env.WA_RECONNECT_MAX_MS || 60000) || 60000,
);
const WA_INBOUND_FORWARD_ENABLED =
  String(process.env.WA_INBOUND_FORWARD_ENABLED || "true").toLowerCase() ===
  "true";
const SERVER_INTERNAL_WEBHOOK_URL = String(
  process.env.SERVER_INTERNAL_WEBHOOK_URL || "",
).replace(/\/+$/g, "");
const SERVER_INTERNAL_WEBHOOK_KEY = String(
  process.env.SERVER_INTERNAL_WEBHOOK_KEY || "",
).trim();
const WA_INBOUND_FORWARD_TIMEOUT_MS = Math.max(
  5000,
  Number(process.env.WA_INBOUND_FORWARD_TIMEOUT_MS || 30000) || 30000,
);
const WA_INBOUND_DEDUPE_TTL_MS = Math.max(
  30000,
  Number(process.env.WA_INBOUND_DEDUPE_TTL_MS || 2 * 60 * 1000) || 2 * 60 * 1000,
);
const WA_INBOUND_TYPING_ENABLED =
  String(process.env.WA_INBOUND_TYPING_ENABLED || "true").toLowerCase() ===
  "true";
const WA_INBOUND_TYPING_HEARTBEAT_MS = 20 * 1000;

const HEADLESS =
  String(process.env.WA_PUPPETEER_HEADLESS || "true").toLowerCase() === "true";

const QR_PUBLIC =
  String(process.env.WA_QR_PUBLIC || "true").toLowerCase() === "true";

const QR_KEY = process.env.WA_QR_KEY || "";

// Prioridade:
// 1) WA_CHROME_PATH
// 2) CHROME_BIN
// 3) PUPPETEER_EXECUTABLE_PATH
// 4) fallback padrão Linux container
const CHROME_PATH =
  process.env.WA_CHROME_PATH ||
  process.env.CHROME_BIN ||
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  (process.platform === "win32"
    ? DEFAULT_WINDOWS_CHROME_PATH
    : "/usr/bin/google-chrome");

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

let waClient = null;
let isInitializing = false;
const recentInboundMessageIds = new Map();
const inflightInboundMessageIds = new Set();

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
}

function clearReconnectSchedule() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  nextReconnectAt = null;
  reconnectDelayMs = null;
}

function resetReconnectState() {
  clearReconnectSchedule();
  reconnectAttempts = 0;
}

function setLastError(where, err) {
  lastErrorAt = nowISO();
  lastError = `${where}: ${err?.message || String(err)}`;
  touch();
  console.error(`[wa] ERROR ${lastErrorAt} ${lastError}`);
  if (err?.stack) console.error(err.stack);
}

function markDisconnected(reason) {
  state = "DISCONNECTED";
  lastDisconnectAt = nowISO();
  lastDisconnectReason = String(reason?.message || reason || "unknown");
  disconnectCount += 1;
  touch();
}

function compactForLog(text, max = 280) {
  const s = String(text ?? "")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .trim();

  if (s.length <= max) return s;
  return `${s.slice(0, max)}…(+${s.length - max} chars)`;
}

function maskApiKey(value) {
  const v = String(value || "");
  if (!v) return "(not set)";
  if (v.length <= 6) return "***";
  return `${v.slice(0, 3)}***${v.slice(-3)}`;
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
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function resolveChromePath() {
  const candidates = [
    process.env.WA_CHROME_PATH,
    process.env.CHROME_BIN,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.platform === "win32" ? DEFAULT_WINDOWS_CHROME_PATH : null,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fileExists(candidate)) return candidate;
  }

  return (
    process.env.WA_CHROME_PATH ||
    process.env.CHROME_BIN ||
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    (process.platform === "win32"
      ? DEFAULT_WINDOWS_CHROME_PATH
      : "/usr/bin/google-chrome")
  );
}

function scheduleReconnect(reason = "unknown") {
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
    initWhatsApp();
  }, reconnectDelayMs);
}

process.on("unhandledRejection", (reason) => {
  setLastError("unhandledRejection", reason);
  markDisconnected(reason);
  scheduleReconnect("unhandledRejection");
});

process.on("uncaughtException", (err) => {
  setLastError("uncaughtException", err);
  markDisconnected(err);
  scheduleReconnect("uncaughtException");
});

function requireApiKey(req, res, next) {
  const key = req.header("x-api-key");
  if (!API_KEY) {
    return res.status(500).json({ ok: false, error: "WA_API_KEY_NOT_SET" });
  }
  if (key !== API_KEY) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }
  next();
}

function allowQrAccess(req) {
  if (QR_PUBLIC) return true;

  const key = String(req.query.key || req.header("x-api-key") || "");
  const expected = QR_KEY || API_KEY;
  if (!expected) return false;

  return key === expected;
}

function normalizeToBR(toRaw) {
  const digits = String(toRaw || "").replace(/\D/g, "");
  if (!digits) return null;

  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13))
    return digits;

  return null;
}

function normalizeInboundPhoneDigits(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }

  return "";
}

function isLidUserId(raw) {
  return /@lid$/i.test(String(raw || "").trim());
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
  if (!WA_INBOUND_FORWARD_ENABLED) {
    return { ok: true, status: "DISABLED" };
  }

  if (!SERVER_INTERNAL_WEBHOOK_URL || !SERVER_INTERNAL_WEBHOOK_KEY) {
    return { ok: false, status: "MISCONFIGURED" };
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

    if (!response.ok || data?.ok === false) {
      return {
        ok: false,
        status: `HTTP_${response.status}`,
        error: data?.error || data?.status || "FORWARD_FAILED",
      };
    }

    return {
      ok: true,
      status: String(data?.status || "FORWARDED"),
    };
  } catch (error) {
    return {
      ok: false,
      status: error?.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR",
      error: error?.message || String(error),
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
  if (!WA_INBOUND_TYPING_ENABLED || !message) {
    return createNoopTypingHandle();
  }

  let chat = null;

  try {
    chat = await message.getChat();
  } catch (error) {
    console.warn(
      `[inbound] typing chat lookup failed messageId=${messageId} from=${fromPhoneDigits || "unknown"} type=${type} error="${compactForLog(
        error?.message || String(error),
        160,
      )}"`,
    );
    return createNoopTypingHandle();
  }

  if (
    !chat ||
    typeof chat.sendStateTyping !== "function" ||
    typeof chat.clearState !== "function"
  ) {
    return createNoopTypingHandle();
  }

  let stopped = false;
  let renewTimer = null;
  let sendInFlight = false;

  const emitTyping = async () => {
    if (stopped || sendInFlight) return;
    sendInFlight = true;

    try {
      await chat.sendStateTyping();
    } catch (error) {
      console.warn(
        `[inbound] typing start failed messageId=${messageId} from=${fromPhoneDigits || "unknown"} type=${type} error="${compactForLog(
          error?.message || String(error),
          160,
        )}"`,
      );
    } finally {
      sendInFlight = false;
    }
  };

  await emitTyping();

  renewTimer = setInterval(() => {
    void emitTyping();
  }, WA_INBOUND_TYPING_HEARTBEAT_MS);

  return {
    active: true,
    async stop() {
      if (stopped) return;
      stopped = true;

      if (renewTimer) {
        clearInterval(renewTimer);
        renewTimer = null;
      }

      try {
        await chat.clearState();
      } catch (error) {
        console.warn(
          `[inbound] typing clear failed messageId=${messageId} from=${fromPhoneDigits || "unknown"} type=${type} error="${compactForLog(
            error?.message || String(error),
            160,
          )}"`,
        );
      }
    },
  };
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

  const messageId =
    message?.id?._serialized || message?.id?.id || `msg-${Date.now()}`;
  if (inflightInboundMessageIds.has(messageId) || hasRecentInboundMessage(messageId)) {
    console.log(`[inbound] skipped duplicate messageId=${messageId}`);
    return;
  }

  inflightInboundMessageIds.add(messageId);

  try {
    const rawFrom = String(message?.from || "").trim();
    const fromPhoneDigits = await resolveInboundPhoneDigits(message);

    if (!fromPhoneDigits) {
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
        markRecentInboundMessage(messageId);
        console.log(
          `[inbound] forwarded text ok messageId=${messageId} from=${fromPhoneDigits} status=${result.status}`,
        );
      } else {
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
        console.warn(
          `[inbound] audio download failed messageId=${messageId} error="${compactForLog(
            error?.message || String(error),
            160,
          )}"`,
        );
        return null;
      });

      if (!media?.data || !media?.mimetype) {
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
        markRecentInboundMessage(messageId);
        console.log(
          `[inbound] forwarded audio ok messageId=${messageId} from=${fromPhoneDigits} status=${result.status}`,
        );
      } else {
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
  }
}

const app = express();
app.use(express.json({ limit: "200kb" }));

app.get("/health", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({
    ok: true,
    at: nowISO(),
    state,
    isInitializing,
  });
});

app.get("/status", requireApiKey, (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({
    ok: true,
    state,
    ready: state === "READY",
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
    sessionPathConfigured: SESSION_PATH_CONFIGURED,
    sessionPath: SESSION_PATH,
    sessionPathIsAbsolute: path.isAbsolute(SESSION_PATH_CONFIGURED),
    reconnectAttempts,
    reconnectCount,
    disconnectCount,
    reconnectBaseMs: RECONNECT_BASE_MS,
    reconnectMaxMs: RECONNECT_MAX_MS,
    reconnectDelayMs,
    nextReconnectAt,
  });
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

app.post("/restart", requireApiKey, async (req, res) => {
  try {
    console.log(`[wa] manual restart requested at=${nowISO()}`);
    await destroyClientSafe();
    initWhatsApp();
    return res.json({ ok: true, state, at: nowISO() });
  } catch (err) {
    setLastError("restart", err);
    return res.status(500).json({
      ok: false,
      error: "RESTART_FAILED",
      details: err?.message || String(err),
    });
  }
});

async function destroyClientSafe() {
  try {
    if (waClient) {
      const current = waClient;
      waClient = null;
      current.removeAllListeners();
      await current.destroy();
    }
  } catch (err) {
    console.error(`[wa] destroy warning: ${err?.message || err}`);
  }
}

async function initWhatsApp() {
  if (isInitializing) {
    console.log(`[wa] init skipped because another init is already running`);
    return;
  }

  isInitializing = true;
  state = "STARTING";
  touch();
  clearReconnectSchedule();
  ensureDir(SESSION_PATH);

  const resolvedChromePath = resolveChromePath();
  const generation = ++clientGeneration;

  console.log(
    `[wa] init at=${nowISO()} headless=${HEADLESS} sessionPath=${SESSION_PATH}`,
  );
  console.log(
    `[wa] env apiKey=${maskApiKey(API_KEY)} qrPublic=${QR_PUBLIC} clientId=${CLIENT_ID} chromeConfigured=${CHROME_PATH} chromeResolved=${resolvedChromePath}`,
  );
  console.log(
    `[wa] chromeExists=${fileExists(resolvedChromePath)} port=${PORT}`,
  );

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
      touch();

      latestQr = qr;
      latestQrAt = nowISO();

      console.log("\n================ WHATSAPP QR (RAW) ================\n");
      console.log(qr);

      console.log("\n================ WHATSAPP QR (ASCII) ==============\n");
      qrcode.generate(qr, { small: true }, (out) => console.log(out));

      console.log(`\n[wa] QR generated at=${latestQrAt} | open /qr to scan\n`);
    });

    waClient.on("ready", () => {
      if (generation !== clientGeneration) return;
      state = "READY";
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

      console.log(`[wa] READY at=${nowISO()} phone=${phone || widUser || "?"}`);
    });

    waClient.on("authenticated", () => {
      if (generation !== clientGeneration) return;
      touch();
      console.log(`[wa] AUTHENTICATED at=${nowISO()}`);
    });

    waClient.on("loading_screen", (percent, message) => {
      if (generation !== clientGeneration) return;
      touch();
      console.log(
        `[wa] LOADING at=${nowISO()} percent=${percent} message="${compactForLog(
          message,
          120,
        )}"`,
      );
    });

    waClient.on("change_state", (nextState) => {
      if (generation !== clientGeneration) return;
      touch();
      console.log(`[wa] CHANGE_STATE at=${nowISO()} nextState=${nextState}`);
    });

    waClient.on("auth_failure", (msg) => {
      if (generation !== clientGeneration) return;
      markDisconnected(msg);
      setLastError("auth_failure", msg);
      scheduleReconnect("auth_failure");
    });

    waClient.on("disconnected", (reason) => {
      if (generation !== clientGeneration) return;
      markDisconnected(reason);
      setLastError("disconnected", reason);
      scheduleReconnect("disconnected");
    });

    waClient.on("message", (message) => {
      if (generation !== clientGeneration) return;
      touch();
      Promise.resolve(handleInboundMessage(message)).catch((error) => {
        console.warn(
          `[inbound] unhandled failure at=${nowISO()} error="${compactForLog(
            error?.message || String(error),
            160,
          )}"`,
        );
      });
    });

    await waClient.initialize();
  } catch (e) {
    markDisconnected(e);
    setLastError("initWhatsApp", e);
    scheduleReconnect("initWhatsApp");
  } finally {
    isInitializing = false;
  }
}

app.post("/send", requireApiKey, async (req, res) => {
  try {
    const { to, message } = req.body || {};

    if (!to || !message) {
      return res.status(400).json({ ok: false, error: "INVALID_BODY" });
    }

    const toNorm = normalizeToBR(to);
    if (!toNorm) {
      return res.status(400).json({ ok: false, error: "INVALID_TO" });
    }

    if (state !== "READY" || !waClient) {
      return res.status(503).json({
        ok: false,
        error: "WHATSAPP_NOT_READY",
        state,
        lastError,
        lastErrorAt,
      });
    }

    const msg = String(message);
    const chatId = `${toNorm}@c.us`;

    console.log(
      `[send] at=${nowISO()} from=${phone || "?"} to=${toNorm} chatId=${chatId} chars=${msg.length} message="${compactForLog(
        msg,
        320,
      )}"`,
    );

    const result = await waClient.sendMessage(chatId, msg);
    const providerMessageId = result?.id?._serialized || result?.id?.id || null;

    console.log(
      `[send] OK at=${nowISO()} to=${toNorm} providerMessageId=${
        providerMessageId || "?"
      }`,
    );

    touch();

    return res.json({ ok: true, providerMessageId });
  } catch (err) {
    setLastError("send", err);
    return res.status(500).json({
      ok: false,
      error: "SEND_FAILED",
      details: err?.message || String(err),
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[wa-gateway] listening on 0.0.0.0:${PORT}`);
  initWhatsApp();
});
