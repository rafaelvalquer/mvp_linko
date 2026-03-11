import { AppSettings } from "../models/AppSettings.js";
import { Workspace } from "../models/Workspace.js";
import { getPlanFeatureMatrix, normalizePlan } from "../utils/planFeatures.js";

const DEFAULT_PAYMENT_REMINDER_DEFAULTS = {
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

function hasText(value) {
  return String(value || "").trim().length > 0;
}

function boolOrDefault(value, fallback) {
  if (value === true) return true;
  if (value === false) return false;
  return fallback;
}

function sanitizeReminderDefaults(input = {}, base = DEFAULT_PAYMENT_REMINDER_DEFAULTS) {
  return {
    enabled24h: boolOrDefault(input.enabled24h, base.enabled24h),
    enabled3d: boolOrDefault(input.enabled3d, base.enabled3d),
    enabledDueDate: boolOrDefault(input.enabledDueDate, base.enabledDueDate),
    enabledAfterDueDate: boolOrDefault(
      input.enabledAfterDueDate,
      base.enabledAfterDueDate,
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
        defaults: sanitizeReminderDefaults(
          input?.whatsapp?.paymentReminders?.defaults,
          source?.whatsapp?.paymentReminders?.defaults ??
            DEFAULT_NOTIFICATION_SETTINGS.whatsapp.paymentReminders.defaults,
        ),
      },
    },
  };
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
      raw.whatsapp.recurringAutoSendDefault === true ||
      raw.whatsapp.recurringAutoSendDefault === false
    ) {
      patch.whatsapp.recurringAutoSendDefault =
        raw.whatsapp.recurringAutoSendDefault;
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
  if (!hasText(process.env.WA_GATEWAY_API_KEY)) {
    reasons.push("WA_GATEWAY_API_KEY ausente");
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

  return {
    plan,
    settings,
    capabilities: getNotificationCapabilities(plan),
  };
}

export function isEmailNotificationEnabled(context, key) {
  return (
    context?.capabilities?.environment?.email?.available === true &&
    context?.settings?.email?.[key] === true
  );
}

export function isWhatsAppMasterEnabled(context) {
  return (
    context?.capabilities?.environment?.whatsapp?.available === true &&
    context?.settings?.whatsapp?.masterEnabled === true
  );
}

export function canSendWhatsAppPaymentStatus(context) {
  return (
    isWhatsAppMasterEnabled(context) &&
    context?.capabilities?.plan?.features?.whatsappPaymentStatus === true &&
    context?.settings?.whatsapp?.paymentStatusUpdatesEnabled === true
  );
}

export function canSendWhatsAppRecurringAutoSend(context) {
  return (
    isWhatsAppMasterEnabled(context) &&
    context?.capabilities?.plan?.features?.whatsappRecurringAutoSend === true &&
    context?.settings?.whatsapp?.recurringAutoSendDefault === true
  );
}

export function canSendWhatsAppPaymentReminders(context) {
  return (
    isWhatsAppMasterEnabled(context) &&
    context?.capabilities?.plan?.features?.whatsappPaymentReminders === true &&
    context?.settings?.whatsapp?.paymentReminders?.enabled === true
  );
}

export function getDefaultOfferNotificationFlags(context) {
  const reminderDefaults =
    context?.settings?.whatsapp?.paymentReminders?.defaults ||
    DEFAULT_NOTIFICATION_SETTINGS.whatsapp.paymentReminders.defaults;
  const remindersEnabled = canSendWhatsAppPaymentReminders(context);

  return {
    notifyWhatsAppOnPaid: canSendWhatsAppPaymentStatus(context),
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
