export const PLAN_VALUES = ["start", "pro", "business", "enterprise"];

export function normalizePlan(value) {
  const plan = String(value || "").trim().toLowerCase();
  if (!plan) return "start";
  return PLAN_VALUES.includes(plan) ? plan : "start";
}

export function getPlanFeatureMatrix(value) {
  const plan = normalizePlan(value);
  const recurring = ["pro", "business", "enterprise"].includes(plan);
  const whatsappPaymentStatus = ["pro", "business", "enterprise"].includes(
    plan,
  );
  const whatsappRecurringAutoSend = ["pro", "business", "enterprise"].includes(
    plan,
  );
  const whatsappBookingReminders = ["pro", "business", "enterprise"].includes(
    plan,
  );
  const whatsappPaymentReminders = ["business", "enterprise"].includes(plan);

  return {
    plan,
    recurring,
    whatsappPaymentStatus,
    whatsappRecurringAutoSend,
    whatsappBookingReminders,
    whatsappPaymentReminders,
  };
}

export function canUseRecurring(value) {
  return getPlanFeatureMatrix(value).recurring;
}

export function canUseRecurringPlan(value) {
  return canUseRecurring(value);
}

export function canUseNotifyWhatsAppOnPaid(value) {
  return getPlanFeatureMatrix(value).whatsappPaymentStatus;
}

export function canUseRecurringAutoSend(value) {
  return getPlanFeatureMatrix(value).whatsappRecurringAutoSend;
}

export function canUseBookingReminderWhatsApp(value) {
  return getPlanFeatureMatrix(value).whatsappBookingReminders;
}

export function canUsePaymentReminderWhatsApp(value) {
  return getPlanFeatureMatrix(value).whatsappPaymentReminders;
}
