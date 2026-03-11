import { processAutomaticPaymentReminders } from "./paymentReminder.service.js";
import {
  markRuntimeCycleError,
  markRuntimeCycleStart,
  markRuntimeCycleSuccess,
  markRuntimeStarted,
  registerRuntime,
} from "./runtimeStatus.js";

let runnerStarted = false;
let intervalRef = null;
let running = false;
const RUNTIME_NAME = "payment-reminders-runner";

registerRuntime(RUNTIME_NAME, {
  type: "runner",
  intervalMs: Math.max(
    60000,
    Number(process.env.PAYMENT_REMINDERS_RUNNER_MS || 300000),
  ),
});

export async function runPaymentRemindersCycle(options = {}) {
  if (running) {
    return { ok: true, skipped: true, reason: "already_running" };
  }

  running = true;
  markRuntimeCycleStart(RUNTIME_NAME);
  try {
    const summary = await processAutomaticPaymentReminders(options);
    markRuntimeCycleSuccess(RUNTIME_NAME, summary);
    return summary;
  } catch (error) {
    markRuntimeCycleError(RUNTIME_NAME, error);
    throw error;
  } finally {
    running = false;
  }
}

export function startPaymentRemindersRunner(options = {}) {
  if (runnerStarted) return intervalRef;
  runnerStarted = true;

  if (process.env.NODE_ENV === "test") return null;

  const intervalMs = Math.max(
    60000,
    Number(process.env.PAYMENT_REMINDERS_RUNNER_MS || 300000),
  );
  markRuntimeStarted(RUNTIME_NAME, { intervalMs });

  const run = async () => {
    try {
      await runPaymentRemindersCycle(options);
    } catch (error) {
      console.error("[payment-reminders-runner]", error?.message || error);
    }
  };

  setTimeout(run, 10000);
  intervalRef = setInterval(run, intervalMs);
  return intervalRef;
}
