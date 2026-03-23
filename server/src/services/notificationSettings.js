import { AppSettings } from "../models/AppSettings.js";
import { Workspace } from "../models/Workspace.js";
import { getPlanFeatureMatrix, normalizePlan } from "../utils/planFeatures.js";
import { hasWhatsAppGatewayConfig } from "./waGateway.js";

// Keep this notification helper in sync with client/src/utils/notificationSettings.js.

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
    bookingChanges: {
      enabled: true,
    },
  },
  whatsapp: {
    masterEnabled: true,
    paymentStatusUpdatesEnabled: true,
    offerCancelledEnabled: false,
    recurringAutoSendDefault: false,
    bookingReminders: {
      enabled: false,
    },
    bookingChanges: {
      enabled: true,
    },
    paymentReminders: {
      enabled: true,
      defaults: { ...DEFAULT_PAYMENT_REMINDER_DEFAULTS },
    },
  },
};

const NOTIFICATION_FEATURE_META = {
  whatsappPaymentStatus: {
    label: "confirmação de pagamento por WhatsApp",
    planMessage:
      "Confirmação de pagamento por WhatsApp disponível apenas nos planos Pro, Business e Enterprise.",
    workspaceMessage:
      "Confirmação de pagamento por WhatsApp desativada nas configurações do workspace.",
  },
  whatsappOfferCancelled: {
    label: "cancelamento de proposta por WhatsApp",
    planMessage:
      "Cancelamento de proposta por WhatsApp disponivel apenas nos planos Pro, Business e Enterprise.",
    workspaceMessage:
      "Cancelamento de proposta por WhatsApp desativado nas configuracoes do workspace.",
  },
  whatsappRecurringAutoSend: {
    label: "autoenvio da recorrência por WhatsApp",
    planMessage:
      "Autoenvio da recorrência por WhatsApp disponível apenas nos planos Pro, Business e Enterprise.",
    workspaceMessage:
      "Autoenvio da recorrência por WhatsApp desativado nas configurações do workspace.",
  },
  whatsappPaymentReminders: {
    label: "lembretes de pagamento por WhatsApp",
    planMessage:
      "Lembretes de pagamento por WhatsApp disponíveis apenas nos planos Business e Enterprise.",
    workspaceMessage:
      "Lembretes de pagamento por WhatsApp desativados nas configurações do workspace.",
  },
  whatsappBookingReminders: {
    label: "lembretes de agendamento por WhatsApp",
    planMessage:
      "Lembretes de agendamento por WhatsApp disponíveis apenas nos planos Pro, Business e Enterprise.",
    workspaceMessage:
      "Lembretes de agendamento por WhatsApp desativados nas configurações do workspace.",
  },
  whatsappBookingChanges: {
    label: "alteracoes de agenda por WhatsApp",
    planMessage:
      "Alteracoes de agenda por WhatsApp disponiveis apenas nos planos Pro, Business e Enterprise.",
    workspaceMessage:
      "Alteracoes de agenda por WhatsApp desativadas nas configuracoes do workspace.",
  },
};

NOTIFICATION_FEATURE_META.whatsappPaymentReminders.planMessage =
  "Lembretes de pagamento por WhatsApp disponiveis apenas nos planos Pro, Business e Enterprise.";
NOTIFICATION_FEATURE_META.whatsappPaymentReminders.workspaceMessage =
  "Lembretes de pagamento por WhatsApp desativados nas configuracoes do workspace.";

function hasText(value) {
  return String(value || "").trim().length > 0;
}

function boolOrDefault(value, fallback) {
  if (value === true) return true;
  if (value === false) return false;
  return fallback;
}

