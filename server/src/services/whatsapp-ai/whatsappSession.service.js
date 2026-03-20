import { env } from "../../config/env.js";
import { WhatsAppCommandSession } from "../../models/WhatsAppCommandSession.js";

export const ACTIVE_WHATSAPP_SESSION_STATES = [
  "NEW",
  "AWAITING_INTENT_SELECTION",
  "COLLECTING_FIELDS",
  "AWAITING_CUSTOMER_SELECTION",
  "AWAITING_PRODUCT_SELECTION",
  "AWAITING_BOOKING_SELECTION",
  "AWAITING_DESTINATION_PHONE",
  "AWAITING_CONFIRMATION",
  "AWAITING_NEW_BOOKING_TIME",
  "AWAITING_BOOKING_CHANGE_CONFIRMATION",
  "PROCESSING_CREATE",
];

const TERMINAL_WHATSAPP_SESSION_STATES = [
  "COMPLETED",
  "CANCELLED",
  "ERROR",
  "EXPIRED",
];

export function buildSessionExpiryDate() {
  return new Date(
    Date.now() + Math.max(1, Number(env.whatsappAiSessionTtlMinutes || 30)) * 60 * 1000,
  );
}

export function isExpiredSession(session) {
  if (!session?.expiresAt) return false;
  const expiresAt = new Date(session.expiresAt);
  return !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= Date.now();
}

export async function findSessionBySourceMessageId({ userId, messageId }) {
  if (!userId || !messageId) return null;

  return WhatsAppCommandSession.findOne({
    userId,
    sourceMessageIds: messageId,
  })
    .sort({ updatedAt: -1 })
    .lean();
}

export async function markSessionExpired(sessionId) {
  return updateWhatsAppSession(sessionId, {
    state: "EXPIRED",
    pendingFields: [],
    candidateCustomers: [],
    candidateProducts: [],
    candidateBookings: [],
    lastQuestionKey: "",
    lastQuestionText: "",
    expiresAt: new Date(),
  });
}

export async function findOpenWhatsAppSession({ userId, requesterPhoneDigits }) {
  const sessions = await WhatsAppCommandSession.find({
    userId,
    requesterPhoneDigits,
    state: { $in: ACTIVE_WHATSAPP_SESSION_STATES },
  })
    .sort({ updatedAt: -1 })
    .lean();

  if (!sessions.length) return null;

  const validSessions = [];
  for (const session of sessions) {
    if (isExpiredSession(session)) {
      // eslint-disable-next-line no-await-in-loop
      await markSessionExpired(session._id);
      continue;
    }
    validSessions.push(session);
  }

  if (!validSessions.length) return null;

  if (validSessions.length > 1) {
    await closeActiveSessionsForRequester({
      userId,
      requesterPhoneDigits,
      state: "EXPIRED",
    });
    return null;
  }

  const activeSession = validSessions[0] || null;
  if (!activeSession) return null;

  const newerTerminalSession = await WhatsAppCommandSession.findOne({
    userId,
    requesterPhoneDigits,
    state: { $in: TERMINAL_WHATSAPP_SESSION_STATES },
    updatedAt: { $gte: activeSession.updatedAt },
  })
    .sort({ updatedAt: -1 })
    .lean();

  if (newerTerminalSession?._id) {
    await markSessionExpired(activeSession._id);
    return null;
  }

  return activeSession;
}

export async function createWhatsAppSession({
  workspaceId,
  userId,
  requesterPhoneRaw,
  requesterPhoneDigits,
  requesterPushName,
  sourceMessageId,
  originalInputType,
  originalText,
  transcriptText,
  lastUserMessageText,
  flowType = "offer_create",
}) {
  return WhatsAppCommandSession.create({
    workspaceId,
    userId,
    requesterPhoneRaw,
    requesterPhoneDigits,
    requesterPushName,
    sourceMessageIds: sourceMessageId ? [sourceMessageId] : [],
    originalInputType,
    originalText: originalText || "",
    transcriptText: transcriptText || "",
    lastUserMessageText: lastUserMessageText || "",
    flowType,
    state: "NEW",
    pendingFields: [],
    extracted: {},
    resolved: {},
    candidateCustomers: [],
    candidateProducts: [],
    candidateBookings: [],
    confirmationSummaryText: "",
    lastQuestionKey: "",
    lastQuestionText: "",
    expiresAt: buildSessionExpiryDate(),
  });
}

