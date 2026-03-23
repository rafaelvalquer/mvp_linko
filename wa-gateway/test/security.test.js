import test from "node:test";
import assert from "node:assert/strict";

import { getClientIp, isIpAllowed, matchesApiKey } from "../src/security.js";

test("getClientIp prefers forwarded headers and normalizes mapped ipv4", () => {
  const req = {
    headers: { "x-forwarded-for": " ::ffff:10.0.0.1, 127.0.0.1 " },
    socket: { remoteAddress: "::1" },
  };

  assert.equal(getClientIp(req), "10.0.0.1");
});

test("isIpAllowed supports exact match and loopback token", () => {
  assert.equal(isIpAllowed("10.0.0.1", ["10.0.0.1"]), true);
  assert.equal(isIpAllowed("127.0.0.1", ["loopback"]), true);
  assert.equal(isIpAllowed("10.0.0.2", ["10.0.0.1"]), false);
});

test("matchesApiKey compares trimmed values", () => {
  assert.equal(matchesApiKey(" secret ", "secret"), true);
  assert.equal(matchesApiKey("secret", "other"), false);
});
