import { User } from "../../models/User.js";
import { Workspace } from "../../models/Workspace.js";
import {
  normalizeDestinationPhoneN11,
  normalizeWhatsAppPhoneDigits,
} from "../../utils/phone.js";
import { canUseWhatsAppAiOfferCreation } from "../../utils/planFeatures.js";
import { queueOrSendWhatsApp } from "../whatsappOutbox.service.js";
import {
  applyCustomerSelection,
  applyProductSelectionToItem,
  pickCandidateByOrdinal,
  resolveCustomerCandidates,
  resolveProductCandidates,
} from "./whatsappEntityResolver.service.js";
import {
  buildSparseItemPatch,
  createEmptyResolved,
  listMissingMandatoryFields,
  mergeResolvedDraft,
  normalizeResolvedItems,
  parseItemFieldKey,
  parseDirectReplyValue,
} from "./whatsappAi.schemas.js";
import {
  buildAgendaFreeDayMessage,
  buildAgendaSummaryMessage,
  buildCancelledMessage,
  buildConfirmationSummary,
  buildCustomerAmbiguityQuestion,
  buildDuplicateLinkedNumberMessage,
  buildErrorMessage,
  buildInvalidConfirmationMessage,
  buildInvalidIntentSelectionMessage,
  buildInvalidSelectionMessage,
  buildIntentDisambiguationQuestion,
  buildMissingFieldQuestion,
  buildNotLinkedNumberMessage,
  buildPlanUpgradeRequiredMessage,
  buildProcessingMessage,
  buildProductAmbiguityQuestion,
  buildSuccessMessage,
} from "./whatsappQuestionBuilder.service.js";
import {
  appendInboundMessageToSession,
  closeActiveSessionsForRequester,
  createWhatsAppSession,
  findOpenWhatsAppSession,
  findSessionBySourceMessageId,
  markSessionCancelled,
  markSessionCompleted,
  markSessionError,
  transitionSessionToProcessing,
  updateWhatsAppSession,
} from "./whatsappSession.service.js";
import { createOfferAndDispatchToCustomer } from "./whatsappOfferCreation.service.js";
import { transcribeWhatsAppAudio } from "./whatsappAudioTranscription.service.js";
import {
  extractWhatsAppAgendaDate,
  extractWhatsAppIntent,
  extractWhatsAppSessionReply,
  routeWhatsAppMessageIntent,
} from "./whatsappIntentExtraction.service.js";
import {
  buildAgendaDayLabel,
  getDateIsoForTimeZone,
  getWorkspaceAgendaTimeZone,
  loadDailyAgendaForWorkspace,
  resolveAgendaQueryDate,
} from "./whatsappAgendaQuery.service.js";
import { isWhatsAppAiEnabled } from "./openai.client.js";

const inflightInboundEventKeys = new Set();
const INTENT_SELECTION_CONTEXT_KEY = "_intentSelectionContext";

function normalizeComparableText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function parseConfirmationReply(value) {
  const normalized = normalizeComparableText(value);
  if (["confirmar", "confirmo", "ok", "sim", "1"].includes(normalized))
    return "CONFIRMAR";
  if (
    ["cancelar", "cancela", "cancelado", "não", "nao", "2"].includes(normalized)
  ) {
    return "CANCELAR";
  }
  return "";
}

function parseIntentSelectionReply(value) {
  const normalized = normalizeComparableText(value);

  if (
    ["cancelar", "cancela", "cancelado"].includes(normalized) ||
    normalized.startsWith("cancel")
  ) {
    return "CANCELAR";
  }

  if (
    normalized === "1" ||
    normalized.startsWith("proposta") ||
    normalized.includes("orcamento")
  ) {
    return "PROPOSTA";
  }

  if (
    normalized === "2" ||
    normalized.startsWith("agenda") ||
    normalized.includes("agenda")
  ) {
    return "AGENDA";
  }

  return "";
}

function resolveFieldQuestionKey(pendingFields = []) {
  if (!Array.isArray(pendingFields) || !pendingFields.length) return "";

  if (pendingFields.includes("customer_name_raw")) return "customer_name_raw";

  const itemFields = pendingFields
    .map((field) => ({
      field,
      parsed: parseItemFieldKey(field),
    }))
    .filter((entry) => entry.parsed);

  if (itemFields.length) {
    const fieldOrder = {
      product_name_raw: 0,
      quantity: 1,
      unit_price_cents: 2,
    };

    itemFields.sort((a, b) => {
      if (a.parsed.itemIndex !== b.parsed.itemIndex) {
        return a.parsed.itemIndex - b.parsed.itemIndex;
      }
      return (fieldOrder[a.parsed.field] ?? 99) - (fieldOrder[b.parsed.field] ?? 99);
    });

    return itemFields[0]?.field || "";
  }

  if (pendingFields.includes("destination_phone_n11")) {
    return "destination_phone_n11";
  }

  return pendingFields[0] || "";
}

