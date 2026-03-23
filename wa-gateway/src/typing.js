export function createNoopTypingHandle() {
  return {
    active: false,
    async stop() {},
  };
}

export async function startTypingHeartbeat({
  enabled = false,
  heartbeatMs = 20000,
  message = null,
  messageId = "",
  fromPhoneDigits = "",
  type = "unknown",
  compactForLog = (value) => String(value || ""),
  logWarn = () => {},
}) {
  if (!enabled || !message) {
    return createNoopTypingHandle();
  }

  let chat = null;

  try {
    chat = await message.getChat();
  } catch (error) {
    logWarn(
      `[inbound] typing chat lookup failed messageId=${messageId} from=${fromPhoneDigits || "unknown"} type=${type} error="${compactForLog(
        error?.message || String(error),
        160,
      )}"`,
    );
    return createNoopTypingHandle();
  }

  if (
    !chat ||
    typeof chat.sendStateTyping !== "function" ||
    typeof chat.clearState !== "function"
  ) {
    return createNoopTypingHandle();
  }

  let stopped = false;
  let renewTimer = null;
  let sendInFlight = false;

  const emitTyping = async () => {
    if (stopped || sendInFlight) return;
    sendInFlight = true;

    try {
      await chat.sendStateTyping();
    } catch (error) {
      logWarn(
        `[inbound] typing start failed messageId=${messageId} from=${fromPhoneDigits || "unknown"} type=${type} error="${compactForLog(
          error?.message || String(error),
          160,
        )}"`,
      );
    } finally {
      sendInFlight = false;
    }
  };

  await emitTyping();

  renewTimer = setInterval(() => {
    void emitTyping();
  }, heartbeatMs);

  return {
    active: true,
    async stop() {
      if (stopped) return;
      stopped = true;

      if (renewTimer) {
        clearInterval(renewTimer);
        renewTimer = null;
      }

      try {
        await chat.clearState();
      } catch (error) {
        logWarn(
          `[inbound] typing clear failed messageId=${messageId} from=${fromPhoneDigits || "unknown"} type=${type} error="${compactForLog(
            error?.message || String(error),
            160,
          )}"`,
        );
      }
    },
  };
}

