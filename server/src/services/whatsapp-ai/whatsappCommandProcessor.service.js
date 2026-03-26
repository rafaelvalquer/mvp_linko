import { User } from "../../models/User.js";
import { Workspace } from "../../models/Workspace.js";
import {
  formatPhoneDisplay,
  normalizeDestinationPhoneN11,
  normalizeWhatsAppPhoneDigits,
} from "../../utils/phone.js";
import { canUseWhatsAppAiOfferCreation } from "../../utils/planFeatures.js";
import { assertWorkspaceModuleAccess } from "../../utils/workspaceAccess.js";
import { queueOrSendWhatsApp } from "../whatsappOutbox.service.js";
import {
  appendWebAgentAssistantMessage,
  appendWebAgentUserMessage,
} from "../webAgentMessages.service.js";
import {
  buildWebAgentRequesterKey,
  buildWebModuleAccessDeniedMessage,
  humanizeLuminaMessage,
  resolveWebAgentActionInput,
} from "../webAgentUi.service.js";
import {
  buildWebAgentAutomationSummaryMessage,
  listWebAgentAutomationOfferCandidates,
  resolveAutomationOfferCandidate,
} from "../webAgentAutomation.service.js";
import {
  buildLuminaInsightLimitMessage,
  generateLuminaInsight,
  getLuminaInsightUsageStatus,
} from "../luminaInsight.service.js";
import {
  applyCustomerSelection,
  applyProductSelectionToItem,
  pickCandidateByOrdinal,
  resolveCustomerCandidates,
  resolveProductByCode,
  resolveProductCandidates,
} from "./whatsappEntityResolver.service.js";
import {
  buildSparseItemPatch,
  createEmptyBackofficeOperationExtraction,
  createEmptyBookingOperationExtraction,
  createEmptyOfferSalesOperationExtraction,
  createEmptyResolved,
  listMissingMandatoryFields,
  mergeResolvedDraft,
  normalizeResolvedItems,
  parseCpfCnpjDigits,
  parseEmailFromText,
  parseItemFieldKey,
  parseProductCodeFromText,
  parseDirectReplyValue,
} from "./whatsappAi.schemas.js";
import {
  buildAgendaFreeDayMessage,
  buildAgendaSummaryMessage,
  buildBackofficeContextSwitchQuestion,
  buildBackofficeMissingFieldQuestion,
  buildBackofficeOperationDisambiguationQuestion,
  buildBookingAmbiguityQuestion,
  buildBookingCancelConfirmation,
  buildBookingCancelledSuccessMessage,
  buildBookingOperationDisambiguationQuestion,
  buildBookingRescheduleConfirmation,
  buildBookingRescheduledSuccessMessage,
  buildCancelledMessage,
  buildConfirmationSummary,
  buildCustomerAmbiguityQuestion,
  buildDuplicateLinkedNumberMessage,
  buildErrorMessage,
  buildInvalidBookingOperationSelectionMessage,
  buildInvalidBackofficeContextSwitchMessage,
  buildInvalidBackofficeSelectionMessage,
  buildInvalidConfirmationMessage,
  buildInvalidIntentSelectionMessage,
  buildInvalidOfferPaymentDecisionMessage,
  buildInvalidOfferSalesSelectionMessage,
  buildInvalidSelectionMessage,
  buildIntentDisambiguationQuestion,
  buildMissingFieldQuestion,
  buildMissingBookingTimeQuestion,
  buildNextBookingMessage,
  buildNotLinkedNumberMessage,
  buildOfferAmbiguityQuestion,
  buildOfferCancelConfirmation,
  buildOfferCancelledSuccessMessage,
  buildOfferPaymentApprovedSuccessMessage,
  buildOfferPaymentProofMissingMessage,
  buildOfferPaymentProofReviewMessage,
  buildOfferPaymentRejectedSuccessMessage,
  buildOfferPaymentRejectionReasonQuestion,
  buildOfferSalesContextSwitchQuestion,
  buildOfferReminderConfirmation,
  buildOfferReminderResultMessage,
  buildOfferSalesOperationDisambiguationQuestion,
  buildOffersWaitingConfirmationEmptyMessage,
  buildOffersWaitingConfirmationSummaryMessage,
  buildInvalidOfferSalesContextSwitchMessage,
  buildPendingOffersEmptyMessage,
  buildPendingOffersSummaryMessage,
  buildPlanUpgradeRequiredMessage,
  buildProcessingMessage,
  buildProductCodeConflictMessage,
  buildProductCreateConfirmation,
  buildProductCreatedSuccessMessage,
  buildProductAmbiguityQuestion,
  buildProductCodeNotFoundQuestion,
  buildProductLookupMessage,
  buildProductPriceUpdateConfirmation,
  buildProductPriceUpdatedSuccessMessage,
  buildSuccessMessage,
  buildWeeklyAgendaMessage,
  buildClientCreateConfirmation,
  buildClientCreatedSuccessMessage,
  buildClientExistingMatchesQuestion,
  buildClientLookupMessage,
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
  extractWhatsAppBackofficeOperation,
  extractWhatsAppBookingOperation,
  extractWhatsAppIntent,
  extractWhatsAppOfferSalesOperation,
  extractWhatsAppSessionReply,
  routeWhatsAppMessageIntent,
} from "./whatsappIntentExtraction.service.js";
import {
  buildAgendaDayLabel,
  findNextBookingForWorkspace,
  getDateIsoForTimeZone,
  getWorkspaceAgendaTimeZone,
  loadDailyAgendaForWorkspace,
  loadWeeklyAgendaForWorkspace,
  resolveAgendaQueryDate,
} from "./whatsappAgendaQuery.service.js";
import {
  cancelBookingByWorkspace,
  pickBookingCandidateByOrdinal,
  previewBookingReschedule,
  resolveBookingCandidates,
  resolveNextBookingSchedule,
  rescheduleBookingByWorkspace,
} from "./whatsappBookingOperations.service.js";
import {
  listPendingOffers,
  listOffersWaitingConfirmation,
  resolveOfferCandidates,
} from "./whatsappOfferOperations.service.js";
import { createClientForWorkspace } from "../clients/createClient.service.js";
import { createProductForWorkspace, updateProductPriceForWorkspace } from "../products/product.service.js";
import { sendManualPaymentReminder } from "../paymentReminder.service.js";
import { cancelOfferByWorkspace } from "../offers/cancelOffer.service.js";
import {
  confirmOfferPaymentByWorkspace,
  rejectOfferPaymentByWorkspace,
} from "../offers/paymentApproval.service.js";
import { isWhatsAppAiEnabled } from "./openai.client.js";
import {
  lookupClientPhones,
  findProductByCode,
  lookupProducts,
  normalizeClientPhoneForStorage,
  searchClientCandidates,
  searchProductCandidates,
} from "./whatsappBackofficeOperations.service.js";

const inflightInboundEventKeys = new Set();
const INTENT_SELECTION_CONTEXT_KEY = "_intentSelectionContext";
const WEB_SOURCE_CHANNEL = "web";

function resolveIntentModuleKey(intent) {
  const normalized = String(intent || "").trim();

  if (normalized === "create_offer_send_whatsapp") return "newOffer";
  if (normalized === "generate_sales_insight") return "reports";
  if (
    [
      "query_pending_offers",
      "query_offers_waiting_confirmation",
      "query_due_today_offers",
      "query_overdue_offers",
      "query_stale_offer_followups",
      "query_billing_priorities",
      "send_offer_payment_reminder",
      "cancel_offer",
    ].includes(normalized)
  ) {
    return "offers";
  }
  if (
    [
      "query_daily_agenda",
      "query_weekly_agenda",
      "query_next_booking",
      "reschedule_booking",
      "cancel_booking",
    ].includes(normalized)
  ) {
    return "calendar";
  }
  if (["create_client", "lookup_client_phone"].includes(normalized)) {
    return "clients";
  }
  if (
    ["create_product", "update_product_price", "lookup_product"].includes(
      normalized,
    )
  ) {
    return "products";
  }
  return "";
}

function isWebSourceChannel(sourceChannel) {
  return String(sourceChannel || "").trim().toLowerCase() === WEB_SOURCE_CHANNEL;
}

async function maybeHandleWebModuleAccessDenied({
  session,
  user,
  moduleKey,
  dedupeSuffix,
}) {
  if (!session?._id || !user || !isWebSourceChannel(session?.sourceChannel)) {
    return null;
  }

  const normalizedModuleKey = String(moduleKey || "").trim();
  if (!normalizedModuleKey) return null;

  try {
    assertWorkspaceModuleAccess({
      user,
      workspacePlan: user?.workspacePlan,
      workspaceOwnerUserId: user?.workspaceOwnerUserId,
      moduleKey: normalizedModuleKey,
    });
    return null;
  } catch (error) {
    if (error?.code !== "MODULE_ACCESS_DENIED") throw error;

    const cancelledSession = await markSessionCancelled(session._id, {
      lastError: {
        message: error.message || "Modulo indisponivel para este usuario.",
        code: error.code || "MODULE_ACCESS_DENIED",
        details: {
          moduleKey: normalizedModuleKey,
        },
        at: new Date(),
      },
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
      message: buildWebModuleAccessDeniedMessage(normalizedModuleKey),
      dedupeSuffix: `${dedupeSuffix}:module-access-denied`,
    });

    return {
      ok: true,
      status: "module_access_denied",
      session: cancelledSession,
    };
  }
}

async function recordWebInboundMessageIfNeeded({
  event,
  session,
  user,
  text,
}) {
  if (
    !session?._id ||
    !user?._id ||
    !isWebSourceChannel(event?.sourceChannel || session?.sourceChannel)
  ) {
    return null;
  }

  return appendWebAgentUserMessage({
    sessionId: session._id,
    workspaceId: user?.workspaceId || session?.workspaceId || null,
    userId: user._id,
    text,
    sourceMessageId: String(event?.messageId || "").trim(),
    inputType: "text",
    meta: {
      sourceChannel: WEB_SOURCE_CHANNEL,
    },
  });
}

function normalizeComparableText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isTerminalSessionState(state) {
  return ["COMPLETED", "CANCELLED", "ERROR", "EXPIRED"].includes(
    String(state || "").trim().toUpperCase(),
  );
}

function buildDeterministicWebRoutingExtraction(action = null, text = "") {
  if (!action?.routingIntent) return null;

  return {
    intent: String(action.routingIntent || "").trim(),
    source_text: String(text || action.value || "").trim(),
  };
}

function buildForcedBackofficeExtraction(intent, text = "") {
  return {
    ...createEmptyBackofficeOperationExtraction(),
    intent: String(intent || "").trim() || "unknown",
    source_text: String(text || "").trim(),
  };
}

function buildForcedBookingExtraction(intent, text = "") {
  return {
    ...createEmptyBookingOperationExtraction(),
    intent: String(intent || "").trim() || "unknown",
    source_text: String(text || "").trim(),
  };
}

function buildForcedOfferSalesExtraction(intent, text = "") {
  return {
    ...createEmptyOfferSalesOperationExtraction(),
    intent: String(intent || "").trim() || "unknown",
    source_text: String(text || "").trim(),
  };
}

function normalizeAutomationContext(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value;
}

async function resolveSelectedOfferCandidateFromAutomationContext({
  user,
  automationContext = null,
}) {
  const context = normalizeAutomationContext(automationContext);
  const offerId = String(context?.offerId || "").trim();
  if (!offerId) return null;

  return resolveAutomationOfferCandidate({
    user,
    offerId,
  });
}

async function maybeRearmWebSessionForNextInput(session) {
  if (!session?._id || !isWebSourceChannel(session?.sourceChannel)) {
    return session;
  }

  if (!isTerminalSessionState(session?.state)) {
    return session;
  }

  return updateWhatsAppSession(session._id, {
    flowType: "intent_disambiguation",
    state: "NEW",
    pendingFields: [],
    extracted: {},
    resolved: createEmptyResolved(),
    candidateCustomers: [],
    candidateProducts: [],
    candidateBookings: [],
    candidateOffers: [],
    confirmationSummaryText: "",
    lastQuestionKey: "",
    lastQuestionText: "",
    completedAt: null,
    cancelledAt: null,
    lastError: null,
  });
}