function buildSessionResolved(baseResolved = {}, patch = {}) {
  return mergeResolvedDraft(
    {
      ...createEmptyResolved(),
      ...(baseResolved && typeof baseResolved === "object" ? baseResolved : {}),
    },
    patch,
  );
}

function buildSessionExtracted(baseExtracted = {}, patch = {}) {
  return {
    ...(baseExtracted && typeof baseExtracted === "object" && !Array.isArray(baseExtracted)
      ? baseExtracted
      : {}),
    ...(patch && typeof patch === "object" && !Array.isArray(patch) ? patch : {}),
  };
}

function stripIntentSelectionContext(resolved = {}) {
  if (!resolved || typeof resolved !== "object" || Array.isArray(resolved)) {
    return {};
  }

  const next = { ...resolved };
  delete next[INTENT_SELECTION_CONTEXT_KEY];
  return next;
}

function getIntentSelectionContext(session) {
  const context = session?.resolved?.[INTENT_SELECTION_CONTEXT_KEY];
  if (!context || typeof context !== "object" || Array.isArray(context)) {
    return null;
  }
  return context;
}

function buildInboundEventKey(event) {
  const fromPhoneDigits = normalizeWhatsAppPhoneDigits(
    event?.fromPhoneDigits || "",
  );
  const messageId = String(event?.messageId || "").trim();
  return fromPhoneDigits && messageId ? `${fromPhoneDigits}:${messageId}` : "";
}

async function sendWhatsAppReply({
  workspaceId = null,
  session = null,
  to,
  message,
  dedupeKey,
  meta = null,
}) {
  if (!to || !message) return { ok: false, status: "skipped" };

  return queueOrSendWhatsApp({
    workspaceId,
    to,
    message,
    dedupeKey,
    sourceType: session ? "whatsapp_command_session" : "whatsapp_ai_inbound",
    sourceId: session?._id || null,
    meta,
  });
}

async function replyToSession({ session, user, message, dedupeSuffix }) {
  return sendWhatsAppReply({
    workspaceId: user?.workspaceId || session?.workspaceId || null,
    session,
    to: normalizeWhatsAppPhoneDigits(session?.requesterPhoneDigits || ""),
    message,
    dedupeKey: `whatsapp-command-session:${session?._id}:${dedupeSuffix}`,
    meta: {
      direction: "requester_reply",
      state: session?.state || null,
      questionKey: session?.lastQuestionKey || null,
    },
  });
}

async function replyNotLinkedRequester({ event, requesterPhoneDigits }) {
  return sendWhatsAppReply({
    workspaceId: null,
    to: requesterPhoneDigits,
    message: buildNotLinkedNumberMessage(),
    dedupeKey: `whatsapp-ai:not-linked:${event.messageId}`,
    meta: {
      direction: "requester_reply",
      reason: "NOT_LINKED",
      messageId: event.messageId,
    },
  });
}

async function replyDuplicateLinkedRequester({ event, requesterPhoneDigits }) {
  return sendWhatsAppReply({
    workspaceId: null,
    to: requesterPhoneDigits,
    message: buildDuplicateLinkedNumberMessage(),
    dedupeKey: `whatsapp-ai:duplicate-linked:${event.messageId}`,
    meta: {
      direction: "requester_reply",
      reason: "DUPLICATE_LINKED_NUMBER",
      messageId: event.messageId,
    },
  });
}

async function replyPlanNotAllowed({ event, user, requesterPhoneDigits }) {
  return sendWhatsAppReply({
    workspaceId: user?.workspaceId || null,
    to: requesterPhoneDigits,
    message: buildPlanUpgradeRequiredMessage(),
    dedupeKey: `whatsapp-ai:plan-not-allowed:${event.messageId}`,
    meta: {
      direction: "requester_reply",
      reason: "PLAN_NOT_ALLOWED",
      messageId: event.messageId,
    },
  });
}

async function askSessionQuestion({
  session,
  user,
  state,
  pendingFields = [],
  lastQuestionKey,
  lastQuestionText,
  candidateCustomers = [],
  candidateProducts = [],
  confirmationSummaryText = "",
  dedupeSuffix,
  resolved,
}) {
  const updatedSession = await updateWhatsAppSession(session._id, {
    state,
    pendingFields,
    lastQuestionKey,
    lastQuestionText,
    candidateCustomers,
    candidateProducts,
    confirmationSummaryText,
    resolved,
  });

  await replyToSession({
    session: updatedSession,
    user,
    message: lastQuestionText,
    dedupeSuffix,
  });

  return updatedSession;
}

