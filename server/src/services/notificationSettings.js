import { AppSettings } from "../models/AppSettings.js";
import { Workspace } from "../models/Workspace.js";
import { getPlanFeatureMatrix, normalizePlan } from "../utils/planFeatures.js";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_PAYMENT_REMINDER_DEFAULTS,
  canSendWhatsAppPaymentReminders,
  canSendWhatsAppPaymentStatus,
  canSendWhatsAppRecurringAutoSend,
  getDefaultOfferNotificationFlags,
  getNotificationFeatureAvailability,
  getNotificationFeatureCapability,
  isEmailNotificationEnabled,
  isWhatsAppMasterEnabled,
  mergeNotificationSettings,
} from "../../../shared/notificationSettings.js";

export {
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_PAYMENT_REMINDER_DEFAULTS,
  canSendWhatsAppPaymentReminders,
  canSendWhatsAppPaymentStatus,
  canSendWhatsAppRecurringAutoSend,
  getDefaultOfferNotificationFlags,
  getNotificationFeatureAvailability,
  getNotificationFeatureCapability,
  isEmailNotificationEnabled,
  isWhatsAppMasterEnabled,
  mergeNotificationSettings,
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
    `Nao foi possivel ${action} porque o recurso esta indisponivel.`;

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
