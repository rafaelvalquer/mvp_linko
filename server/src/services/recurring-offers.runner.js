// server/src/services/recurring-offers.runner.js
import { processDueRecurringOffers } from "./recurring-offers.service.js";
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
const RUNTIME_NAME = "recurring-offers-runner";

registerRuntime(RUNTIME_NAME, {
  type: "runner",
  intervalMs: Math.max(
    15000,
    Number(process.env.RECURRING_OFFERS_RUNNER_MS || 60000),
  ),
});

function resolveSchedulerLeaseTtlMs(intervalMs) {
  return Math.max(
    30_000,
    Number(
      process.env.RECURRING_OFFERS_RUNNER_SCHEDULER_LOCK_TTL_MS ||
        intervalMs * 2,
    ),
  );
}

export async function runRecurringOffersCycle(options = {}) {
  if (running) {
    return { ok: true, skipped: true, reason: "already_running" };
  }

  const intervalMs = Math.max(
    15000,
    Number(process.env.RECURRING_OFFERS_RUNNER_MS || 60000),
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
        console.log("[recurring-runner]", {
          role: env.appRole,
          runner: RUNTIME_NAME,
          lockId: lease?.lockId || null,
          reason: "cycle_started",
        });
        return processDueRecurringOffers(options);
      },
    );

    if (summary?.reason === "lease_not_acquired") {
      console.log("[recurring-runner]", {
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

export function startRecurringOffersRunner(options = {}) {
  if (runnerStarted) return intervalRef;
  runnerStarted = true;

  if (process.env.NODE_ENV === "test") return null;

  const intervalMs = Math.max(
    15000,
    Number(process.env.RECURRING_OFFERS_RUNNER_MS || 60000),
  );
  markRuntimeStarted(RUNTIME_NAME, { intervalMs });

  const run = async () => {
    try {
      await runRecurringOffersCycle(options);
    } catch (error) {
      console.error("[recurring-runner]", error?.message || error);
    }
  };

  initialTimeoutRef = setTimeout(run, 5000);
  intervalRef = setInterval(run, intervalMs);
  return intervalRef;
}

export function stopRecurringOffersRunner() {
  if (initialTimeoutRef) clearTimeout(initialTimeoutRef);
  if (intervalRef) clearInterval(intervalRef);
  initialTimeoutRef = null;
  intervalRef = null;
  running = false;
  runnerStarted = false;
}