async function resolveInitialRoutingForSession({
  session,
  text,
  actionKey = "",
  user = null,
}) {
  if (isWebSourceChannel(session?.sourceChannel)) {
    const deterministicAction = resolveWebAgentActionInput({
      actionKey,
      value: text,
      user,
    });
    if (deterministicAction) {
      return {
        deterministicAction,
        routingExtraction: buildDeterministicWebRoutingExtraction(
          deterministicAction,
          text,
        ),
      };
    }
  }

  return {
    deterministicAction: null,
    routingExtraction: await routeWhatsAppMessageIntent({ text }),
  };
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

function parseCandidateSelectionReply(value) {
  const normalized = normalizeComparableText(value);

  if (
    ["cancelar", "cancela", "cancelado"].includes(normalized) ||
    normalized === "0" ||
    normalized.startsWith("cancel")
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
    normalized.includes("proposta") ||
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

function parseBookingOperationSelectionReply(value) {
  const normalized = normalizeComparableText(value);

  if (
    ["cancelar", "cancela", "cancelado"].includes(normalized) ||
    normalized.startsWith("cancel")
  ) {
    return "CANCELAR_COMPROMISSO";
  }

  if (
    normalized === "1" ||
    normalized.startsWith("agenda") ||
    normalized.includes("consult")
  ) {
    return "CONSULTAR_AGENDA";
  }

  if (
    normalized === "2" ||
    normalized.startsWith("reagendar") ||
    normalized.includes("reagendar") ||
    normalized.includes("remarcar")
  ) {
    return "REAGENDAR";
  }

  if (normalized === "3" || normalized.includes("cancel")) {
    return "CANCELAR_COMPROMISSO";
  }

  return "";
}

function parseOfferSalesOperationSelectionReply(value) {
  const normalized = normalizeComparableText(value);

  if (
    ["cancelar", "cancela", "cancelado"].includes(normalized) ||
    normalized === "0"
  ) {
    return "CANCELAR";
  }

  if (
    normalized === "1" ||
    normalized.includes("pendente") ||
    normalized.includes("consult")
  ) {
    return "CONSULTAR_PENDENTES";
  }

  if (
    normalized === "2" ||
    normalized.includes("aguardando confirmacao") ||
    normalized.includes("aprov") ||
    normalized.includes("comprovante")
  ) {
    return "AGUARDANDO_CONFIRMACAO";
  }

  if (
    normalized === "3" ||
    normalized.startsWith("cobrar") ||
    normalized.includes("lembrete")
  ) {
    return "COBRAR_CLIENTE";
  }

  if (
    normalized === "4" ||
    normalized.startsWith("cancelar proposta") ||
    normalized.includes("cancelar proposta") ||
    normalized.includes("cancel")
  ) {
    return "CANCELAR_PROPOSTA";
  }

  return "";
}

function parseOfferApprovalDecisionReply(value) {
  const normalized = normalizeComparableText(value);

  if (
    ["confirmar", "confirmo", "aprovar", "aprovado", "1"].includes(normalized) ||
    normalized.includes("confirmar recibo") ||
    normalized.includes("confirmar comprovante") ||
    normalized.includes("aprovar recibo") ||
    normalized.includes("aprovar comprovante")
  ) {
    return "CONFIRMAR";
  }

  if (
    ["recusar", "recuso", "reprovar", "2"].includes(normalized) ||
    normalized.includes("recusar") ||
    normalized.includes("reprovar")
  ) {
    return "RECUSAR";
  }

  if (
    ["cancelar", "cancela", "cancelado", "3"].includes(normalized) ||
    normalized.startsWith("cancel")
  ) {
    return "CANCELAR";
  }

  return "";
}

function parseBackofficeOperationSelectionReply(value) {
  const normalized = normalizeComparableText(value);

  if (
    ["cancelar", "cancela", "cancelado"].includes(normalized) ||
    normalized === "0"
  ) {
    return "CANCELAR";
  }

  if (
    normalized === "1" ||
    (normalized.includes("cliente") && normalized.includes("cad"))
  ) {
    return "CRIAR_CLIENTE";
  }

  if (
    normalized === "2" ||
    (normalized.includes("produto") && normalized.includes("cad"))
  ) {
    return "CRIAR_PRODUTO";
  }

  if (
    normalized === "3" ||
    normalized.includes("preco") ||
    normalized.includes("valor")
  ) {
    return "ATUALIZAR_PRECO";
  }

  if (
    normalized === "4" ||
    normalized.includes("consult") ||
    normalized.includes("telefone")
  ) {
    return "CONSULTAR";
  }

  return "";
}

function parseOfferSalesContextSwitchReply(value) {
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
    normalized.startsWith("cobranca") ||
    normalized.startsWith("cobrar") ||
    normalized.includes("cobrar") ||
    normalized.includes("venda")
  ) {
    return "OPERACAO";
  }

  return "";
}

function parseBackofficeContextSwitchReply(value) {
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
    normalized.includes("proposta") ||
    normalized.includes("orcamento")
  ) {
    return "PROPOSTA";
  }

  if (
    normalized === "2" ||
    normalized.startsWith("backoffice") ||
    normalized.includes("cadastro") ||
    normalized.includes("cliente") ||
    normalized.includes("produto")
  ) {
    return "BACKOFFICE";
  }

  return "";
}

function resolveIntentSelectionFromDeterministicAction({
  context = null,
  actionKey = "",
  text = "",
  user = null,
}) {
  const action = resolveWebAgentActionInput({
    actionKey,
    value: text,
    user,
  });
  const routedIntent = String(action?.routingIntent || "").trim();
  if (!routedIntent) return "";

  const selectionType = String(context?.selectionType || "").trim();

  if (selectionType === "booking_operation") {
    if (["query_daily_agenda", "query_weekly_agenda", "query_next_booking"].includes(routedIntent)) {
      return "CONSULTAR_AGENDA";
    }
    if (routedIntent === "reschedule_booking") return "REAGENDAR";
    if (routedIntent === "cancel_booking") return "CANCELAR_COMPROMISSO";
    return "";
  }

  if (selectionType === "offer_sales_operation") {
    if (
      [
        "query_pending_offers",
        "query_due_today_offers",
        "query_overdue_offers",
        "query_stale_offer_followups",
        "query_billing_priorities",
      ].includes(routedIntent)
    ) {
      return "CONSULTAR_PENDENTES";
    }
    if (routedIntent === "query_offers_waiting_confirmation") {
      return "AGUARDANDO_CONFIRMACAO";
    }
    if (routedIntent === "send_offer_payment_reminder") return "COBRAR_CLIENTE";
    if (routedIntent === "cancel_offer") return "CANCELAR_PROPOSTA";
    return "";
  }

  if (selectionType === "offer_sales_context_switch") {
    if (routedIntent === "create_offer_send_whatsapp") return "PROPOSTA";
    if (
      [
        "query_pending_offers",
        "query_offers_waiting_confirmation",
        "query_due_today_offers",
        "query_overdue_offers",
        "query_stale_offer_followups",
        "query_billing_priorities",
        "send_offer_payment_reminder",
        "cancel_offer",
        "ambiguous_offer_sales_operation",
      ].includes(routedIntent)
    ) {
      return "OPERACAO";
    }
    return "";
  }

  if (selectionType === "backoffice_operation") {
    if (routedIntent === "create_client") return "CRIAR_CLIENTE";
    if (routedIntent === "create_product") return "CRIAR_PRODUTO";
    if (routedIntent === "update_product_price") return "ATUALIZAR_PRECO";
    if (["lookup_client_phone", "lookup_product"].includes(routedIntent)) {
      return "CONSULTAR";
    }
    return "";
  }

  if (selectionType === "backoffice_context_switch") {
    if (routedIntent === "create_offer_send_whatsapp") return "PROPOSTA";
    if (
      [
        "create_client",
        "create_product",
        "update_product_price",
        "lookup_client_phone",
        "lookup_product",
        "ambiguous_backoffice_operation",
      ].includes(routedIntent)
    ) {
      return "BACKOFFICE";
    }
    return "";
  }

  if (["query_daily_agenda", "query_weekly_agenda", "query_next_booking", "reschedule_booking", "cancel_booking", "ambiguous_offer_or_agenda"].includes(routedIntent)) {
    return "AGENDA";
  }

  if (routedIntent === "create_offer_send_whatsapp") {
    return "PROPOSTA";
  }

  return "";
}

function isValidClientPhoneInput(value) {
  const normalized = normalizeClientPhoneForStorage(value);
  return String(normalized || "").trim().length > 0;
}

function validateBackofficeFieldValue(field, text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return false;

  if (field === "client_full_name") return true;
  if (field === "client_phone") return isValidClientPhoneInput(trimmed);
  if (field === "client_email") return Boolean(parseEmailFromText(trimmed));
  if (field === "client_cpf_cnpj") return Boolean(parseCpfCnpjDigits(trimmed));
  if (field === "product_name") return true;
  if (field === "product_code") return Boolean(parseProductCodeFromText(trimmed));
  if (field === "product_price_cents") {
    const parsed = parseDirectReplyValue("product_price_cents", trimmed);
    return Number.isFinite(Number(parsed?.product_price_cents));
  }
  if (field === "product_description") return true;
  return false;
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

function getBookingOperationDraft(session) {
  const draft = session?.resolved?.bookingOperation;
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
    return createEmptyBookingOperationExtraction();
  }
  return {
    ...createEmptyBookingOperationExtraction(),
    ...draft,
  };
}

function getSelectedBookingCandidate(session) {
  const candidate = session?.resolved?.selectedBookingCandidate;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }
  return candidate;
}

function getSelectedBookingPreview(session) {
  const preview = session?.resolved?.selectedBookingPreview;
  if (!preview || typeof preview !== "object" || Array.isArray(preview)) {
    return null;
  }
  return preview;
}

function getOfferSalesOperationDraft(session) {
  const draft = session?.resolved?.offerSalesOperation;
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
    return {
      intent: "unknown",
      target_customer_name: "",
      target_created_day_kind: "unspecified",
      target_created_date_iso: "",
      source_text: "",
    };
  }

  return {
    intent: "unknown",
    target_customer_name: "",
    target_created_day_kind: "unspecified",
    target_created_date_iso: "",
    source_text: "",
    ...draft,
  };
}

function getSelectedOfferCandidate(session) {
  const candidate = session?.resolved?.selectedOfferCandidate;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }
  return candidate;
}

function resolveOfferSalesFlowType(intent = "") {
  if (intent === "cancel_offer") return "offer_cancel";
  if (intent === "query_offers_waiting_confirmation") {
    return "offer_payment_approval";
  }
  return "offer_payment_reminder";
}

function resolveOfferCandidateAction(intent = "") {
  if (intent === "cancel_offer") return "cancel";
  if (intent === "query_offers_waiting_confirmation") {
    return "payment_approval";
  }
  return "payment_reminder";
}

function buildOfferPaymentProofMeta(candidate = {}) {
  return {
    kind: "offer_payment_proof_review",
    offer: {
      offerId: String(candidate?.offerId || "").trim(),
      customerName: String(candidate?.customerName || "").trim(),
      title: String(candidate?.title || "").trim(),
      totalCents: Number(candidate?.totalCents || 0) || 0,
      paymentStatus: String(candidate?.paymentStatus || "").trim(),
      proofOriginalName: String(candidate?.paymentProofOriginalName || "").trim(),
      proofMimeType: String(candidate?.paymentProofMimeType || "").trim(),
      proofUploadedAt: candidate?.paymentProofUploadedAt || null,
      proofAvailable: candidate?.paymentProofAvailable === true,
    },
  };
}

function getBackofficeOperationDraft(session) {
  const draft = session?.resolved?.backofficeOperation;
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
    return createEmptyBackofficeOperationExtraction();
  }

  return {
    ...createEmptyBackofficeOperationExtraction(),
    ...draft,
  };
}

function getSelectedBackofficeProduct(session) {
  const product = session?.resolved?.selectedBackofficeProduct;
  if (!product || typeof product !== "object" || Array.isArray(product)) {
    return null;
  }
  return product;
}

function listMissingBackofficeFields(draft = {}) {
  const intent = String(draft?.intent || "").trim();
  const missing = [];

  if (intent === "create_client") {
    if (!String(draft.client_full_name || "").trim()) missing.push("client_full_name");
    if (!isValidClientPhoneInput(draft.client_phone || "")) missing.push("client_phone");
    if (!parseEmailFromText(draft.client_email || "")) missing.push("client_email");
    if (!parseCpfCnpjDigits(draft.client_cpf_cnpj || "")) missing.push("client_cpf_cnpj");
    return missing;
  }

  if (intent === "create_product") {
    if (!String(draft.product_name || "").trim()) missing.push("product_name");
    if (!Number.isFinite(Number(draft.product_price_cents))) {
      missing.push("product_price_cents");
    }
    return missing;
  }

  if (intent === "update_product_price") {
    if (!String(draft.product_name || "").trim()) missing.push("product_name");
    if (!Number.isFinite(Number(draft.product_price_cents))) {
      missing.push("product_price_cents");
    }
    return missing;
  }

  if (intent === "lookup_client_phone") {
    if (!String(draft.client_full_name || "").trim()) missing.push("client_full_name");
    return missing;
  }

  if (intent === "lookup_product") {
    const productLookupMode = String(draft.product_lookup_mode || "").trim();
    const hasProductCode = Boolean(String(draft.product_code || "").trim());
    const hasProductName = Boolean(String(draft.product_name || "").trim());
    const sourceSuggestsCode = /\b(?:codigo|id(?: do produto)?|cod)\b/i.test(
      String(draft.source_text || ""),
    );

    if (productLookupMode === "by_code" || (sourceSuggestsCode && !hasProductName)) {
      if (!hasProductCode) missing.push("product_code");
      return missing;
    }

    if (!hasProductCode && !hasProductName) missing.push("product_name");
    return missing;
  }

  return missing;
}