function buildRestoredProposalQuestion(context = {}, resolved = {}) {
  if (context?.priorState === "AWAITING_CONFIRMATION") {
    return (
      String(context?.priorConfirmationSummaryText || "").trim() ||
      buildConfirmationSummary(resolved)
    );
  }

  if (String(context?.priorLastQuestionText || "").trim()) {
    return String(context.priorLastQuestionText || "").trim();
  }

  const nextField = resolveFieldQuestionKey(context?.priorPendingFields || []);
  if (nextField) {
    return buildMissingFieldQuestion(nextField, resolved);
  }

  return buildIntentDisambiguationQuestion();
}

async function maybeAskForIntentSelection({
  session,
  user,
  text,
  dedupeSuffix,
  origin = "existing_session",
}) {
  const routingExtraction = await routeWhatsAppMessageIntent({ text });

  if (
    !["query_daily_agenda", "ambiguous_offer_or_agenda"].includes(
      routingExtraction.intent,
    )
  ) {
    return null;
  }

  const question = buildIntentDisambiguationQuestion();
  const resolvedWithoutContext = stripIntentSelectionContext(session?.resolved || {});
  const context = {
    origin,
    pendingIntent: routingExtraction.intent,
    pendingIntentText: text,
    priorFlowType: session?.flowType || "offer_create",
    priorState: session?.state || "",
    priorPendingFields: Array.isArray(session?.pendingFields)
      ? session.pendingFields
      : [],
    priorLastQuestionKey: String(session?.lastQuestionKey || "").trim(),
    priorLastQuestionText: String(session?.lastQuestionText || "").trim(),
    priorCandidateCustomers: Array.isArray(session?.candidateCustomers)
      ? session.candidateCustomers
      : [],
    priorCandidateProducts: Array.isArray(session?.candidateProducts)
      ? session.candidateProducts
      : [],
    priorConfirmationSummaryText: String(
      session?.confirmationSummaryText || "",
    ).trim(),
  };

  const updatedSession = await updateWhatsAppSession(session._id, {
    flowType: "intent_disambiguation",
    state: "AWAITING_INTENT_SELECTION",
    pendingFields: [],
    lastQuestionKey: "intent_selection",
    lastQuestionText: question,
    candidateCustomers: [],
    candidateProducts: [],
    confirmationSummaryText: "",
    extracted: buildSessionExtracted(session?.extracted, {
      intentRouting: routingExtraction,
    }),
    resolved: {
      ...resolvedWithoutContext,
      [INTENT_SELECTION_CONTEXT_KEY]: context,
    },
  });

  await replyToSession({
    session: updatedSession,
    user,
    message: question,
    dedupeSuffix,
  });

  return {
    ok: true,
    status: "awaiting_intent_selection",
    session: updatedSession,
    routingExtraction,
  };
}

async function runAgendaQueryForSession({
  session,
  user,
  text,
  dedupeSuffix,
  routingExtraction = null,
}) {
  const timeZone = await getWorkspaceAgendaTimeZone(user.workspaceId);
  const now = new Date();
  const todayDateIso = getDateIsoForTimeZone(now, timeZone);
  const agendaExtraction = await extractWhatsAppAgendaDate({
    text,
    todayDateIso,
    timeZone,
  });
  const dateISO = resolveAgendaQueryDate({
    requestedDayKind: agendaExtraction.requested_day_kind,
    requestedDateIso: agendaExtraction.requested_date_iso,
    now,
    timeZone,
  });
  const dayLabel = buildAgendaDayLabel({
    requestedDayKind: agendaExtraction.requested_day_kind,
    dateISO,
    now,
    timeZone,
  });
  const agenda = await loadDailyAgendaForWorkspace({
    workspaceId: user.workspaceId,
    dateISO,
    timeZone,
  });
  const message =
    Array.isArray(agenda?.items) && agenda.items.length
      ? buildAgendaSummaryMessage({
          dayLabel,
          dateISO,
          timeZone,
          summary: agenda.summary,
          items: agenda.items,
        })
      : buildAgendaFreeDayMessage({
          dayLabel,
          dateISO,
          timeZone,
        });

  const completedSession = await markSessionCompleted(session._id, {
    flowType: "agenda_query",
    extracted: buildSessionExtracted(session?.extracted, {
      ...(routingExtraction ? { intentRouting: routingExtraction } : {}),
      agendaQuery: {
        ...agendaExtraction,
        dateISO,
        dayLabel,
        timeZone,
        summary: agenda.summary,
      },
    }),
    resolved: {
      ...stripIntentSelectionContext(session?.resolved || {}),
      source_text: text,
      agendaDateIso: dateISO,
      agendaDayLabel: dayLabel,
      agendaTimeZone: timeZone,
    },
  });

  await closeActiveSessionsForRequester({
    userId: user._id,
    requesterPhoneDigits: completedSession.requesterPhoneDigits,
    excludeSessionId: completedSession._id,
    state: "EXPIRED",
  });

  await replyToSession({
    session: completedSession,
    user,
    message,
    dedupeSuffix,
  });

  return {
    ok: true,
    status: "completed",
    session: completedSession,
    agendaDateIso: dateISO,
  };
}

