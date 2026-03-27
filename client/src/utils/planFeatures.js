export const PLAN_VALUES = ["start", "pro", "business", "enterprise"];

export function normalizePlan(value) {
  const plan = String(value || "").trim().toLowerCase();
  if (!plan) return "start";
  return PLAN_VALUES.includes(plan) ? plan : "start";
}

export function getPlanFeatureMatrix(value) {
  const plan = normalizePlan(value);
  const recurring = ["pro", "business", "enterprise"].includes(plan);
  const automations = ["pro", "business", "enterprise"].includes(plan);
  const whatsappAccountPhone = [
    "pro",
    "business",
    "enterprise",
  ].includes(plan);
  const whatsappAiOfferCreation = [
    "pro",
    "business",
    "enterprise",
  ].includes(plan);
  const whatsappPaymentStatus = ["pro", "business", "enterprise"].includes(
    plan,
  );
  const whatsappOfferCancelled = ["pro", "business", "enterprise"].includes(
    plan,
  );
  const whatsappRecurringAutoSend = ["pro", "business", "enterprise"].includes(
    plan,
  );
  const whatsappBookingReminders = ["pro", "business", "enterprise"].includes(
    plan,
  );
  const whatsappBookingChanges = ["pro", "business", "enterprise"].includes(
    plan,
  );
  const whatsappOfferPaymentReminders = [
    "pro",
    "business",
    "enterprise",
  ].includes(plan);
  const whatsappPaymentReminders = ["pro", "business", "enterprise"].includes(
    plan,
  );

  return {
    plan,
    recurring,
    automations,
    whatsappAccountPhone,
    whatsappAiOfferCreation,
    whatsappPaymentStatus,
    whatsappOfferCancelled,
    whatsappRecurringAutoSend,
    whatsappBookingReminders,
    whatsappBookingChanges,
    whatsappOfferPaymentReminders,
    whatsappPaymentReminders,
  };
}

export function canUseRecurring(value) {
  return getPlanFeatureMatrix(value).recurring;
}

export function canUseAutomations(value) {
  return getPlanFeatureMatrix(value).automations;
}

export function canUseWhatsAppAccountPhone(value) {
  return getPlanFeatureMatrix(value).whatsappAccountPhone;
}

export function canUseWhatsAppAiOfferCreation(value) {
  return getPlanFeatureMatrix(value).whatsappAiOfferCreation;
}

export function canUseRecurringPlan(value) {
  return canUseRecurring(value);
}

export function canUseNotifyWhatsAppOnPaid(value) {
  return getPlanFeatureMatrix(value).whatsappPaymentStatus;
}

export function canUseOfferCancelledWhatsApp(value) {
  return getPlanFeatureMatrix(value).whatsappOfferCancelled;
}

export function canUseRecurringAutoSend(value) {
  return getPlanFeatureMatrix(value).whatsappRecurringAutoSend;
}

export function canUseBookingReminderWhatsApp(value) {
  return getPlanFeatureMatrix(value).whatsappBookingReminders;
}

export function canUseBookingChangeWhatsApp(value) {
  return getPlanFeatureMatrix(value).whatsappBookingChanges;
}

export function canUseOfferPaymentReminderWhatsApp(value) {
  return getPlanFeatureMatrix(value).whatsappOfferPaymentReminders;
}

export function canUsePaymentReminderWhatsApp(value) {
  return getPlanFeatureMatrix(value).whatsappPaymentReminders;
}
