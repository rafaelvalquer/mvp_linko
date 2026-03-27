import { processDueUserAutomations } from "./userAutomations.service.js";
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
const RUNTIME_NAME = "user-automations-runner";

registerRuntime(RUNTIME_NAME, {
  type: "runner",
  intervalMs: Math.max(
    60000,
    Number(process.env.USER_AUTOMATIONS_RUNNER_MS || 300000),
  ),
});

export async function runUserAutomationsCycle(options = {}) {
  if (running) {
    return { ok: true, skipped: true, reason: "already_running" };
  }

  running = true;
  markRuntimeCycleStart(RUNTIME_NAME);
  try {
    const summary = await processDueUserAutomations(options);
    markRuntimeCycleSuccess(RUNTIME_NAME, summary);
    return summary;
  } catch (error) {
    markRuntimeCycleError(RUNTIME_NAME, error);
    throw error;
  } finally {
    running = false;
  }
}

export function startUserAutomationsRunner(options = {}) {
  if (runnerStarted) return intervalRef;
  runnerStarted = true;

  if (process.env.NODE_ENV === "test") return null;

  const intervalMs = Math.max(
    60000,
    Number(process.env.USER_AUTOMATIONS_RUNNER_MS || 300000),
  );
  markRuntimeStarted(RUNTIME_NAME, { intervalMs });

  const run = async () => {
    try {
      await runUserAutomationsCycle(options);
    } catch (error) {
      console.error("[user-automations-runner]", error?.message || error);
    }
  };

  setTimeout(run, 15000);
  intervalRef = setInterval(run, intervalMs);
  return intervalRef;
}
