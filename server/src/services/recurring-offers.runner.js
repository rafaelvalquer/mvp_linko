// server/src/services/recurring-offers.runner.js
import { processDueRecurringOffers } from "./recurring-offers.service.js";
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
const RUNTIME_NAME = "recurring-offers-runner";

registerRuntime(RUNTIME_NAME, {
  type: "runner",
  intervalMs: Math.max(
    15000,
    Number(process.env.RECURRING_OFFERS_RUNNER_MS || 60000),
  ),
});

export async function runRecurringOffersCycle(options = {}) {
  if (running) {
    return { ok: true, skipped: true, reason: "already_running" };
  }

  running = true;
  markRuntimeCycleStart(RUNTIME_NAME);
  try {
    const summary = await processDueRecurringOffers(options);
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

  setTimeout(run, 5000);
  intervalRef = setInterval(run, intervalMs);
  return intervalRef;
}
