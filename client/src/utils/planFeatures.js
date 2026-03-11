export function normalizePlan(value) {
  const plan = String(value || "").trim().toLowerCase();
  if (!plan) return "start";
  return ["start", "pro", "business", "enterprise"].includes(plan)
    ? plan
    : "start";
}

export function canUseRecurringPlan(plan) {
  return ["pro", "business", "enterprise"].includes(normalizePlan(plan));
}
