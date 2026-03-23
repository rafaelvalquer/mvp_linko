import test from "node:test";
import assert from "node:assert/strict";

import { startTypingHeartbeat } from "../src/typing.js";

test("startTypingHeartbeat renews and clears typing state", async () => {
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
