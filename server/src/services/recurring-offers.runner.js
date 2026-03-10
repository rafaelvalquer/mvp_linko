// server/src/services/recurring-offers.runner.js
import { processDueRecurringOffers } from "./recurring-offers.service.js";

let runnerStarted = false;
let intervalRef = null;
let running = false;

export async function runRecurringOffersCycle(options = {}) {
  if (running) {
    return { ok: true, skipped: true, reason: "already_running" };
  }

  running = true;
  try {
    return await processDueRecurringOffers(options);
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
