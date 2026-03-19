import { Router } from "express";

import { env } from "../config/env.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { processInboundWhatsAppEvent } from "../services/whatsapp-ai/whatsappCommandProcessor.service.js";

const r = Router();

function assertInternalKey(req, res, next) {
  if (!env.internalWaWebhookKey) {
    return res.status(503).json({
      ok: false,
      error: "INTERNAL_WA_WEBHOOK_KEY_NOT_SET",
    });
  }

  if (req.header("x-internal-key") !== env.internalWaWebhookKey) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }

  return next();
}

function isNonEmpty(value) {
  return String(value || "").trim().length > 0;
}

function validateInboundPayload(body = {}) {
  const type = String(body.type || "").trim().toLowerCase();
  const timestamp = body.timestamp ? new Date(body.timestamp) : null;

  if (!isNonEmpty(body.messageId)) {
    const err = new Error("messageId obrigatorio.");
    err.status = 400;
    throw err;
  }

  if (!isNonEmpty(body.fromPhoneDigits)) {
    const err = new Error("fromPhoneDigits obrigatorio.");
    err.status = 400;
    throw err;
  }

  if (!["text", "audio"].includes(type)) {
    const err = new Error("type invalido.");
    err.status = 400;
    throw err;
  }

  if (type === "text" && !isNonEmpty(body.text)) {
    const err = new Error("text obrigatorio para mensagens de texto.");
    err.status = 400;
    throw err;
  }

  if (type === "audio") {
    if (!isNonEmpty(body.mimeType) || !isNonEmpty(body.audioBase64)) {
      const err = new Error("mimeType e audioBase64 sao obrigatorios para audio.");
      err.status = 400;
      throw err;
    }
  }

  return {
    messageId: String(body.messageId || "").trim(),
    fromPhoneDigits: String(body.fromPhoneDigits || "").trim(),
    pushName: String(body.pushName || "").trim(),
    type,
    text: String(body.text || "").trim(),
    mimeType: String(body.mimeType || "").trim(),
    audioBase64: String(body.audioBase64 || ""),
    timestamp:
      timestamp && !Number.isNaN(timestamp.getTime())
        ? timestamp.toISOString()
        : null,
  };
}

export { validateInboundPayload };

r.use(assertInternalKey);

r.post(
  "/inbound",
  asyncHandler(async (req, res) => {
    const payload = validateInboundPayload(req.body || {});
    const result = await processInboundWhatsAppEvent(payload);
    return res.json({
      ok: result?.ok !== false,
      status: result?.status || "processed",
      ...(result?.error ? { error: result.error } : {}),
    });
  }),
);

export default r;
