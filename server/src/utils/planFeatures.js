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

export function getAutomationPlanLimits(value) {
  const plan = normalizePlan(value);

  if (plan === "enterprise") {
    return {
      plan,
      activeLimit: 30,
      recipientsPerChannel: 10,
      historyDays: 180,
      allowedFrequencies: ["daily", "weekly"],
    };
  }

  if (plan === "business") {
    return {
      plan,
      activeLimit: 10,
      recipientsPerChannel: 3,
      historyDays: 60,
      allowedFrequencies: ["daily", "weekly"],
    };
  }

  if (plan === "pro") {
    return {
      plan,
      activeLimit: 3,
      recipientsPerChannel: 1,
      historyDays: 15,
      allowedFrequencies: ["daily", "weekly"],
    };
  }

  return {
    plan,
    activeLimit: 0,
    recipientsPerChannel: 0,
    historyDays: 0,
    allowedFrequencies: [],
  };
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

export function whatsappAccountPhoneFeatureError() {
  const err = new Error(
    "O WhatsApp da conta fica disponÃ­vel apenas nos planos Pro, Business e Enterprise.",
  );
  err.status = 403;
  err.statusCode = 403;
  err.code = "WHATSAPP_ACCOUNT_PHONE_PLAN_BLOCKED";
  return err;
}

export function assertWhatsAppAccountPhoneAllowed(plan) {
  const normalizedPlan = normalizePlan(plan);
  if (!canUseWhatsAppAccountPhone(normalizedPlan)) {
    throw whatsappAccountPhoneFeatureError();
  }
  return normalizedPlan;
}
