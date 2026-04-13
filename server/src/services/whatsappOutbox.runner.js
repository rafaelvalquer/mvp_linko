import { processWhatsAppOutboxCycle } from "./whatsappOutbox.service.js";
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
const RUNTIME_NAME = "whatsapp-outbox-runner";

registerRuntime(RUNTIME_NAME, {
  type: "runner",
  intervalMs: Math.max(
    15000,
    Number(process.env.WHATSAPP_OUTBOX_RUNNER_MS || 30000),
  ),
});

function resolveSchedulerLeaseTtlMs(intervalMs) {
  return Math.max(
    30_000,
    Number(
      process.env.WHATSAPP_OUTBOX_RUNNER_SCHEDULER_LOCK_TTL_MS ||
        intervalMs * 2,
    ),
  );
}

export async function runWhatsAppOutboxCycle(options = {}) {
  if (running) {
    return { ok: true, skipped: true, reason: "already_running" };
  }

  const intervalMs = Math.max(
    15000,
    Number(process.env.WHATSAPP_OUTBOX_RUNNER_MS || 30000),
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
        console.log("[whatsapp-outbox-runner]", {
          role: env.appRole,
          runner: RUNTIME_NAME,
          lockId: lease?.lockId || null,
          reason: "cycle_started",
        });
        return processWhatsAppOutboxCycle(options);
      },
    );

    if (summary?.reason === "lease_not_acquired") {
      console.log("[whatsapp-outbox-runner]", {
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

export function startWhatsAppOutboxRunner(options = {}) {
  if (runnerStarted) return intervalRef;
  runnerStarted = true;

  if (process.env.NODE_ENV === "test") return null;

  const intervalMs = Math.max(
    15000,
    Number(process.env.WHATSAPP_OUTBOX_RUNNER_MS || 30000),
  );
  markRuntimeStarted(RUNTIME_NAME, { intervalMs });

  const run = async () => {
    try {
      const summary = await runWhatsAppOutboxCycle(options);
      console.log("[whatsapp-outbox-runner]", {
        whatsAppReady: summary?.ready === true,
        gatewayState: summary?.gatewayState || "UNKNOWN",
        queuedTotal: Number(summary?.queuedTotal || 0),
        queuedOfferReminders: Number(summary?.queuedOfferReminders || 0),
        processed: Number(summary?.processed || 0),
        sent: Number(summary?.sent || 0),
        failed: Number(summary?.failed || 0),
        queued: Number(summary?.queued || 0),
        skipped: Number(summary?.skipped || 0),
        reason: summary?.reason || "",
      });
    } catch (error) {
      console.error("[whatsapp-outbox-runner]", error?.message || error);
    }
  };

  initialTimeoutRef = setTimeout(run, 7000);
  intervalRef = setInterval(run, intervalMs);
  return intervalRef;
}

export function stopWhatsAppOutboxRunner() {
  if (initialTimeoutRef) clearTimeout(initialTimeoutRef);
  if (intervalRef) clearInterval(intervalRef);
  initialTimeoutRef = null;
  intervalRef = null;
  running = false;
  runnerStarted = false;
}
