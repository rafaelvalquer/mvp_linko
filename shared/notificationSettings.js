export const DEFAULT_PAYMENT_REMINDER_DEFAULTS = {
  enabled24h: false,
  enabled3d: false,
  enabledDueDate: false,
  enabledAfterDueDate: false,
};

export const DEFAULT_NOTIFICATION_SETTINGS = {
  email: {
    sellerProofSubmitted: true,
    sellerPixPaid: true,
    sellerPlatformConfirmed: true,
  },
  whatsapp: {
    masterEnabled: true,
    paymentStatusUpdatesEnabled: true,
    recurringAutoSendDefault: false,
    paymentReminders: {
      enabled: true,
      defaults: { ...DEFAULT_PAYMENT_REMINDER_DEFAULTS },
    },
  },
};

const NOTIFICATION_FEATURE_META = {
  whatsappPaymentStatus: {
    label: "confirmacao de pagamento por WhatsApp",
    planMessage:
      "Confirmacao de pagamento por WhatsApp disponivel apenas nos planos Pro, Business e Enterprise.",
    workspaceMessage:
      "Confirmacao de pagamento por WhatsApp desativada nas configuracoes do workspace.",
  },
  whatsappRecurringAutoSend: {
    label: "autoenvio da recorrencia por WhatsApp",
    planMessage:
      "Autoenvio da recorrencia por WhatsApp disponivel apenas nos planos Pro, Business e Enterprise.",
    workspaceMessage:
      "Autoenvio da recorrencia por WhatsApp desativado nas configuracoes do workspace.",
  },
  whatsappPaymentReminders: {
    label: "lembretes de pagamento por WhatsApp",
    planMessage:
      "Lembretes de pagamento por WhatsApp disponiveis apenas nos planos Business e Enterprise.",
    workspaceMessage:
      "Lembretes de pagamento por WhatsApp desativados nas configuracoes do workspace.",
  },
};

function boolOrDefault(value, fallback) {
  if (value === true) return true;
  if (value === false) return false;
  return fallback;
}

function normalizeReminderDefaults(input = {}, base = DEFAULT_PAYMENT_REMINDER_DEFAULTS) {
  return {
    enabled24h: boolOrDefault(input?.enabled24h, base?.enabled24h ?? false),
    enabled3d: boolOrDefault(input?.enabled3d, base?.enabled3d ?? false),
    enabledDueDate: boolOrDefault(
      input?.enabledDueDate,
      base?.enabledDueDate ?? false,
    ),
    enabledAfterDueDate: boolOrDefault(
      input?.enabledAfterDueDate,
      base?.enabledAfterDueDate ?? false,
    ),
  };
}

export function mergeNotificationSettings(base, patch) {
  const source = base || DEFAULT_NOTIFICATION_SETTINGS;
  const input = patch || {};

  return {
    email: {
      sellerProofSubmitted: boolOrDefault(
        input?.email?.sellerProofSubmitted,
        source?.email?.sellerProofSubmitted ??
          DEFAULT_NOTIFICATION_SETTINGS.email.sellerProofSubmitted,
      ),
      sellerPixPaid: boolOrDefault(
        input?.email?.sellerPixPaid,
        source?.email?.sellerPixPaid ??
          DEFAULT_NOTIFICATION_SETTINGS.email.sellerPixPaid,
      ),
      sellerPlatformConfirmed: boolOrDefault(
        input?.email?.sellerPlatformConfirmed,
        source?.email?.sellerPlatformConfirmed ??
          DEFAULT_NOTIFICATION_SETTINGS.email.sellerPlatformConfirmed,
      ),
    },
    whatsapp: {
      masterEnabled: boolOrDefault(
        input?.whatsapp?.masterEnabled,
        source?.whatsapp?.masterEnabled ??
          DEFAULT_NOTIFICATION_SETTINGS.whatsapp.masterEnabled,
      ),
      paymentStatusUpdatesEnabled: boolOrDefault(
        input?.whatsapp?.paymentStatusUpdatesEnabled,
        source?.whatsapp?.paymentStatusUpdatesEnabled ??
          DEFAULT_NOTIFICATION_SETTINGS.whatsapp.paymentStatusUpdatesEnabled,
      ),
      recurringAutoSendDefault: boolOrDefault(
        input?.whatsapp?.recurringAutoSendDefault,
        source?.whatsapp?.recurringAutoSendDefault ??
          DEFAULT_NOTIFICATION_SETTINGS.whatsapp.recurringAutoSendDefault,
      ),
      paymentReminders: {
        enabled: boolOrDefault(
          input?.whatsapp?.paymentReminders?.enabled,
          source?.whatsapp?.paymentReminders?.enabled ??
            DEFAULT_NOTIFICATION_SETTINGS.whatsapp.paymentReminders.enabled,
        ),
        defaults: normalizeReminderDefaults(
          input?.whatsapp?.paymentReminders?.defaults,
          source?.whatsapp?.paymentReminders?.defaults ??
            DEFAULT_NOTIFICATION_SETTINGS.whatsapp.paymentReminders.defaults,
        ),
      },
    },
  };
}

