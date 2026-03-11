export {
  canUseNotifyWhatsAppOnPaid,
  canUsePaymentReminderWhatsApp,
  canUseRecurring,
  canUseRecurringAutoSend,
  getPlanFeatureMatrix,
  normalizePlan,
} from "../../../shared/planFeatures.js";

export function recurringFeatureError() {
  const err = new Error(
    "Recorrências disponíveis apenas nos planos Pro, Business e Enterprise.",
  );
  err.status = 403;
  err.statusCode = 403;
  return err;
}

export function assertRecurringPlanAllowed(plan) {
  const normalizedPlan = normalizePlan(plan);
  if (!canUseRecurring(normalizedPlan)) {
    throw recurringFeatureError();
  }
  return normalizedPlan;
}
