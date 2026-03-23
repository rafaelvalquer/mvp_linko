import test from "node:test";
import assert from "node:assert/strict";

import {
  isLidUserId,
  normalizeInboundPhoneDigits,
  normalizeToBR,
} from "../src/phone.js";

test("normalizeToBR accepts local and brazilian numbers", () => {
  assert.equal(normalizeToBR("(11) 99999-8888"), "5511999998888");
  assert.equal(normalizeToBR("5511999998888"), "5511999998888");
  assert.equal(normalizeToBR("abc"), null);
});

test("normalizeInboundPhoneDigits rejects unsupported lengths", () => {
  assert.equal(normalizeInboundPhoneDigits("11999998888"), "5511999998888");
  assert.equal(normalizeInboundPhoneDigits("5511999998888"), "5511999998888");
  assert.equal(normalizeInboundPhoneDigits("123"), "");
});

test("isLidUserId detects lid users", () => {
  assert.equal(isLidUserId("222776245907523@lid"), true);
  assert.equal(isLidUserId("5511999998888@c.us"), false);
});
