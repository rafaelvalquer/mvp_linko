// server/src/routes/webhooks.abacatepay.routes.js
import express from "express";
import crypto from "crypto";
import { pixCharges, bookings } from "../mvpStore.js";
import { abacateCheckPix } from "../services/abacatepayClient.js";

const router = express.Router();

// conforme docs (public HMAC key)
const ABACATEPAY_PUBLIC_KEY =
  "t9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9";

function verifySignature(rawBody, signatureFromHeader) {
  if (!rawBody || !signatureFromHeader) return false;

  const expectedSig = crypto
    .createHmac("sha256", ABACATEPAY_PUBLIC_KEY)
    .update(Buffer.from(rawBody, "utf8"))
    .digest("base64");

  const A = Buffer.from(expectedSig);
  const B = Buffer.from(signatureFromHeader);

  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

router.post("/webhook/abacatepay", async (req, res) => {
  try {
    // camada 1: secret na URL
    const webhookSecret = String(req.query.webhookSecret || "");
    const expectedSecret = String(process.env.WEBHOOK_SECRET || "");
    if (expectedSecret && webhookSecret !== expectedSecret) {
      return res.status(401).json({ error: "Invalid webhook secret" });
    }

    // camada 2: assinatura HMAC
    const sig = String(req.header("X-Webhook-Signature") || "");
    const raw = String(req.rawBody || "");
    if (!verifySignature(raw, sig)) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    const event = req.body || {};
    const eventName = String(event.event || "");
    if (eventName !== "billing.paid") {
      return res.status(200).json({ received: true });
    }

    const pixId = event?.data?.pixQrCode?.id;
    if (!pixId) return res.status(200).json({ received: true });

    // fonte da verdade
    const abacate = await abacateCheckPix({ pixId });
    const status = String(abacate.status || "").toUpperCase();

    const local = pixCharges.get(pixId);
    if (local) {
      local.status = status;
      local.expiresAt = abacate.expiresAt || local.expiresAt;
      pixCharges.set(pixId, local);

      if (status === "PAID") {
        const booking = bookings.find(
          (b) => b.id === local.bookingId && b.token === local.token,
        );
        if (booking && booking.status === "HOLD") {
          booking.status = "CONFIRMED";
          booking.paidAt = new Date().toISOString();
        }
      }
    }

    return res.status(200).json({ received: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Webhook error" });
  }
});

export default router;
