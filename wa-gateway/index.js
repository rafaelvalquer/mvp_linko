// wa-gateway/index.js
import express from "express";
import dotenv from "dotenv";

import qrcodePkg from "qrcode-terminal";
import whatsappPkg from "whatsapp-web.js";
import QRCode from "qrcode";

dotenv.config();

const qrcode = qrcodePkg?.default ?? qrcodePkg; // compat CJS/ESM
const { Client, LocalAuth } = whatsappPkg?.default ?? whatsappPkg;

// Render usa PORT
const PORT = Number(process.env.PORT || process.env.WA_PORT || 3010);

const API_KEY = process.env.WA_API_KEY || "";
const SESSION_PATH = process.env.WA_SESSION_PATH || "./wa-session";

const HEADLESS =
  String(process.env.WA_PUPPETEER_HEADLESS || "true").toLowerCase() === "true";

// /qr access
const QR_PUBLIC =
  String(process.env.WA_QR_PUBLIC || "true").toLowerCase() === "true";
const QR_KEY = process.env.WA_QR_KEY || ""; // opcional (se vazio, usa WA_API_KEY)

let state = "INIT"; // INIT | STARTING | QR | READY | DISCONNECTED
let phone = null;
let lastSeen = new Date().toISOString();

let latestQr = null;
let latestQrAt = null;

let lastError = null;
let lastErrorAt = null;

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
  if (!API_KEY)
    return res.status(500).json({ ok: false, error: "WA_API_KEY_NOT_SET" });
  if (key !== API_KEY)
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
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

  return digits;
}

const app = express();
app.use(express.json({ limit: "200kb" }));

app.get("/health", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ ok: true, at: nowISO(), state });
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
  });
});

// ✅ visualizar QR no navegador
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
      "UNAUTHORIZED\n\nDefina WA_QR_PUBLIC=true (MVP) ou acesse com ?key=SEU_TOKEN (ou header x-api-key).",
    );
  }

  // Se já está logado
  if (isReady) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(`<!doctype html>
<html>
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>WhatsApp QR</title></head>
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

  // Sem QR ainda (ou init falhou)
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
    <p style="color:#555"><b>Última atividade:</b> ${lastSeen}</p>
    ${
      lastError
        ? `<div style="margin-top:12px;padding:12px;border:1px solid #f59e0b;background:#fffbeb;border-radius:10px;">
             <b>Último erro:</b><br/>${lastError}<br/><small>${lastErrorAt}</small>
           </div>`
        : ""
    }
    <hr/>
    <p style="color:#666;font-size:13px;">
      Se o status ficar DISCONNECTED e não aparecer QR, quase sempre é falha ao iniciar o Chromium/Puppeteer no Render.
    </p>
  </body>
</html>`);
  }

  // Tem QR: renderiza imagem
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
    <p style="color:#777"><b>Última atividade:</b> ${lastSeen}</p>
    ${
      lastError
        ? `<hr/><p style="color:#b45309"><b>Último erro:</b> ${lastError}<br/><b>Quando:</b> ${lastErrorAt}</p>`
        : ""
    }
  </body>
</html>`);
});

let waClient = null;

async function initWhatsApp() {
  state = "STARTING";
  touch();

  console.log(
    `[wa] init at=${nowISO()} headless=${HEADLESS} sessionPath=${SESSION_PATH}`,
  );

  try {
    waClient = new Client({
      authStrategy: new LocalAuth({ dataPath: SESSION_PATH }),
      puppeteer: {
        headless: HEADLESS,
        // Se você usar chromium do sistema, pode setar PUPPETEER_EXECUTABLE_PATH no Render
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
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

      // opcional: limpa QR depois de conectar
      latestQr = null;
      latestQrAt = null;

      console.log(`[wa] READY at=${nowISO()} phone=${phone || widUser || "?"}`);
    });

    waClient.on("authenticated", () => {
      touch();
      console.log(`[wa] AUTHENTICATED at=${nowISO()}`);
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
  }
}

app.post("/send", requireApiKey, async (req, res) => {
  try {
    const { to, message } = req.body || {};
    if (!to || !message) {
      return res.status(400).json({ ok: false, error: "INVALID_BODY" });
    }

    const toNorm = normalizeToBR(to);
    if (!toNorm)
      return res.status(400).json({ ok: false, error: "INVALID_TO" });

    if (state !== "READY") {
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

    // ✅ LOG: número + mensagem (com preview seguro)
    console.log(
      `[send] at=${nowISO()} from=${phone || "?"} to=${toNorm} chatId=${chatId} chars=${msg.length} message="${compactForLog(
        msg,
        320,
      )}"`,
    );

    const result = await waClient.sendMessage(chatId, msg);
    const providerMessageId = result?.id?._serialized || result?.id?.id || null;

    // ✅ LOG: confirmação do envio
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

app.listen(PORT, () => {
  console.log(`[wa-gateway] listening on :${PORT}`);
  initWhatsApp();
});