async function initializeOfferSession({
  session,
  user,
  text,
  dedupeSuffix,
  routingExtraction = null,
  forceOfferFlow = false,
}) {
  const extracted = await extractWhatsAppIntent({ text });
  const normalizedExtracted =
    forceOfferFlow && extracted.intent !== "create_offer_send_whatsapp"
      ? {
          ...extracted,
          intent: "create_offer_send_whatsapp",
          send_via_whatsapp: true,
          source_text: String(extracted?.source_text || text || "").trim(),
        }
      : extracted;

  const resolved = buildSessionResolved(
    stripIntentSelectionContext(session?.resolved || createEmptyResolved()),
    normalizedExtracted,
  );
  const sessionAfterExtraction = await updateWhatsAppSession(session._id, {
    flowType: "offer_create",
    extracted: buildSessionExtracted(session?.extracted, {
      ...normalizedExtracted,
      ...(routingExtraction ? { intentRouting: routingExtraction } : {}),
    }),
    resolved,
  });

  if (normalizedExtracted.intent !== "create_offer_send_whatsapp") {
    const erroredSession = await markSessionError(sessionAfterExtraction._id, {
      code: "WHATSAPP_AI_UNKNOWN_INTENT",
      message: "Intencao nao reconhecida para o fluxo de proposta.",
    });

    await replyToSession({
      session: erroredSession,
      user,
      message: buildErrorMessage(),
      dedupeSuffix,
    });
    return { ok: true, status: "unknown_intent" };
  }

  return advanceSessionAfterResolution({
    session: sessionAfterExtraction,
    user,
    dedupeSuffix,
  });
}

async function advanceSessionAfterResolution({ session, user, dedupeSuffix }) {
  let resolved = {
    ...createEmptyResolved(),
    ...(session?.resolved && typeof session.resolved === "object"
      ? session.resolved
      : {}),
  };

  if (resolved.customer_name_raw && !resolved.customerId) {
    const query = String(resolved.customer_name_raw || "").trim();
    if (query && String(resolved.customerLookupQuery || "").trim() !== query) {
      const candidates = await resolveCustomerCandidates({
        workspaceId: user.workspaceId,
        customerNameRaw: query,
      });

      if (candidates.length > 1) {
        const question = buildCustomerAmbiguityQuestion(candidates);
        return {
          ok: true,
          status: "awaiting_customer_selection",
          session: await askSessionQuestion({
            session,
            user,
            state: "AWAITING_CUSTOMER_SELECTION",
            pendingFields: listMissingMandatoryFields(resolved),
            lastQuestionKey: "customer_selection",
            lastQuestionText: question,
            candidateCustomers: candidates,
            candidateProducts: [],
            dedupeSuffix,
            resolved: {
              ...resolved,
              customerLookupQuery: query,
              customerLookupMiss: false,
            },
          }),
        };
      }

      if (candidates.length === 1) {
        resolved = applyCustomerSelection(resolved, candidates[0]);
      } else {
        resolved = buildSessionResolved(resolved, {
          customerId: null,
          customerName: query,
          customerLookupQuery: query,
          customerLookupMiss: true,
        });
      }
    } else if (!resolved.customerName) {
      resolved = buildSessionResolved(resolved, {
        customerName: resolved.customer_name_raw,
      });
    }
  }

  const resolvedItems = normalizeResolvedItems(resolved);
  for (let itemIndex = 0; itemIndex < resolvedItems.length; itemIndex += 1) {
    const item = normalizeResolvedItems(resolved)[itemIndex] || {};
    const query = String(item.product_name_raw || "").trim();
    const lookupQuery = String(item.productLookupQuery || "").trim();

    if (!query) {
      continue;
    }

    if (!item.productId && query && lookupQuery !== query) {
      const candidates = await resolveProductCandidates({
        workspaceId: user.workspaceId,
        productNameRaw: query,
      });

      if (candidates.length > 1) {
        const question = buildProductAmbiguityQuestion(candidates, {
          itemIndex,
          itemLabel: ` (${query})`,
        });
        return {
          ok: true,
          status: "awaiting_product_selection",
          session: await askSessionQuestion({
            session,
            user,
            state: "AWAITING_PRODUCT_SELECTION",
            pendingFields: listMissingMandatoryFields(resolved),
            lastQuestionKey: `items.${itemIndex}.product_selection`,
            lastQuestionText: question,
            candidateCustomers: [],
            candidateProducts: candidates,
            dedupeSuffix,
            resolved: buildSessionResolved(
              resolved,
              buildSparseItemPatch(itemIndex, {
                productLookupQuery: query,
                productLookupMiss: false,
              }),
            ),
          }),
        };
      }

      if (candidates.length === 1) {
        resolved = applyProductSelectionToItem(resolved, itemIndex, candidates[0]);
      } else {
        resolved = buildSessionResolved(resolved, {
          ...buildSparseItemPatch(itemIndex, {
            productId: null,
            productName: query,
            productLookupQuery: query,
            productLookupMiss: true,
          }),
        });
      }
    } else if (!item.productName) {
      resolved = buildSessionResolved(
        resolved,
        buildSparseItemPatch(itemIndex, {
          productName: query,
        }),
      );
    }
  }

  const missingFields = listMissingMandatoryFields(resolved);
  if (missingFields.length) {
    const nextField = resolveFieldQuestionKey(missingFields);
    const question = buildMissingFieldQuestion(nextField, resolved);
    const nextState =
      nextField === "destination_phone_n11"
        ? "AWAITING_DESTINATION_PHONE"
        : "COLLECTING_FIELDS";

    return {
      ok: true,
      status: "collecting_fields",
      session: await askSessionQuestion({
        session,
        user,
        state: nextState,
        pendingFields: missingFields,
        lastQuestionKey: nextField,
        lastQuestionText: question,
        candidateCustomers: [],
        candidateProducts: [],
        dedupeSuffix,
        resolved,
      }),
    };
  }

  const confirmationSummaryText = buildConfirmationSummary(resolved);
  return {
    ok: true,
    status: "awaiting_confirmation",
    session: await askSessionQuestion({
      session,
      user,
      state: "AWAITING_CONFIRMATION",
      pendingFields: [],
      lastQuestionKey: "confirmation",
      lastQuestionText: confirmationSummaryText,
      candidateCustomers: [],
      candidateProducts: [],
      confirmationSummaryText,
      dedupeSuffix,
      resolved,
    }),
  };
}