function normalizeReminderDefaults(
  input = {},
  base = DEFAULT_PAYMENT_REMINDER_DEFAULTS,
) {
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

function isEmailSettingEnabled(value) {
  if (value === true) return true;
  if (value && typeof value === "object") return value.enabled === true;
  return false;
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
      bookingChanges: {
        enabled: boolOrDefault(
          input?.email?.bookingChanges?.enabled,
          source?.email?.bookingChanges?.enabled ??
            DEFAULT_NOTIFICATION_SETTINGS.email.bookingChanges.enabled,
        ),
      },
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
      offerCancelledEnabled: boolOrDefault(
        input?.whatsapp?.offerCancelledEnabled,
        source?.whatsapp?.offerCancelledEnabled ??
          DEFAULT_NOTIFICATION_SETTINGS.whatsapp.offerCancelledEnabled,
      ),
      recurringAutoSendDefault: boolOrDefault(
        input?.whatsapp?.recurringAutoSendDefault,
        source?.whatsapp?.recurringAutoSendDefault ??
          DEFAULT_NOTIFICATION_SETTINGS.whatsapp.recurringAutoSendDefault,
      ),
      bookingReminders: {
        enabled: boolOrDefault(
          input?.whatsapp?.bookingReminders?.enabled,
          source?.whatsapp?.bookingReminders?.enabled ??
            DEFAULT_NOTIFICATION_SETTINGS.whatsapp.bookingReminders.enabled,
        ),
      },
      bookingChanges: {
        enabled: boolOrDefault(
          input?.whatsapp?.bookingChanges?.enabled,
          source?.whatsapp?.bookingChanges?.enabled ??
            DEFAULT_NOTIFICATION_SETTINGS.whatsapp.bookingChanges.enabled,
        ),
      },
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
    input?.settings &&
    typeof input.settings === "object" &&
    !Array.isArray(input.settings);
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
    isEmailSettingEnabled(settings?.email?.[key])
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
    reason: "Recurso indisponível.",
    statusCode: 403,
  };

  if (envAvailable !== true) {
    return {
      ...base,
      code: "WHATSAPP_ENVIRONMENT_DISABLED",
      reason: envReason
        ? `WhatsApp indisponível no ambiente: ${envReason}.`
        : "WhatsApp indisponível no ambiente.",
      statusCode: 503,
    };
  }

  if (planAllowed !== true) {
    return {
      ...base,
      code: "PLAN_NOT_ALLOWED",
      reason: meta?.planMessage || "Plano não permite este recurso.",
      statusCode: 403,
    };
  }

  if (masterEnabled !== true) {
    return {
      ...base,
      code: "WHATSAPP_MASTER_DISABLED",
      reason: "WhatsApp desativado nas configurações do workspace.",
      statusCode: 409,
    };
  }

  if (workspaceEnabled !== true) {
    return {
      ...base,
      code: "WORKSPACE_SETTING_DISABLED",
      reason:
        meta?.workspaceMessage ||
        "Recurso desativado nas configurações do workspace.",
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
    whatsappOfferCancelled: buildWhatsAppFeatureAvailability({
      envAvailable: whatsappEnvironment.available === true,
      envReason: whatsappEnvironment.reason || "",
      planAllowed: planFeatures?.whatsappOfferCancelled === true,
      masterEnabled,
      workspaceEnabled: whatsappSettings?.offerCancelledEnabled === true,
      meta: NOTIFICATION_FEATURE_META.whatsappOfferCancelled,
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
    whatsappBookingReminders: buildWhatsAppFeatureAvailability({
      envAvailable: whatsappEnvironment.available === true,
      envReason: whatsappEnvironment.reason || "",
      planAllowed: planFeatures?.whatsappBookingReminders === true,
      masterEnabled,
      workspaceEnabled: whatsappSettings?.bookingReminders?.enabled === true,
      meta: NOTIFICATION_FEATURE_META.whatsappBookingReminders,
    }),
    whatsappBookingChanges: buildWhatsAppFeatureAvailability({
      envAvailable: whatsappEnvironment.available === true,
      envReason: whatsappEnvironment.reason || "",
      planAllowed: planFeatures?.whatsappBookingChanges === true,
      masterEnabled,
      workspaceEnabled: whatsappSettings?.bookingChanges?.enabled === true,
      meta: NOTIFICATION_FEATURE_META.whatsappBookingChanges,
    }),
  };
}

export function getNotificationFeatureCapability(context, featureKey) {
  return (
    getNotificationFeatureAvailability(context)?.[featureKey] || {
      available: false,
      code: "FEATURE_NOT_AVAILABLE",
      reason: "Recurso indisponível.",
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

export function canSendWhatsAppOfferCancelled(context) {
  return getNotificationFeatureCapability(
    context,
    "whatsappOfferCancelled",
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

export function canSendWhatsAppBookingReminders(context) {
  return getNotificationFeatureCapability(
    context,
    "whatsappBookingReminders",
  ).available === true;
}

export function canSendWhatsAppBookingChanges(context) {
  return getNotificationFeatureCapability(
    context,
    "whatsappBookingChanges",
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

function sanitizeReminderDefaults(
  input = {},
  base = DEFAULT_PAYMENT_REMINDER_DEFAULTS,
) {
  return normalizeReminderDefaults(input, base);
}

export function sanitizeNotificationPatch(input) {
  const raw = input || {};
  const patch = {};

  if (raw.email && typeof raw.email === "object") {
    patch.email = {};
    if (raw.email.sellerProofSubmitted === true || raw.email.sellerProofSubmitted === false) {
      patch.email.sellerProofSubmitted = raw.email.sellerProofSubmitted;
    }
    if (raw.email.sellerPixPaid === true || raw.email.sellerPixPaid === false) {
      patch.email.sellerPixPaid = raw.email.sellerPixPaid;
    }
    if (
      raw.email.sellerPlatformConfirmed === true ||
      raw.email.sellerPlatformConfirmed === false
    ) {
      patch.email.sellerPlatformConfirmed = raw.email.sellerPlatformConfirmed;
    }
    if (
      raw.email.bookingChanges &&
      typeof raw.email.bookingChanges === "object" &&
      (raw.email.bookingChanges.enabled === true ||
        raw.email.bookingChanges.enabled === false)
    ) {
      patch.email.bookingChanges = {
        enabled: raw.email.bookingChanges.enabled,
      };
    }
    if (Object.keys(patch.email).length === 0) delete patch.email;
  }

  if (raw.whatsapp && typeof raw.whatsapp === "object") {
    patch.whatsapp = {};
    if (raw.whatsapp.masterEnabled === true || raw.whatsapp.masterEnabled === false) {
      patch.whatsapp.masterEnabled = raw.whatsapp.masterEnabled;
    }
    if (
      raw.whatsapp.paymentStatusUpdatesEnabled === true ||
      raw.whatsapp.paymentStatusUpdatesEnabled === false
    ) {
      patch.whatsapp.paymentStatusUpdatesEnabled =
        raw.whatsapp.paymentStatusUpdatesEnabled;
    }
    if (
      raw.whatsapp.offerCancelledEnabled === true ||
      raw.whatsapp.offerCancelledEnabled === false
    ) {
      patch.whatsapp.offerCancelledEnabled =
        raw.whatsapp.offerCancelledEnabled;
    }
    if (
      raw.whatsapp.recurringAutoSendDefault === true ||
      raw.whatsapp.recurringAutoSendDefault === false
    ) {
      patch.whatsapp.recurringAutoSendDefault =
        raw.whatsapp.recurringAutoSendDefault;
    }
    if (
      raw.whatsapp.bookingReminders &&
      typeof raw.whatsapp.bookingReminders === "object" &&
      (raw.whatsapp.bookingReminders.enabled === true ||
        raw.whatsapp.bookingReminders.enabled === false)
    ) {
      patch.whatsapp.bookingReminders = {
        enabled: raw.whatsapp.bookingReminders.enabled,
      };
    }
    if (
      raw.whatsapp.bookingChanges &&
      typeof raw.whatsapp.bookingChanges === "object" &&
      (raw.whatsapp.bookingChanges.enabled === true ||
        raw.whatsapp.bookingChanges.enabled === false)
    ) {
      patch.whatsapp.bookingChanges = {
        enabled: raw.whatsapp.bookingChanges.enabled,
      };
    }

    if (
      raw.whatsapp.paymentReminders &&
      typeof raw.whatsapp.paymentReminders === "object"
    ) {
      patch.whatsapp.paymentReminders = {};
      if (
        raw.whatsapp.paymentReminders.enabled === true ||
        raw.whatsapp.paymentReminders.enabled === false
      ) {
        patch.whatsapp.paymentReminders.enabled =
          raw.whatsapp.paymentReminders.enabled;
      }

      if (
        raw.whatsapp.paymentReminders.defaults &&
        typeof raw.whatsapp.paymentReminders.defaults === "object"
      ) {
        const defaults = {};
        for (const key of Object.keys(DEFAULT_PAYMENT_REMINDER_DEFAULTS)) {
          const value = raw.whatsapp.paymentReminders.defaults[key];
          if (value === true || value === false) defaults[key] = value;
        }
        if (Object.keys(defaults).length > 0) {
          patch.whatsapp.paymentReminders.defaults = defaults;
        }
      }

      if (Object.keys(patch.whatsapp.paymentReminders).length === 0) {
        delete patch.whatsapp.paymentReminders;
      }
    }

    if (Object.keys(patch.whatsapp).length === 0) delete patch.whatsapp;
  }

  return patch;
}

function getEmailEnvironmentCapability() {
  const reasons = [];
  if (!hasText(process.env.RESEND_API_KEY)) reasons.push("RESEND_API_KEY ausente");
  if (!hasText(process.env.RESEND_FROM)) reasons.push("RESEND_FROM ausente");

  return {
    available: reasons.length === 0,
    reason: reasons[0] || "",
    reasons,
  };
}

function getWhatsAppEnvironmentCapability() {
  const reasons = [];

  if (
    String(process.env.WHATSAPP_NOTIFICATIONS_ENABLED || "")
      .trim()
      .toLowerCase() !== "true"
  ) {
    reasons.push("WHATSAPP_NOTIFICATIONS_ENABLED desativado");
  }
  if (!hasText(process.env.WA_GATEWAY_URL)) reasons.push("WA_GATEWAY_URL ausente");
  if (!hasWhatsAppGatewayConfig("send")) {
    reasons.push(
      "WA_GATEWAY_SEND_API_KEY ausente (ou WA_GATEWAY_API_KEY legacy ausente)",
    );
  }

  return {
    available: reasons.length === 0,
    reason: reasons[0] || "",
    reasons,
  };
}

export function getNotificationCapabilities(planValue) {
  const plan = normalizePlan(planValue);
  const features = getPlanFeatureMatrix(plan);
  const environment = {
    email: getEmailEnvironmentCapability(),
    whatsapp: getWhatsAppEnvironmentCapability(),
  };

  return {
    environment,
    plan: {
      value: plan,
      features,
    },
  };
}

async function loadPlanFromWorkspace(workspaceId) {
  if (!workspaceId) return "start";
  const workspace = await Workspace.findById(workspaceId).select("plan").lean();
  return normalizePlan(workspace?.plan);
}

async function findSettingsDocument({ workspaceId, ownerUserId }) {
  if (!workspaceId) return null;
  if (ownerUserId) {
    return AppSettings.findOne({ workspaceId, ownerUserId })
      .select("notifications")
      .lean();
  }

  return AppSettings.findOne({ workspaceId }).select("notifications").lean();
}

export async function loadWorkspaceNotificationSettings({
  workspaceId,
  ownerUserId = null,
}) {
  const doc = await findSettingsDocument({ workspaceId, ownerUserId });
  return mergeNotificationSettings(
    DEFAULT_NOTIFICATION_SETTINGS,
    doc?.notifications || {},
  );
}

export async function resolveWorkspaceNotificationContext({
  workspaceId,
  ownerUserId = null,
  workspacePlan = null,
}) {
  const plan = normalizePlan(workspacePlan || (await loadPlanFromWorkspace(workspaceId)));
  const settings = await loadWorkspaceNotificationSettings({
    workspaceId,
    ownerUserId,
  });
  const capabilities = getNotificationCapabilities(plan);
  const featureAvailability = getNotificationFeatureAvailability({
    settings,
    capabilities,
  });

  return {
    plan,
    settings,
    capabilities,
    featureAvailability,
  };
}

export function createNotificationFeatureError({
  context,
  featureKey,
  capability = null,
  action = "usar este recurso",
}) {
  const resolvedCapability =
    capability || getNotificationFeatureCapability(context, featureKey);
  const message =
    resolvedCapability?.reason ||
    `Não foi possível ${action} porque o recurso está indisponível.`;

  const err = new Error(message);
  err.status = Number(resolvedCapability?.statusCode) || 403;
  err.statusCode = err.status;
  err.code = resolvedCapability?.code || "FEATURE_NOT_AVAILABLE";
  err.reason = message;
  err.capability = {
    featureKey,
    ...resolvedCapability,
  };
  err.details = {
    action,
    featureKey,
    capability: err.capability,
  };
  return err;
}

export function assertNotificationFeatureSelection({
  context,
  featureKey,
  requested,
  action = "usar este recurso",
}) {
  if (requested !== true) return false;

  const capability = getNotificationFeatureCapability(context, featureKey);
  if (capability.available !== true) {
    throw createNotificationFeatureError({
      context,
      featureKey,
      capability,
      action,
    });
  }

  return true;
}

