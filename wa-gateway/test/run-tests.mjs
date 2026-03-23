import assert from "node:assert/strict";

import { loadGatewayConfig, validateGatewayConfig } from "../src/config.js";
import {
  isLidUserId,
  normalizeInboundPhoneDigits,
  normalizeToBR,
} from "../src/phone.js";
import { getClientIp, isIpAllowed, matchesApiKey } from "../src/security.js";
import { startTypingHeartbeat } from "../src/typing.js";

async function run(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
  }
}

await run("config legacy fallback", () => {
  const config = loadGatewayConfig({
    env: {
      NODE_ENV: "production",
      WA_API_KEY: "legacy-key",
      WA_QR_PUBLIC: "",
      WA_INBOUND_FORWARD_ENABLED: "false",
    },
    exists: () => true,
  });

  assert.equal(config.auth.adminApiKey, "legacy-key");
  assert.equal(config.auth.sendApiKey, "legacy-key");
  assert.equal(config.auth.qrPublic, false);
});

await run("config validation catches webhook and chrome", () => {
  const config = loadGatewayConfig({
    env: {
      WA_ADMIN_API_KEY: "admin",
      WA_SEND_API_KEY: "send",
      WA_INBOUND_FORWARD_ENABLED: "true",
    },
    exists: () => false,
  });

  const result = validateGatewayConfig(config);
  assert.equal(result.ok, false);
  assert.equal(
    result.errors.some((error) => error.code === "WEBHOOK_URL_MISSING"),
    true,
  );
  assert.equal(
    result.errors.some((error) => error.code === "CHROME_MISSING"),
    true,
  );
});

await run("phone normalization", () => {
  assert.equal(normalizeToBR("(11) 99999-8888"), "5511999998888");
  assert.equal(normalizeInboundPhoneDigits("11999998888"), "5511999998888");
  assert.equal(normalizeInboundPhoneDigits("123"), "");
  assert.equal(isLidUserId("222776245907523@lid"), true);
});

await run("security helpers", () => {
  const req = {
    headers: { "x-forwarded-for": " ::ffff:10.0.0.1, 127.0.0.1 " },
    socket: { remoteAddress: "::1" },
  };

  assert.equal(getClientIp(req), "10.0.0.1");
  assert.equal(isIpAllowed("127.0.0.1", ["loopback"]), true);
  assert.equal(matchesApiKey(" secret ", "secret"), true);
});

await run("typing heartbeat lifecycle", async () => {
  let typingCalls = 0;
  let clearCalls = 0;

  const message = {
    async getChat() {
      return {
        async sendStateTyping() {
          typingCalls += 1;
        },
        async clearState() {
          clearCalls += 1;
        },
      };
    },
  };

  const handle = await startTypingHeartbeat({
    enabled: true,
    heartbeatMs: 10,
    message,
  });

  await new Promise((resolve) => setTimeout(resolve, 25));
  await handle.stop();

  assert.equal(handle.active, true);
  assert.equal(typingCalls >= 2, true);
  assert.equal(clearCalls, 1);
});

if (!process.exitCode) {
  console.log("All tests passed.");
}