async function handleIntentSelection({ session, user, event, text }) {
  const selection = parseIntentSelectionReply(text);
  const context = getIntentSelectionContext(session);
  const pendingIntentText = String(context?.pendingIntentText || text || "").trim();

  if (selection === "CANCELAR") {
    const cancelledSession = await markSessionCancelled(session._id, {
      resolved: stripIntentSelectionContext(session?.resolved || {}),
    });
    await closeActiveSessionsForRequester({
      userId: user._id,
      requesterPhoneDigits: session.requesterPhoneDigits,
      excludeSessionId: cancelledSession._id,
      state: "EXPIRED",
    });
    await replyToSession({
      session: cancelledSession,
      user,
      message: buildCancelledMessage(),
      dedupeSuffix: `${event.messageId}:cancel`,
    });
    return { ok: true, status: "cancelled", session: cancelledSession };
  }

  if (selection === "AGENDA") {
    return runAgendaQueryForSession({
      session,
      user,
      text: pendingIntentText || text,
      dedupeSuffix: `${event.messageId}:agenda`,
      routingExtraction: {
        intent: "query_daily_agenda",
        source_text: pendingIntentText || text,
      },
    });
  }

  if (selection === "PROPOSTA") {
    const baseResolved = stripIntentSelectionContext(session?.resolved || {});

    if (context?.origin === "existing_session") {
      const restoredQuestion = buildRestoredProposalQuestion(context, baseResolved);
      const restoredSession = await updateWhatsAppSession(session._id, {
        flowType: "offer_create",
        state: String(context?.priorState || "COLLECTING_FIELDS").trim() || "COLLECTING_FIELDS",
        pendingFields: Array.isArray(context?.priorPendingFields)
          ? context.priorPendingFields
          : [],
        lastQuestionKey: String(context?.priorLastQuestionKey || "").trim(),
        lastQuestionText: restoredQuestion,
        candidateCustomers: Array.isArray(context?.priorCandidateCustomers)
          ? context.priorCandidateCustomers
          : [],
        candidateProducts: Array.isArray(context?.priorCandidateProducts)
          ? context.priorCandidateProducts
          : [],
        confirmationSummaryText: String(
          context?.priorConfirmationSummaryText || "",
        ).trim(),
        resolved: baseResolved,
      });

      await replyToSession({
        session: restoredSession,
        user,
        message: restoredQuestion,
        dedupeSuffix: `${event.messageId}:proposal-resume`,
      });

      return {
        ok: true,
        status: "offer_resumed",
        session: restoredSession,
      };
    }

    const resetSession = await updateWhatsAppSession(session._id, {
      flowType: "offer_create",
      state: "NEW",
      pendingFields: [],
      lastQuestionKey: "",
      lastQuestionText: "",
      candidateCustomers: [],
      candidateProducts: [],
      confirmationSummaryText: "",
      resolved: baseResolved,
    });

    return initializeOfferSession({
      session: resetSession,
      user,
      text: pendingIntentText || text,
      dedupeSuffix: `${event.messageId}:proposal`,
      routingExtraction: {
        intent: "create_offer_send_whatsapp",
        source_text: pendingIntentText || text,
      },
      forceOfferFlow: true,
    });
  }

  await replyToSession({
    session,
    user,
    message: buildInvalidIntentSelectionMessage(session?.lastQuestionText),
    dedupeSuffix: `${event.messageId}:invalid-intent-selection`,
  });
  return { ok: true, status: "awaiting_intent_selection", session };
}

