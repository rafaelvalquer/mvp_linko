import crypto from "node:crypto";

import { Offer } from "../models/Offer.js";
import { MessageLog } from "../models/MessageLog.js";
import OfferReminderLog from "../models/OfferReminderLog.js";
import { RecurringOffer } from "../models/RecurringOffer.js";
import { WhatsAppOutbox } from "../models/WhatsAppOutbox.js";
import {
  getWhatsAppGatewayStatus,
  isRetryableWhatsAppError,
  sendWhatsAppNow,
} from "./waGateway.js";

const LOCK_TTL_MS = Math.max(
  15000,
  Number(process.env.WHATSAPP_OUTBOX_LOCK_TTL_MS || 5 * 60 * 1000),
);
const DEFAULT_BATCH_SIZE = Math.max(
  1,
  Math.min(20, Number(process.env.WHATSAPP_OUTBOX_BATCH_SIZE || 20)),
);
const DEFAULT_MAX_ATTEMPTS = Math.max(
  1,
  Number(process.env.WHATSAPP_OUTBOX_MAX_ATTEMPTS || 8),
);
const BACKOFF_STEPS_MS = [
  0,
  15 * 1000,
  60 * 1000,
  5 * 60 * 1000,
  15 * 60 * 1000,
  60 * 60 * 1000,
  3 * 60 * 60 * 1000,
  6 * 60 * 60 * 1000,
  12 * 60 * 60 * 1000,
];

async function countQueuedOutboxMessages() {
  const [queuedTotal, queuedOfferReminders] = await Promise.all([
    WhatsAppOutbox.countDocuments({ status: "queued" }),
    WhatsAppOutbox.countDocuments({
      status: "queued",
      sourceType: "offer_reminder_log",
    }),
  ]);

  return { queuedTotal, queuedOfferReminders };
}

function now() {
  return new Date();
}

