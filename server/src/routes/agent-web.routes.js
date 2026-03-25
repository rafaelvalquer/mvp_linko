import crypto from "crypto";
import { Router } from "express";

import { ensureAuth } from "../middleware/auth.js";
import { WhatsAppCommandSession } from "../models/WhatsAppCommandSession.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { canUseWhatsAppAiOfferCreation } from "../utils/planFeatures.js";
import {
  closeActiveSessionsForRequester,
  findOpenWhatsAppSession,
} from "../services/whatsapp-ai/whatsappSession.service.js";
import { processInboundWhatsAppEvent } from "../services/whatsapp-ai/whatsappCommandProcessor.service.js";
import { listWebAgentMessages } from "../services/webAgentMessages.service.js";
import {
  buildLuminaWelcomeMessage,
  getWebAgentActionByKey,
  buildWebAgentRequesterKey,
  buildWebAgentUiPayload,
  serializeWebAgentMessages,
  serializeWebAgentSession,
} from "../services/webAgentUi.service.js";

const r = Router();
const WEB_SOURCE_CHANNEL = "web";

function assertAgentPlanAllowed(req) {
  if (canUseWhatsAppAiOfferCreation(req.user?.workspacePlan || "start")) return;
  const err = new Error(
    "Seu plano atual nao libera a Lumina. Faca upgrade para Pro, Business ou Enterprise para usar esse recurso.",
  );
  err.status = 403;
  err.code = "AGENT_PLAN_NOT_ALLOWED";
  throw err;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function buildSessionResponsePayload({
  user,
  activeSession = null,
  selectedSession = null,
  messages = [],
  recentSessions = [],
}) {
  const effectiveSession = selectedSession || activeSession || null;
  const serializedActiveSession = serializeWebAgentSession(activeSession);
  const serializedSelectedSession = serializeWebAgentSession(effectiveSession);
  const ui = buildWebAgentUiPayload({
    session: effectiveSession,
    user,
  });

  return {
    ok: true,
    agent: {
      name: "Lumina",
      subtitle: "Agente operacional da sua carteira",
      available: true,
    },
    welcomeMessage: buildLuminaWelcomeMessage(user?.name || ""),
    activeSession: serializedActiveSession,
    session: serializedSelectedSession,
    messages: serializeWebAgentMessages(messages),
    recentSessions: recentSessions.map((item) => serializeWebAgentSession(item)),
    ui,
    uiHints: ui,
    quickReplies: Array.isArray(ui.quickReplies) ? ui.quickReplies : [],
    suggestedActions: Array.isArray(ui.suggestedActions)
      ? ui.suggestedActions
      : [],
    actionMenu: Array.isArray(ui.actionMenu) ? ui.actionMenu : [],
    readOnly:
      !!serializedSelectedSession &&
      String(serializedSelectedSession?._id || "") !==
        String(serializedActiveSession?._id || ""),
  };
}

async function loadActiveWebSession(req) {
  return findOpenWhatsAppSession({
    userId: req.user?._id,
    requesterPhoneDigits: buildWebAgentRequesterKey(req.user?._id),
  });
}

async function listRecentWebSessions(req, excludeSessionId = null) {
  const query = {
    userId: req.user?._id,
    sourceChannel: WEB_SOURCE_CHANNEL,
  };

  if (excludeSessionId) {
    query._id = { $ne: excludeSessionId };
  }

  return WhatsAppCommandSession.find(query)
    .sort({ updatedAt: -1 })
    .limit(4)
    .lean();
}

async function loadWebSessionForUser(req, sessionId) {
  return WhatsAppCommandSession.findOne({
    _id: sessionId,
    userId: req.user?._id,
    sourceChannel: WEB_SOURCE_CHANNEL,
  }).lean();
}

r.use(ensureAuth);

r.get(
  "/agent/web/bootstrap",
  asyncHandler(async (req, res) => {
    assertAgentPlanAllowed(req);

    const activeSession = await loadActiveWebSession(req);
    let selectedSession = activeSession;
    let recentSessions = await listRecentWebSessions(req, activeSession?._id || null);
    let messages = activeSession?._id
      ? await listWebAgentMessages({ sessionId: activeSession._id, limit: 80 })
      : [];

    if (!selectedSession?._id && recentSessions.length > 0) {
      selectedSession = recentSessions[0];
      recentSessions = recentSessions.slice(1);
      messages = await listWebAgentMessages({
        sessionId: selectedSession._id,
        limit: 80,
      });
    }

    return res.json(
      buildSessionResponsePayload({
        user: req.user,
        activeSession,
        selectedSession,
        messages,
        recentSessions,
      }),
    );
  }),
);

r.get(
  "/agent/web/sessions/:id",
  asyncHandler(async (req, res) => {
    assertAgentPlanAllowed(req);

    const session = await loadWebSessionForUser(req, req.params.id);
    if (!session?._id) {
      const err = new Error("Conversa da Lumina nao encontrada.");
      err.status = 404;
      err.code = "WEB_AGENT_SESSION_NOT_FOUND";
      throw err;
    }

    const activeSession = await loadActiveWebSession(req);
    const recentSessions = await listRecentWebSessions(req, session._id);
    const messages = await listWebAgentMessages({
      sessionId: session._id,
      limit: 80,
    });

    return res.json(
      buildSessionResponsePayload({
        user: req.user,
        activeSession,
        selectedSession: session,
        messages,
        recentSessions,
      }),
    );
  }),
);

r.post(
  "/agent/web/messages",
  asyncHandler(async (req, res) => {
    assertAgentPlanAllowed(req);

    const actionKey = normalizeText(req.body?.actionKey || "");
    const explicitAction = actionKey ? getWebAgentActionByKey(actionKey, req.user) : null;
    if (actionKey && !explicitAction) {
      const err = new Error("A acao selecionada da Lumina nao esta disponivel para este usuario.");
      err.status = 400;
      err.code = "WEB_AGENT_ACTION_INVALID";
      throw err;
    }

    const text = normalizeText(req.body?.text || explicitAction?.value || "");
    if (!text) {
      const err = new Error("Digite uma mensagem para falar com a Lumina.");
      err.status = 400;
      err.code = "WEB_AGENT_MESSAGE_REQUIRED";
      throw err;
    }

    if (text.length > 5000) {
      const err = new Error("A mensagem esta muito longa para este envio.");
      err.status = 400;
      err.code = "WEB_AGENT_MESSAGE_TOO_LONG";
      throw err;
    }

    const messageId = `web-${crypto.randomUUID()}`;

    const result = await processInboundWhatsAppEvent(
      {
        sourceChannel: WEB_SOURCE_CHANNEL,
        requesterUserId: String(req.user?._id || ""),
        messageId,
        type: "text",
        text,
        actionKey: explicitAction?.actionKey || actionKey,
        pushName: String(req.user?.name || "").trim(),
      },
      {
        authUser: req.user,
      },
    );

    const activeSession = await loadActiveWebSession(req);
    const selectedSession = result?.session?._id
      ? await loadWebSessionForUser(req, result.session._id)
      : activeSession;
    const recentSessions = await listRecentWebSessions(
      req,
      selectedSession?._id || activeSession?._id || null,
    );
    const messages = selectedSession?._id
      ? await listWebAgentMessages({ sessionId: selectedSession._id, limit: 80 })
      : [];

    return res.json(
      buildSessionResponsePayload({
        user: req.user,
        activeSession,
        selectedSession,
        messages,
        recentSessions,
      }),
    );
  }),
);

r.post(
  "/agent/web/sessions/new",
  asyncHandler(async (req, res) => {
    assertAgentPlanAllowed(req);

    await closeActiveSessionsForRequester({
      userId: req.user?._id,
      requesterPhoneDigits: buildWebAgentRequesterKey(req.user?._id),
      state: "CANCELLED",
    });

    const recentSessions = await listRecentWebSessions(req, null);

    return res.json(
      buildSessionResponsePayload({
        user: req.user,
        activeSession: null,
        messages: [],
        recentSessions,
      }),
    );
  }),
);

export default r;
