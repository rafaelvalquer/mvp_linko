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

const API_KEY = process.env.WA_API_KEY || "";
const SESSION_PATH = process.env.WA_SESSION_PATH || "./wa-session";

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
  "/usr/bin/google-chrome";

let state = "INIT"; // INIT | STARTING | QR | READY | DISCONNECTED
let phone = null;
let lastSeen = new Date().toISOString();

let latestQr = null;
let latestQrAt = null;

let lastError = null;
let lastErrorAt = null;

let waClient = null;
let isInitializing = false;

function nowISO() {
  return new Date().toISOString();
}

function touch() {
  lastSeen = nowISO();
}

function setLastError(where, err) {
  lastErrorAt = nowISO();
  lastError = `${where}: ${err?.message || String(err)}`;
  touch();
  console.error(`[wa] ERROR ${lastErrorAt} ${lastError}`);
  if (err?.stack) console.error(err.stack);
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
    "/usr/bin/google-chrome"
  );
}

process.on("unhandledRejection", (reason) => {
  setLastError("unhandledRejection", reason);
  state = "DISCONNECTED";
});

process.on("uncaughtException", (err) => {
  setLastError("uncaughtException", err);
  state = "DISCONNECTED";
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
    phone,
    lastSeen,
    hasLatestQr: !!latestQr,
    latestQrAt,
    lastError,
    lastErrorAt,
    isInitializing,
    chromePathConfigured: CHROME_PATH,
    chromePathResolved: resolveChromePath(),
    sessionPath: SESSION_PATH,
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

  ensureDir(path.resolve(SESSION_PATH));

  const resolvedChromePath = resolveChromePath();

  console.log(
    `[wa] init at=${nowISO()} headless=${HEADLESS} sessionPath=${SESSION_PATH}`,
  );
  console.log(
    `[wa] env apiKey=${maskApiKey(API_KEY)} qrPublic=${QR_PUBLIC} chromeConfigured=${CHROME_PATH} chromeResolved=${resolvedChromePath}`,
  );
  console.log(
    `[wa] chromeExists=${fileExists(resolvedChromePath)} port=${PORT}`,
  );

  try {
    await destroyClientSafe();

    waClient = new Client({
      authStrategy: new LocalAuth({
        dataPath: SESSION_PATH,
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
      state = "READY";
      touch();

      const widUser =
        waClient?.info?.wid?.user || waClient?.info?.me?.user || null;

      phone = widUser ? `${widUser}`.replace(/\D/g, "") : widUser;

      latestQr = null;
      latestQrAt = null;
      lastError = null;
      lastErrorAt = null;

      console.log(`[wa] READY at=${nowISO()} phone=${phone || widUser || "?"}`);
    });

    waClient.on("authenticated", () => {
      touch();
      console.log(`[wa] AUTHENTICATED at=${nowISO()}`);
    });

    waClient.on("loading_screen", (percent, message) => {
      touch();
      console.log(
        `[wa] LOADING at=${nowISO()} percent=${percent} message="${compactForLog(
          message,
          120,
        )}"`,
      );
    });

    waClient.on("change_state", (nextState) => {
      touch();
      console.log(`[wa] CHANGE_STATE at=${nowISO()} nextState=${nextState}`);
    });

    waClient.on("auth_failure", (msg) => {
      state = "DISCONNECTED";
      setLastError("auth_failure", msg);
    });

    waClient.on("disconnected", (reason) => {
      state = "DISCONNECTED";
      setLastError("disconnected", reason);
    });

    await waClient.initialize();
  } catch (e) {
    state = "DISCONNECTED";
    setLastError("initWhatsApp", e);
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