function normalizeDedupeKey(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function mergeMeta(baseMeta, patchMeta) {
  const next = {
    ...(baseMeta && typeof baseMeta === "object" ? baseMeta : {}),
    ...(patchMeta && typeof patchMeta === "object" ? patchMeta : {}),
  };
  return Object.keys(next).length ? next : null;
}

function buildErrorPayload(err, fallbackDetails = null) {
  return {
    message: String(err?.message || "Falha ao enviar WhatsApp"),
    code: String(err?.code || err?.name || "SEND_FAILED"),
    details: err?.details || fallbackDetails || null,
  };
}

function buildPendingDeliveryPatch(sentAt = new Date()) {
  return {
    deliveryState: "PENDING",
    deliveryLastAckCode: 0,
    deliveryLastAckAt: sentAt,
    deliveredAt: null,
    readAt: null,
    playedAt: null,
  };
}

function buildClearedDeliveryPatch() {
  return {
    deliveryState: null,
    deliveryLastAckCode: null,
    deliveryLastAckAt: null,
    deliveredAt: null,
    readAt: null,
    playedAt: null,
  };
}

function computeNextAttemptAt(attempts) {
  const idx = Math.max(
    0,
    Math.min(Number(attempts) || 0, BACKOFF_STEPS_MS.length - 1),
  );
  return new Date(Date.now() + BACKOFF_STEPS_MS[idx]);
}

async function claimSpecificOutboxMessage(outboxId) {
  const startedAt = now();
  const lockId = crypto.randomUUID();

  const doc = await WhatsAppOutbox.findOneAndUpdate(
    {
      _id: outboxId,
      status: "queued",
      nextAttemptAt: { $lte: startedAt },
    },
    {
      $set: {
        status: "processing",
        lockedAt: startedAt,
        lockId,
        lastAttemptAt: startedAt,
      },
      $inc: { attempts: 1 },
    },
    { new: true, strict: false },
  ).lean();

  return doc;
}

async function claimNextOutboxMessage() {
  const startedAt = now();
  const staleAt = new Date(startedAt.getTime() - LOCK_TTL_MS);
  const lockId = crypto.randomUUID();

  return WhatsAppOutbox.findOneAndUpdate(
    {
      $or: [
        {
          status: "queued",
          nextAttemptAt: { $lte: startedAt },
        },
        {
          status: "processing",
          lockedAt: { $lte: staleAt },
        },
      ],
    },
    {
      $set: {
        status: "processing",
        lockedAt: startedAt,
        lockId,
        lastAttemptAt: startedAt,
      },
      $inc: { attempts: 1 },
    },
    {
      new: true,
      strict: false,
      sort: { createdAt: 1 },
    },
  ).lean();
}

async function updateOutboxMeta(outboxId, patchMeta = {}) {
  if (!outboxId) return null;

  await WhatsAppOutbox.updateOne(
    { _id: outboxId },
    { $set: { meta: patchMeta } },
    { strict: false },
  ).catch(() => {});

  return WhatsAppOutbox.findById(outboxId).lean();
}

async function appendRecurringOutboxHistory({
  recurringId,
  offerId = null,
  recurringSequence = null,
  status,
  outboxId,
  providerMessageId = null,
  error = null,
  meta = null,
}) {
  const recurring = await RecurringOffer.findById(recurringId).lean();
  if (!recurring) return null;

  const entry = {
    status,
    source: "outbox",
    ranAt: new Date(),
    offerId: offerId || null,
    recurringSequence:
      Number.isFinite(Number(recurringSequence)) ? Number(recurringSequence) : null,
    message:
      status === "sent"
        ? "Entrega automática por WhatsApp concluída pela fila."
        : "Falha definitiva no envio automático por WhatsApp pela fila.",
    error:
      status === "failed"
        ? error || { message: "Falha ao enviar WhatsApp", code: "SEND_FAILED" }
        : { message: null, code: null, details: null },
    meta: {
      ...(meta && typeof meta === "object" ? meta : {}),
      outboxId: String(outboxId || ""),
      providerMessageId,
    },
  };

  const history = [entry, ...(Array.isArray(recurring.history) ? recurring.history : [])]
    .slice(0, Math.max(10, Number(process.env.RECURRING_HISTORY_LIMIT || 100)));

  await RecurringOffer.updateOne(
    { _id: recurringId },
    { $set: { history } },
    { strict: false },
  ).catch(() => {});

  return RecurringOffer.findById(recurringId).lean();
}

export async function markSourceAsSent(outbox, extra = {}) {
  if (!outbox?.sourceType || !outbox?.sourceId) return null;

  const sentAt = extra.sentAt || outbox?.sentAt || new Date();
  const providerMessageId =
    extra.providerMessageId || outbox?.providerMessageId || null;

  if (outbox.sourceType === "message_log") {
    await MessageLog.updateOne(
      { _id: outbox.sourceId },
      {
        $set: {
          status: "SENT",
          providerMessageId,
          sentAt,
          ...buildPendingDeliveryPatch(sentAt),
          error: null,
        },
      },
      { strict: false },
    ).catch(() => {});
    return MessageLog.findById(outbox.sourceId).lean();
  }

  if (outbox.sourceType === "offer_reminder_log") {
    await OfferReminderLog.updateOne(
      { _id: outbox.sourceId },
      {
        $set: {
          status: "sent",
          providerMessageId,
          sentAt,
          ...buildPendingDeliveryPatch(sentAt),
          error: null,
        },
      },
      { strict: false },
    ).catch(() => {});

    const offerId = outbox?.meta?.offerId || null;
    const kind = outbox?.meta?.kind || null;
    if (offerId && kind) {
      await Offer.updateOne(
        { _id: offerId },
        {
          $set: {
            "paymentReminders.lastSentAt": sentAt,
            "paymentReminders.lastSentKind": kind,
          },
        },
        { strict: false },
      ).catch(() => {});
    }

    return OfferReminderLog.findById(outbox.sourceId).lean();
  }

  if (
    outbox.sourceType === "recurring_offer" &&
    outbox?.meta?.initialDisposition === "queued"
  ) {
    return appendRecurringOutboxHistory({
      recurringId: outbox.sourceId,
      offerId: outbox?.meta?.offerId || null,
      recurringSequence: outbox?.meta?.recurringSequence || null,
      status: "sent",
      outboxId: outbox._id,
      providerMessageId,
      meta: {
        publicUrl: outbox?.meta?.publicUrl || null,
        to: outbox?.to || null,
      },
    });
  }

  return null;
}

export async function markSourceAsFailed(outbox, extra = {}) {
  if (!outbox?.sourceType || !outbox?.sourceId) return null;

  const error = buildErrorPayload(extra.error || outbox?.lastError || null);

  if (outbox.sourceType === "message_log") {
    await MessageLog.updateOne(
      { _id: outbox.sourceId },
      {
        $set: {
          status: "FAILED",
          providerMessageId: null,
          sentAt: null,
          ...buildClearedDeliveryPatch(),
          error,
        },
      },
      { strict: false },
    ).catch(() => {});
    return MessageLog.findById(outbox.sourceId).lean();
  }

  if (outbox.sourceType === "offer_reminder_log") {
    await OfferReminderLog.updateOne(
      { _id: outbox.sourceId },
      {
        $set: {
          status: "failed",
          providerMessageId: null,
          sentAt: null,
          ...buildClearedDeliveryPatch(),
          error,
        },
      },
      { strict: false },
    ).catch(() => {});
    return OfferReminderLog.findById(outbox.sourceId).lean();
  }

  if (
    outbox.sourceType === "recurring_offer" &&
    outbox?.meta?.initialDisposition === "queued"
  ) {
    return appendRecurringOutboxHistory({
      recurringId: outbox.sourceId,
      offerId: outbox?.meta?.offerId || null,
      recurringSequence: outbox?.meta?.recurringSequence || null,
      status: "failed",
      outboxId: outbox._id,
      error,
      meta: {
        publicUrl: outbox?.meta?.publicUrl || null,
        to: outbox?.to || null,
      },
    });
  }

  return null;
}

export async function enqueueWhatsAppMessage({
  workspaceId = null,
  to,
  message,
  dedupeKey = null,
  sourceType = null,
  sourceId = null,
  meta = null,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
}) {
  const normalizedDedupeKey = normalizeDedupeKey(dedupeKey);
  const baseDoc = {
    workspaceId,
    to,
    message,
    status: "queued",
    attempts: 0,
    maxAttempts: Math.max(1, Number(maxAttempts) || DEFAULT_MAX_ATTEMPTS),
    nextAttemptAt: now(),
    lastAttemptAt: null,
    lockedAt: null,
    lockId: null,
    providerMessageId: null,
    lastError: null,
    sentAt: null,
    dedupeKey: normalizedDedupeKey,
    sourceType: sourceType || null,
    sourceId: sourceId || null,
    meta: meta || null,
  };

  if (!normalizedDedupeKey) {
    const created = await WhatsAppOutbox.create(baseDoc);
    return {
      created: true,
      outbox: created.toObject ? created.toObject() : created,
    };
  }

  const raw = await WhatsAppOutbox.findOneAndUpdate(
    { dedupeKey: normalizedDedupeKey },
    { $setOnInsert: baseDoc },
    {
      upsert: true,
      new: true,
      includeResultMetadata: true,
      strict: false,
    },
  );

  return {
    created: raw?.lastErrorObject?.updatedExisting === false,
    outbox: raw?.value ?? null,
  };
}

export async function processSingleOutboxMessage({
  outboxId = null,
  claimedOutbox = null,
} = {}) {
  const claimed =
    claimedOutbox || (outboxId ? await claimSpecificOutboxMessage(outboxId) : null);

  if (!claimed?._id || !claimed?.lockId) {
    return { ok: false, status: "skipped", reason: "NOT_CLAIMED" };
  }

  try {
    const resp = await sendWhatsAppNow({
      to: claimed.to,
      message: claimed.message,
    });
    const providerMessageId =
      String(resp?.providerMessageId || "").trim() || null;
    const sentAt = new Date();

    await WhatsAppOutbox.updateOne(
      { _id: claimed._id, lockId: claimed.lockId },
      {
        $set: {
          status: "sent",
          providerMessageId,
          sentAt,
          ...buildPendingDeliveryPatch(sentAt),
          lastError: null,
          lockedAt: null,
          lockId: null,
          nextAttemptAt: null,
        },
      },
      { strict: false },
    );

    const outbox = await WhatsAppOutbox.findById(claimed._id).lean();
    await markSourceAsSent(outbox, { sentAt, providerMessageId });

    return {
      ok: true,
      status: "sent",
      providerMessageId,
      outbox,
    };
  } catch (error) {
    const retryable = isRetryableWhatsAppError(error);
    const exhausted = Number(claimed.attempts || 0) >= Number(claimed.maxAttempts || 1);
    const lastError = buildErrorPayload(error);

    if (retryable && !exhausted) {
      const nextAttemptAt = computeNextAttemptAt(claimed.attempts);

      await WhatsAppOutbox.updateOne(
        { _id: claimed._id, lockId: claimed.lockId },
        {
          $set: {
            status: "queued",
            nextAttemptAt,
            lastError,
            ...buildClearedDeliveryPatch(),
            lockedAt: null,
            lockId: null,
          },
        },
        { strict: false },
      );

      const outbox = await WhatsAppOutbox.findById(claimed._id).lean();
      return {
        ok: false,
        status: "queued",
        error,
        outbox,
      };
    }

    await WhatsAppOutbox.updateOne(
      { _id: claimed._id, lockId: claimed.lockId },
      {
        $set: {
          status: "failed",
          nextAttemptAt: null,
          lastError,
          ...buildClearedDeliveryPatch(),
          lockedAt: null,
          lockId: null,
        },
      },
      { strict: false },
    );

    const outbox = await WhatsAppOutbox.findById(claimed._id).lean();
    await markSourceAsFailed(outbox, { error });

    return {
      ok: false,
      status: "failed",
      error,
      outbox,
    };
  }
}

export async function queueOrSendWhatsApp({
  workspaceId = null,
  to,
  message,
  dedupeKey = null,
  sourceType = null,
  sourceId = null,
  meta = null,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
}) {
  const { outbox } = await enqueueWhatsAppMessage({
    workspaceId,
    to,
    message,
    dedupeKey,
    sourceType,
    sourceId,
    meta,
    maxAttempts,
  });

  if (!outbox?._id) {
    return {
      ok: false,
      status: "failed",
      error: new Error("Não foi possível criar a fila de WhatsApp."),
      outbox: null,
    };
  }

  if (outbox.status === "sent") {
    return {
      ok: true,
      status: "sent",
      providerMessageId: outbox.providerMessageId || null,
      outbox,
    };
  }

  if (outbox.status === "processing") {
    return {
      ok: true,
      status: "queued",
      outbox,
    };
  }

  if (outbox.status === "failed") {
    return {
      ok: false,
      status: "failed",
      outbox,
    };
  }

  let gatewayReady = false;

  try {
    const status = await getWhatsAppGatewayStatus();
    gatewayReady = status?.ready === true;
  } catch (error) {
    if (!isRetryableWhatsAppError(error)) {
      await markSourceAsFailed(outbox, { error });
      await WhatsAppOutbox.updateOne(
        { _id: outbox._id },
        {
          $set: {
            status: "failed",
            nextAttemptAt: null,
            lastError: buildErrorPayload(error),
          },
        },
        { strict: false },
      ).catch(() => {});

      const failedOutbox = await WhatsAppOutbox.findById(outbox._id).lean();
      await updateOutboxMeta(
        failedOutbox?._id,
        mergeMeta(failedOutbox?.meta, { initialDisposition: "failed" }),
      );
      return {
        ok: false,
        status: "failed",
        error,
        outbox: failedOutbox,
      };
    }
  }

  if (!gatewayReady) {
    const queuedOutbox = await updateOutboxMeta(
      outbox._id,
      mergeMeta(outbox?.meta, { initialDisposition: "queued" }),
    );
    return {
      ok: true,
      status: "queued",
      outbox: queuedOutbox || outbox,
    };
  }

  const result = await processSingleOutboxMessage({ outboxId: outbox._id });
  const patchedOutbox = await updateOutboxMeta(
    outbox._id,
    mergeMeta(result?.outbox?.meta || outbox?.meta, {
      initialDisposition: result?.status || "queued",
    }),
  );

  return {
    ...result,
    outbox: patchedOutbox || result?.outbox || outbox,
  };
}

export async function processWhatsAppOutboxCycle({
  limit = DEFAULT_BATCH_SIZE,
} = {}) {
  const initialQueueStats = await countQueuedOutboxMessages();
  const summary = {
    ok: true,
    ready: false,
    gatewayState: "UNKNOWN",
    queuedTotal: initialQueueStats.queuedTotal,
    queuedOfferReminders: initialQueueStats.queuedOfferReminders,
    processed: 0,
    sent: 0,
    failed: 0,
    queued: 0,
    skipped: 0,
    items: [],
  };

  let status = null;
  try {
    status = await getWhatsAppGatewayStatus();
  } catch (error) {
    summary.skipped += 1;
    summary.gatewayState = "UNAVAILABLE";
    summary.reason = String(error?.message || "WA gateway status unavailable");
    return summary;
  }

  summary.ready = status?.ready === true;
  summary.gatewayState = String(status?.state || "").trim().toUpperCase() || "UNKNOWN";
  if (!summary.ready) {
    summary.reason = status?.state || "NOT_READY";
    return summary;
  }

  const max = Math.max(1, Math.min(20, Number(limit) || DEFAULT_BATCH_SIZE));

  for (let index = 0; index < max; index += 1) {
    const claimed = await claimNextOutboxMessage();
    if (!claimed?._id) break;

    const result = await processSingleOutboxMessage({ claimedOutbox: claimed });
    summary.processed += 1;
    summary.items.push({
      outboxId: String(claimed._id),
      status: result?.status || "skipped",
    });

    if (result?.status === "sent") summary.sent += 1;
    else if (result?.status === "failed") summary.failed += 1;
    else if (result?.status === "queued") summary.queued += 1;
    else summary.skipped += 1;
  }

  const remainingQueueStats = await countQueuedOutboxMessages();
  summary.queuedTotal = remainingQueueStats.queuedTotal;
  summary.queuedOfferReminders = remainingQueueStats.queuedOfferReminders;

  return summary;
}
