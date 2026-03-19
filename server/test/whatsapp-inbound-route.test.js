import test from "node:test";
import assert from "node:assert/strict";

process.env.MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/test";

const { validateInboundPayload } = await import(
  "../src/routes/whatsapp-ai.routes.js"
);

test("validateInboundPayload accepts text payload", () => {
  const payload = validateInboundPayload({
    messageId: "wamid-1",
    fromPhoneDigits: "5511999999999",
    pushName: "Rafael",
    type: "text",
    text: "criar proposta",
    timestamp: "2026-03-17T22:10:00.000Z",
  });

  assert.equal(payload.type, "text");
  assert.equal(payload.text, "criar proposta");
  assert.equal(payload.timestamp, "2026-03-17T22:10:00.000Z");
});

test("validateInboundPayload accepts audio payload", () => {
  const payload = validateInboundPayload({
    messageId: "wamid-2",
    fromPhoneDigits: "5511999999999",
    type: "audio",
    mimeType: "audio/ogg",
    audioBase64: "ZmFrZQ==",
  });

  assert.equal(payload.type, "audio");
  assert.equal(payload.mimeType, "audio/ogg");
  assert.equal(payload.audioBase64, "ZmFrZQ==");
});

test("validateInboundPayload rejects invalid bodies", () => {
  assert.throws(
    () =>
      validateInboundPayload({
        messageId: "wamid-3",
        fromPhoneDigits: "5511999999999",
        type: "text",
      }),
    /text obrigatorio/i,
  );

  assert.throws(
    () =>
      validateInboundPayload({
        messageId: "wamid-4",
        fromPhoneDigits: "5511999999999",
        type: "audio",
        mimeType: "audio/ogg",
      }),
    /audioBase64/i,
  );
});
