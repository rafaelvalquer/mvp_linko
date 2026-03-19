import { env } from "../config/env.js";
import { Offer } from "../models/Offer.js";
import OfferReminderLog from "../models/OfferReminderLog.js";
import { getPlanFeatureMatrix } from "../utils/planFeatures.js";
import { queueOrSendWhatsApp } from "./whatsappOutbox.service.js";
import {
  resolveWorkspaceNotificationContext,
} from "./notificationSettings.js";
import { buildOfferPublicUrl } from "./publicUrl.service.js";

const TZ = "America/Sao_Paulo";

function onlyDigits(v) {
  return String(v || "").replace(/\D+/g, "");
}

function normalizePhoneBR(raw) {
  const digits = onlyDigits(raw);
  if (!digits) return "";
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (
    digits.startsWith("55") &&
    (digits.length === 12 || digits.length === 13)
  ) {
    return digits;
  }
  return digits;
}

function firstName(name) {
  const s = String(name || "").trim();
  if (!s) return "";
  return s.split(/\s+/)[0] || "";
}

function normStatus(v) {
  const s = String(v || "")
    .trim()
    .toUpperCase();
  if (!s) return "";
  return s === "CANCELED" ? "CANCELLED" : s;
}

function formatDateTimeSP(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function dateKeySP(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function computeOfferDueDate(offer) {
  const enabled = offer?.validityEnabled === true;
  const days = Number(offer?.validityDays);
  const createdAt = offer?.createdAt ? new Date(offer.createdAt) : null;

  if (!enabled || !Number.isFinite(days) || days <= 0 || !createdAt)
    return null;
  if (Number.isNaN(createdAt.getTime())) return null;

  const dueDate = addDays(createdAt, days);
  return startOfDay(dueDate);
}

export function isOfferReminderEligible(offer) {
  const paymentStatus = normStatus(offer?.paymentStatus);
  const status = normStatus(offer?.status);
  const hasProof = !!offer?.paymentProof?.storage?.key;

  if (!offer?._id) {
    return { ok: false, reason: "Proposta não encontrada." };
  }

  if (hasProof) {
    return {
      ok: false,
      reason:
        "O cliente já enviou comprovante. Não é possível enviar lembrete.",
    };
  }

  if (["CONFIRMED", "PAID"].includes(paymentStatus)) {
    return { ok: false, reason: "O pagamento já foi confirmado." };
  }

  if (["WAITING_CONFIRMATION", "REJECTED"].includes(paymentStatus)) {
    return {
      ok: false,
      reason: "A proposta não está mais aguardando pagamento simples.",
    };
  }

  if (["CANCELLED", "EXPIRED", "CONFIRMED", "PAID"].includes(status)) {
    return {
      ok: false,
      reason: "A proposta não pode receber lembretes no status atual.",
    };
  }

  if (paymentStatus !== "PENDING") {
    return {
      ok: false,
      reason: "Somente propostas pendentes podem receber lembretes.",
    };
  }

  return { ok: true, reason: "" };
}

function reminderHeadline(kind) {
  switch (kind) {
    case "after_24h":
      return "Sua proposta ainda está aguardando pagamento.";
    case "after_3d":
      return "Passando para reforçar que sua proposta segue aguardando pagamento.";
    case "due_date":
      return "Hoje é o dia previsto para o pagamento da sua proposta.";
    case "after_due_date":
      return "Sua proposta está com pagamento pendente após o vencimento.";
    default:
      return "Sua proposta ainda está aguardando pagamento.";
  }
}

export function buildPaymentReminderMessage({
  offer,
  kind = "manual",
  publicUrl,
}) {
  const name = firstName(offer?.customerName);
  const greeting = name ? `Olá ${name}!` : "Olá!";
  const lines = [
    greeting,
    "",
    reminderHeadline(kind),
    "",
    "Você pode finalizar pelo link abaixo:",
    publicUrl || "",
    "",
    "Se já tiver realizado o pagamento, pode ignorar esta mensagem 😊",
  ];

  return lines.filter(Boolean).join("\n");
}

function boolValue(v) {
  return v === true;
}

function getOfferPaymentReminderCapability(notificationContext) {
  const whatsappEnvironment =
    notificationContext?.capabilities?.environment?.whatsapp || {};
  const planValue = notificationContext?.capabilities?.plan?.value || "start";
  const planFeatures = {
    ...getPlanFeatureMatrix(planValue),
    ...(notificationContext?.capabilities?.plan?.features || {}),
  };
  const masterEnabled =
    notificationContext?.settings?.whatsapp?.masterEnabled === true;

  if (whatsappEnvironment.available !== true) {
    return {
      available: false,
      code: "FEATURE_DISABLED",
      reason:
        whatsappEnvironment.reason || "WhatsApp desabilitado na configuracao do ambiente.",
      status: 503,
    };
  }

  if (planFeatures?.whatsappOfferPaymentReminders !== true) {
    return {
      available: false,
      code: "PLAN_NOT_ALLOWED",
      reason:
        "Lembretes por WhatsApp disponiveis apenas nos planos Pro, Business e Enterprise.",
      status: 403,
    };
  }

  if (!masterEnabled) {
    return {
      available: false,
      code: "WORKSPACE_SETTING_DISABLED",
      reason: "WhatsApp desativado nas configuracoes do workspace.",
      status: 409,
    };
  }

  return {
    available: true,
    code: "",
    reason: "",
    status: 200,
  };
}

export async function updateOfferPaymentReminderSettings({
  offerId,
  workspaceId,
  ownerUserId,
  patch = {},
}) {
  const query = { _id: offerId, workspaceId };
  if (ownerUserId) query.ownerUserId = ownerUserId;

  const wantsReminderEnabled = [
    patch.enabled24h,
    patch.enabled3d,
    patch.enabledDueDate,
    patch.enabledAfterDueDate,
  ].some((value) => value === true);

  if (wantsReminderEnabled) {
    const notificationContext = await resolveWorkspaceNotificationContext({
      workspaceId,
      ownerUserId: ownerUserId || null,
    });
    const capability = getOfferPaymentReminderCapability(notificationContext);

    if (!capability.available) {
      const err = new Error(capability.reason);
      err.status = capability.status;
      err.statusCode = capability.status;
      err.code = capability.code;
      throw err;
    }
  }

  await Offer.updateOne(
    query,
    {
      $set: {
        "paymentReminders.enabled24h": boolValue(patch.enabled24h),
        "paymentReminders.enabled3d": boolValue(patch.enabled3d),
        "paymentReminders.enabledDueDate": boolValue(patch.enabledDueDate),
        "paymentReminders.enabledAfterDueDate": boolValue(
          patch.enabledAfterDueDate,
        ),
      },
    },
    { strict: false },
  );

  return Offer.findOne(query).lean();
}

export async function listOfferReminderHistory({
  offerId,
  workspaceId,
  ownerUserId,
  limit = 50,
}) {
  const offerQuery = { _id: offerId, workspaceId };
  if (ownerUserId) offerQuery.ownerUserId = ownerUserId;

  const offer = await Offer.findOne(offerQuery).select("_id").lean();
  if (!offer) return null;

  return OfferReminderLog.find({ offerId: offer._id, workspaceId })
    .sort({ sentAt: -1, createdAt: -1 })
    .limit(Math.max(1, Math.min(100, Number(limit) || 50)))
    .lean();
}

async function createReminderLog(doc) {
  try {
    return await OfferReminderLog.create(doc);
  } catch (err) {
    if (err?.code === 11000 && doc?.triggerKey) {
      return OfferReminderLog.findOne({
        offerId: doc.offerId,
        triggerKey: doc.triggerKey,
      }).lean();
    }
    throw err;
  }
}

async function markReminderLog(logId, patch) {
  await OfferReminderLog.updateOne(
    { _id: logId },
    { $set: patch },
    { strict: false },
  );
}

async function markOfferReminderSent(offerId, kind, at = new Date()) {
  await Offer.updateOne(
    { _id: offerId },
    {
      $set: {
        "paymentReminders.lastSentAt": at,
        "paymentReminders.lastSentKind": kind,
      },
    },
    { strict: false },
  ).catch(() => {});
}

export async function dispatchPaymentReminder({
  offer,
  workspaceId,
  userId = null,
  kind = "manual",
  origin = "",
  triggerKey = null,
  meta = null,
}) {
  const eligibility = isOfferReminderEligible(offer);
  if (!eligibility.ok) {
    throw Object.assign(new Error(eligibility.reason), {
      status: 409,
      code: "REMINDER_NOT_ALLOWED",
    });
  }

  const publicUrl = buildOfferPublicUrl(offer, origin);
  if (!publicUrl) {
    throw Object.assign(
      new Error("A proposta não possui link público disponível."),
      {
        status: 409,
        code: "PUBLIC_URL_MISSING",
      },
    );
  }

  const to = normalizePhoneBR(offer?.customerWhatsApp);
  const message = buildPaymentReminderMessage({ offer, kind, publicUrl });
  const notificationContext = await resolveWorkspaceNotificationContext({
    workspaceId,
    ownerUserId: offer?.ownerUserId || userId || null,
  });
  const capability = getOfferPaymentReminderCapability(notificationContext);
  const baseMeta = {
    ...(meta || {}),
    publicUrl,
    customerName: String(offer?.customerName || "").trim(),
    customerWhatsApp: String(offer?.customerWhatsApp || "").trim(),
  };

  if (!capability.available) {
    const log = await createReminderLog({
      workspaceId,
      offerId: offer._id,
      createdByUserId: userId,
      kind,
      channel: "whatsapp",
      status: "skipped",
      to: to || "",
      message,
      error: {
        message: capability.reason,
        code: capability.code,
      },
      sentAt: null,
      meta: baseMeta,
      triggerKey,
    });

    return {
      ok: false,
      status: "skipped",
      reason: capability.code,
      log,
      offer: await Offer.findById(offer._id).lean(),
    };
  }

  if (!to) {
    const log = await createReminderLog({
      workspaceId,
      offerId: offer._id,
      createdByUserId: userId,
      kind,
      channel: "whatsapp",
      status: "skipped",
      to: "",
      message,
      error: {
        message: "Cliente sem WhatsApp válido para receber lembrete.",
        code: "NO_PHONE",
      },
      sentAt: null,
      meta: baseMeta,
      triggerKey,
    });

    return {
      ok: false,
      status: "skipped",
      reason: "NO_PHONE",
      log,
      offer: await Offer.findById(offer._id).lean(),
    };
  }

  const maybeExisting = triggerKey
    ? await OfferReminderLog.findOne({ offerId: offer._id, triggerKey }).lean()
    : null;

  if (maybeExisting) {
    return {
      ok: true,
      status: "skipped",
      reason: "ALREADY_TRIGGERED",
      log: maybeExisting,
      offer: await Offer.findById(offer._id).lean(),
    };
  }

  const log = await createReminderLog({
    workspaceId,
    offerId: offer._id,
    createdByUserId: userId,
    kind,
    channel: "whatsapp",
    status: "pending",
    to,
    message,
    provider: "whatsapp-web.js",
    providerMessageId: null,
    sentAt: null,
    error: null,
    meta: baseMeta,
    triggerKey,
  });

  if (log?.status && log.status !== "pending") {
    return {
      ok: true,
      status: "skipped",
      reason: "ALREADY_TRIGGERED",
      log,
      offer: await Offer.findById(offer._id).lean(),
    };
  }

  const result = await queueOrSendWhatsApp({
    workspaceId,
    to,
    message,
    dedupeKey: `offer-reminder-log:${log._id}`,
    sourceType: "offer_reminder_log",
    sourceId: log._id,
    meta: {
      offerId: offer._id,
      kind,
      triggerKey,
      source: meta?.source || null,
    },
  });

  if (result?.status === "sent") {
    return {
      ok: true,
      status: "sent",
      log: await OfferReminderLog.findById(log._id).lean(),
      offer: await Offer.findById(offer._id).lean(),
    };
  }

  if (result?.status === "queued") {
    return {
      ok: true,
      status: "queued",
      log: await OfferReminderLog.findById(log._id).lean(),
      offer: await Offer.findById(offer._id).lean(),
    };
  }

  return {
    ok: false,
    status: "failed",
    error: result?.error || new Error("Falha ao enviar lembrete"),
    log: await OfferReminderLog.findById(log._id).lean(),
    offer: await Offer.findById(offer._id).lean(),
  };
}

export async function sendManualPaymentReminder({
  offerId,
  workspaceId,
  ownerUserId,
  userId,
  origin,
}) {
  const query = { _id: offerId, workspaceId };
  if (ownerUserId) query.ownerUserId = ownerUserId;

  const offer = await Offer.findOne(query).lean();
  if (!offer) {
    throw Object.assign(new Error("Proposta não encontrada."), {
      status: 404,
      code: "OFFER_NOT_FOUND",
    });
  }

  return dispatchPaymentReminder({
    offer,
    workspaceId,
    userId,
    kind: "manual",
    origin,
    meta: { source: "manual" },
  });
}

function hoursSince(date, now) {
  const from = date instanceof Date ? date : new Date(date);
  const to = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  return (to.getTime() - from.getTime()) / 36e5;
}

function pickAutomaticReminderTrigger(offer, now = new Date()) {
  const cfg = offer?.paymentReminders || {};
  const dueDate = computeOfferDueDate(offer);
  const todayKey = dateKeySP(now);
  const dueKey = dueDate ? dateKeySP(dueDate) : "";
  const elapsedHours = hoursSince(offer?.createdAt, now);

  const candidates = [];

  if (cfg.enabledDueDate && dueKey && dueKey === todayKey) {
    candidates.push({
      kind: "due_date",
      triggerKey: `due_date:${offer._id}:${dueKey}`,
      priority: 1,
    });
  }

  if (cfg.enabledAfterDueDate && dueKey && dueKey < todayKey) {
    candidates.push({
      kind: "after_due_date",
      triggerKey: `after_due_date:${offer._id}:${dueKey}`,
      priority: 2,
    });
  }

  if (cfg.enabled3d && elapsedHours >= 72) {
    candidates.push({
      kind: "after_3d",
      triggerKey: `after_3d:${offer._id}`,
      priority: 3,
    });
  }

  if (cfg.enabled24h && elapsedHours >= 24) {
    candidates.push({
      kind: "after_24h",
      triggerKey: `after_24h:${offer._id}`,
      priority: 4,
    });
  }

  candidates.sort((a, b) => a.priority - b.priority);
  return candidates[0] || null;
}

export async function processAutomaticPaymentReminders({
  now = new Date(),
  limit = 200,
  origin = "",
} = {}) {
  const query = {
    paymentStatus: "PENDING",
    status: { $nin: ["EXPIRED", "CANCELLED", "CANCELED", "CONFIRMED", "PAID"] },
    $or: [
      { "paymentReminders.enabled24h": true },
      { "paymentReminders.enabled3d": true },
      { "paymentReminders.enabledDueDate": true },
      { "paymentReminders.enabledAfterDueDate": true },
    ],
  };

  const offers = await Offer.find(query)
    .sort({ createdAt: 1 })
    .limit(Math.max(1, Math.min(500, Number(limit) || 200)))
    .lean();

  const summary = {
    scanned: offers.length,
    sent: 0,
    queued: 0,
    failed: 0,
    skipped: 0,
    items: [],
  };

  for (const offer of offers) {
    const trigger = pickAutomaticReminderTrigger(offer, now);
    if (!trigger) continue;

    const result = await dispatchPaymentReminder({
      offer,
      workspaceId: offer.workspaceId,
      userId: null,
      kind: trigger.kind,
      origin,
      triggerKey: trigger.triggerKey,
      meta: {
        source: "automation",
        evaluatedAt: formatDateTimeSP(now),
        dueDate: computeOfferDueDate(offer),
      },
    });

    summary.items.push({
      offerId: String(offer._id),
      kind: trigger.kind,
      status: result.status,
      reason: result.reason || result.error?.message || "",
    });

    if (result.status === "sent") summary.sent += 1;
    else if (result.status === "queued") summary.queued += 1;
    else if (result.status === "failed") summary.failed += 1;
    else summary.skipped += 1;
  }

  return summary;
}