function mergeBackofficeOperationDraft(currentDraft = {}, patch = {}) {
  return {
    ...createEmptyBackofficeOperationExtraction(),
    ...(currentDraft && typeof currentDraft === "object" ? currentDraft : {}),
    ...(patch && typeof patch === "object" ? patch : {}),
  };
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
  if (!message) return { ok: false, status: "skipped" };

  if (isWebSourceChannel(session?.sourceChannel)) {
    const humanizedMessage = humanizeLuminaMessage({ message, session });

    await appendWebAgentAssistantMessage({
      sessionId: session?._id || null,
      workspaceId,
      userId: session?.userId || null,
      text: humanizedMessage,
      meta: {
        ...(meta && typeof meta === "object" ? meta : {}),
        sourceChannel: WEB_SOURCE_CHANNEL,
      },
    });

    return {
      ok: true,
      status: "stored",
      channel: WEB_SOURCE_CHANNEL,
    };
  }

  if (!to) return { ok: false, status: "skipped" };

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

async function replyToSession({
  session,
  user,
  message,
  dedupeSuffix,
  meta = null,
}) {
  const reply = await sendWhatsAppReply({
    workspaceId: user?.workspaceId || session?.workspaceId || null,
    session,
    to: normalizeWhatsAppPhoneDigits(session?.requesterPhoneDigits || ""),
    message,
    dedupeKey: `whatsapp-command-session:${session?._id}:${dedupeSuffix}`,
    meta: {
      direction: "requester_reply",
      state: session?.state || null,
      questionKey: session?.lastQuestionKey || null,
      ...(meta && typeof meta === "object" && !Array.isArray(meta) ? meta : {}),
    },
  });

  await maybeRearmWebSessionForNextInput(session);
  return reply;
}

async function cancelSessionAndReply({ session, user, dedupeSuffix }) {
  const cancelledSession = await markSessionCancelled(session._id);
  await closeActiveSessionsForRequester({
    userId: user._id,
    requesterPhoneDigits: cancelledSession.requesterPhoneDigits,
    excludeSessionId: cancelledSession._id,
    state: "EXPIRED",
  });
  await replyToSession({
    session: cancelledSession,
    user,
    message: buildCancelledMessage(),
    dedupeSuffix,
  });
  return cancelledSession;
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
  candidateBookings = [],
  candidateOffers = [],
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
    candidateBookings,
    candidateOffers,
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
  actionKey = "",
  dedupeSuffix,
  origin = "existing_session",
}) {
  const { routingExtraction } = await resolveInitialRoutingForSession({
    session,
    text,
    actionKey,
    user,
  });

  if (
    ![
      "query_daily_agenda",
      "query_weekly_agenda",
      "query_next_booking",
      "reschedule_booking",
      "cancel_booking",
      "ambiguous_offer_or_agenda",
    ].includes(
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

async function askBookingOperationSelection({
  session,
  user,
  dedupeSuffix,
  pendingIntentText,
  origin = "new_session",
}) {
  const question = buildBookingOperationDisambiguationQuestion();
  const resolvedWithoutContext = stripIntentSelectionContext(session?.resolved || {});
  const updatedSession = await updateWhatsAppSession(session._id, {
    flowType: "intent_disambiguation",
    state: "AWAITING_INTENT_SELECTION",
    pendingFields: [],
    lastQuestionKey: "booking_operation_selection",
    lastQuestionText: question,
    candidateCustomers: [],
    candidateProducts: [],
    confirmationSummaryText: "",
    resolved: {
      ...resolvedWithoutContext,
      [INTENT_SELECTION_CONTEXT_KEY]: {
        selectionType: "booking_operation",
        origin,
        pendingIntentText: String(pendingIntentText || "").trim(),
      },
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
  };
}

async function askOfferSalesOperationSelection({
  session,
  user,
  dedupeSuffix,
  pendingIntentText,
  origin = "new_session",
}) {
  const question = buildOfferSalesOperationDisambiguationQuestion();
  const resolvedWithoutContext = stripIntentSelectionContext(session?.resolved || {});
  const updatedSession = await updateWhatsAppSession(session._id, {
    flowType: "intent_disambiguation",
    state: "AWAITING_INTENT_SELECTION",
    pendingFields: [],
    lastQuestionKey: "offer_sales_operation_selection",
    lastQuestionText: question,
    candidateCustomers: [],
    candidateProducts: [],
    candidateBookings: [],
    candidateOffers: [],
    confirmationSummaryText: "",
    resolved: {
      ...resolvedWithoutContext,
      [INTENT_SELECTION_CONTEXT_KEY]: {
        selectionType: "offer_sales_operation",
        origin,
        pendingIntentText: String(pendingIntentText || "").trim(),
      },
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
  };
}

async function askBackofficeOperationSelection({
  session,
  user,
  dedupeSuffix,
  pendingIntentText,
  origin = "new_session",
}) {
  const question = buildBackofficeOperationDisambiguationQuestion();
  const resolvedWithoutContext = stripIntentSelectionContext(session?.resolved || {});
  const updatedSession = await updateWhatsAppSession(session._id, {
    flowType: "intent_disambiguation",
    state: "AWAITING_INTENT_SELECTION",
    pendingFields: [],
    lastQuestionKey: "backoffice_operation_selection",
    lastQuestionText: question,
    candidateCustomers: [],
    candidateProducts: [],
    candidateBookings: [],
    candidateOffers: [],
    confirmationSummaryText: "",
    resolved: {
      ...resolvedWithoutContext,
      [INTENT_SELECTION_CONTEXT_KEY]: {
        selectionType: "backoffice_operation",
        origin,
        pendingIntentText: String(pendingIntentText || "").trim(),
      },
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
  };
}

async function maybeAskForOfferSalesContextSwitch({
  session,
  user,
  text,
  actionKey = "",
  dedupeSuffix,
  origin = "existing_session",
}) {
  const { routingExtraction } = await resolveInitialRoutingForSession({
    session,
    text,
    actionKey,
    user,
  });

  if (
    ![
      "query_pending_offers",
      "query_offers_waiting_confirmation",
      "send_offer_payment_reminder",
      "cancel_offer",
      "ambiguous_offer_sales_operation",
    ].includes(routingExtraction.intent)
  ) {
    return null;
  }

  const question = buildOfferSalesContextSwitchQuestion();
  const resolvedWithoutContext = stripIntentSelectionContext(session?.resolved || {});
  const context = {
    selectionType: "offer_sales_context_switch",
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
    lastQuestionKey: "offer_sales_context_switch",
    lastQuestionText: question,
    candidateCustomers: [],
    candidateProducts: [],
    candidateBookings: [],
    candidateOffers: [],
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

async function maybeAskForBackofficeContextSwitch({
  session,
  user,
  text,
  actionKey = "",
  dedupeSuffix,
  origin = "existing_session",
}) {
  const { routingExtraction } = await resolveInitialRoutingForSession({
    session,
    text,
    actionKey,
    user,
  });

  if (
    ![
      "create_client",
      "create_product",
      "update_product_price",
      "lookup_client_phone",
      "lookup_product",
      "ambiguous_backoffice_operation",
    ].includes(routingExtraction.intent)
  ) {
    return null;
  }

  const question = buildBackofficeContextSwitchQuestion();
  const resolvedWithoutContext = stripIntentSelectionContext(session?.resolved || {});
  const context = {
    selectionType: "backoffice_context_switch",
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
    lastQuestionKey: "backoffice_context_switch",
    lastQuestionText: question,
    candidateCustomers: [],
    candidateProducts: [],
    candidateBookings: [],
    candidateOffers: [],
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
  const accessDenied = await maybeHandleWebModuleAccessDenied({
    session,
    user,
    moduleKey: resolveIntentModuleKey("query_daily_agenda"),
    dedupeSuffix,
  });
  if (accessDenied) return accessDenied;

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

async function runWeeklyAgendaQueryForSession({
  session,
  user,
  text,
  dedupeSuffix,
  routingExtraction = null,
}) {
  const accessDenied = await maybeHandleWebModuleAccessDenied({
    session,
    user,
    moduleKey: resolveIntentModuleKey("query_weekly_agenda"),
    dedupeSuffix,
  });
  if (accessDenied) return accessDenied;

  const timeZone = await getWorkspaceAgendaTimeZone(user.workspaceId);
  const now = new Date();
  const startDateISO = getDateIsoForTimeZone(now, timeZone);
  const weeklyAgenda = await loadWeeklyAgendaForWorkspace({
    workspaceId: user.workspaceId,
    startDateISO,
    days: 7,
    timeZone,
  });
  const message = buildWeeklyAgendaMessage({
    startDateISO: weeklyAgenda.startDateISO,
    endDateISO: weeklyAgenda.endDateISO,
    days: weeklyAgenda.days,
    timeZone,
  });

  const completedSession = await markSessionCompleted(session._id, {
    flowType: "agenda_query",
    extracted: buildSessionExtracted(session?.extracted, {
      ...(routingExtraction ? { intentRouting: routingExtraction } : {}),
      agendaQuery: {
        requested_day_kind: "week",
        requested_date_iso: weeklyAgenda.startDateISO,
        source_text: text,
        startDateISO: weeklyAgenda.startDateISO,
        endDateISO: weeklyAgenda.endDateISO,
        timeZone,
      },
    }),
    resolved: {
      ...stripIntentSelectionContext(session?.resolved || {}),
      source_text: text,
      agendaDateIso: weeklyAgenda.startDateISO,
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
  };
}

async function runNextBookingQueryForSession({
  session,
  user,
  text,
  dedupeSuffix,
  routingExtraction = null,
}) {
  const accessDenied = await maybeHandleWebModuleAccessDenied({
    session,
    user,
    moduleKey: resolveIntentModuleKey("query_next_booking"),
    dedupeSuffix,
  });
  if (accessDenied) return accessDenied;

  const timeZone = await getWorkspaceAgendaTimeZone(user.workspaceId);
  const nextBooking = await findNextBookingForWorkspace({
    workspaceId: user.workspaceId,
    now: new Date(),
    timeZone,
  });
  const message = buildNextBookingMessage(nextBooking);

  const completedSession = await markSessionCompleted(session._id, {
    flowType: "agenda_query",
    extracted: buildSessionExtracted(session?.extracted, {
      ...(routingExtraction ? { intentRouting: routingExtraction } : {}),
      agendaQuery: {
        requested_day_kind: "next_booking",
        requested_date_iso: "",
        source_text: text,
        timeZone,
      },
    }),
    resolved: {
      ...stripIntentSelectionContext(session?.resolved || {}),
      source_text: text,
      agendaTimeZone: timeZone,
      nextBookingId: nextBooking?.bookingId || "",
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
  };
}

async function runPendingOffersQueryForSession({
  session,
  user,
  text,
  dedupeSuffix,
  routingExtraction = null,
}) {
  const accessDenied = await maybeHandleWebModuleAccessDenied({
    session,
    user,
    moduleKey: resolveIntentModuleKey("query_pending_offers"),
    dedupeSuffix,
  });
  if (accessDenied) return accessDenied;

  const timeZone = await getWorkspaceAgendaTimeZone(user.workspaceId);
  const offers = await listPendingOffers({
    workspaceId: user.workspaceId,
    ownerUserId: user._id || null,
    timeZone,
    limit: 10,
  });
  const message = offers.length
    ? buildPendingOffersSummaryMessage(offers)
    : buildPendingOffersEmptyMessage();

  const completedSession = await markSessionCompleted(session._id, {
    flowType: "offer_query",
    extracted: buildSessionExtracted(session?.extracted, {
      ...(routingExtraction ? { intentRouting: routingExtraction } : {}),
      offerSalesOperation: {
        intent: "query_pending_offers",
        target_customer_name: "",
        target_created_day_kind: "unspecified",
        target_created_date_iso: "",
        source_text: text,
      },
    }),
    resolved: {
      ...stripIntentSelectionContext(session?.resolved || {}),
      source_text: text,
      pendingOffersCount: offers.length,
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
  };
}

async function runOfferAutomationSummaryForSession({
  session,
  user,
  text,
  dedupeSuffix,
  routingExtraction = null,
  automationType = "",
}) {
  const accessDenied = await maybeHandleWebModuleAccessDenied({
    session,
    user,
    moduleKey: resolveIntentModuleKey(routingExtraction?.intent || "query_pending_offers"),
    dedupeSuffix,
  });
  if (accessDenied) return accessDenied;

  const normalizedAutomationType = String(automationType || "").trim();
  const automationCandidates = await listWebAgentAutomationOfferCandidates({
    user,
    automationType: normalizedAutomationType,
    limit: 8,
    now: new Date(),
  });
  const message = await buildWebAgentAutomationSummaryMessage({
    user,
    automationType: normalizedAutomationType,
    candidates: automationCandidates,
  });

  if (
    isWebSourceChannel(session?.sourceChannel) &&
    ["due_today", "overdue", "stale_followup", "billing_priorities"].includes(
      normalizedAutomationType,
    ) &&
    automationCandidates.length > 0
  ) {
    const timeZone = await getWorkspaceAgendaTimeZone(user.workspaceId);
    const draft = {
      ...createEmptyOfferSalesOperationExtraction(),
      intent: "send_offer_payment_reminder",
      source_text: String(text || "").trim(),
    };

    const updatedSession = await updateWhatsAppSession(session._id, {
      flowType: "offer_payment_reminder",
      state: "AWAITING_OFFER_SELECTION",
      lastQuestionKey: "offer_selection",
      lastQuestionText: message,
      candidateOffers: automationCandidates,
      extracted: buildSessionExtracted(session?.extracted, {
        ...(routingExtraction ? { intentRouting: routingExtraction } : {}),
        offerSalesOperation: draft,
      }),
      resolved: {
        ...stripIntentSelectionContext(session?.resolved || {}),
        source_text: text,
        automationType: normalizedAutomationType,
        offerSalesOperation: draft,
        offerSalesTimeZone: timeZone,
        selectedOfferCandidate: null,
      },
    });

    await replyToSession({
      session: updatedSession,
      user,
      message,
      dedupeSuffix,
    });

    return {
      ok: true,
      status: "awaiting_offer_selection",
      session: updatedSession,
    };
  }

  const completedSession = await markSessionCompleted(session._id, {
    flowType: "offer_query",
    extracted: buildSessionExtracted(session?.extracted, {
      ...(routingExtraction ? { intentRouting: routingExtraction } : {}),
      offerSalesOperation: {
        intent: String(routingExtraction?.intent || "query_pending_offers").trim(),
        target_customer_name: "",
        target_created_day_kind: "unspecified",
        target_created_date_iso: "",
        source_text: text,
      },
    }),
      resolved: {
        ...stripIntentSelectionContext(session?.resolved || {}),
        source_text: text,
        automationType: normalizedAutomationType,
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
  };
}

async function runLuminaInsightForSession({
  session,
  user,
  text,
  dedupeSuffix,
  routingExtraction = null,
}) {
  const accessDenied = await maybeHandleWebModuleAccessDenied({
    session,
    user,
    moduleKey: resolveIntentModuleKey(routingExtraction?.intent || "generate_sales_insight"),
    dedupeSuffix,
  });
  if (accessDenied) return accessDenied;

  const insightUsage = await getLuminaInsightUsageStatus({
    user,
    now: new Date(),
  });
  if (insightUsage?.usedToday === true && Number(insightUsage?.remainingToday || 0) <= 0) {
    const limitMessage = buildLuminaInsightLimitMessage();
    const limitedSession = await updateWhatsAppSession(session._id, {
      flowType: "insight_analysis",
      state: "NEW",
      pendingFields: [],
      candidateCustomers: [],
      candidateProducts: [],
      candidateBookings: [],
      candidateOffers: [],
      confirmationSummaryText: "",
      lastQuestionKey: "insight_daily_limit",
      lastQuestionText: limitMessage,
      extracted: buildSessionExtracted(session?.extracted, {
        ...(routingExtraction ? { intentRouting: routingExtraction } : {}),
      }),
      resolved: {
        ...stripIntentSelectionContext(session?.resolved || {}),
        source_text: String(text || "").trim(),
        insightDailyLimitHitAt: new Date().toISOString(),
      },
      completedAt: null,
      cancelledAt: null,
      lastError: null,
    });

    await replyToSession({
      session: limitedSession,
      user,
      message: limitMessage,
      dedupeSuffix,
    });

    return {
      ok: true,
      status: "insight_limit_reached",
      session: limitedSession,
    };
  }

  const insight = await generateLuminaInsight({
    user,
    now: new Date(),
    windowDays: 30,
  });

  const updatedSession = await updateWhatsAppSession(session._id, {
    flowType: "insight_analysis",
    state: "NEW",
    pendingFields: [],
    candidateCustomers: [],
    candidateProducts: [],
    candidateBookings: [],
    candidateOffers: [],
    confirmationSummaryText: "",
    lastQuestionKey: "insight_summary",
    lastQuestionText: insight.message,
    extracted: buildSessionExtracted(session?.extracted, {
      ...(routingExtraction ? { intentRouting: routingExtraction } : {}),
    }),
    resolved: {
      ...stripIntentSelectionContext(session?.resolved || {}),
      source_text: String(text || "").trim(),
      insightWindowDays: 30,
      insightGeneratedAt: insight?.snapshot?.meta?.generatedAt || new Date().toISOString(),
      insightConfidence: String(insight?.analysis?.confidence || "medium").trim(),
      insightHeadline: String(insight?.analysis?.headline || "").trim(),
      insightSuggestedActions: Array.isArray(insight?.analysis?.suggestedActions)
        ? insight.analysis.suggestedActions
        : [],
    },
    insightGeneratedAt: new Date(),
    completedAt: null,
    cancelledAt: null,
    lastError: null,
  });

  await replyToSession({
    session: updatedSession,
    user,
    message: insight.message,
    dedupeSuffix,
  });

  return {
    ok: true,
    status: "insight_ready",
    session: updatedSession,
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
  const accessDenied = await maybeHandleWebModuleAccessDenied({
    session,
    user,
    moduleKey: resolveIntentModuleKey("create_offer_send_whatsapp"),
    dedupeSuffix,
  });
  if (accessDenied) return accessDenied;

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

async function advanceBookingOperationSession({ session, user, dedupeSuffix }) {
  const draft = getBookingOperationDraft(session);
  const selectedBookingCandidate = getSelectedBookingCandidate(session);
  const timeZone =
    String(selectedBookingCandidate?.timeZone || draft.timeZone || "").trim() ||
    (await getWorkspaceAgendaTimeZone(user.workspaceId));

  let workingDraft = {
    ...draft,
    timeZone,
  };
  let candidate = selectedBookingCandidate;

  if (!candidate) {
    const candidates = await resolveBookingCandidates({
      workspaceId: user.workspaceId,
      targetCustomerName: workingDraft.target_customer_name,
      targetDateIso: workingDraft.target_date_iso,
      targetTimeHhmm: workingDraft.target_time_hhmm,
      targetReference: workingDraft.target_reference,
      now: new Date(),
      limit: 5,
    });

    if (!candidates.length) {
      const erroredSession = await markSessionError(session._id, {
        code: "BOOKING_NOT_FOUND",
        message: "Nenhum compromisso elegivel encontrado para esta solicitacao.",
      });
      await replyToSession({
        session: erroredSession,
        user,
        message: "Nao encontrei um compromisso elegivel para essa solicitacao.",
        dedupeSuffix,
      });
      return { ok: true, status: "booking_not_found", session: erroredSession };
    }

    if (candidates.length > 1) {
      const question = buildBookingAmbiguityQuestion(
        candidates,
        workingDraft.intent === "cancel_booking" ? "cancelar" : "reagendar",
      );
      const updatedSession = await updateWhatsAppSession(session._id, {
        flowType:
          workingDraft.intent === "cancel_booking"
            ? "booking_cancel"
            : "booking_reschedule",
        state: "AWAITING_BOOKING_SELECTION",
        lastQuestionKey: "booking_selection",
        lastQuestionText: question,
        candidateBookings: candidates,
        resolved: {
          ...(session?.resolved || {}),
          bookingOperation: workingDraft,
          selectedBookingCandidate: null,
          selectedBookingPreview: null,
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
        status: "awaiting_booking_selection",
        session: updatedSession,
      };
    }

    candidate = candidates[0];
  }

  if (workingDraft.intent === "cancel_booking") {
    const question = buildBookingCancelConfirmation(candidate);
    const updatedSession = await updateWhatsAppSession(session._id, {
      flowType: "booking_cancel",
      state: "AWAITING_BOOKING_CHANGE_CONFIRMATION",
      lastQuestionKey: "booking_cancel_confirmation",
      lastQuestionText: question,
      confirmationSummaryText: question,
      candidateBookings: [],
      resolved: {
        ...(session?.resolved || {}),
        bookingOperation: workingDraft,
        selectedBookingCandidate: candidate,
        selectedBookingPreview: null,
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
      status: "awaiting_booking_change_confirmation",
      session: updatedSession,
    };
  }

  const nextSchedule = resolveNextBookingSchedule({
    booking: candidate,
    newDateIso: workingDraft.new_date_iso,
    newTimeHhmm: workingDraft.new_time_hhmm,
    timeZone,
  });

  if (!nextSchedule?.startAt || !nextSchedule?.endAt) {
    const question = buildMissingBookingTimeQuestion(candidate);
    const updatedSession = await updateWhatsAppSession(session._id, {
      flowType: "booking_reschedule",
      state: "AWAITING_NEW_BOOKING_TIME",
      lastQuestionKey: "booking_new_time",
      lastQuestionText: question,
      candidateBookings: [],
      resolved: {
        ...(session?.resolved || {}),
        bookingOperation: workingDraft,
        selectedBookingCandidate: candidate,
        selectedBookingPreview: null,
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
      status: "awaiting_new_booking_time",
      session: updatedSession,
    };
  }

  try {
    await previewBookingReschedule({
      bookingId: candidate.bookingId,
      workspaceId: user.workspaceId,
      startAt: nextSchedule.startAt,
      endAt: nextSchedule.endAt,
      now: new Date(),
    });
  } catch (error) {
    const question = [
      String(error?.message || "Nao consegui validar esse horario."),
      "",
      buildMissingBookingTimeQuestion(candidate),
    ].join("\n");
    const updatedSession = await updateWhatsAppSession(session._id, {
      flowType: "booking_reschedule",
      state: "AWAITING_NEW_BOOKING_TIME",
      lastQuestionKey: "booking_new_time",
      lastQuestionText: question,
      candidateBookings: [],
      resolved: {
        ...(session?.resolved || {}),
        bookingOperation: workingDraft,
        selectedBookingCandidate: candidate,
        selectedBookingPreview: null,
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
      status: "awaiting_new_booking_time",
      session: updatedSession,
    };
  }

  const question = buildBookingRescheduleConfirmation(candidate, nextSchedule);
  const updatedSession = await updateWhatsAppSession(session._id, {
    flowType: "booking_reschedule",
    state: "AWAITING_BOOKING_CHANGE_CONFIRMATION",
    lastQuestionKey: "booking_reschedule_confirmation",
    lastQuestionText: question,
    confirmationSummaryText: question,
    candidateBookings: [],
    resolved: {
      ...(session?.resolved || {}),
      bookingOperation: workingDraft,
      selectedBookingCandidate: candidate,
      selectedBookingPreview: nextSchedule,
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
    status: "awaiting_booking_change_confirmation",
    session: updatedSession,
  };
}

async function initializeBookingOperationSession({
  session,
  user,
  text,
  dedupeSuffix,
  routingExtraction = null,
  forcedExtraction = null,
}) {
  const accessDenied = await maybeHandleWebModuleAccessDenied({
    session,
    user,
    moduleKey: resolveIntentModuleKey(
      routingExtraction?.intent || "reschedule_booking",
    ),
    dedupeSuffix,
  });
  if (accessDenied) return accessDenied;

  const timeZone = await getWorkspaceAgendaTimeZone(user.workspaceId);
  const todayDateIso = getDateIsoForTimeZone(new Date(), timeZone);
  const extraction =
    forcedExtraction ||
    (await extractWhatsAppBookingOperation({
      text,
      todayDateIso,
      timeZone,
    }));

  const updatedSession = await updateWhatsAppSession(session._id, {
    flowType:
      extraction.intent === "cancel_booking"
        ? "booking_cancel"
        : "booking_reschedule",
    extracted: buildSessionExtracted(session?.extracted, {
      ...(routingExtraction ? { intentRouting: routingExtraction } : {}),
      bookingOperation: extraction,
    }),
    resolved: {
      ...(stripIntentSelectionContext(session?.resolved || {})),
      source_text: text,
      bookingOperation: {
        ...extraction,
        timeZone,
      },
      selectedBookingCandidate: null,
      selectedBookingPreview: null,
    },
  });

  if (!["reschedule_booking", "cancel_booking"].includes(extraction.intent)) {
    const erroredSession = await markSessionError(updatedSession._id, {
      code: "WHATSAPP_AI_UNKNOWN_BOOKING_OPERATION",
      message: "Intencao de operacao de agenda nao reconhecida.",
    });
    await replyToSession({
      session: erroredSession,
      user,
      message: buildErrorMessage(),
      dedupeSuffix,
    });
    return { ok: true, status: "unknown_intent", session: erroredSession };
  }

  return advanceBookingOperationSession({
    session: updatedSession,
    user,
    dedupeSuffix,
  });
}

async function advanceOfferSalesOperationSession({ session, user, dedupeSuffix }) {
  const draft = getOfferSalesOperationDraft(session);
  const selectedOfferCandidate = getSelectedOfferCandidate(session);
  const timeZone =
    String(session?.resolved?.offerSalesTimeZone || "").trim() ||
    (await getWorkspaceAgendaTimeZone(user.workspaceId));
  const flowType = resolveOfferSalesFlowType(draft.intent);
  const offerAction = resolveOfferCandidateAction(draft.intent);

  let candidate = selectedOfferCandidate;

  if (!candidate) {
    const candidates = await resolveOfferCandidates({
      workspaceId: user.workspaceId,
      ownerUserId: user._id || null,
      action: offerAction,
      targetCustomerName: draft.target_customer_name,
      targetCreatedDayKind: draft.target_created_day_kind,
      targetCreatedDateIso: draft.target_created_date_iso,
      now: new Date(),
      timeZone,
      limit: 5,
    });

    if (!candidates.length) {
      const completedSession = await markSessionCompleted(session._id, {
        flowType,
        resolved: {
          ...(session?.resolved || {}),
          offerSalesOperation: draft,
        },
      });
      await replyToSession({
        session: completedSession,
        user,
        message:
          draft.intent === "cancel_offer"
            ? "Nao encontrei uma proposta elegivel para cancelamento."
            : draft.intent === "query_offers_waiting_confirmation"
              ? buildOffersWaitingConfirmationEmptyMessage()
              : "Nao encontrei uma proposta pendente elegivel para cobranca.",
        dedupeSuffix,
      });
      return { ok: true, status: "completed", session: completedSession };
    }

    if (candidates.length > 1) {
      const question =
        draft.intent === "query_offers_waiting_confirmation"
          ? buildOffersWaitingConfirmationSummaryMessage(candidates)
          : buildOfferAmbiguityQuestion(
              candidates,
              draft.intent === "cancel_offer" ? "cancelar" : "cobrar",
            );
      const updatedSession = await updateWhatsAppSession(session._id, {
        flowType,
        state: "AWAITING_OFFER_SELECTION",
        lastQuestionKey: "offer_selection",
        lastQuestionText: question,
        candidateOffers: candidates,
        resolved: {
          ...(session?.resolved || {}),
          offerSalesOperation: draft,
          offerSalesTimeZone: timeZone,
          selectedOfferCandidate: null,
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
        status: "awaiting_offer_selection",
        session: updatedSession,
      };
    }

    candidate = candidates[0];
  }

  if (draft.intent === "query_offers_waiting_confirmation") {
    if (candidate?.paymentProofAvailable !== true) {
      const completedSession = await markSessionCompleted(session._id, {
        flowType,
        resolved: {
          ...(session?.resolved || {}),
          offerSalesOperation: draft,
          offerSalesTimeZone: timeZone,
          selectedOfferCandidate: candidate,
          offerSalesResult: {
            offerId: candidate?.offerId || null,
            status: "skipped",
            reason: "PROOF_NOT_AVAILABLE",
          },
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
        message: buildOfferPaymentProofMissingMessage(candidate),
        dedupeSuffix,
      });
      return { ok: true, status: "completed", session: completedSession };
    }

    const question = buildOfferPaymentProofReviewMessage(candidate);
    const updatedSession = await updateWhatsAppSession(session._id, {
      flowType,
      state: "AWAITING_OFFER_APPROVAL_DECISION",
      lastQuestionKey: "offer_payment_proof_review",
      lastQuestionText: question,
      confirmationSummaryText: question,
      candidateOffers: [],
      resolved: {
        ...(session?.resolved || {}),
        offerSalesOperation: draft,
        offerSalesTimeZone: timeZone,
        selectedOfferCandidate: candidate,
      },
    });

    await replyToSession({
      session: updatedSession,
      user,
      message: question,
      dedupeSuffix,
      meta: buildOfferPaymentProofMeta(candidate),
    });

    return {
      ok: true,
      status: "awaiting_offer_approval_decision",
      session: updatedSession,
    };
  }

  const question =
    draft.intent === "cancel_offer"
      ? buildOfferCancelConfirmation(candidate)
      : buildOfferReminderConfirmation(candidate);

  const updatedSession = await updateWhatsAppSession(session._id, {
    flowType,
    state: "AWAITING_OFFER_ACTION_CONFIRMATION",
    lastQuestionKey:
      draft.intent === "cancel_offer"
        ? "offer_cancel_confirmation"
        : "offer_reminder_confirmation",
    lastQuestionText: question,
    confirmationSummaryText: question,
    candidateOffers: [],
    resolved: {
      ...(session?.resolved || {}),
      offerSalesOperation: draft,
      offerSalesTimeZone: timeZone,
      selectedOfferCandidate: candidate,
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
    status: "awaiting_offer_action_confirmation",
    session: updatedSession,
  };
}

async function initializeOfferSalesOperationSession({
  session,
  user,
  text,
  dedupeSuffix,
  routingExtraction = null,
  forcedExtraction = null,
  automationContext = null,
}) {
  const accessDenied = await maybeHandleWebModuleAccessDenied({
    session,
    user,
    moduleKey: resolveIntentModuleKey(
      routingExtraction?.intent || "query_pending_offers",
    ),
    dedupeSuffix,
  });
  if (accessDenied) return accessDenied;

  const timeZone = await getWorkspaceAgendaTimeZone(user.workspaceId);
  const todayDateIso = getDateIsoForTimeZone(new Date(), timeZone);
  const extraction =
    forcedExtraction ||
    (await extractWhatsAppOfferSalesOperation({
      text,
      todayDateIso,
      timeZone,
    }));
  const selectedOfferCandidate = await resolveSelectedOfferCandidateFromAutomationContext({
    user,
    automationContext,
  });
  const flowType = resolveOfferSalesFlowType(extraction.intent);

  const updatedSession = await updateWhatsAppSession(session._id, {
    flowType,
    extracted: buildSessionExtracted(session?.extracted, {
      ...(routingExtraction ? { intentRouting: routingExtraction } : {}),
      offerSalesOperation: extraction,
    }),
    resolved: {
      ...(stripIntentSelectionContext(session?.resolved || {})),
      source_text: text,
      offerSalesOperation: extraction,
      offerSalesTimeZone: timeZone,
      selectedOfferCandidate,
    },
  });

  if (
    ![
      "query_offers_waiting_confirmation",
      "send_offer_payment_reminder",
      "cancel_offer",
    ].includes(extraction.intent)
  ) {
    const erroredSession = await markSessionError(updatedSession._id, {
      code: "WHATSAPP_AI_UNKNOWN_OFFER_OPERATION",
      message: "Intencao de cobranca e vendas nao reconhecida.",
    });
    await replyToSession({
      session: erroredSession,
      user,
      message: buildErrorMessage(),
      dedupeSuffix,
    });
    return { ok: true, status: "unknown_intent", session: erroredSession };
  }

  return advanceOfferSalesOperationSession({
    session: updatedSession,
    user,
    dedupeSuffix,
  });
}

function resolveBackofficeFlowType(intent) {
  if (intent === "create_client") return "client_create";
  if (intent === "create_product") return "product_create";
  if (intent === "update_product_price") return "product_update";
  return "lookup_query";
}

async function runBackofficeLookupForSession({
  session,
  user,
  text,
  dedupeSuffix,
  routingExtraction = null,
  draftOverride = null,
}) {
  const draft = draftOverride
    ? mergeBackofficeOperationDraft(getBackofficeOperationDraft(session), draftOverride)
    : getBackofficeOperationDraft(session);

  const missingFields = listMissingBackofficeFields(draft);
  if (missingFields.length) {
    const nextField = missingFields[0];
    const question = buildBackofficeMissingFieldQuestion(nextField);
    const updatedSession = await updateWhatsAppSession(session._id, {
      flowType: "lookup_query",
      state: "COLLECTING_FIELDS",
      pendingFields: missingFields,
      lastQuestionKey: nextField,
      lastQuestionText: question,
      resolved: {
        ...(session?.resolved || {}),
        backofficeOperation: draft,
      },
    });
    await replyToSession({
      session: updatedSession,
      user,
      message: question,
      dedupeSuffix,
    });
    return { ok: true, status: "collecting_fields", session: updatedSession };
  }

  let message = "";
  let lookupCount = 0;

  if (draft.intent === "lookup_client_phone") {
    const lookup = await lookupClientPhones({
      workspaceId: user.workspaceId,
      clientNameRaw: draft.client_full_name,
      limit: 5,
    });
    lookupCount = lookup.count;
    if (lookup.count > 1) {
      message = buildClientLookupMessage(draft.client_full_name, lookup.lines);
      const updatedSession = await updateWhatsAppSession(session._id, {
        flowType: "lookup_query",
        state: "AWAITING_CUSTOMER_SELECTION",
        pendingFields: [],
        lastQuestionKey: "lookup_client_phone_selection",
        lastQuestionText: message,
        candidateCustomers: lookup.items,
        extracted: buildSessionExtracted(session?.extracted, {
          ...(routingExtraction ? { intentRouting: routingExtraction } : {}),
          backofficeOperation: draft,
        }),
        resolved: {
          ...(stripIntentSelectionContext(session?.resolved || {})),
          source_text: text,
          backofficeOperation: draft,
          customerLookupQuery: String(draft.client_full_name || "").trim(),
          customerLookupMiss: false,
        },
      });
      await replyToSession({
        session: updatedSession,
        user,
        message,
        dedupeSuffix,
      });
      return {
        ok: true,
        status: "awaiting_customer_selection",
        session: updatedSession,
      };
    }
    message = buildClientLookupMessage(draft.client_full_name, lookup.lines);
  } else {
    const sourceSuggestsCode = /\b(?:codigo|id(?: do produto)?|cod)\b/i.test(
      String(draft.source_text || ""),
    );
    const lookupMode =
      String(draft.product_lookup_mode || "").trim() === "by_code" ||
      sourceSuggestsCode ||
      (String(draft.product_code || "").trim() &&
        !String(draft.product_name || "").trim())
        ? "by_code"
        : "by_name";
    const lookup = await lookupProducts({
      workspaceId: user.workspaceId,
      productNameRaw: draft.product_name,
      productCode: draft.product_code,
      lookupMode,
      limit: 8,
    });
    lookupCount = lookup.count;
    message = buildProductLookupMessage(draft.product_name, lookup.lines, {
      lookupMode,
      productCode: draft.product_code,
      items: lookup.items,
    });
  }

  const completedSession = await markSessionCompleted(session._id, {
    flowType: "lookup_query",
    extracted: buildSessionExtracted(session?.extracted, {
      ...(routingExtraction ? { intentRouting: routingExtraction } : {}),
      backofficeOperation: draft,
    }),
    resolved: {
      ...(stripIntentSelectionContext(session?.resolved || {})),
      source_text: text,
      backofficeOperation: draft,
      lookupCount,
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
  };
}

async function advanceBackofficeOperationSession({ session, user, dedupeSuffix }) {
  let draft = getBackofficeOperationDraft(session);
  const flowType = resolveBackofficeFlowType(draft.intent);

  if (!draft.intent || draft.intent === "unknown") {
    const erroredSession = await markSessionError(session._id, {
      code: "WHATSAPP_AI_UNKNOWN_BACKOFFICE_OPERATION",
      message: "Intencao de backoffice nao reconhecida.",
    });
    await replyToSession({
      session: erroredSession,
      user,
      message: buildErrorMessage(),
      dedupeSuffix,
    });
    return { ok: true, status: "unknown_intent", session: erroredSession };
  }

  if (["lookup_client_phone", "lookup_product"].includes(draft.intent)) {
    return runBackofficeLookupForSession({
      session,
      user,
      text: String(draft.source_text || session?.lastUserMessageText || "").trim(),
      dedupeSuffix,
      draftOverride: draft,
    });
  }

  if (draft.intent === "create_client" && !draft.allow_create_new) {
    const query = String(draft.client_full_name || "").trim();
    if (
      query &&
      String(draft.client_existing_lookup_query || "").trim() !== query
    ) {
      const existingClients = await searchClientCandidates({
        workspaceId: user.workspaceId,
        clientNameRaw: query,
        limit: 5,
      });

      if (existingClients.length) {
        const question = buildClientExistingMatchesQuestion(existingClients);
        const updatedSession = await updateWhatsAppSession(session._id, {
          flowType: "client_create",
          state: "AWAITING_CUSTOMER_SELECTION",
          pendingFields: [],
          lastQuestionKey: "client_create_existing_selection",
          lastQuestionText: question,
          candidateCustomers: existingClients,
          resolved: {
            ...(session?.resolved || {}),
            backofficeOperation: mergeBackofficeOperationDraft(draft, {
              client_existing_lookup_query: query,
            }),
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
          status: "awaiting_customer_selection",
          session: updatedSession,
        };
      }

      draft = mergeBackofficeOperationDraft(draft, {
        client_existing_lookup_query: query,
        allow_create_new: true,
      });
    }
  }

  const missingFields = listMissingBackofficeFields(draft);
  if (missingFields.length) {
    const nextField = missingFields[0];
    const question = buildBackofficeMissingFieldQuestion(nextField);
    const updatedSession = await updateWhatsAppSession(session._id, {
      flowType,
      state: "COLLECTING_FIELDS",
      pendingFields: missingFields,
      lastQuestionKey: nextField,
      lastQuestionText: question,
      candidateCustomers: [],
      candidateProducts: [],
      resolved: {
        ...(session?.resolved || {}),
        backofficeOperation: draft,
      },
    });
    await replyToSession({
      session: updatedSession,
      user,
      message: question,
      dedupeSuffix,
    });
    return { ok: true, status: "collecting_fields", session: updatedSession };
  }

  if (draft.intent === "create_client") {
    const question = buildClientCreateConfirmation(draft);
    const updatedSession = await updateWhatsAppSession(session._id, {
      flowType: "client_create",
      state: "AWAITING_BACKOFFICE_ACTION_CONFIRMATION",
      lastQuestionKey: "client_create_confirmation",
      lastQuestionText: question,
      confirmationSummaryText: question,
      candidateCustomers: [],
      candidateProducts: [],
      resolved: {
        ...(session?.resolved || {}),
        backofficeOperation: draft,
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
      status: "awaiting_backoffice_action_confirmation",
      session: updatedSession,
    };
  }

  if (draft.intent === "create_product") {
    const explicitProductCode = String(draft.product_code || "").trim();
    if (explicitProductCode) {
      const existingProduct = await findProductByCode({
        workspaceId: user.workspaceId,
        productCode: explicitProductCode,
      });

      if (existingProduct) {
        const message = buildProductCodeConflictMessage(explicitProductCode);
        const completedSession = await markSessionCompleted(session._id, {
          flowType: "product_create",
          resolved: {
            ...(session?.resolved || {}),
            backofficeOperation: draft,
            backofficeResult: {
              type: "product_create",
              status: "skipped",
              reason: "PRODUCT_CODE_CONFLICT",
              externalProductId: explicitProductCode,
              existingProductMongoId: existingProduct?.productId
                ? String(existingProduct.productId)
                : null,
            },
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
        return { ok: true, status: "completed", session: completedSession };
      }
    }

    const question = buildProductCreateConfirmation(draft);
    const updatedSession = await updateWhatsAppSession(session._id, {
      flowType: "product_create",
      state: "AWAITING_BACKOFFICE_ACTION_CONFIRMATION",
      lastQuestionKey: "product_create_confirmation",
      lastQuestionText: question,
      confirmationSummaryText: question,
      candidateCustomers: [],
      candidateProducts: [],
      resolved: {
        ...(session?.resolved || {}),
        backofficeOperation: draft,
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
      status: "awaiting_backoffice_action_confirmation",
      session: updatedSession,
    };
  }

  let selectedProduct = getSelectedBackofficeProduct(session);
  if (!selectedProduct) {
    const candidates = await searchProductCandidates({
      workspaceId: user.workspaceId,
      productNameRaw: draft.product_name,
      limit: 5,
    });

    if (!candidates.length) {
      const completedSession = await markSessionCompleted(session._id, {
        flowType: "product_update",
        resolved: {
          ...(session?.resolved || {}),
          backofficeOperation: draft,
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
        message: "Nao encontrei um produto elegivel para atualizar o preco.",
        dedupeSuffix,
      });
      return { ok: true, status: "completed", session: completedSession };
    }

    if (candidates.length > 1) {
      const question = buildProductAmbiguityQuestion(candidates, {
        itemLabel: ` (${draft.product_name})`,
      });
      const updatedSession = await updateWhatsAppSession(session._id, {
        flowType: "product_update",
        state: "AWAITING_PRODUCT_SELECTION",
        lastQuestionKey: "product_update_selection",
        lastQuestionText: question,
        candidateProducts: candidates,
        resolved: {
          ...(session?.resolved || {}),
          backofficeOperation: draft,
          selectedBackofficeProduct: null,
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
        status: "awaiting_product_selection",
        session: updatedSession,
      };
    }

    selectedProduct = candidates[0];
  }

  const question = buildProductPriceUpdateConfirmation(selectedProduct, draft);
  const updatedSession = await updateWhatsAppSession(session._id, {
    flowType: "product_update",
    state: "AWAITING_BACKOFFICE_ACTION_CONFIRMATION",
    lastQuestionKey: "product_update_confirmation",
    lastQuestionText: question,
    confirmationSummaryText: question,
    candidateProducts: [],
    resolved: {
      ...(session?.resolved || {}),
      backofficeOperation: draft,
      selectedBackofficeProduct: selectedProduct,
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
    status: "awaiting_backoffice_action_confirmation",
    session: updatedSession,
  };
}

async function initializeBackofficeOperationSession({
  session,
  user,
  text,
  dedupeSuffix,
  routingExtraction = null,
  forcedExtraction = null,
}) {
  const extraction = forcedExtraction || (await extractWhatsAppBackofficeOperation({ text }));
  const accessDenied = await maybeHandleWebModuleAccessDenied({
    session,
    user,
    moduleKey: resolveIntentModuleKey(extraction?.intent),
    dedupeSuffix,
  });
  if (accessDenied) return accessDenied;

  const flowType = resolveBackofficeFlowType(extraction.intent);

  const updatedSession = await updateWhatsAppSession(session._id, {
    flowType,
    extracted: buildSessionExtracted(session?.extracted, {
      ...(routingExtraction ? { intentRouting: routingExtraction } : {}),
      backofficeOperation: extraction,
    }),
    resolved: {
      ...(stripIntentSelectionContext(session?.resolved || {})),
      source_text: text,
      backofficeOperation: extraction,
      selectedBackofficeProduct: null,
    },
  });

  if (extraction.intent === "unknown") {
    const erroredSession = await markSessionError(updatedSession._id, {
      code: "WHATSAPP_AI_UNKNOWN_BACKOFFICE_OPERATION",
      message: "Intencao de cadastro e backoffice nao reconhecida.",
    });
    await replyToSession({
      session: erroredSession,
      user,
      message: buildErrorMessage(),
      dedupeSuffix,
    });
    return { ok: true, status: "unknown_intent", session: erroredSession };
  }

  return advanceBackofficeOperationSession({
    session: updatedSession,
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
    const productCode = String(item.productCode || item.product_code || "").trim();
    const query = String(item.product_name_raw || "").trim();
    const lookupQuery = String(item.productLookupQuery || "").trim();

    if (productCode && !item.productId) {
      const candidate = await resolveProductByCode({
        workspaceId: user.workspaceId,
        productCode,
      });

      if (!candidate) {
        const question = buildProductCodeNotFoundQuestion(productCode, {
          itemIndex,
        });
        return {
          ok: true,
          status: "collecting_fields",
          session: await askSessionQuestion({
            session,
            user,
            state: "COLLECTING_FIELDS",
            pendingFields: listMissingMandatoryFields(resolved),
            lastQuestionKey: `items.${itemIndex}.product_name_raw`,
            lastQuestionText: question,
            candidateCustomers: [],
            candidateProducts: [],
            dedupeSuffix,
            resolved: buildSessionResolved(
              resolved,
              buildSparseItemPatch(itemIndex, {
                productLookupQuery: productCode,
                productLookupMiss: true,
              }),
            ),
          }),
        };
      }

      resolved = applyProductSelectionToItem(resolved, itemIndex, candidate, {
        replaceRawName: true,
        useCatalogPrice: true,
      });
      continue;
    }

    if (!query) continue;

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
  const context = getIntentSelectionContext(session);
  const selectionFromAction = resolveIntentSelectionFromDeterministicAction({
    context,
    actionKey: event?.actionKey,
    text,
    user,
  });
  const selection =
    selectionFromAction ||
    (context?.selectionType === "booking_operation"
      ? parseBookingOperationSelectionReply(text)
      : context?.selectionType === "offer_sales_operation"
        ? parseOfferSalesOperationSelectionReply(text)
        : context?.selectionType === "offer_sales_context_switch"
          ? parseOfferSalesContextSwitchReply(text)
          : context?.selectionType === "backoffice_operation"
            ? parseBackofficeOperationSelectionReply(text)
            : context?.selectionType === "backoffice_context_switch"
              ? parseBackofficeContextSwitchReply(text)
              : parseIntentSelectionReply(text));
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

  if (selection === "CONSULTAR_PENDENTES") {
    return runPendingOffersQueryForSession({
      session,
      user,
      text: pendingIntentText || text,
      dedupeSuffix: `${event.messageId}:pending-offers`,
      routingExtraction: {
        intent: "query_pending_offers",
        source_text: pendingIntentText || text,
      },
    });
  }

  if (selection === "COBRAR_CLIENTE") {
    const resetSession = await updateWhatsAppSession(session._id, {
      flowType: "offer_payment_reminder",
      state: "NEW",
      pendingFields: [],
      lastQuestionKey: "",
      lastQuestionText: "",
      candidateCustomers: [],
      candidateProducts: [],
      candidateBookings: [],
      candidateOffers: [],
      confirmationSummaryText: "",
      resolved: stripIntentSelectionContext(session?.resolved || {}),
    });

    return initializeOfferSalesOperationSession({
      session: resetSession,
      user,
      text: pendingIntentText || text,
      dedupeSuffix: `${event.messageId}:offer-reminder`,
      routingExtraction: {
        intent: "send_offer_payment_reminder",
        source_text: pendingIntentText || text,
      },
      forcedExtraction: buildForcedOfferSalesExtraction(
        "send_offer_payment_reminder",
        pendingIntentText || text,
      ),
    });
  }

  if (selection === "AGUARDANDO_CONFIRMACAO") {
    const resetSession = await updateWhatsAppSession(session._id, {
      flowType: "offer_payment_approval",
      state: "NEW",
      pendingFields: [],
      lastQuestionKey: "",
      lastQuestionText: "",
      candidateCustomers: [],
      candidateProducts: [],
      candidateBookings: [],
      candidateOffers: [],
      confirmationSummaryText: "",
      resolved: stripIntentSelectionContext(session?.resolved || {}),
    });

    return initializeOfferSalesOperationSession({
      session: resetSession,
      user,
      text: pendingIntentText || text,
      dedupeSuffix: `${event.messageId}:offer-waiting-confirmation`,
      routingExtraction: {
        intent: "query_offers_waiting_confirmation",
        source_text: pendingIntentText || text,
      },
      forcedExtraction: buildForcedOfferSalesExtraction(
        "query_offers_waiting_confirmation",
        pendingIntentText || text,
      ),
    });
  }

  if (selection === "CANCELAR_PROPOSTA") {
    const resetSession = await updateWhatsAppSession(session._id, {
      flowType: "offer_cancel",
      state: "NEW",
      pendingFields: [],
      lastQuestionKey: "",
      lastQuestionText: "",
      candidateCustomers: [],
      candidateProducts: [],
      candidateBookings: [],
      candidateOffers: [],
      confirmationSummaryText: "",
      resolved: stripIntentSelectionContext(session?.resolved || {}),
    });

    return initializeOfferSalesOperationSession({
      session: resetSession,
      user,
      text: pendingIntentText || text,
      dedupeSuffix: `${event.messageId}:offer-cancel`,
      routingExtraction: {
        intent: "cancel_offer",
        source_text: pendingIntentText || text,
      },
      forcedExtraction: buildForcedOfferSalesExtraction(
        "cancel_offer",
        pendingIntentText || text,
      ),
    });
  }

  if (selection === "CONSULTAR_AGENDA") {
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

  if (selection === "REAGENDAR") {
    const resetSession = await updateWhatsAppSession(session._id, {
      flowType: "booking_reschedule",
      state: "NEW",
      pendingFields: [],
      lastQuestionKey: "",
      lastQuestionText: "",
      candidateCustomers: [],
      candidateProducts: [],
      candidateBookings: [],
      candidateOffers: [],
      confirmationSummaryText: "",
      resolved: stripIntentSelectionContext(session?.resolved || {}),
    });

    return initializeBookingOperationSession({
      session: resetSession,
      user,
      text: pendingIntentText || text,
      dedupeSuffix: `${event.messageId}:reschedule`,
      routingExtraction: {
        intent: "reschedule_booking",
        source_text: pendingIntentText || text,
      },
      forcedExtraction: buildForcedBookingExtraction(
        "reschedule_booking",
        pendingIntentText || text,
      ),
    });
  }

  if (selection === "CANCELAR_COMPROMISSO") {
    const resetSession = await updateWhatsAppSession(session._id, {
      flowType: "booking_cancel",
      state: "NEW",
      pendingFields: [],
      lastQuestionKey: "",
      lastQuestionText: "",
      candidateCustomers: [],
      candidateProducts: [],
      candidateBookings: [],
      candidateOffers: [],
      confirmationSummaryText: "",
      resolved: stripIntentSelectionContext(session?.resolved || {}),
    });

    return initializeBookingOperationSession({
      session: resetSession,
      user,
      text: pendingIntentText || text,
      dedupeSuffix: `${event.messageId}:cancel-booking`,
      routingExtraction: {
        intent: "cancel_booking",
        source_text: pendingIntentText || text,
      },
      forcedExtraction: buildForcedBookingExtraction(
        "cancel_booking",
        pendingIntentText || text,
      ),
    });
  }

  if (selection === "OPERACAO") {
    const routedIntent =
      String(context?.pendingIntent || "").trim() ||
      "ambiguous_offer_sales_operation";

    if (routedIntent === "query_pending_offers") {
      return runPendingOffersQueryForSession({
        session,
        user,
        text: pendingIntentText || text,
        dedupeSuffix: `${event.messageId}:pending-offers`,
        routingExtraction: {
          intent: "query_pending_offers",
          source_text: pendingIntentText || text,
        },
      });
    }

    if (
      [
        "query_offers_waiting_confirmation",
        "send_offer_payment_reminder",
        "cancel_offer",
      ].includes(routedIntent)
    ) {
      const resetSession = await updateWhatsAppSession(session._id, {
        flowType: resolveOfferSalesFlowType(routedIntent),
        state: "NEW",
        pendingFields: [],
        lastQuestionKey: "",
        lastQuestionText: "",
        candidateCustomers: [],
        candidateProducts: [],
        candidateBookings: [],
        candidateOffers: [],
        confirmationSummaryText: "",
        resolved: stripIntentSelectionContext(session?.resolved || {}),
      });

      return initializeOfferSalesOperationSession({
        session: resetSession,
        user,
        text: pendingIntentText || text,
        dedupeSuffix:
          routedIntent === "cancel_offer"
            ? `${event.messageId}:offer-cancel`
            : routedIntent === "query_offers_waiting_confirmation"
              ? `${event.messageId}:offer-waiting-confirmation`
              : `${event.messageId}:offer-reminder`,
        routingExtraction: {
          intent: routedIntent,
          source_text: pendingIntentText || text,
        },
        forcedExtraction: buildForcedOfferSalesExtraction(
          routedIntent,
          pendingIntentText || text,
        ),
      });
    }

    return askOfferSalesOperationSelection({
      session,
      user,
      pendingIntentText: pendingIntentText || text,
      dedupeSuffix: `${event.messageId}:offer-sales-operation-selection`,
      origin: "context_switch",
    });
  }

  if (selection === "CRIAR_CLIENTE") {
    const resetSession = await updateWhatsAppSession(session._id, {
      flowType: "client_create",
      state: "NEW",
      pendingFields: [],
      lastQuestionKey: "",
      lastQuestionText: "",
      candidateCustomers: [],
      candidateProducts: [],
      candidateBookings: [],
      candidateOffers: [],
      confirmationSummaryText: "",
      resolved: stripIntentSelectionContext(session?.resolved || {}),
    });

    return initializeBackofficeOperationSession({
      session: resetSession,
      user,
      text: pendingIntentText || text,
      dedupeSuffix: `${event.messageId}:create-client`,
      routingExtraction: {
        intent: "create_client",
        source_text: pendingIntentText || text,
      },
      forcedExtraction: buildForcedBackofficeExtraction(
        "create_client",
        pendingIntentText || text,
      ),
    });
  }

  if (selection === "CRIAR_PRODUTO") {
    const resetSession = await updateWhatsAppSession(session._id, {
      flowType: "product_create",
      state: "NEW",
      pendingFields: [],
      lastQuestionKey: "",
      lastQuestionText: "",
      candidateCustomers: [],
      candidateProducts: [],
      candidateBookings: [],
      candidateOffers: [],
      confirmationSummaryText: "",
      resolved: stripIntentSelectionContext(session?.resolved || {}),
    });

    return initializeBackofficeOperationSession({
      session: resetSession,
      user,
      text: pendingIntentText || text,
      dedupeSuffix: `${event.messageId}:create-product`,
      routingExtraction: {
        intent: "create_product",
        source_text: pendingIntentText || text,
      },
      forcedExtraction: buildForcedBackofficeExtraction(
        "create_product",
        pendingIntentText || text,
      ),
    });
  }

  if (selection === "ATUALIZAR_PRECO") {
    const resetSession = await updateWhatsAppSession(session._id, {
      flowType: "product_update",
      state: "NEW",
      pendingFields: [],
      lastQuestionKey: "",
      lastQuestionText: "",
      candidateCustomers: [],
      candidateProducts: [],
      candidateBookings: [],
      candidateOffers: [],
      confirmationSummaryText: "",
      resolved: stripIntentSelectionContext(session?.resolved || {}),
    });

    return initializeBackofficeOperationSession({
      session: resetSession,
      user,
      text: pendingIntentText || text,
      dedupeSuffix: `${event.messageId}:update-product-price`,
      routingExtraction: {
        intent: "update_product_price",
        source_text: pendingIntentText || text,
      },
      forcedExtraction: buildForcedBackofficeExtraction(
        "update_product_price",
        pendingIntentText || text,
      ),
    });
  }

  if (selection === "CONSULTAR") {
    const resetSession = await updateWhatsAppSession(session._id, {
      flowType: "lookup_query",
      state: "NEW",
      pendingFields: [],
      lastQuestionKey: "",
      lastQuestionText: "",
      candidateCustomers: [],
      candidateProducts: [],
      candidateBookings: [],
      candidateOffers: [],
      confirmationSummaryText: "",
      resolved: stripIntentSelectionContext(session?.resolved || {}),
    });

    return initializeBackofficeOperationSession({
      session: resetSession,
      user,
      text: pendingIntentText || text,
      dedupeSuffix: `${event.messageId}:lookup`,
      routingExtraction:
        String(context?.pendingIntent || "").trim() &&
        String(context?.pendingIntent || "").trim() !== "ambiguous_backoffice_operation"
          ? {
              intent: String(context?.pendingIntent || "").trim(),
              source_text: pendingIntentText || text,
            }
          : {
              intent: "unknown",
              source_text: pendingIntentText || text,
            },
      forcedExtraction:
        ["lookup_client_phone", "lookup_product"].includes(
          String(context?.pendingIntent || "").trim(),
        )
          ? buildForcedBackofficeExtraction(
              String(context?.pendingIntent || "").trim(),
              pendingIntentText || text,
            )
          : null,
    });
  }

  if (selection === "AGENDA") {
    const routedIntent =
      String(context?.pendingIntent || "").trim() || "query_daily_agenda";

    if (routedIntent === "query_weekly_agenda") {
      return runWeeklyAgendaQueryForSession({
        session,
        user,
        text: pendingIntentText || text,
        dedupeSuffix: `${event.messageId}:weekly-agenda`,
        routingExtraction: {
          intent: "query_weekly_agenda",
          source_text: pendingIntentText || text,
        },
      });
    }

    if (routedIntent === "query_next_booking") {
      return runNextBookingQueryForSession({
        session,
        user,
        text: pendingIntentText || text,
        dedupeSuffix: `${event.messageId}:next-booking`,
        routingExtraction: {
          intent: "query_next_booking",
          source_text: pendingIntentText || text,
        },
      });
    }

    if (["reschedule_booking", "cancel_booking"].includes(routedIntent)) {
      return initializeBookingOperationSession({
        session,
        user,
        text: pendingIntentText || text,
        dedupeSuffix: `${event.messageId}:agenda-operation`,
        routingExtraction: {
          intent: routedIntent,
          source_text: pendingIntentText || text,
        },
        forcedExtraction: buildForcedBookingExtraction(
          routedIntent,
          pendingIntentText || text,
        ),
      });
    }

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

  if (selection === "BACKOFFICE") {
    const routedIntent =
      String(context?.pendingIntent || "").trim() || "ambiguous_backoffice_operation";

    if (
      [
        "create_client",
        "create_product",
        "update_product_price",
        "lookup_client_phone",
        "lookup_product",
      ].includes(routedIntent)
    ) {
      const resetSession = await updateWhatsAppSession(session._id, {
        flowType:
          routedIntent === "create_client"
            ? "client_create"
            : routedIntent === "create_product"
              ? "product_create"
              : routedIntent === "update_product_price"
                ? "product_update"
                : "lookup_query",
        state: "NEW",
        pendingFields: [],
        lastQuestionKey: "",
        lastQuestionText: "",
        candidateCustomers: [],
        candidateProducts: [],
        candidateBookings: [],
        candidateOffers: [],
        confirmationSummaryText: "",
        resolved: stripIntentSelectionContext(session?.resolved || {}),
      });

      return initializeBackofficeOperationSession({
        session: resetSession,
        user,
        text: pendingIntentText || text,
        dedupeSuffix: `${event.messageId}:backoffice`,
        routingExtraction: {
          intent: routedIntent,
          source_text: pendingIntentText || text,
        },
        forcedExtraction: buildForcedBackofficeExtraction(
          routedIntent,
          pendingIntentText || text,
        ),
      });
    }

    return askBackofficeOperationSelection({
      session,
      user,
      pendingIntentText: pendingIntentText || text,
      dedupeSuffix: `${event.messageId}:backoffice-operation-selection`,
      origin: "context_switch",
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
    message:
      context?.selectionType === "booking_operation"
        ? buildInvalidBookingOperationSelectionMessage(session?.lastQuestionText)
        : context?.selectionType === "offer_sales_operation"
          ? buildInvalidOfferSalesSelectionMessage(session?.lastQuestionText)
          : context?.selectionType === "offer_sales_context_switch"
            ? buildInvalidOfferSalesContextSwitchMessage(session?.lastQuestionText)
            : context?.selectionType === "backoffice_operation"
              ? buildInvalidBackofficeSelectionMessage(session?.lastQuestionText)
              : context?.selectionType === "backoffice_context_switch"
                ? buildInvalidBackofficeContextSwitchMessage(session?.lastQuestionText)
        : buildInvalidIntentSelectionMessage(session?.lastQuestionText),
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

async function handleBookingChangeConfirmation({
  session,
  user,
  text,
  event,
}) {
  const confirmation = parseConfirmationReply(text);

  if (confirmation === "CANCELAR") {
    const cancelledSession = await markSessionCancelled(session._id);
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

  if (confirmation !== "CONFIRMAR") {
    await replyToSession({
      session,
      user,
      message: buildInvalidConfirmationMessage(),
      dedupeSuffix: `${event.messageId}:invalid-confirmation`,
    });
    return { ok: true, status: "awaiting_booking_change_confirmation", session };
  }

  const processingSession = await updateWhatsAppSession(session._id, {
    state: "PROCESSING_CREATE",
  });
  const candidate = getSelectedBookingCandidate(processingSession);
  const preview = getSelectedBookingPreview(processingSession);
  const draft = getBookingOperationDraft(processingSession);

  if (!candidate?.bookingId) {
    const erroredSession = await markSessionError(processingSession._id, {
      code: "BOOKING_NOT_FOUND",
      message: "Compromisso selecionado nao encontrado na sessao.",
    });
    await replyToSession({
      session: erroredSession,
      user,
      message: buildErrorMessage(),
      dedupeSuffix: `${event.messageId}:booking-error`,
    });
    return { ok: true, status: "error", session: erroredSession };
  }

  if (draft.intent === "cancel_booking") {
    const result = await cancelBookingByWorkspace({
      bookingId: candidate.bookingId,
      workspaceId: user.workspaceId,
      now: new Date(),
    });
    const completedSession = await markSessionCompleted(processingSession._id, {
      resolved: {
        ...(processingSession.resolved || {}),
        bookingOperationResult: {
          bookingId: result.booking?._id ? String(result.booking._id) : candidate.bookingId,
          status: "CANCELLED",
        },
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
      message: buildBookingCancelledSuccessMessage(candidate),
      dedupeSuffix: `${event.messageId}:booking-cancelled`,
    });
    return { ok: true, status: "completed", session: completedSession };
  }

  if (!preview?.startAt || !preview?.endAt) {
    const erroredSession = await markSessionError(processingSession._id, {
      code: "BOOKING_PREVIEW_MISSING",
      message: "Preview do reagendamento nao encontrado na sessao.",
    });
    await replyToSession({
      session: erroredSession,
      user,
      message: buildErrorMessage(),
      dedupeSuffix: `${event.messageId}:booking-error`,
    });
    return { ok: true, status: "error", session: erroredSession };
  }

  const result = await rescheduleBookingByWorkspace({
    bookingId: candidate.bookingId,
    workspaceId: user.workspaceId,
    startAt: preview.startAt,
    endAt: preview.endAt,
    now: new Date(),
  });
  const completedSession = await markSessionCompleted(processingSession._id, {
    resolved: {
      ...(processingSession.resolved || {}),
      bookingOperationResult: {
        bookingId: result.booking?._id ? String(result.booking._id) : candidate.bookingId,
        status: "RESCHEDULED",
        startAt: result.booking?.startAt || preview.startAt,
        endAt: result.booking?.endAt || preview.endAt,
      },
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
    message: buildBookingRescheduledSuccessMessage(candidate, preview),
    dedupeSuffix: `${event.messageId}:booking-rescheduled`,
  });
  return { ok: true, status: "completed", session: completedSession };
}

async function handleOfferActionConfirmation({
  session,
  user,
  text,
  event,
}) {
  const confirmation = parseConfirmationReply(text);

  if (confirmation === "CANCELAR") {
    const cancelledSession = await markSessionCancelled(session._id);
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

  if (confirmation !== "CONFIRMAR") {
    await replyToSession({
      session,
      user,
      message: buildInvalidConfirmationMessage(),
      dedupeSuffix: `${event.messageId}:invalid-confirmation`,
    });
    return { ok: true, status: "awaiting_offer_action_confirmation", session };
  }

  const processingSession = await updateWhatsAppSession(session._id, {
    state: "PROCESSING_CREATE",
  });
  const candidate = getSelectedOfferCandidate(processingSession);
  const draft = getOfferSalesOperationDraft(processingSession);

  if (!candidate?.offerId) {
    const erroredSession = await markSessionError(processingSession._id, {
      code: "OFFER_NOT_FOUND",
      message: "Proposta selecionada nao encontrada na sessao.",
    });
    await replyToSession({
      session: erroredSession,
      user,
      message: buildErrorMessage(),
      dedupeSuffix: `${event.messageId}:offer-error`,
    });
    return { ok: true, status: "error", session: erroredSession };
  }

  try {
    if (draft.intent === "cancel_offer") {
      const result = await cancelOfferByWorkspace({
        offerId: candidate.offerId,
        workspaceId: user.workspaceId,
        ownerUserId: user._id || null,
        cancelledByUserId: user._id || null,
        reason: "Cancelada via agente de WhatsApp.",
      });

      const completedSession = await markSessionCompleted(processingSession._id, {
        resolved: {
          ...(processingSession.resolved || {}),
          offerSalesResult: {
            offerId: result.offer?._id ? String(result.offer._id) : candidate.offerId,
            status: "CANCELLED",
            notifyStatus: result.notify?.status || "",
          },
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
        message: buildOfferCancelledSuccessMessage(candidate),
        dedupeSuffix: `${event.messageId}:offer-cancelled`,
      });
      return { ok: true, status: "completed", session: completedSession };
    }

    const result = await sendManualPaymentReminder({
      offerId: candidate.offerId,
      workspaceId: user.workspaceId,
      ownerUserId: user._id || null,
      userId: user._id || null,
      origin: "",
    });

    const completedSession = await markSessionCompleted(processingSession._id, {
      resolved: {
        ...(processingSession.resolved || {}),
        offerSalesResult: {
          offerId: candidate.offerId,
          status: String(result?.status || "").trim(),
          reason: String(result?.reason || result?.error?.message || "").trim(),
        },
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
      message: buildOfferReminderResultMessage(candidate, result),
      dedupeSuffix: `${event.messageId}:offer-reminder-result`,
    });
    return { ok: true, status: "completed", session: completedSession };
  } catch (error) {
    const businessConflict = Number(error?.status || error?.statusCode || 0) >= 400 &&
      Number(error?.status || error?.statusCode || 0) < 500;

    if (businessConflict) {
      const completedSession = await markSessionCompleted(processingSession._id, {
        resolved: {
          ...(processingSession.resolved || {}),
          offerSalesResult: {
            offerId: candidate.offerId,
            status: "skipped",
            reason: String(error?.message || "").trim(),
          },
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
        message: String(error?.message || "Nao consegui concluir a operacao."),
        dedupeSuffix: `${event.messageId}:offer-business-conflict`,
      });
      return { ok: true, status: "completed", session: completedSession };
    }

    const erroredSession = await markSessionError(processingSession._id, error);
    await replyToSession({
      session: erroredSession,
      user,
      message: buildErrorMessage(),
      dedupeSuffix: `${event.messageId}:offer-error`,
    });
    return { ok: true, status: "error", session: erroredSession };
  }
}

async function handleOfferApprovalDecision({
  session,
  user,
  text,
  event,
}) {
  const decision = parseOfferApprovalDecisionReply(text);

  if (decision === "CANCELAR") {
    const cancelledSession = await markSessionCancelled(session._id);
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

  if (decision === "RECUSAR") {
    const candidate = getSelectedOfferCandidate(session);
    const question = buildOfferPaymentRejectionReasonQuestion(candidate);
    const updatedSession = await updateWhatsAppSession(session._id, {
      flowType: "offer_payment_approval",
      state: "AWAITING_OFFER_REJECTION_REASON",
      lastQuestionKey: "offer_payment_rejection_reason",
      lastQuestionText: question,
      confirmationSummaryText: question,
    });
    await replyToSession({
      session: updatedSession,
      user,
      message: question,
      dedupeSuffix: `${event.messageId}:offer-rejection-reason`,
    });
    return {
      ok: true,
      status: "awaiting_offer_rejection_reason",
      session: updatedSession,
    };
  }

  if (decision !== "CONFIRMAR") {
    await replyToSession({
      session,
      user,
      message: buildInvalidOfferPaymentDecisionMessage(),
      dedupeSuffix: `${event.messageId}:invalid-offer-approval-decision`,
    });
    return { ok: true, status: "awaiting_offer_approval_decision", session };
  }

  const processingSession = await updateWhatsAppSession(session._id, {
    state: "PROCESSING_CREATE",
  });
  const candidate = getSelectedOfferCandidate(processingSession);

  if (!candidate?.offerId) {
    const erroredSession = await markSessionError(processingSession._id, {
      code: "OFFER_NOT_FOUND",
      message: "Proposta selecionada nao encontrada na sessao.",
    });
    await replyToSession({
      session: erroredSession,
      user,
      message: buildErrorMessage(),
      dedupeSuffix: `${event.messageId}:offer-approval-error`,
    });
    return { ok: true, status: "error", session: erroredSession };
  }

  try {
    const result = await confirmOfferPaymentByWorkspace({
      offerId: candidate.offerId,
      workspaceId: user.workspaceId,
      ownerUserId: user._id || null,
      confirmedByUserId: user._id || null,
    });

    const completedSession = await markSessionCompleted(processingSession._id, {
      flowType: "offer_payment_approval",
      resolved: {
        ...(processingSession.resolved || {}),
        offerSalesResult: {
          offerId: result.offer?._id ? String(result.offer._id) : candidate.offerId,
          status: "CONFIRMED",
          notifyStatus: String(result.notify?.status || "").trim(),
        },
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
      message: buildOfferPaymentApprovedSuccessMessage(candidate),
      dedupeSuffix: `${event.messageId}:offer-payment-approved`,
    });
    return { ok: true, status: "completed", session: completedSession };
  } catch (error) {
    const businessConflict =
      Number(error?.status || error?.statusCode || 0) >= 400 &&
      Number(error?.status || error?.statusCode || 0) < 500;

    if (businessConflict) {
      const completedSession = await markSessionCompleted(processingSession._id, {
        flowType: "offer_payment_approval",
        resolved: {
          ...(processingSession.resolved || {}),
          offerSalesResult: {
            offerId: candidate.offerId,
            status: "skipped",
            reason: String(error?.message || "").trim(),
          },
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
        message:
          String(error?.code || "").trim() === "NO_PROOF"
            ? buildOfferPaymentProofMissingMessage(candidate)
            : String(error?.message || "Nao consegui concluir a aprovacao."),
        dedupeSuffix: `${event.messageId}:offer-payment-approval-conflict`,
      });
      return { ok: true, status: "completed", session: completedSession };
    }

    const erroredSession = await markSessionError(processingSession._id, error);
    await replyToSession({
      session: erroredSession,
      user,
      message: buildErrorMessage(),
      dedupeSuffix: `${event.messageId}:offer-approval-error`,
    });
    return { ok: true, status: "error", session: erroredSession };
  }
}

async function handleOfferRejectionReason({
  session,
  user,
  text,
  event,
}) {
  const cancellation = parseCandidateSelectionReply(text);
  if (cancellation === "CANCELAR") {
    const cancelledSession = await markSessionCancelled(session._id);
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

  const reason = String(text || "").trim();
  if (!reason) {
    await replyToSession({
      session,
      user,
      message: buildOfferPaymentRejectionReasonQuestion(
        getSelectedOfferCandidate(session),
      ),
      dedupeSuffix: `${event.messageId}:offer-rejection-reason-repeat`,
    });
    return { ok: true, status: "awaiting_offer_rejection_reason", session };
  }

  const processingSession = await updateWhatsAppSession(session._id, {
    state: "PROCESSING_CREATE",
  });
  const candidate = getSelectedOfferCandidate(processingSession);

  if (!candidate?.offerId) {
    const erroredSession = await markSessionError(processingSession._id, {
      code: "OFFER_NOT_FOUND",
      message: "Proposta selecionada nao encontrada na sessao.",
    });
    await replyToSession({
      session: erroredSession,
      user,
      message: buildErrorMessage(),
      dedupeSuffix: `${event.messageId}:offer-rejection-error`,
    });
    return { ok: true, status: "error", session: erroredSession };
  }

  try {
    const result = await rejectOfferPaymentByWorkspace({
      offerId: candidate.offerId,
      workspaceId: user.workspaceId,
      ownerUserId: user._id || null,
      rejectedByUserId: user._id || null,
      reason,
    });

    const completedSession = await markSessionCompleted(processingSession._id, {
      flowType: "offer_payment_approval",
      resolved: {
        ...(processingSession.resolved || {}),
        offerSalesResult: {
          offerId: result.offer?._id ? String(result.offer._id) : candidate.offerId,
          status: "REJECTED",
          reason,
          notifyStatus: String(result.notify?.status || "").trim(),
        },
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
      message: buildOfferPaymentRejectedSuccessMessage(candidate),
      dedupeSuffix: `${event.messageId}:offer-payment-rejected`,
    });
    return { ok: true, status: "completed", session: completedSession };
  } catch (error) {
    const businessConflict =
      Number(error?.status || error?.statusCode || 0) >= 400 &&
      Number(error?.status || error?.statusCode || 0) < 500;

    if (businessConflict) {
      const completedSession = await markSessionCompleted(processingSession._id, {
        flowType: "offer_payment_approval",
        resolved: {
          ...(processingSession.resolved || {}),
          offerSalesResult: {
            offerId: candidate.offerId,
            status: "skipped",
            reason: String(error?.message || "").trim(),
          },
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
        message:
          String(error?.code || "").trim() === "NO_PROOF"
            ? buildOfferPaymentProofMissingMessage(candidate)
            : String(error?.message || "Nao consegui concluir a recusa."),
        dedupeSuffix: `${event.messageId}:offer-payment-rejection-conflict`,
      });
      return { ok: true, status: "completed", session: completedSession };
    }

    const erroredSession = await markSessionError(processingSession._id, error);
    await replyToSession({
      session: erroredSession,
      user,
      message: buildErrorMessage(),
      dedupeSuffix: `${event.messageId}:offer-rejection-error`,
    });
    return { ok: true, status: "error", session: erroredSession };
  }
}

async function handleBackofficeActionConfirmation({
  session,
  user,
  text,
  event,
}) {
  const confirmation = parseConfirmationReply(text);

  if (confirmation === "CANCELAR") {
    const cancelledSession = await markSessionCancelled(session._id);
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

  if (confirmation !== "CONFIRMAR") {
    await replyToSession({
      session,
      user,
      message: buildInvalidConfirmationMessage(),
      dedupeSuffix: `${event.messageId}:invalid-confirmation`,
    });
    return { ok: true, status: "awaiting_backoffice_action_confirmation", session };
  }

  const processingSession = await updateWhatsAppSession(session._id, {
    state: "PROCESSING_CREATE",
  });
  const draft = getBackofficeOperationDraft(processingSession);
  const selectedProduct = getSelectedBackofficeProduct(processingSession);

  try {
    let completedSession = null;
    let successMessage = "";

    if (draft.intent === "create_client") {
      const client = await createClientForWorkspace({
        workspaceId: user.workspaceId,
        ownerUserId: user._id || null,
        fullName: String(draft.client_full_name || "").trim(),
        phone: normalizeClientPhoneForStorage(draft.client_phone || ""),
        email: parseEmailFromText(draft.client_email || ""),
        cpfCnpj: parseCpfCnpjDigits(draft.client_cpf_cnpj || ""),
      });

      completedSession = await markSessionCompleted(processingSession._id, {
        resolved: {
          ...(processingSession.resolved || {}),
          backofficeResult: {
            type: "client_create",
            clientId: client?._id ? String(client._id) : null,
          },
        },
      });
      successMessage = buildClientCreatedSuccessMessage(client);
    } else if (draft.intent === "create_product") {
      const product = await createProductForWorkspace({
        workspaceId: user.workspaceId,
        ownerUserId: user._id || null,
        productId: String(draft.product_code || "").trim(),
        name: String(draft.product_name || "").trim(),
        description: String(draft.product_description || "").trim(),
        priceCents: Number(draft.product_price_cents || 0),
      });

      completedSession = await markSessionCompleted(processingSession._id, {
        resolved: {
          ...(processingSession.resolved || {}),
          backofficeResult: {
            type: "product_create",
            productId: product?._id ? String(product._id) : null,
            externalProductId: String(product?.productId || "").trim(),
          },
        },
      });
      successMessage = buildProductCreatedSuccessMessage(product);
    } else if (draft.intent === "update_product_price") {
      if (!selectedProduct?.productId) {
        const err = new Error("Produto selecionado nao encontrado na sessao.");
        err.status = 404;
        err.statusCode = 404;
        err.code = "PRODUCT_NOT_FOUND";
        throw err;
      }

      const product = await updateProductPriceForWorkspace({
        workspaceId: user.workspaceId,
        productMongoId: selectedProduct.productId,
        priceCents: Number(draft.product_price_cents || 0),
      });

      if (!product) {
        const err = new Error("Produto nao encontrado.");
        err.status = 404;
        err.statusCode = 404;
        err.code = "PRODUCT_NOT_FOUND";
        throw err;
      }

      completedSession = await markSessionCompleted(processingSession._id, {
        resolved: {
          ...(processingSession.resolved || {}),
          backofficeResult: {
            type: "product_price_update",
            productId: product?._id ? String(product._id) : null,
          },
        },
      });
      successMessage = buildProductPriceUpdatedSuccessMessage(product);
    } else {
      const err = new Error("Operacao de backoffice nao suportada.");
      err.code = "BACKOFFICE_OPERATION_UNSUPPORTED";
      throw err;
    }

    await closeActiveSessionsForRequester({
      userId: user._id,
      requesterPhoneDigits: processingSession.requesterPhoneDigits,
      excludeSessionId: completedSession._id,
      state: "EXPIRED",
    });
    await replyToSession({
      session: completedSession,
      user,
      message: successMessage,
      dedupeSuffix: `${event.messageId}:backoffice-success`,
    });
    return { ok: true, status: "completed", session: completedSession };
  } catch (error) {
    const businessConflict =
      Number(error?.status || error?.statusCode || 0) >= 400 &&
      Number(error?.status || error?.statusCode || 0) < 500;

    if (businessConflict) {
      const completedSession = await markSessionCompleted(processingSession._id, {
        resolved: {
          ...(processingSession.resolved || {}),
          backofficeResult: {
            type: draft.intent,
            status: "skipped",
            reason: String(error?.message || "").trim(),
          },
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
        message: String(error?.message || "Nao consegui concluir a operacao."),
        dedupeSuffix: `${event.messageId}:backoffice-business-conflict`,
      });
      return { ok: true, status: "completed", session: completedSession };
    }

    const erroredSession = await markSessionError(processingSession._id, error);
    await replyToSession({
      session: erroredSession,
      user,
      message: buildErrorMessage(),
      dedupeSuffix: `${event.messageId}:backoffice-error`,
    });
    return { ok: true, status: "error", session: erroredSession };
  }
}

async function dispatchInitialSessionRouting({
  session,
  user,
  text,
  messageId,
  routingExtraction,
  deterministicAction = null,
  automationContext = null,
}) {
  const sessionAfterRouting = await updateWhatsAppSession(session._id, {
    extracted: buildSessionExtracted(session?.extracted, {
      intentRouting: routingExtraction,
    }),
  });

  if (routingExtraction.intent === "query_daily_agenda") {
    return runAgendaQueryForSession({
      session: sessionAfterRouting,
      user,
      text,
      dedupeSuffix: `${messageId}:agenda`,
      routingExtraction,
    });
  }

  if (routingExtraction.intent === "query_weekly_agenda") {
    return runWeeklyAgendaQueryForSession({
      session: sessionAfterRouting,
      user,
      text,
      dedupeSuffix: `${messageId}:weekly-agenda`,
      routingExtraction,
    });
  }

  if (routingExtraction.intent === "query_next_booking") {
    return runNextBookingQueryForSession({
      session: sessionAfterRouting,
      user,
      text,
      dedupeSuffix: `${messageId}:next-booking`,
      routingExtraction,
    });
  }

  if (routingExtraction.intent === "query_pending_offers") {
    return runPendingOffersQueryForSession({
      session: sessionAfterRouting,
      user,
      text,
      dedupeSuffix: `${messageId}:pending-offers`,
      routingExtraction,
    });
  }

  if (routingExtraction.intent === "generate_sales_insight") {
    return runLuminaInsightForSession({
      session: sessionAfterRouting,
      user,
      text,
      dedupeSuffix: `${messageId}:sales-insight`,
      routingExtraction,
    });
  }

  if (routingExtraction.intent === "query_due_today_offers") {
    return runOfferAutomationSummaryForSession({
      session: sessionAfterRouting,
      user,
      text,
      dedupeSuffix: `${messageId}:due-today-offers`,
      routingExtraction,
      automationType: "due_today",
    });
  }

  if (routingExtraction.intent === "query_overdue_offers") {
    return runOfferAutomationSummaryForSession({
      session: sessionAfterRouting,
      user,
      text,
      dedupeSuffix: `${messageId}:overdue-offers`,
      routingExtraction,
      automationType: "overdue",
    });
  }

  if (routingExtraction.intent === "query_stale_offer_followups") {
    return runOfferAutomationSummaryForSession({
      session: sessionAfterRouting,
      user,
      text,
      dedupeSuffix: `${messageId}:stale-offer-followups`,
      routingExtraction,
      automationType: "stale_followup",
    });
  }

  if (routingExtraction.intent === "query_billing_priorities") {
    return runOfferAutomationSummaryForSession({
      session: sessionAfterRouting,
      user,
      text,
      dedupeSuffix: `${messageId}:billing-priorities`,
      routingExtraction,
      automationType: "billing_priorities",
    });
  }

  if (
    ["lookup_client_phone", "lookup_product"].includes(routingExtraction.intent)
  ) {
    return initializeBackofficeOperationSession({
      session: sessionAfterRouting,
      user,
      text,
      dedupeSuffix: `${messageId}:backoffice-lookup`,
      routingExtraction,
      forcedExtraction:
        deterministicAction?.routingIntent === routingExtraction.intent
          ? buildForcedBackofficeExtraction(routingExtraction.intent, text)
          : null,
    });
  }

  if (routingExtraction.intent === "ambiguous_offer_or_agenda") {
    const intentSelection = await maybeAskForIntentSelection({
      session: sessionAfterRouting,
      user,
      text,
      dedupeSuffix: `${messageId}:intent-selection`,
      origin: "new_session",
    });
    if (intentSelection) return intentSelection;
  }

  if (routingExtraction.intent === "ambiguous_offer_sales_operation") {
    return askOfferSalesOperationSelection({
      session: sessionAfterRouting,
      user,
      pendingIntentText: text,
      dedupeSuffix: `${messageId}:offer-sales-selection`,
    });
  }

  if (routingExtraction.intent === "ambiguous_backoffice_operation") {
    return askBackofficeOperationSelection({
      session: sessionAfterRouting,
      user,
      pendingIntentText: text,
      dedupeSuffix: `${messageId}:backoffice-selection`,
    });
  }

  if (routingExtraction.intent === "ambiguous_booking_operation") {
    return askBookingOperationSelection({
      session: sessionAfterRouting,
      user,
      pendingIntentText: text,
      dedupeSuffix: `${messageId}:booking-intent-selection`,
    });
  }

  if (
    ["reschedule_booking", "cancel_booking"].includes(routingExtraction.intent)
  ) {
    return initializeBookingOperationSession({
      session: sessionAfterRouting,
      user,
      text,
      dedupeSuffix: `${messageId}:booking-operation`,
      routingExtraction,
      forcedExtraction:
        deterministicAction?.routingIntent === routingExtraction.intent
          ? buildForcedBookingExtraction(routingExtraction.intent, text)
          : null,
    });
  }

  if (
    [
      "query_offers_waiting_confirmation",
      "send_offer_payment_reminder",
      "cancel_offer",
    ].includes(
      routingExtraction.intent,
    )
  ) {
    return initializeOfferSalesOperationSession({
      session: sessionAfterRouting,
      user,
      text,
      dedupeSuffix: `${messageId}:offer-sales-operation`,
      routingExtraction,
      automationContext,
      forcedExtraction:
        deterministicAction?.routingIntent === routingExtraction.intent
          ? buildForcedOfferSalesExtraction(routingExtraction.intent, text)
          : null,
    });
  }

  if (
    [
      "create_client",
      "create_product",
      "update_product_price",
      "lookup_client_phone",
      "lookup_product",
    ].includes(
      routingExtraction.intent,
    )
  ) {
    return initializeBackofficeOperationSession({
      session: sessionAfterRouting,
      user,
      text,
      dedupeSuffix: `${messageId}:backoffice-operation`,
      routingExtraction,
      forcedExtraction:
        deterministicAction?.routingIntent === routingExtraction.intent
          ? buildForcedBackofficeExtraction(routingExtraction.intent, text)
          : null,
    });
  }

  if (routingExtraction.intent !== "create_offer_send_whatsapp") {
    const erroredSession = await markSessionError(sessionAfterRouting._id, {
      code: "WHATSAPP_AI_UNKNOWN_INTENT",
      message:
        "Intencao nao reconhecida para proposta, agenda, cobranca e vendas ou backoffice.",
    });

    await replyToSession({
      session: erroredSession,
      user,
      message: buildErrorMessage(),
      dedupeSuffix: `${messageId}:unknown-intent`,
    });
    return { ok: true, status: "unknown_intent", session: erroredSession };
  }

  return initializeOfferSession({
    session: sessionAfterRouting,
    user,
    text,
    dedupeSuffix: `${messageId}:new-session`,
    routingExtraction,
    forceOfferFlow: deterministicAction?.routingIntent === "create_offer_send_whatsapp",
  });
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

  await recordWebInboundMessageIfNeeded({
    event,
    session: refreshedSession,
    user,
    text,
  });

  const dedupeSuffix = `${event.messageId}:${String(refreshedSession.state || "").toLowerCase()}`;

  if (refreshedSession.state === "NEW") {
    const { routingExtraction, deterministicAction } =
      await resolveInitialRoutingForSession({
        session: refreshedSession,
        text,
        actionKey: event?.actionKey,
        user,
      });

    return dispatchInitialSessionRouting({
      session: refreshedSession,
      user,
      text,
      messageId: event.messageId,
      routingExtraction,
      deterministicAction,
      automationContext: event?.automationContext,
    });
  }

  if (refreshedSession.state === "AWAITING_INTENT_SELECTION") {
    return handleIntentSelection({
      session: refreshedSession,
      user,
      event,
      text,
    });
  }

  if (refreshedSession.state === "AWAITING_CUSTOMER_SELECTION") {
    const selection = parseCandidateSelectionReply(text);
    if (selection === "CANCELAR") {
      const cancelledSession = await cancelSessionAndReply({
        session: refreshedSession,
        user,
        dedupeSuffix: `${event.messageId}:cancel`,
      });
      return { ok: true, status: "cancelled", session: cancelledSession };
    }

    if (
      refreshedSession.flowType === "lookup_query" &&
      refreshedSession.lastQuestionKey === "lookup_client_phone_selection"
    ) {
      const selectedLookupCustomer = pickCandidateByOrdinal(
        text,
        refreshedSession.candidateCustomers || [],
      );
      if (!selectedLookupCustomer) {
        await replyToSession({
          session: refreshedSession,
          user,
          message: buildInvalidSelectionMessage(refreshedSession.lastQuestionText),
          dedupeSuffix,
        });
        return { ok: true, status: "awaiting_customer_selection", session: refreshedSession };
      }

      const draft = getBackofficeOperationDraft(refreshedSession);
      const selectedLine = `1. ${String(
        selectedLookupCustomer?.fullName || draft.client_full_name || "Cliente",
      ).trim()} - ${formatPhoneDisplay(
        selectedLookupCustomer?.phoneDigits || selectedLookupCustomer?.phone || "",
      )}`;
      const message = buildClientLookupMessage(
        selectedLookupCustomer?.fullName || draft.client_full_name,
        [selectedLine],
      );

      const completedSession = await markSessionCompleted(refreshedSession._id, {
        flowType: "lookup_query",
        extracted: buildSessionExtracted(refreshedSession?.extracted, {
          backofficeOperation: draft,
        }),
        resolved: {
          ...(stripIntentSelectionContext(refreshedSession?.resolved || {})),
          source_text: String(
            draft.source_text || refreshedSession?.lastUserMessageText || "",
          ).trim(),
          backofficeOperation: draft,
          customerId: selectedLookupCustomer?.customerId || null,
          customerName: String(
            selectedLookupCustomer?.fullName || draft.client_full_name || "",
          ).trim(),
          customerLookupQuery: String(draft.client_full_name || "").trim(),
          customerLookupMiss: false,
          lookupCount: 1,
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
      return { ok: true, status: "completed", session: completedSession };
    }

    if (
      refreshedSession.flowType === "client_create" &&
      refreshedSession.lastQuestionKey === "client_create_existing_selection"
    ) {
      const normalizedReply = normalizeComparableText(text);

      if (["novo", "criar novo", "criar", "continuar"].includes(normalizedReply)) {
        const nextDraft = mergeBackofficeOperationDraft(
          getBackofficeOperationDraft(refreshedSession),
          { allow_create_new: true },
        );
        const updatedSession = await updateWhatsAppSession(refreshedSession._id, {
          candidateCustomers: [],
          resolved: {
            ...(refreshedSession.resolved || {}),
            backofficeOperation: nextDraft,
          },
        });
        return advanceBackofficeOperationSession({
          session: updatedSession,
          user,
          dedupeSuffix,
        });
      }

      const selectedExistingClient = pickCandidateByOrdinal(
        text,
        refreshedSession.candidateCustomers || [],
      );
      if (!selectedExistingClient) {
        await replyToSession({
          session: refreshedSession,
          user,
          message: buildInvalidSelectionMessage(refreshedSession.lastQuestionText),
          dedupeSuffix,
        });
        return { ok: true, status: "awaiting_customer_selection", session: refreshedSession };
      }

      const completedSession = await markSessionCompleted(refreshedSession._id, {
        resolved: {
          ...(refreshedSession.resolved || {}),
          backofficeResult: {
            type: "client_create_existing",
            clientId: selectedExistingClient.customerId || null,
          },
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
        message: `Ja existe um cliente cadastrado: ${selectedExistingClient.fullName}. Nenhum novo cadastro foi criado.`,
        dedupeSuffix,
      });
      return { ok: true, status: "completed", session: completedSession };
    }

    const selected = pickCandidateByOrdinal(
      text,
      refreshedSession.candidateCustomers || [],
    );
    if (!selected) {
      const salesContextSwitch = await maybeAskForOfferSalesContextSwitch({
        session: refreshedSession,
        user,
        text,
        actionKey: event?.actionKey,
        dedupeSuffix: `${event.messageId}:offer-sales-context-switch`,
      });
      if (salesContextSwitch) return salesContextSwitch;

      const backofficeContextSwitch = await maybeAskForBackofficeContextSwitch({
        session: refreshedSession,
        user,
        text,
        actionKey: event?.actionKey,
        dedupeSuffix: `${event.messageId}:backoffice-context-switch`,
      });
      if (backofficeContextSwitch) return backofficeContextSwitch;

      const intentSelection = await maybeAskForIntentSelection({
        session: refreshedSession,
        user,
        text,
        actionKey: event?.actionKey,
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
    const selection = parseCandidateSelectionReply(text);
    if (selection === "CANCELAR") {
      const cancelledSession = await cancelSessionAndReply({
        session: refreshedSession,
        user,
        dedupeSuffix: `${event.messageId}:cancel`,
      });
      return { ok: true, status: "cancelled", session: cancelledSession };
    }

    if (
      refreshedSession.flowType === "product_update" &&
      refreshedSession.lastQuestionKey === "product_update_selection"
    ) {
      const selectedProduct = pickCandidateByOrdinal(
        text,
        refreshedSession.candidateProducts || [],
      );
      if (!selectedProduct) {
        await replyToSession({
          session: refreshedSession,
          user,
          message: buildInvalidSelectionMessage(refreshedSession.lastQuestionText),
          dedupeSuffix,
        });
        return { ok: true, status: "awaiting_product_selection", session: refreshedSession };
      }

      const updatedSession = await updateWhatsAppSession(refreshedSession._id, {
        candidateProducts: [],
        resolved: {
          ...(refreshedSession.resolved || {}),
          selectedBackofficeProduct: selectedProduct,
        },
      });
      return advanceBackofficeOperationSession({
        session: updatedSession,
        user,
        dedupeSuffix,
      });
    }

    const selected = pickCandidateByOrdinal(
      text,
      refreshedSession.candidateProducts || [],
    );
    if (!selected) {
      const salesContextSwitch = await maybeAskForOfferSalesContextSwitch({
        session: refreshedSession,
        user,
        text,
        actionKey: event?.actionKey,
        dedupeSuffix: `${event.messageId}:offer-sales-context-switch`,
      });
      if (salesContextSwitch) return salesContextSwitch;

      const backofficeContextSwitch = await maybeAskForBackofficeContextSwitch({
        session: refreshedSession,
        user,
        text,
        actionKey: event?.actionKey,
        dedupeSuffix: `${event.messageId}:backoffice-context-switch`,
      });
      if (backofficeContextSwitch) return backofficeContextSwitch;

      const intentSelection = await maybeAskForIntentSelection({
        session: refreshedSession,
        user,
        text,
        actionKey: event?.actionKey,
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
      const salesContextSwitch = await maybeAskForOfferSalesContextSwitch({
        session: refreshedSession,
        user,
        text,
        actionKey: event?.actionKey,
        dedupeSuffix: `${event.messageId}:offer-sales-context-switch`,
      });
      if (salesContextSwitch) return salesContextSwitch;

      const backofficeContextSwitch = await maybeAskForBackofficeContextSwitch({
        session: refreshedSession,
        user,
        text,
        actionKey: event?.actionKey,
        dedupeSuffix: `${event.messageId}:backoffice-context-switch`,
      });
      if (backofficeContextSwitch) return backofficeContextSwitch;

      const intentSelection = await maybeAskForIntentSelection({
        session: refreshedSession,
        user,
        text,
        actionKey: event?.actionKey,
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

  if (refreshedSession.state === "AWAITING_BOOKING_SELECTION") {
    const selection = parseCandidateSelectionReply(text);
    if (selection === "CANCELAR") {
      const cancelledSession = await cancelSessionAndReply({
        session: refreshedSession,
        user,
        dedupeSuffix: `${event.messageId}:cancel`,
      });
      return { ok: true, status: "cancelled", session: cancelledSession };
    }

    const selected = pickBookingCandidateByOrdinal(
      text,
      refreshedSession.candidateBookings || [],
    );
    if (!selected) {
      await replyToSession({
        session: refreshedSession,
        user,
        message: buildInvalidSelectionMessage(refreshedSession.lastQuestionText),
        dedupeSuffix,
      });
      return { ok: true, status: "awaiting_booking_selection", session: refreshedSession };
    }

    const updatedSession = await updateWhatsAppSession(refreshedSession._id, {
      candidateBookings: [],
      resolved: {
        ...(refreshedSession.resolved || {}),
        selectedBookingCandidate: selected,
      },
    });
    return advanceBookingOperationSession({
      session: updatedSession,
      user,
      dedupeSuffix,
    });
  }

  if (refreshedSession.state === "AWAITING_OFFER_SELECTION") {
    const selection = parseCandidateSelectionReply(text);
    if (selection === "CANCELAR") {
      const cancelledSession = await cancelSessionAndReply({
        session: refreshedSession,
        user,
        dedupeSuffix: `${event.messageId}:cancel`,
      });
      return { ok: true, status: "cancelled", session: cancelledSession };
    }

    const selected = pickCandidateByOrdinal(
      text,
      refreshedSession.candidateOffers || [],
    );
    if (!selected) {
      await replyToSession({
        session: refreshedSession,
        user,
        message: buildInvalidSelectionMessage(refreshedSession.lastQuestionText),
        dedupeSuffix,
      });
      return { ok: true, status: "awaiting_offer_selection", session: refreshedSession };
    }

    const updatedSession = await updateWhatsAppSession(refreshedSession._id, {
      candidateOffers: [],
      resolved: {
        ...(refreshedSession.resolved || {}),
        selectedOfferCandidate: selected,
      },
    });
    return advanceOfferSalesOperationSession({
      session: updatedSession,
      user,
      dedupeSuffix,
    });
  }

  if (refreshedSession.state === "AWAITING_NEW_BOOKING_TIME") {
    const confirmation = parseConfirmationReply(text);
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

    const timeZone =
      getSelectedBookingCandidate(refreshedSession)?.timeZone ||
      getBookingOperationDraft(refreshedSession)?.timeZone ||
      (await getWorkspaceAgendaTimeZone(user.workspaceId));
    const todayDateIso = getDateIsoForTimeZone(new Date(), timeZone);
    const extracted = await extractWhatsAppBookingOperation({
      text,
      todayDateIso,
      timeZone,
    });
    const currentDraft = getBookingOperationDraft(refreshedSession);
    const mergedDraft = {
      ...currentDraft,
      new_date_iso: extracted.new_date_iso || currentDraft.new_date_iso || "",
      new_time_hhmm: extracted.new_time_hhmm || currentDraft.new_time_hhmm || "",
      source_text: String(extracted.source_text || text || "").trim(),
      timeZone,
    };

    const updatedSession = await updateWhatsAppSession(refreshedSession._id, {
      extracted: buildSessionExtracted(refreshedSession.extracted, {
        bookingOperation: mergedDraft,
      }),
      resolved: {
        ...(refreshedSession.resolved || {}),
        bookingOperation: mergedDraft,
      },
    });
    return advanceBookingOperationSession({
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

    const salesContextSwitch = await maybeAskForOfferSalesContextSwitch({
      session: refreshedSession,
      user,
      text,
      actionKey: event?.actionKey,
      dedupeSuffix: `${event.messageId}:offer-sales-context-switch`,
    });
    if (salesContextSwitch) return salesContextSwitch;

    const backofficeContextSwitch = await maybeAskForBackofficeContextSwitch({
      session: refreshedSession,
      user,
      text,
      actionKey: event?.actionKey,
      dedupeSuffix: `${event.messageId}:backoffice-context-switch`,
    });
    if (backofficeContextSwitch) return backofficeContextSwitch;

    const intentSelection = await maybeAskForIntentSelection({
      session: refreshedSession,
      user,
      text,
      actionKey: event?.actionKey,
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

  if (refreshedSession.state === "AWAITING_OFFER_ACTION_CONFIRMATION") {
    return handleOfferActionConfirmation({
      session: refreshedSession,
      user,
      text,
      event,
    });
  }

  if (refreshedSession.state === "AWAITING_OFFER_APPROVAL_DECISION") {
    return handleOfferApprovalDecision({
      session: refreshedSession,
      user,
      text,
      event,
    });
  }

  if (refreshedSession.state === "AWAITING_OFFER_REJECTION_REASON") {
    return handleOfferRejectionReason({
      session: refreshedSession,
      user,
      text,
      event,
    });
  }

  if (refreshedSession.state === "AWAITING_BACKOFFICE_ACTION_CONFIRMATION") {
    return handleBackofficeActionConfirmation({
      session: refreshedSession,
      user,
      text,
      event,
    });
  }

  if (refreshedSession.state === "AWAITING_BOOKING_CHANGE_CONFIRMATION") {
    return handleBookingChangeConfirmation({
      session: refreshedSession,
      user,
      text,
      event,
    });
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

  if (
    refreshedSession.state === "COLLECTING_FIELDS" &&
    ["client_create", "product_create", "product_update", "lookup_query"].includes(
      String(refreshedSession.flowType || ""),
    )
  ) {
    const field = String(refreshedSession.lastQuestionKey || "").trim();
    if (!validateBackofficeFieldValue(field, text)) {
      await replyToSession({
        session: refreshedSession,
        user,
        message: buildBackofficeMissingFieldQuestion(field),
        dedupeSuffix,
      });
      return { ok: true, status: "collecting_fields", session: refreshedSession };
    }

    const patch = parseDirectReplyValue(field, text);
    const nextDraft = mergeBackofficeOperationDraft(
      getBackofficeOperationDraft(refreshedSession),
      patch,
    );
    const updatedSession = await updateWhatsAppSession(refreshedSession._id, {
      extracted: buildSessionExtracted(refreshedSession.extracted, {
        backofficeOperation: nextDraft,
      }),
      resolved: {
        ...(refreshedSession.resolved || {}),
        backofficeOperation: nextDraft,
      },
    });
    return advanceBackofficeOperationSession({
      session: updatedSession,
      user,
      dedupeSuffix,
    });
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
    const salesContextSwitch = await maybeAskForOfferSalesContextSwitch({
      session: refreshedSession,
      user,
      text,
      actionKey: event?.actionKey,
      dedupeSuffix: `${event.messageId}:offer-sales-context-switch`,
    });
    if (salesContextSwitch) return salesContextSwitch;

    const backofficeContextSwitch = await maybeAskForBackofficeContextSwitch({
      session: refreshedSession,
      user,
      text,
      actionKey: event?.actionKey,
      dedupeSuffix: `${event.messageId}:backoffice-context-switch`,
    });
    if (backofficeContextSwitch) return backofficeContextSwitch;

    const intentSelection = await maybeAskForIntentSelection({
      session: refreshedSession,
      user,
      text,
      actionKey: event?.actionKey,
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

export async function processInboundWhatsAppEvent(event, options = {}) {
  if (!isWhatsAppAiEnabled()) {
    return { ok: true, status: "disabled" };
  }

  const isWebEvent = isWebSourceChannel(event?.sourceChannel);
  const inboundEventKey = isWebEvent ? "" : buildInboundEventKey(event);
  if (inboundEventKey && inflightInboundEventKeys.has(inboundEventKey)) {
    return { ok: true, status: "duplicate_message" };
  }

  if (inboundEventKey) {
    inflightInboundEventKeys.add(inboundEventKey);
  }

  let requesterPhoneDigits = isWebEvent
    ? buildWebAgentRequesterKey(options?.authUser?._id || event?.requesterUserId)
    : normalizeWhatsAppPhoneDigits(event.fromPhoneDigits || "");
  let user = null;
  let sessionForError = null;
  const preferredSessionId = String(options?.preferredSessionId || "").trim();

  try {
    if (!requesterPhoneDigits) {
      return { ok: false, status: "invalid_from_phone" };
    }

    let workspacePlan = "start";

    if (isWebEvent) {
      const authUser =
        options?.authUser && typeof options.authUser === "object"
          ? options.authUser
          : null;

      if (!authUser?._id || !authUser?.workspaceId || authUser?.status !== "active") {
        return { ok: false, status: "web_user_invalid" };
      }

      user = authUser;
      workspacePlan = user?.workspacePlan || "start";
    } else {
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
      workspacePlan = workspace?.plan || "start";
    }

    if (!canUseWhatsAppAiOfferCreation(workspacePlan)) {
      await closeActiveSessionsForRequester({
        userId: user._id,
        requesterPhoneDigits,
        state: "CANCELLED",
      });

      if (!isWebEvent) {
        await replyPlanNotAllowed({
          event,
          user,
          requesterPhoneDigits,
        });
      }

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
      preferredSessionId,
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
        requesterPhoneRaw: String(event.fromPhoneDigits || requesterPhoneDigits || ""),
        requesterPhoneDigits,
        requesterPushName: String(event.pushName || "").trim(),
        sourceMessageId: event.messageId,
        sourceChannel: isWebEvent ? WEB_SOURCE_CHANNEL : "whatsapp",
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
          preferredSessionId,
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

    await recordWebInboundMessageIfNeeded({
      event,
      session: createdSession,
      user,
      text,
    });

    const { routingExtraction, deterministicAction } =
      await resolveInitialRoutingForSession({
        session: createdSession,
        text,
        actionKey: event?.actionKey,
        user,
      });

    return dispatchInitialSessionRouting({
      session: createdSession,
      user,
      text,
      messageId: event.messageId,
      routingExtraction,
      deterministicAction,
      automationContext: event?.automationContext,
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
