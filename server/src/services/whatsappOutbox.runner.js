import { processWhatsAppOutboxCycle } from "./whatsappOutbox.service.js";

let runnerStarted = false;
let intervalRef = null;
let running = false;

export async function runWhatsAppOutboxCycle(options = {}) {
  if (running) {
    return { ok: true, skipped: true, reason: "already_running" };
  }

  running = true;
  try {
    return await processWhatsAppOutboxCycle(options);
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

  setTimeout(run, 7000);
  intervalRef = setInterval(run, intervalMs);
  return intervalRef;
}
