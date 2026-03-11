import { processAutomaticPaymentReminders } from "./paymentReminder.service.js";

let runnerStarted = false;
let intervalRef = null;
let running = false;

export async function runPaymentRemindersCycle(options = {}) {
  if (running) {
    return { ok: true, skipped: true, reason: "already_running" };
  }

  running = true;
  try {
    return await processAutomaticPaymentReminders(options);
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
