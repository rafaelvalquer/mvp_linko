import { processAutomaticBookingReminders } from "./bookingReminder.service.js";
import { env } from "../config/env.js";
import { runWithDistributedLease } from "./distributedLease.service.js";
import {
  markRuntimeCycleError,
  markRuntimeCycleStart,
  markRuntimeCycleSuccess,
  markRuntimeStarted,
  registerRuntime,
} from "./runtimeStatus.js";

let runnerStarted = false;
let intervalRef = null;
let initialTimeoutRef = null;
let running = false;
const RUNTIME_NAME = "booking-reminders-runner";

registerRuntime(RUNTIME_NAME, {
  type: "runner",
  intervalMs: Math.max(
    60000,
    Number(process.env.BOOKING_REMINDERS_RUNNER_MS || 300000),
  ),
});

function resolveSchedulerLeaseTtlMs(intervalMs) {
  return Math.max(
    30_000,
    Number(
      process.env.BOOKING_REMINDERS_RUNNER_SCHEDULER_LOCK_TTL_MS ||
        intervalMs * 2,
    ),
  );
}

export async function runBookingRemindersCycle(options = {}) {
  if (running) {
    return { ok: true, skipped: true, reason: "already_running" };
  }

  const intervalMs = Math.max(
    60000,
    Number(process.env.BOOKING_REMINDERS_RUNNER_MS || 300000),
  );

  running = true;
  markRuntimeCycleStart(RUNTIME_NAME);
  try {
    const summary = await runWithDistributedLease(
      {
        key: `runner-scheduler:${RUNTIME_NAME}`,
        ttlMs: resolveSchedulerLeaseTtlMs(intervalMs),
        meta: {
          runner: RUNTIME_NAME,
          role: env.appRole,
        },
        renewLabel: RUNTIME_NAME,
        onLeaseUnavailable: () => ({
          ok: true,
          skipped: true,
          reason: "lease_not_acquired",
        }),
      },
      async (lease) => {
        console.log("[booking-reminders-runner]", {
          role: env.appRole,
          runner: RUNTIME_NAME,
          lockId: lease?.lockId || null,
          reason: "cycle_started",
        });
        return processAutomaticBookingReminders(options);
      },
    );

    if (summary?.reason === "lease_not_acquired") {
      console.log("[booking-reminders-runner]", {
        role: env.appRole,
        runner: RUNTIME_NAME,
        reason: "lease_not_acquired",
      });
    }

    markRuntimeCycleSuccess(RUNTIME_NAME, summary);
    return summary;
  } catch (error) {
    markRuntimeCycleError(RUNTIME_NAME, error);
    throw error;
  } finally {
    running = false;
  }
}

export function startBookingRemindersRunner(options = {}) {
  if (runnerStarted) return intervalRef;
  runnerStarted = true;

  if (process.env.NODE_ENV === "test") return null;

  const intervalMs = Math.max(
    60000,
    Number(process.env.BOOKING_REMINDERS_RUNNER_MS || 300000),
  );
  markRuntimeStarted(RUNTIME_NAME, { intervalMs });

  const run = async () => {
    try {
      await runBookingRemindersCycle(options);
    } catch (error) {
      console.error("[booking-reminders-runner]", error?.message || error);
    }
  };

  initialTimeoutRef = setTimeout(run, 10000);
  intervalRef = setInterval(run, intervalMs);
  return intervalRef;
}

export function stopBookingRemindersRunner() {
  if (initialTimeoutRef) clearTimeout(initialTimeoutRef);
  if (intervalRef) clearInterval(intervalRef);
  initialTimeoutRef = null;
  intervalRef = null;
  running = false;
  runnerStarted = false;
}
