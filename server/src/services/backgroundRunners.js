import { env } from "../config/env.js";
import { startBookingRemindersRunner, stopBookingRemindersRunner } from "./booking-reminders.runner.js";
import { startPaymentRemindersRunner, stopPaymentRemindersRunner } from "./payment-reminders.runner.js";
import { startRecurringOffersRunner, stopRecurringOffersRunner } from "./recurring-offers.runner.js";
import { startUserAutomationsRunner, stopUserAutomationsRunner } from "./user-automations.runner.js";
import { startWhatsAppOutboxRunner, stopWhatsAppOutboxRunner } from "./whatsappOutbox.runner.js";

let backgroundRunnersStarted = false;

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/g, "");
}

export function resolveBackgroundRunnerOrigin() {
  const publicUrl = trimTrailingSlash(env.publicFrontendUrl);
  if (publicUrl) return publicUrl;

  const frontendUrl = trimTrailingSlash(env.frontendUrl);
  if (frontendUrl) return frontendUrl;

  const firstCorsOrigin = trimTrailingSlash(String(env.corsOrigin || "").split(",")[0]);
  return firstCorsOrigin;
}

export function shouldRunBackgroundRunners() {
  return env.appRole === "worker" || env.appRole === "all";
}

export function startBackgroundRunners() {
  if (backgroundRunnersStarted) return false;
  if (!shouldRunBackgroundRunners()) return false;

  backgroundRunnersStarted = true;
  const origin = resolveBackgroundRunnerOrigin();

  startRecurringOffersRunner({ origin });
  startBookingRemindersRunner({ origin });
  startPaymentRemindersRunner({ origin });
  startUserAutomationsRunner();
  startWhatsAppOutboxRunner();

  console.log("[background-runners] started", {
    role: env.appRole,
    origin,
  });

  return true;
}

export function stopBackgroundRunners() {
  stopRecurringOffersRunner();
  stopBookingRemindersRunner();
  stopPaymentRemindersRunner();
  stopUserAutomationsRunner();
  stopWhatsAppOutboxRunner();
  backgroundRunnersStarted = false;
}
