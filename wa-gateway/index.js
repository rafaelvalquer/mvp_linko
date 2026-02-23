// wa-gateway/index.js
import express from "express";
import dotenv from "dotenv";

import qrcodePkg from "qrcode-terminal";
import whatsappPkg from "whatsapp-web.js";
import QRCode from "qrcode";

dotenv.config();

const qrcode = qrcodePkg?.default ?? qrcodePkg; // compat CJS/ESM
const { Client, LocalAuth } = whatsappPkg?.default ?? whatsappPkg;

const PORT = Number(process.env.PORT || process.env.WA_PORT || 3010);

const API_KEY = process.env.WA_API_KEY || "";
const SESSION_PATH = process.env.WA_SESSION_PATH || "./wa-session";

const HEADLESS =
  String(process.env.WA_PUPPETEER_HEADLESS || "true").toLowerCase() === "true";

// ✅ /qr no browser (MVP)
// - WA_QR_PUBLIC=true permite abrir /qr sem key
// - se WA_QR_PUBLIC=false, exige key em ?key=... ou header x-api-key
const QR_PUBLIC =
  String(process.env.WA_QR_PUBLIC || "true").toLowerCase() === "true";
const QR_KEY = process.env.WA_QR_KEY || ""; // opcional (se vazio, aceita WA_API_KEY)

let state = "INIT"; // INIT | QR | READY | DISCONNECTED
let phone = null;
let lastSeen = new Date().toISOString();

let latestQr = null;
let latestQrAt = null;

function touch() {
  lastSeen = new Date().toISOString();
}

function nowISO() {
  return new Date().toISOString();
}

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
  const expected = QR_KEY || API_KEY; // se WA_QR_KEY não definido, usa WA_API_KEY

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
  res.json({ ok: true, at: nowISO() });
});

app.get("/status", requireApiKey, (req, res) => {
  res.json({
    ok: true,
    state,
    phone,
    lastSeen,
    hasLatestQr: !!latestQr,
    latestQrAt,
  });
});

// ✅ página HTML para escanear o QR
app.get("/qr", async (req, res) => {
  const ip =
    req.headers["x-forwarded-for"]?.toString()?.split(",")?.[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";
  const ua = req.headers["user-agent"] || "unknown";

  const isReady = state === "READY";
  const hasQr = !!latestQr;

  const authorized = allowQrAccess(req);

  // logs da rota /qr (pedido do usuário)
  console.log(
    `[qr] access ip=${ip} ua="${ua}" authorized=${authorized} state=${state} isReady=${isReady} hasQr=${hasQr} at=${nowISO()}`,
  );

  if (!authorized) {
    res.status(401).setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.send(
      "UNAUTHORIZED\n\nDefina WA_QR_PUBLIC=true (MVP) ou acesse com ?key=SEU_TOKEN (ou header x-api-key).",
    );
  }

  // se já está logado, mostra status “logado” em tela
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
    <hr/>
    <p style="color:#555">Se precisar reconectar, reinicie o serviço para gerar um novo QR.</p>
  </body>
</html>`);
  }

  // se ainda não tem QR, mostra “aguarde” e auto refresh
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
  </body>
</html>`);
  }

  // tem QR: renderiza imagem e auto refresh enquanto não READY
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
    <p><b>Status:</b> ${state} (não logado ainda)</p>
    <p><b>Gerado em:</b> ${latestQrAt}</p>
    <img src="${dataUrl}" alt="QR Code" style="max-width: 320px; width: 100%; height: auto;" />
    <p style="margin-top:12px;color:#555">
      Escaneie no WhatsApp: <b>Dispositivos conectados</b> → <b>Conectar dispositivo</b>.
      Esta página atualiza sozinha.
    </p>
    <p style="color:#777"><b>Última atividade:</b> ${lastSeen}</p>
  </body>
</html>`);
});

let waClient = null;

async function initWhatsApp() {
  console.log(
    `[wa] init at=${nowISO()} headless=${HEADLESS} sessionPath=${SESSION_PATH}`,
  );

  waClient = new Client({
    authStrategy: new LocalAuth({ dataPath: SESSION_PATH }),
    puppeteer: {
      headless: HEADLESS,
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

    phone = widUser ? `55${widUser}`.replace(/\D/g, "") : widUser;

    // opcional: limpa QR após conectar
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
    touch();
    console.log(`[wa] AUTH_FAILURE at=${nowISO()} msg=${msg}`);
  });

  waClient.on("disconnected", (reason) => {
    state = "DISCONNECTED";
    touch();
    console.log(`[wa] DISCONNECTED at=${nowISO()} reason=${reason}`);
  });

  await waClient.initialize();
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
      return res.status(503).json({ ok: false, error: "WHATSAPP_NOT_READY" });
    }

    const chatId = `${toNorm}@c.us`;
    console.log(
      `[send] at=${nowISO()} to=${toNorm} chars=${String(message).length}`,
    );

    const result = await waClient.sendMessage(chatId, String(message));
    const providerMessageId = result?.id?._serialized || result?.id?.id || null;

    touch();
    return res.json({ ok: true, providerMessageId });
  } catch (err) {
    touch();
    console.error("[send] error:", err?.message || err);
    return res.status(500).json({
      ok: false,
      error: "SEND_FAILED",
      details: err?.message || String(err),
    });
  }
});

app.listen(PORT, () => {
  console.log(`[wa-gateway] listening on :${PORT}`);
  initWhatsApp().catch((e) => {
    state = "DISCONNECTED";
    touch();
    console.error("[wa] Failed to init WhatsApp:", e?.message || e);
  });
});
