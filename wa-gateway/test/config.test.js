import test from "node:test";
import assert from "node:assert/strict";

import { loadGatewayConfig, validateGatewayConfig } from "../src/config.js";

test("loadGatewayConfig separates admin and send keys with legacy fallback", () => {
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

test("validateGatewayConfig reports missing webhook and chrome", () => {
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