export async function updateWhatsAppSession(sessionId, patch = {}) {
  const next = { ...patch };

  if (next.state && !TERMINAL_WHATSAPP_SESSION_STATES.includes(String(next.state))) {
    next.expiresAt = buildSessionExpiryDate();
  }

  return WhatsAppCommandSession.findByIdAndUpdate(
    sessionId,
    { $set: next },
    { new: true, strict: false },
  ).lean();
}

export async function appendInboundMessageToSession(
  sessionId,
  { sourceMessageId, requesterPushName, text, transcriptText, originalInputType } = {},
) {
  const patch = {
    requesterPushName: requesterPushName || "",
    lastUserMessageText: text || "",
    expiresAt: buildSessionExpiryDate(),
  };

  if (transcriptText !== undefined) patch.transcriptText = transcriptText || "";
  if (originalInputType) patch.originalInputType = originalInputType;

  return WhatsAppCommandSession.findByIdAndUpdate(
    {
      _id: sessionId,
      ...(sourceMessageId ? { sourceMessageIds: { $ne: sourceMessageId } } : {}),
    },
    {
      $set: patch,
      ...(sourceMessageId ? { $addToSet: { sourceMessageIds: sourceMessageId } } : {}),
    },
    { new: true, strict: false },
  ).lean();
}

export async function transitionSessionToProcessing(sessionId) {
  return WhatsAppCommandSession.findOneAndUpdate(
    {
      _id: sessionId,
      state: "AWAITING_CONFIRMATION",
    },
    {
      $set: {
        state: "PROCESSING_CREATE",
        expiresAt: buildSessionExpiryDate(),
      },
    },
    { new: true, strict: false },
  ).lean();
}

export async function closeActiveSessionsForRequester({
  userId,
  requesterPhoneDigits,
  excludeSessionId = null,
  state = "EXPIRED",
} = {}) {
  if (!userId || !requesterPhoneDigits) return { modifiedCount: 0 };

  const targetState = TERMINAL_WHATSAPP_SESSION_STATES.includes(String(state))
    ? String(state)
    : "EXPIRED";

  const query = {
    userId,
    requesterPhoneDigits,
    state: { $in: ACTIVE_WHATSAPP_SESSION_STATES },
  };

  if (excludeSessionId) {
    query._id = { $ne: excludeSessionId };
  }

  return WhatsAppCommandSession.updateMany(
    query,
    {
      $set: {
        state: targetState,
        pendingFields: [],
        candidateCustomers: [],
        candidateProducts: [],
        candidateBookings: [],
        lastQuestionKey: "",
        lastQuestionText: "",
        expiresAt: new Date(),
        ...(targetState === "CANCELLED" ? { cancelledAt: new Date() } : {}),
        ...(targetState === "COMPLETED" ? { completedAt: new Date() } : {}),
      },
    },
    { strict: false },
  );
}

export async function markSessionCompleted(sessionId, patch = {}) {
  return updateWhatsAppSession(sessionId, {
    ...patch,
    state: "COMPLETED",
    completedAt: new Date(),
    pendingFields: [],
    candidateCustomers: [],
    candidateProducts: [],
    candidateBookings: [],
    lastQuestionKey: "",
    lastQuestionText: "",
    expiresAt: new Date(),
  });
}

export async function markSessionCancelled(sessionId, patch = {}) {
  return updateWhatsAppSession(sessionId, {
    ...patch,
    state: "CANCELLED",
    cancelledAt: new Date(),
    pendingFields: [],
    candidateCustomers: [],
    candidateProducts: [],
    candidateBookings: [],
    lastQuestionKey: "",
    lastQuestionText: "",
    expiresAt: new Date(),
  });
}

export async function markSessionError(sessionId, error, patch = {}) {
  return updateWhatsAppSession(sessionId, {
    ...patch,
    state: "ERROR",
    pendingFields: [],
    candidateCustomers: [],
    candidateProducts: [],
    candidateBookings: [],
    lastQuestionKey: "",
    lastQuestionText: "",
    expiresAt: new Date(),
    lastError: {
      message: String(error?.message || "Falha ao processar sessao"),
      code: String(error?.code || error?.name || "WHATSAPP_SESSION_ERROR"),
      details: error?.details || null,
      at: new Date(),
    },
  });
}