async function handleConfirmation({ session, user, dedupeSuffix }) {
  const processingSession = await transitionSessionToProcessing(session._id);
  if (!processingSession) {
    return { ok: true, status: "processing" };
  }

  const created = await createOfferAndDispatchToCustomer({
    session: processingSession,
    user,
  });

  const completedSession = await markSessionCompleted(processingSession._id, {
    createdOfferId: created.offer?._id || null,
    sentToCustomerAt: created.dispatch?.status ? new Date() : null,
    resolved: {
      ...(processingSession.resolved || {}),
      offerPublicUrl: created.publicUrl,
    },
  });

  await closeActiveSessionsForRequester({
    userId: user._id,
    requesterPhoneDigits: processingSession.requesterPhoneDigits,
    excludeSessionId: completedSession._id,
    state: "EXPIRED",
  });

  await replyToSession({
    session: completedSession,
    user,
    message: buildSuccessMessage(
      completedSession?.resolved?.customerName ||
        completedSession?.resolved?.customer_name_raw,
    ),
    dedupeSuffix,
  });

  return {
    ok: true,
    status: "completed",
    session: completedSession,
    offerId: created.offer?._id ? String(created.offer._id) : null,
  };
}

async function handleOpenSession({ session, user, event, text }) {
  const refreshedSession = await appendInboundMessageToSession(session._id, {
    sourceMessageId: event.messageId,
    requesterPushName: event.pushName,
    text,
    transcriptText:
      event.type === "audio" ? text : session.transcriptText || "",
    originalInputType: event.type,
  });

  if (!refreshedSession) {
    return { ok: true, status: "duplicate_message" };
  }

  const dedupeSuffix = `${event.messageId}:${String(refreshedSession.state || "").toLowerCase()}`;

  if (refreshedSession.state === "AWAITING_INTENT_SELECTION") {
    return handleIntentSelection({
      session: refreshedSession,
      user,
      event,
      text,
    });
  }

  if (refreshedSession.state === "AWAITING_CUSTOMER_SELECTION") {
    const selected = pickCandidateByOrdinal(
      text,
      refreshedSession.candidateCustomers || [],
    );
    if (!selected) {
      const intentSelection = await maybeAskForIntentSelection({
        session: refreshedSession,
        user,
        text,
        dedupeSuffix: `${event.messageId}:intent-selection`,
      });
      if (intentSelection) return intentSelection;

      await replyToSession({
        session: refreshedSession,
        user,
        message: buildInvalidSelectionMessage(
          refreshedSession.lastQuestionText,
        ),
        dedupeSuffix,
      });
      return { ok: true, status: "awaiting_customer_selection" };
    }

    const resolved = applyCustomerSelection(
      refreshedSession.resolved,
      selected,
    );
    const updatedSession = await updateWhatsAppSession(refreshedSession._id, {
      resolved,
      candidateCustomers: [],
    });
    return advanceSessionAfterResolution({
      session: updatedSession,
      user,
      dedupeSuffix,
    });
  }

  if (refreshedSession.state === "AWAITING_PRODUCT_SELECTION") {
    const selected = pickCandidateByOrdinal(
      text,
      refreshedSession.candidateProducts || [],
    );
    if (!selected) {
      const intentSelection = await maybeAskForIntentSelection({
        session: refreshedSession,
        user,
        text,
        dedupeSuffix: `${event.messageId}:intent-selection`,
      });
      if (intentSelection) return intentSelection;

      await replyToSession({
        session: refreshedSession,
        user,
        message: buildInvalidSelectionMessage(
          refreshedSession.lastQuestionText,
        ),
        dedupeSuffix,
      });
      return { ok: true, status: "awaiting_product_selection" };
    }

    const productSelectionField = parseItemFieldKey(refreshedSession.lastQuestionKey);
    const itemIndex =
      productSelectionField?.field === "product_selection"
        ? productSelectionField.itemIndex
        : 0;
    const resolved = applyProductSelectionToItem(
      refreshedSession.resolved,
      itemIndex,
      selected,
    );
    const updatedSession = await updateWhatsAppSession(refreshedSession._id, {
      resolved,
      candidateProducts: [],
    });
    return advanceSessionAfterResolution({
      session: updatedSession,
      user,
      dedupeSuffix,
    });
  }

  if (refreshedSession.state === "AWAITING_DESTINATION_PHONE") {
    const destinationPhone = normalizeDestinationPhoneN11(text);
    if (!destinationPhone) {
      const intentSelection = await maybeAskForIntentSelection({
        session: refreshedSession,
        user,
        text,
        dedupeSuffix: `${event.messageId}:intent-selection`,
      });
      if (intentSelection) return intentSelection;

      await replyToSession({
        session: refreshedSession,
        user,
        message: buildMissingFieldQuestion("destination_phone_n11"),
        dedupeSuffix,
      });
      return { ok: true, status: "awaiting_destination_phone" };
    }

    const resolved = buildSessionResolved(refreshedSession.resolved, {
      destination_phone_n11: destinationPhone,
      source_text: text,
    });

    const updatedSession = await updateWhatsAppSession(refreshedSession._id, {
      resolved,
    });
    return advanceSessionAfterResolution({
      session: updatedSession,
      user,
      dedupeSuffix,
    });
  }

  if (refreshedSession.state === "AWAITING_CONFIRMATION") {
    const confirmation = parseConfirmationReply(text);

    if (confirmation === "CONFIRMAR") {
      return handleConfirmation({
        session: refreshedSession,
        user,
        dedupeSuffix: `${event.messageId}:confirm`,
      });
    }

    if (confirmation === "CANCELAR") {
      const cancelledSession = await markSessionCancelled(refreshedSession._id);
      await closeActiveSessionsForRequester({
        userId: user._id,
        requesterPhoneDigits: refreshedSession.requesterPhoneDigits,
        excludeSessionId: cancelledSession._id,
        state: "EXPIRED",
      });
      await replyToSession({
        session: cancelledSession,
        user,
        message: buildCancelledMessage(),
        dedupeSuffix: `${event.messageId}:cancel`,
      });
      return { ok: true, status: "cancelled", session: cancelledSession };
    }

    const intentSelection = await maybeAskForIntentSelection({
      session: refreshedSession,
      user,
      text,
      dedupeSuffix: `${event.messageId}:intent-selection`,
    });
    if (intentSelection) return intentSelection;

    await replyToSession({
      session: refreshedSession,
      user,
      message: buildInvalidConfirmationMessage(),
      dedupeSuffix,
    });
    return { ok: true, status: "awaiting_confirmation" };
  }

  if (refreshedSession.state === "PROCESSING_CREATE") {
    await replyToSession({
      session: refreshedSession,
      user,
      message: buildProcessingMessage(),
      dedupeSuffix,
    });
    return { ok: true, status: "processing" };
  }

  const pendingFields = Array.isArray(refreshedSession.pendingFields)
    ? refreshedSession.pendingFields
    : [];

  let patch = {};
  if (
    refreshedSession.lastQuestionKey &&
    pendingFields.includes(refreshedSession.lastQuestionKey)
  ) {
    patch = parseDirectReplyValue(refreshedSession.lastQuestionKey, text);
  }

  if (!Object.keys(patch).length) {
    const intentSelection = await maybeAskForIntentSelection({
      session: refreshedSession,
      user,
      text,
      dedupeSuffix: `${event.messageId}:intent-selection`,
    });
    if (intentSelection) return intentSelection;
  }

  const extracted = Object.keys(patch).length
    ? patch
    : await extractWhatsAppSessionReply({
        text,
        lastQuestionKey: refreshedSession.lastQuestionKey,
        pendingFields,
        currentResolved: refreshedSession.resolved || {},
      });

  const resolved = buildSessionResolved(refreshedSession.resolved, extracted);
  const updatedSession = await updateWhatsAppSession(refreshedSession._id, {
    extracted: buildSessionExtracted(refreshedSession.extracted, extracted),
    resolved,
  });

  return advanceSessionAfterResolution({
    session: updatedSession,
    user,
    dedupeSuffix,
  });
}

