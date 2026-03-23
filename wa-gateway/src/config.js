import fs from "fs";
import path from "path";

const DEFAULT_WINDOWS_SESSION_PATH = "C:\\LuminorPay\\wa-session";
const DEFAULT_WINDOWS_CHROME_PATH =
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

function hasText(value) {
  return String(value || "").trim().length > 0;
}

function parseBool(value, defaultValue = false) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (!normalized) return defaultValue;
  return ["1", "true", "yes", "on"].includes(normalized);
}

function parseNumber(value, defaultValue, { min = null, max = null } = {}) {
  const numeric = Number(value);
  let resolved = Number.isFinite(numeric) ? numeric : defaultValue;

  if (min !== null) {
    resolved = Math.max(min, resolved);
  }

  if (max !== null) {
    resolved = Math.min(max, resolved);
  }

  return resolved;
}

function splitList(raw) {
  return String(raw || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function fileExists(filePath) {
  try {
    return Boolean(filePath) && fs.existsSync(filePath);
  } catch {
    return false;
  }
}

export function resolveChromePath({
  env = process.env,
  platform = process.platform,
  exists = fileExists,
} = {}) {
  const candidates = [
    env.WA_CHROME_PATH,
    env.CHROME_BIN,
    env.PUPPETEER_EXECUTABLE_PATH,
    platform === "win32" ? DEFAULT_WINDOWS_CHROME_PATH : null,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (exists(candidate)) return candidate;
  }

  return (
    env.WA_CHROME_PATH ||
    env.CHROME_BIN ||
    env.PUPPETEER_EXECUTABLE_PATH ||
    (platform === "win32"
      ? DEFAULT_WINDOWS_CHROME_PATH
      : "/usr/bin/google-chrome")
  );
}

export function loadGatewayConfig({
  env = process.env,
  platform = process.platform,
  cwd = process.cwd(),
  exists = fileExists,
} = {}) {
  const legacyApiKey = String(env.WA_API_KEY || "").trim();
  const adminApiKey = String(env.WA_ADMIN_API_KEY || legacyApiKey).trim();
  const sendApiKey = String(env.WA_SEND_API_KEY || legacyApiKey).trim();
  const isProduction = String(env.NODE_ENV || "").trim().toLowerCase() === "production";

  const sessionPathConfigured =
    env.WA_SESSION_PATH ||
    (platform === "win32" ? DEFAULT_WINDOWS_SESSION_PATH : "./wa-session");
  const sessionPath = path.resolve(cwd, sessionPathConfigured);

  const chromePathResolved = resolveChromePath({ env, platform, exists });
  const qrPublic = parseBool(
    env.WA_QR_PUBLIC,
    isProduction ? false : true,
  );

  const config = {
    isProduction,
    port: parseNumber(env.PORT || env.WA_PORT, 3010, { min: 1 }),
    clientId:
      String(env.WA_CLIENT_ID || "luminorpay-windows").trim() ||
      "luminorpay-windows",
    headless: parseBool(env.WA_PUPPETEER_HEADLESS, true),
    sessionPathConfigured,
    sessionPath,
    chromePathConfigured:
      env.WA_CHROME_PATH ||
      env.CHROME_BIN ||
      env.PUPPETEER_EXECUTABLE_PATH ||
      (platform === "win32"
        ? DEFAULT_WINDOWS_CHROME_PATH
        : "/usr/bin/google-chrome"),
    chromePathResolved,
    chromePathExists: exists(chromePathResolved),
    auth: {
      legacyApiKey,
      adminApiKey,
      sendApiKey,
      qrPublic,
      qrKey: String(env.WA_QR_KEY || adminApiKey || legacyApiKey).trim(),
      sensitiveIpAllowlist: splitList(
        env.WA_SENSITIVE_IP_ALLOWLIST || env.WA_ADMIN_IP_ALLOWLIST || "",
      ),
    },
    reconnect: {
      baseMs: parseNumber(env.WA_RECONNECT_BASE_MS, 5000, { min: 1000 }),
      maxMs: parseNumber(env.WA_RECONNECT_MAX_MS, 60000, { min: 1000 }),
    },
    inbound: {
      forwardEnabled: parseBool(env.WA_INBOUND_FORWARD_ENABLED, true),
      webhookUrl: String(env.SERVER_INTERNAL_WEBHOOK_URL || "").replace(
        /\/+$/g,
        "",
      ),
      webhookKey: String(env.SERVER_INTERNAL_WEBHOOK_KEY || "").trim(),
      timeoutMs: parseNumber(env.WA_INBOUND_FORWARD_TIMEOUT_MS, 30000, {
        min: 5000,
      }),
      dedupeTtlMs: parseNumber(env.WA_INBOUND_DEDUPE_TTL_MS, 2 * 60 * 1000, {
        min: 30000,
      }),
      typingEnabled: parseBool(env.WA_INBOUND_TYPING_ENABLED, true),
      typingHeartbeatMs: parseNumber(env.WA_INBOUND_TYPING_HEARTBEAT_MS, 20000, {
        min: 5000,
      }),
    },
    outbound: {
      allowMedia: parseBool(env.WA_SEND_MEDIA_ENABLED, true),
      chatThrottleMs: parseNumber(env.WA_SEND_CHAT_THROTTLE_MS, 0, {
        min: 0,
      }),
    },
    telemetry: {
      recentEventsLimit: parseNumber(env.WA_RECENT_EVENTS_LIMIT, 200, {
        min: 50,
        max: 1000,
      }),
    },
    watchdog: {
      enabled: parseBool(env.WA_WATCHDOG_ENABLED, true),
      intervalMs: parseNumber(env.WA_WATCHDOG_INTERVAL_MS, 60000, {
        min: 10000,
      }),
    },
    qrRefreshSeconds: parseNumber(env.WA_QR_REFRESH_SECONDS, 6, { min: 2 }),
  };

  if (config.reconnect.maxMs < config.reconnect.baseMs) {
    config.reconnect.maxMs = config.reconnect.baseMs;
  }

  return config;
}

export function validateGatewayConfig(config) {
  const errors = [];
  const warnings = [];

  if (!hasText(config?.auth?.adminApiKey)) {
    errors.push({
      code: "ADMIN_API_KEY_MISSING",
      message: "WA_ADMIN_API_KEY ausente (ou WA_API_KEY legacy ausente).",
    });
  }

  if (!hasText(config?.auth?.sendApiKey)) {
    errors.push({
      code: "SEND_API_KEY_MISSING",
      message: "WA_SEND_API_KEY ausente (ou WA_API_KEY legacy ausente).",
    });
  }

  if (config?.inbound?.forwardEnabled) {
    if (!hasText(config?.inbound?.webhookUrl)) {
      errors.push({
        code: "WEBHOOK_URL_MISSING",
        message: "SERVER_INTERNAL_WEBHOOK_URL ausente.",
      });
    }

    if (!hasText(config?.inbound?.webhookKey)) {
      errors.push({
        code: "WEBHOOK_KEY_MISSING",
        message: "SERVER_INTERNAL_WEBHOOK_KEY ausente.",
      });
    }
  }

  if (!config?.chromePathExists) {
    errors.push({
      code: "CHROME_MISSING",
      message: `Chrome nao encontrado em ${config?.chromePathResolved || "(desconhecido)"}.`,
    });
  }

  if (config?.isProduction && config?.auth?.qrPublic) {
    warnings.push({
      code: "QR_PUBLIC_IN_PRODUCTION",
      message: "WA_QR_PUBLIC esta habilitado em producao.",
    });
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}
