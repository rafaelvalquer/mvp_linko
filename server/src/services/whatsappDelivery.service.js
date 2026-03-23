import { MessageLog } from "../models/MessageLog.js";
import OfferReminderLog from "../models/OfferReminderLog.js";
import { WhatsAppOutbox } from "../models/WhatsAppOutbox.js";

const DELIVERY_STATE_RANK = {
  ERROR: 0,
  PENDING: 1,
  SERVER: 2,
  DEVICE: 3,
  READ: 4,
  PLAYED: 5,
};

function parseAckCode(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function deliveryAckCodeToState(ack) {
  switch (parseAckCode(ack)) {
    case -1:
      return "ERROR";
    case 0:
      return "PENDING";
    case 1:
      return "SERVER";
    case 2:
      return "DEVICE";
    case 3:
      return "READ";
    case 4:
      return "PLAYED";
    default:
      return null;
  }
}

export function normalizeDeliveryState(value, ack = null) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();

  if (DELIVERY_STATE_RANK[normalized] != null) {
    return normalized;
  }

  return deliveryAckCodeToState(ack);
}

function normalizeAckAt(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function getStateRank(value) {
  const normalized = normalizeDeliveryState(value);
  return normalized == null ? -1 : DELIVERY_STATE_RANK[normalized];
}

export function buildDeliveryAckPatch(current = {}, ackEvent = {}) {
  const deliveryState = normalizeDeliveryState(
    ackEvent.ackState,
    ackEvent.ack,
  );
  if (!deliveryState) return null;

  const ackAt = normalizeAckAt(ackEvent.at);
  const incomingRank = getStateRank(deliveryState);
  const currentState = normalizeDeliveryState(current.deliveryState);
  const currentRank = getStateRank(currentState);

  if (currentRank > incomingRank) {
    return null;
  }

  if (deliveryState === "ERROR" && currentRank >= getStateRank("PENDING")) {
    return null;
  }

  if (
    currentState === deliveryState &&
    parseAckCode(current.deliveryLastAckCode) === parseAckCode(ackEvent.ack)
  ) {
    const currentAckAt = current.deliveryLastAckAt
      ? new Date(current.deliveryLastAckAt)
      : null;
    if (currentAckAt && !Number.isNaN(currentAckAt.getTime())) {
      if (currentAckAt.getTime() >= ackAt.getTime()) {
        return null;
      }
    }
  }

  const patch = {
    deliveryState,
    deliveryLastAckCode: parseAckCode(ackEvent.ack),
    deliveryLastAckAt: ackAt,
  };

  if (
    ["DEVICE", "READ", "PLAYED"].includes(deliveryState) &&
    !current.deliveredAt
  ) {
    patch.deliveredAt = ackAt;
  }

  if (["READ", "PLAYED"].includes(deliveryState) && !current.readAt) {
    patch.readAt = ackAt;
  }

  if (deliveryState === "PLAYED" && !current.playedAt) {
    patch.playedAt = ackAt;
  }

  return patch;
}

async function applyAckToModel(Model, providerMessageId, ackEvent) {
  const rows = await Model.find({ providerMessageId })
    .select(
      "_id deliveryState deliveryLastAckCode deliveryLastAckAt deliveredAt readAt playedAt",
    )
    .lean();

  if (!rows.length) {
    return {
      matched: 0,
      updated: 0,
      ignored: 0,
    };
  }

  const operations = [];
  let ignored = 0;

  for (const row of rows) {
    const patch = buildDeliveryAckPatch(row, ackEvent);
    if (!patch) {
      ignored += 1;
      continue;
    }

    operations.push({
      updateOne: {
        filter: { _id: row._id },
        update: { $set: patch },
      },
    });
  }

  if (operations.length) {
    await Model.bulkWrite(operations, { ordered: false });
  }

  return {
    matched: rows.length,
    updated: operations.length,
    ignored,
  };
}

export async function processWhatsAppMessageAck(event = {}) {
  const providerMessageId = String(event.providerMessageId || "").trim();
  if (!providerMessageId) {
    const err = new Error("providerMessageId obrigatorio.");
    err.status = 400;
    err.code = "PROVIDER_MESSAGE_ID_REQUIRED";
    throw err;
  }

  const ackEvent = {
    providerMessageId,
    ack: parseAckCode(event.ack),
    ackState: normalizeDeliveryState(event.ackState, event.ack),
    at: normalizeAckAt(event.at),
    chatId: String(event.chatId || "").trim() || null,
    raw: event.raw && typeof event.raw === "object" ? event.raw : null,
  };

  const [messageLogs, outbox, reminderLogs] = await Promise.all([
    applyAckToModel(MessageLog, providerMessageId, ackEvent),
    applyAckToModel(WhatsAppOutbox, providerMessageId, ackEvent),
    applyAckToModel(OfferReminderLog, providerMessageId, ackEvent),
  ]);

  const matched =
    messageLogs.matched + outbox.matched + reminderLogs.matched;
  const updated =
    messageLogs.updated + outbox.updated + reminderLogs.updated;
  const ignored =
    messageLogs.ignored + outbox.ignored + reminderLogs.ignored;

  if (matched === 0) {
    console.info("[whatsapp-delivery-ack] providerMessageId not found", {
      at: new Date().toISOString(),
      providerMessageId,
      ack: ackEvent.ack,
      ackState: ackEvent.ackState,
      chatId: ackEvent.chatId,
    });
  }

  return {
    ok: true,
    providerMessageId,
    ack: ackEvent.ack,
    ackState: ackEvent.ackState,
    at: ackEvent.at.toISOString(),
    matched,
    updated,
    ignored,
    models: {
      messageLogs,
      outbox,
      reminderLogs,
    },
  };
}