export async function processInboundWhatsAppEvent(event) {
  if (!isWhatsAppAiEnabled()) {
    return { ok: true, status: "disabled" };
  }

  const inboundEventKey = buildInboundEventKey(event);
  if (inboundEventKey && inflightInboundEventKeys.has(inboundEventKey)) {
    return { ok: true, status: "duplicate_message" };
  }

  if (inboundEventKey) {
    inflightInboundEventKeys.add(inboundEventKey);
  }

  const requesterPhoneDigits = normalizeWhatsAppPhoneDigits(
    event.fromPhoneDigits || "",
  );
  let user = null;
  let sessionForError = null;

  try {
    if (!requesterPhoneDigits) {
      return { ok: false, status: "invalid_from_phone" };
    }

    const users = await User.find({
      whatsappPhoneDigits: requesterPhoneDigits,
      status: "active",
    })
      .select("_id workspaceId name email role status whatsappPhone")
      .limit(2)
      .lean();

    if (users.length === 0) {
      await replyNotLinkedRequester({ event, requesterPhoneDigits });
      return { ok: true, status: "requester_not_linked" };
    }

    if (users.length > 1) {
      await replyDuplicateLinkedRequester({ event, requesterPhoneDigits });
      return { ok: true, status: "requester_phone_ambiguous" };
    }

    user = users[0];
    const workspace = await Workspace.findById(user.workspaceId)
      .select("plan")
      .lean();
    const workspacePlan = workspace?.plan || "start";

    if (!canUseWhatsAppAiOfferCreation(workspacePlan)) {
      await closeActiveSessionsForRequester({
        userId: user._id,
        requesterPhoneDigits,
        state: "CANCELLED",
      });
      await replyPlanNotAllowed({
        event,
        user,
        requesterPhoneDigits,
      });
      return { ok: true, status: "plan_not_allowed" };
    }

    const duplicateSession = await findSessionBySourceMessageId({
      userId: user._id,
      messageId: event.messageId,
    });
    if (duplicateSession) {
      return { ok: true, status: "duplicate_message" };
    }

    sessionForError = await findOpenWhatsAppSession({
      userId: user._id,
      requesterPhoneDigits,
    });

    let text = String(event.text || "").trim();

    if (event.type === "audio") {
      text = await transcribeWhatsAppAudio({
        audioBase64: event.audioBase64,
        mimeType: event.mimeType,
      });
    }

    if (!text) {
      const err = new Error("Mensagem vazia recebida.");
      err.code = "EMPTY_INBOUND_MESSAGE";
      throw err;
    }

    if (sessionForError) {
      return handleOpenSession({ session: sessionForError, user, event, text });
    }

    let createdSession = null;
    try {
      createdSession = await createWhatsAppSession({
        workspaceId: user.workspaceId,
        userId: user._id,
        requesterPhoneRaw: String(event.fromPhoneDigits || ""),
        requesterPhoneDigits,
        requesterPushName: String(event.pushName || "").trim(),
        sourceMessageId: event.messageId,
        originalInputType: event.type,
        originalText: event.type === "text" ? text : "",
        transcriptText: event.type === "audio" ? text : "",
        lastUserMessageText: text,
      });
    } catch (error) {
      if (error?.code === 11000) {
        const duplicateCreatedSession = await findSessionBySourceMessageId({
          userId: user._id,
          messageId: event.messageId,
        });
        if (duplicateCreatedSession) {
          return { ok: true, status: "duplicate_message" };
        }

        sessionForError = await findOpenWhatsAppSession({
          userId: user._id,
          requesterPhoneDigits,
        });
        if (sessionForError) {
          return handleOpenSession({
            session: sessionForError,
            user,
            event,
            text,
          });
        }
      }

      throw error;
    }
    sessionForError = createdSession;

    const routingExtraction = await routeWhatsAppMessageIntent({ text });
    const sessionAfterRouting = await updateWhatsAppSession(createdSession._id, {
      extracted: buildSessionExtracted(createdSession.extracted, {
        intentRouting: routingExtraction,
      }),
    });

    if (routingExtraction.intent === "query_daily_agenda") {
      return runAgendaQueryForSession({
        session: sessionAfterRouting,
        user,
        text,
        dedupeSuffix: `${event.messageId}:agenda`,
        routingExtraction,
      });
    }

    if (routingExtraction.intent === "ambiguous_offer_or_agenda") {
      const intentSelection = await maybeAskForIntentSelection({
        session: sessionAfterRouting,
        user,
        text,
        dedupeSuffix: `${event.messageId}:intent-selection`,
        origin: "new_session",
      });
      if (intentSelection) return intentSelection;
    }

    if (routingExtraction.intent !== "create_offer_send_whatsapp") {
      const erroredSession = await markSessionError(sessionAfterRouting._id, {
        code: "WHATSAPP_AI_UNKNOWN_INTENT",
        message: "Intencao nao reconhecida para proposta nem agenda.",
      });

      await replyToSession({
        session: erroredSession,
        user,
        message: buildErrorMessage(),
        dedupeSuffix: `${event.messageId}:unknown-intent`,
      });
      return { ok: true, status: "unknown_intent" };
    }

    return initializeOfferSession({
      session: sessionAfterRouting,
      user,
      text,
      dedupeSuffix: `${event.messageId}:new-session`,
      routingExtraction,
    });
  } catch (error) {
    if (typeof user !== "undefined" && sessionForError?._id) {
      const erroredSession = await markSessionError(sessionForError._id, error);
      await replyToSession({
        session: erroredSession,
        user,
        message: buildErrorMessage(),
        dedupeSuffix: `${event.messageId}:error`,
      });
    } else if (typeof user !== "undefined") {
      await sendWhatsAppReply({
        workspaceId: user.workspaceId,
        to: requesterPhoneDigits,
        message: buildErrorMessage(),
        dedupeKey: `whatsapp-ai:error:${event.messageId}`,
        meta: {
          direction: "requester_reply",
          reason: "UNHANDLED_ERROR",
        },
      });
    }

    return {
      ok: false,
      status: "error",
      error: String(error?.message || "Falha ao processar evento inbound."),
    };
  } finally {
    if (inboundEventKey) {
      inflightInboundEventKeys.delete(inboundEventKey);
    }
  }
}
