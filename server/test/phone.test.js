import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeDestinationPhoneN11,
  normalizeUserWhatsAppPhone,
  normalizeWhatsAppPhoneDigits,
} from "../src/utils/phone.js";

test("normalizeWhatsAppPhoneDigits canonicalizes local BR numbers", () => {
  assert.equal(normalizeWhatsAppPhoneDigits("11999998888"), "5511999998888");
  assert.equal(normalizeWhatsAppPhoneDigits("+55 (11) 99999-8888"), "5511999998888");
});

test("normalizeDestinationPhoneN11 accepts n11 and strips +55 when present", () => {
  assert.equal(normalizeDestinationPhoneN11("11999998888"), "11999998888");
  assert.equal(normalizeDestinationPhoneN11("+55 11 99999-8888"), "11999998888");
  assert.equal(normalizeDestinationPhoneN11("1133334444"), "");
});

test("normalizeUserWhatsAppPhone validates and allows clearing", () => {
  assert.deepEqual(normalizeUserWhatsAppPhone(""), {
    whatsappPhone: "",
    whatsappPhoneDigits: "",
  });

  assert.deepEqual(normalizeUserWhatsAppPhone("11 99999-8888"), {
    whatsappPhone: "11 99999-8888",
    whatsappPhoneDigits: "5511999998888",
  });

  assert.throws(
    () => normalizeUserWhatsAppPhone("123"),
    /WhatsApp valido/i,
  );
});