export function normalizeNotificationSettings(input) {
  return mergeNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS, input || {});
}

function extractNotificationContext(input = {}) {
  const hasSettingsObject =
    input?.settings && typeof input.settings === "object" && !Array.isArray(input.settings);
  const hasNotificationObject =
    input?.notifications &&
    typeof input.notifications === "object" &&
    !Array.isArray(input.notifications);

  return {
    settings: normalizeNotificationSettings(
      hasSettingsObject
        ? input.settings
        : hasNotificationObject
          ? input.notifications
          : input,
    ),
    capabilities:
      input?.capabilities && typeof input.capabilities === "object"
        ? input.capabilities
        : {},
  };
}

export function isEmailNotificationEnabled(context, key) {
  const { settings, capabilities } = extractNotificationContext(context);
  return (
    capabilities?.environment?.email?.available === true &&
    settings?.email?.[key] === true
  );
}

export function isWhatsAppMasterEnabled(context) {
  const { settings, capabilities } = extractNotificationContext(context);
  return (
    capabilities?.environment?.whatsapp?.available === true &&
    settings?.whatsapp?.masterEnabled === true
  );
}

function buildWhatsAppFeatureAvailability({
  envAvailable,
  envReason = "",
  planAllowed,
  masterEnabled,
  workspaceEnabled,
  meta,
}) {
  const base = {
    label: meta?.label || "recurso de WhatsApp",
    planAllowed: planAllowed === true,
    environmentAvailable: envAvailable === true,
    masterEnabled: masterEnabled === true,
    workspaceEnabled: workspaceEnabled === true,
    available: false,
    code: "FEATURE_NOT_AVAILABLE",
    reason: "Recurso indisponivel.",
    statusCode: 403,
  };

  if (envAvailable !== true) {
    return {
      ...base,
      code: "WHATSAPP_ENVIRONMENT_DISABLED",
      reason: envReason
        ? `WhatsApp indisponivel no ambiente: ${envReason}.`
        : "WhatsApp indisponivel no ambiente.",
      statusCode: 503,
    };
  }

  if (planAllowed !== true) {
    return {
      ...base,
      code: "PLAN_NOT_ALLOWED",
      reason: meta?.planMessage || "Plano nao permite este recurso.",
      statusCode: 403,
    };
  }

  if (masterEnabled !== true) {
    return {
      ...base,
      code: "WHATSAPP_MASTER_DISABLED",
      reason: "WhatsApp desativado nas configuracoes do workspace.",
      statusCode: 409,
    };
  }

  if (workspaceEnabled !== true) {
    return {
      ...base,
      code: "WORKSPACE_SETTING_DISABLED",
      reason:
        meta?.workspaceMessage ||
        "Recurso desativado nas configuracoes do workspace.",
      statusCode: 409,
    };
  }

  return {
    ...base,
    available: true,
    code: "",
    reason: "",
    statusCode: 200,
  };
}

