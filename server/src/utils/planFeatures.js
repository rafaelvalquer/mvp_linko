export function normalizePlan(value) {
  const plan = String(value || "").trim().toLowerCase();
  if (!plan) return "start";
  return ["start", "pro", "business", "enterprise"].includes(plan)
    ? plan
    : "start";
}

export function canUseRecurring(plan) {
  return ["pro", "business", "enterprise"].includes(normalizePlan(plan));
}

export function canUseNotifyWhatsAppOnPaid(plan) {
  return ["pro", "business", "enterprise"].includes(normalizePlan(plan));
}

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
