import { WebAgentMessage } from "../models/WebAgentMessage.js";

function normalizeText(value) {
  return String(value || "").trim();
}

function basePayload(payload = {}) {
  return payload && typeof payload === "object" ? payload : {};
}

export async function appendWebAgentUserMessage({
  sessionId,
  workspaceId,
  userId,
  text,
  sourceMessageId = "",
  inputType = "text",
  meta = null,
}) {
  const normalizedText = normalizeText(text);
  if (!sessionId || !workspaceId || !userId || !normalizedText) return null;

  return WebAgentMessage.create({
    sessionId,
    workspaceId,
    userId,
    role: "user",
    inputType,
    text: normalizedText,
    sourceMessageId: String(sourceMessageId || "").trim(),
    meta: basePayload(meta),
  });
}

export async function appendWebAgentAssistantMessage({
  sessionId,
  workspaceId,
  userId,
  text,
  meta = null,
}) {
  const normalizedText = normalizeText(text);
  if (!sessionId || !workspaceId || !userId || !normalizedText) return null;

  return WebAgentMessage.create({
    sessionId,
    workspaceId,
    userId,
    role: "assistant",
    inputType: "text",
    text: normalizedText,
    meta: basePayload(meta),
  });
}

export async function listWebAgentMessages({
  sessionId,
  limit = 80,
}) {
  if (!sessionId) return [];

  const safeLimit = Math.max(1, Math.min(200, Number(limit || 80)));

  return WebAgentMessage.find({ sessionId })
    .sort({ createdAt: 1 })
    .limit(safeLimit)
    .lean();
}
