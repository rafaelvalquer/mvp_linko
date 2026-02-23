// wa-gateway/index.js
import express from "express";
import dotenv from "dotenv";

import qrcodePkg from "qrcode-terminal";
import whatsappPkg from "whatsapp-web.js";

dotenv.config();

const qrcode = qrcodePkg?.default ?? qrcodePkg; // compat CJS/ESM
const { Client, LocalAuth } = whatsappPkg?.default ?? whatsappPkg; // <-- FIX AQUI

const PORT = Number(process.env.WA_PORT || 3010);
const API_KEY = process.env.WA_API_KEY || "";
const SESSION_PATH = process.env.WA_SESSION_PATH || "./wa-session";
const HEADLESS =
  String(process.env.WA_PUPPETEER_HEADLESS || "true").toLowerCase() === "true";

let state = "INIT"; // INIT | QR | READY | DISCONNECTED
let phone = null;
let lastSeen = new Date().toISOString();

function touch() {
  lastSeen = new Date().toISOString();
}

function requireApiKey(req, res, next) {
  const key = req.header("x-api-key");
  if (!API_KEY)
    return res.status(500).json({ ok: false, error: "WA_API_KEY_NOT_SET" });
  if (key !== API_KEY)
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  next();
}

function normalizeToBR(toRaw) {
  const digits = String(toRaw || "").replace(/\D/g, "");
  if (!digits) return null;

  // Se veio como 11 (DDD+9+8dig) ou 10 (DDD+8dig), assume BR e prefixa 55
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;

  // Se já veio com DDI BR
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13))
    return digits;

  // Caso já venha com algum DDI/variação, mantém (MVP)
  return digits;
}

const app = express();
app.use(express.json({ limit: "200kb" }));

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/status", requireApiKey, (req, res) => {
  res.json({ ok: true, state, phone, lastSeen });
});

let waClient = null;

async function initWhatsApp() {
  waClient = new Client({
    authStrategy: new LocalAuth({
      dataPath: SESSION_PATH,
    }),
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

    console.log("\n================ WHATSAPP QR (RAW) ================\n");
    console.log(qr); // ✅ sempre aparece no log (texto simples)

    console.log("\n================ WHATSAPP QR (ASCII) ==============\n");
    qrcode.generate(qr, { small: true }, (out) => {
      console.log(out); // ✅ Render captura melhor assim
    });

    console.log("\nEscaneie o QR no WhatsApp (Dispositivos conectados)\n");
  });

  waClient.on("ready", () => {
    state = "READY";
    touch();

    // tenta descobrir o número conectado
    const widUser =
      waClient?.info?.wid?.user || waClient?.info?.me?.user || null;

    phone = widUser ? `55${widUser}`.replace(/\D/g, "") : widUser;
    console.log(`WhatsApp READY: ${widUser || "CONNECTED"}`);
  });

  waClient.on("authenticated", () => {
    touch();
    console.log("WhatsApp AUTHENTICATED");
  });

  waClient.on("auth_failure", (msg) => {
    state = "DISCONNECTED";
    touch();
    console.log("AUTH_FAILURE:", msg);
  });

  waClient.on("disconnected", (reason) => {
    state = "DISCONNECTED";
    touch();
    console.log("DISCONNECTED:", reason);
  });

  await waClient.initialize();
}

app.post("/send", requireApiKey, async (req, res) => {
  console.log(req);
  console.log(res);
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
    const result = await waClient.sendMessage(chatId, String(message));

    const providerMessageId = result?.id?._serialized || result?.id?.id || null;

    touch();
    return res.json({ ok: true, providerMessageId });
  } catch (err) {
    touch();
    return res.status(500).json({
      ok: false,
      error: "SEND_FAILED",
      details: err?.message || String(err),
    });
  }
});

app.listen(PORT, () => {
  console.log(`wa-gateway listening on http://localhost:${PORT}`);
  initWhatsApp().catch((e) => {
    state = "DISCONNECTED";
    touch();
    console.error("Failed to init WhatsApp:", e);
  });
});