export function getNotificationFeatureAvailability(context) {
  const { settings, capabilities } = extractNotificationContext(context);
  const whatsappSettings = settings?.whatsapp || {};
  const whatsappEnvironment = capabilities?.environment?.whatsapp || {};
  const planFeatures = capabilities?.plan?.features || {};
  const masterEnabled = whatsappSettings?.masterEnabled === true;

  return {
    whatsappPaymentStatus: buildWhatsAppFeatureAvailability({
      envAvailable: whatsappEnvironment.available === true,
      envReason: whatsappEnvironment.reason || "",
      planAllowed: planFeatures?.whatsappPaymentStatus === true,
      masterEnabled,
      workspaceEnabled: whatsappSettings?.paymentStatusUpdatesEnabled === true,
      meta: NOTIFICATION_FEATURE_META.whatsappPaymentStatus,
    }),
    whatsappRecurringAutoSend: buildWhatsAppFeatureAvailability({
      envAvailable: whatsappEnvironment.available === true,
      envReason: whatsappEnvironment.reason || "",
      planAllowed: planFeatures?.whatsappRecurringAutoSend === true,
      masterEnabled,
      workspaceEnabled: whatsappSettings?.recurringAutoSendDefault === true,
      meta: NOTIFICATION_FEATURE_META.whatsappRecurringAutoSend,
    }),
    whatsappPaymentReminders: buildWhatsAppFeatureAvailability({
      envAvailable: whatsappEnvironment.available === true,
      envReason: whatsappEnvironment.reason || "",
      planAllowed: planFeatures?.whatsappPaymentReminders === true,
      masterEnabled,
      workspaceEnabled: whatsappSettings?.paymentReminders?.enabled === true,
      meta: NOTIFICATION_FEATURE_META.whatsappPaymentReminders,
    }),
  };
}

export function getNotificationFeatureCapability(context, featureKey) {
  return (
    getNotificationFeatureAvailability(context)?.[featureKey] || {
      available: false,
      code: "FEATURE_NOT_AVAILABLE",
      reason: "Recurso indisponivel.",
      statusCode: 403,
    }
  );
}

export function canSendWhatsAppPaymentStatus(context) {
  return getNotificationFeatureCapability(
    context,
    "whatsappPaymentStatus",
  ).available === true;
}

export function canSendWhatsAppRecurringAutoSend(context) {
  return getNotificationFeatureCapability(
    context,
    "whatsappRecurringAutoSend",
  ).available === true;
}

export function canSendWhatsAppPaymentReminders(context) {
  return getNotificationFeatureCapability(
    context,
    "whatsappPaymentReminders",
  ).available === true;
}

export function getDefaultOfferNotificationFlags(context) {
  const { settings, capabilities } = extractNotificationContext(context);
  const reminderDefaults =
    settings?.whatsapp?.paymentReminders?.defaults ||
    DEFAULT_NOTIFICATION_SETTINGS.whatsapp.paymentReminders.defaults;
  const remindersEnabled = canSendWhatsAppPaymentReminders({
    settings,
    capabilities,
  });

  return {
    notifyWhatsAppOnPaid: canSendWhatsAppPaymentStatus({
      settings,
      capabilities,
    }),
    paymentReminders: {
      enabled24h: remindersEnabled ? reminderDefaults.enabled24h === true : false,
      enabled3d: remindersEnabled ? reminderDefaults.enabled3d === true : false,
      enabledDueDate:
        remindersEnabled ? reminderDefaults.enabledDueDate === true : false,
      enabledAfterDueDate:
        remindersEnabled
          ? reminderDefaults.enabledAfterDueDate === true
          : false,
    },
  };
}

export function getDefaultRecurringAutomationFlags(context) {
  const { settings, capabilities } = extractNotificationContext(context);
  return {
    autoSendToCustomer: canSendWhatsAppRecurringAutoSend({
      settings,
      capabilities,
    }),
  };
}
