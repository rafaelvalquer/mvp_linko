import Booking from "../models/Booking.js";
import { Offer } from "../models/Offer.js";
import { WhatsAppCommandSession } from "../models/WhatsAppCommandSession.js";
import { canAccessWorkspaceModule } from "../utils/workspaceAccess.js";
import { computeOfferDueDate } from "./paymentReminder.service.js";
import {
  getDateIsoForTimeZone,
  getWorkspaceAgendaTimeZone,
} from "./whatsapp-ai/whatsappAgendaQuery.service.js";

const OFFER_TERMINAL_STATUSES = ["EXPIRED", "CANCELLED", "CANCELED", "CONFIRMED", "PAID"];
const STALLED_SESSION_STATES = ["ERROR", "EXPIRED"];
const STALE_FOLLOWUP_DAYS = 3;
const UPCOMING_BOOKING_WINDOW_HOURS = 36;
const PASSIVE_AUTOMATION_TYPES = new Set([
  "payment_due_today",
  "payment_overdue",
  "stale_offer_followup",
]);

function toDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfSentence(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatDateTime(value, timeZone = "America/Sao_Paulo") {
  const date = toDate(value);
  if (!date) return "";

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone,
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return "";
  }
}

function formatDate(value, timeZone = "America/Sao_Paulo") {
  const date = toDate(value);
  if (!date) return "";

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone,
      day: "2-digit",
      month: "2-digit",
    }).format(date);
  } catch {
    return "";
  }
}

function hasWorkspaceModuleAccess(user, moduleKey) {
  return canAccessWorkspaceModule({
    user,
    workspacePlan: user?.workspacePlan,
    workspaceOwnerUserId: user?.workspaceOwnerUserId,
    moduleKey,
  });
}

export function buildPendingOfferCandidate(
  offer = {},
  timeZone = "America/Sao_Paulo",
) {
  const computedDueDate = computeOfferDueDate(offer);
  const customerName = String(offer?.customerName || "").trim() || "Cliente";
  const title = String(offer?.title || "").trim() || "Proposta";
  const createdAt = toDate(offer?.createdAt);
  const updatedAt = toDate(offer?.updatedAt);
  const dueAt = toDate(computedDueDate);
  const linkExpiresAt = toDate(offer?.expiresAt);
  const totalCents = Number.isFinite(Number(offer?.totalCents))
    ? Number(offer.totalCents)
    : Number.isFinite(Number(offer?.amountCents))
      ? Number(offer.amountCents)
      : 0;

  return {
    offerId: offer?._id ? String(offer._id) : "",
    ownerUserId: offer?.ownerUserId ? String(offer.ownerUserId) : "",
    customerName,
    title,
    totalCents,
    status: String(offer?.status || "").trim(),
    paymentStatus: String(offer?.paymentStatus || "").trim() || "PENDING",
    createdAt,
    updatedAt,
    dueAt,
    linkExpiresAt,
    publicToken: String(offer?.publicToken || "").trim(),
    displayLabel: `${customerName} - ${title}`,
  };
}

export function buildOfferOpportunityLine(
  candidate = {},
  timeZone = "America/Sao_Paulo",
) {
  const dueLabel = candidate?.dueAt
    ? `vence em ${formatDate(candidate.dueAt, timeZone)}`
    : "sem vencimento definido";
  return `${candidate.customerName} - ${candidate.title} (${dueLabel})`;
}

async function listPendingOffersForAutomation({
  workspaceId,
  ownerUserId,
  limit = 40,
}) {
  return Offer.find({
    workspaceId,
    ownerUserId,
    paymentStatus: "PENDING",
    status: { $nin: OFFER_TERMINAL_STATUSES },
  })
    .sort({ updatedAt: 1, createdAt: 1 })
    .limit(limit)
    .lean();
}

export function groupPendingOfferAutomations({
  offers = [],
  now = new Date(),
  timeZone = "America/Sao_Paulo",
}) {
  const todayIso = getDateIsoForTimeZone(now, timeZone);
  const staleCutoff = new Date(now.getTime() - STALE_FOLLOWUP_DAYS * 24 * 60 * 60 * 1000);
  const grouped = {
    allPending: [],
    dueToday: [],
    overdue: [],
    staleFollowup: [],
  };

  for (const offer of Array.isArray(offers) ? offers : []) {
    const candidate = buildPendingOfferCandidate(offer, timeZone);
    const dueIso = candidate?.dueAt
      ? getDateIsoForTimeZone(candidate.dueAt, timeZone)
      : "";
    const lastActivityAt = candidate?.updatedAt || candidate?.createdAt || null;

    grouped.allPending.push(candidate);

    if (dueIso && dueIso === todayIso) {
      grouped.dueToday.push(candidate);
      continue;
    }

    if (dueIso && dueIso < todayIso) {
      grouped.overdue.push(candidate);
      continue;
    }

    if (lastActivityAt && lastActivityAt <= staleCutoff) {
      grouped.staleFollowup.push(candidate);
    }
  }

  return grouped;
}

async function loadUpcomingBookingOpportunity({
  workspaceId,
  ownerUserId,
  timeZone = "America/Sao_Paulo",
  now = new Date(),
}) {
  const windowEnd = new Date(now.getTime() + UPCOMING_BOOKING_WINDOW_HOURS * 60 * 60 * 1000);
  const booking = await Booking.findOne({
    workspaceId,
    ownerUserId,
    status: { $in: ["HOLD", "CONFIRMED"] },
    startAt: {
      $gte: now,
      $lte: windowEnd,
    },
  })
    .sort({ startAt: 1 })
    .populate("offerId", "_id title publicToken")
    .lean();

  if (!booking?._id) return null;

  return {
    bookingId: String(booking._id),
    customerName: String(booking?.customerName || "").trim() || "Cliente",
    offerTitle: String(booking?.offerId?.title || "").trim() || "Servico",
    startAt: booking?.startAt || null,
    status: String(booking?.status || "").trim() || "CONFIRMED",
    summary: `${String(booking?.customerName || "Cliente").trim()} - ${String(
      booking?.offerId?.title || "Servico",
    ).trim()} em ${formatDateTime(booking?.startAt, timeZone)}`,
  };
}

async function loadResumeOpportunity({
  user,
  activeSession = null,
  selectedSession = null,
}) {
  const blockedSessionIds = [
    activeSession?._id ? String(activeSession._id) : "",
    selectedSession?._id ? String(selectedSession._id) : "",
  ].filter(Boolean);

  const query = {
    userId: user?._id,
    sourceChannel: "web",
    state: { $in: STALLED_SESSION_STATES },
  };

  if (blockedSessionIds.length) {
    query._id = { $nin: blockedSessionIds };
  }

  const session = await WhatsAppCommandSession.findOne(query)
    .sort({ updatedAt: -1 })
    .lean();

  if (!session?._id) return null;

  const preview = startOfSentence(
    session?.lastQuestionText || session?.confirmationSummaryText || session?.lastUserMessageText,
  );
  const flowLabel = String(session?.flowType || "")
    .trim()
    .replace(/_/g, " ");

  return {
    id: `resume:${String(session._id)}`,
    type: "resume_stalled_conversation",
    title: "Retomar conversa que ficou em aberto",
    summary: preview
      ? `${preview.slice(0, 140)}`
      : `Existe uma conversa recente de ${flowLabel || "atendimento"} pronta para retomada.`,
    actionKey: "",
    text: "",
    context: {
      sessionId: String(session._id),
    },
    priority: 1,
    relatedEntityId: String(session._id),
    ctaLabel: "Retomar",
    dismissLabel: "Agora nao",
  };
}

function buildBillingAutomationSummary(grouped = {}) {
  const parts = [];
  if (grouped?.dueToday?.length) parts.push(`${grouped.dueToday.length} vencendo hoje`);
  if (grouped?.overdue?.length) parts.push(`${grouped.overdue.length} atrasada${grouped.overdue.length > 1 ? "s" : ""}`);
  if (grouped?.staleFollowup?.length) {
    parts.push(`${grouped.staleFollowup.length} sem resposta recente`);
  }

  if (!parts.length && grouped?.allPending?.length) {
    parts.push(`${grouped.allPending.length} pendente${grouped.allPending.length > 1 ? "s" : ""}`);
  }

  if (!parts.length) return "";
  return `Encontrei ${parts.join(", ")} na sua carteira.`;
}

function buildPassiveOpportunityMessage(item = null) {
  const type = String(item?.type || "").trim();
  if (type === "payment_due_today") {
    return String(item?.actionKey || "").trim() === "offer_payment_reminder"
      ? "Que tal cobrar a proposta que vence hoje?"
      : "Que tal cobrar as propostas que vencem hoje?";
  }

  if (type === "payment_overdue") {
    return String(item?.actionKey || "").trim() === "offer_payment_reminder"
      ? "Encontrei uma cobranca pronta para lembrete."
      : "Encontrei cobrancas atrasadas prontas para lembrete.";
  }

  if (type === "stale_offer_followup") {
    return String(item?.actionKey || "").trim() === "offer_payment_reminder"
      ? "Que tal retomar a proposta sem resposta?"
      : "Que tal retomar propostas sem resposta?";
  }

  return "";
}

function toPassiveOpportunityPayload(item = null) {
  if (!item?.id) return null;

  return {
    id: String(item.id),
    type: String(item.type || "").trim(),
    title: String(item.title || "").trim(),
    actionKey: String(item.actionKey || "").trim(),
    context:
      item?.context && typeof item.context === "object" && !Array.isArray(item.context)
        ? item.context
        : {},
    priority: Number(item?.priority || 0),
    relatedEntityId: String(item?.relatedEntityId || "").trim(),
  };
}

export async function scanWebAgentPassiveOpportunities({
  user,
  now = new Date(),
}) {
  if (!user?._id || !user?.workspaceId) return [];
  if (!hasWorkspaceModuleAccess(user, "offers")) return [];

  const timeZone = await getWorkspaceAgendaTimeZone(user.workspaceId);
  const offers = await listPendingOffersForAutomation({
    workspaceId: user.workspaceId,
    ownerUserId: user._id,
  });
  const grouped = groupPendingOfferAutomations({ offers, now, timeZone });
  const items = [];

  if (grouped.dueToday.length) {
    const first = grouped.dueToday[0];
    const single = grouped.dueToday.length === 1;
    items.push({
      id: single ? `passive:due-today:${first.offerId}` : "passive:due-today:summary",
      type: "payment_due_today",
      title: single ? "Cobrar vencida de hoje" : "Cobrar vencidas de hoje",
      actionKey: single ? "offer_payment_reminder" : "billing_due_today",
      context: single
        ? { offerId: first.offerId, automationType: "due_today" }
        : { automationType: "due_today" },
      priority: 3,
      relatedEntityId: first.offerId,
    });
  }

  if (grouped.overdue.length) {
    const first = grouped.overdue[0];
    const single = grouped.overdue.length === 1;
    items.push({
      id: single ? `passive:overdue:${first.offerId}` : "passive:overdue:summary",
      type: "payment_overdue",
      title: single ? "Cobrar atrasada" : "Cobrar atrasadas",
      actionKey: single ? "offer_payment_reminder" : "billing_overdue",
      context: single
        ? { offerId: first.offerId, automationType: "overdue" }
        : { automationType: "overdue" },
      priority: 2,
      relatedEntityId: first.offerId,
    });
  }

  if (grouped.staleFollowup.length) {
    const first = grouped.staleFollowup[0];
    const single = grouped.staleFollowup.length === 1;
    items.push({
      id: single ? `passive:stale:${first.offerId}` : "passive:stale:summary",
      type: "stale_offer_followup",
      title: single ? "Retomar proposta sem resposta" : "Retomar propostas sem resposta",
      actionKey: single ? "offer_payment_reminder" : "billing_followup_stale",
      context: single
        ? { offerId: first.offerId, automationType: "stale_followup" }
        : { automationType: "stale_followup" },
      priority: 1,
      relatedEntityId: first.offerId,
    });
  }

  return items
    .filter((item) => PASSIVE_AUTOMATION_TYPES.has(String(item?.type || "").trim()))
    .sort((left, right) => Number(right?.priority || 0) - Number(left?.priority || 0));
}

export async function buildWebAgentPassiveStatus({
  user,
  enabled = true,
  now = new Date(),
}) {
  const passiveEnabled = enabled === true;
  if (!passiveEnabled) {
    return {
      enabled: false,
      hasOpportunities: false,
      count: 0,
      topOpportunity: null,
      humanizedMessage: "",
      updatedAt: now.toISOString(),
    };
  }

  const opportunities = await scanWebAgentPassiveOpportunities({ user, now });
  const topOpportunity = toPassiveOpportunityPayload(opportunities[0] || null);

  return {
    enabled: true,
    hasOpportunities: opportunities.length > 0,
    count: opportunities.length,
    topOpportunity,
    humanizedMessage: buildPassiveOpportunityMessage(opportunities[0] || null),
    updatedAt: now.toISOString(),
  };
}

export async function scanWebAgentAutomationInbox({
  user,
  activeSession = null,
  selectedSession = null,
  now = new Date(),
}) {
  if (!user?._id || !user?.workspaceId) return [];

  const items = [];
  const timeZone = await getWorkspaceAgendaTimeZone(user.workspaceId);

  if (hasWorkspaceModuleAccess(user, "offers")) {
    const offers = await listPendingOffersForAutomation({
      workspaceId: user.workspaceId,
      ownerUserId: user._id,
    });
    const grouped = groupPendingOfferAutomations({ offers, now, timeZone });

    if (grouped.dueToday.length) {
      const first = grouped.dueToday[0];
      const single = grouped.dueToday.length === 1;
      items.push({
        id: single ? `due-today:${first.offerId}` : "due-today:summary",
        type: "payment_due_today",
        title: single ? "Cobrar vencida de hoje" : "Cobrar vencidas de hoje",
        summary: single
          ? buildOfferOpportunityLine(first, timeZone)
          : `${grouped.dueToday.length} propostas vencem hoje. Vale revisar essas cobrancas agora.`,
        actionKey: single ? "offer_payment_reminder" : "billing_due_today",
        text: single
          ? "Quero enviar lembrete para a proposta vencida de hoje"
          : "Quem preciso cobrar hoje?",
        context: single
          ? { offerId: first.offerId, automationType: "due_today" }
          : { automationType: "due_today" },
        priority: 3,
        relatedEntityId: first.offerId,
        ctaLabel: single ? "Revisar cobranca" : "Ver cobrancas",
        dismissLabel: "Agora nao",
      });
    }

    if (grouped.overdue.length) {
      const first = grouped.overdue[0];
      const single = grouped.overdue.length === 1;
      items.push({
        id: single ? `overdue:${first.offerId}` : "overdue:summary",
        type: "payment_overdue",
        title: single ? "Cobrar atrasada" : "Cobrar atrasadas",
        summary: single
          ? buildOfferOpportunityLine(first, timeZone)
          : `${grouped.overdue.length} propostas ja estao atrasadas e podem pedir follow-up agora.`,
        actionKey: single ? "offer_payment_reminder" : "billing_overdue",
        text: single
          ? "Quero enviar lembrete para a proposta atrasada"
          : "Quais cobrancas atrasadas eu tenho?",
        context: single
          ? { offerId: first.offerId, automationType: "overdue" }
          : { automationType: "overdue" },
        priority: 3,
        relatedEntityId: first.offerId,
        ctaLabel: single ? "Revisar cobranca" : "Ver atrasadas",
        dismissLabel: "Agora nao",
      });
    }

    if (grouped.staleFollowup.length) {
      const first = grouped.staleFollowup[0];
      const single = grouped.staleFollowup.length === 1;
      items.push({
        id: single ? `stale:${first.offerId}` : "stale:summary",
        type: "stale_offer_followup",
        title: single ? "Retomar proposta sem resposta" : "Retomar propostas sem resposta",
        summary: single
          ? buildOfferOpportunityLine(first, timeZone)
          : `${grouped.staleFollowup.length} propostas estao sem resposta recente e merecem follow-up.`,
        actionKey: single ? "offer_payment_reminder" : "billing_followup_stale",
        text: single
          ? "Quero retomar a proposta sem resposta"
          : "Quais propostas estao sem resposta?",
        context: single
          ? { offerId: first.offerId, automationType: "stale_followup" }
          : { automationType: "stale_followup" },
        priority: 2,
        relatedEntityId: first.offerId,
        ctaLabel: single ? "Revisar follow-up" : "Retomar propostas",
        dismissLabel: "Agora nao",
      });
    }

    if (grouped.allPending.length) {
      items.push({
        id: "billing-priorities",
        type: "billing_priorities",
        title: "Pendencias de cobranca do dia",
        summary: buildBillingAutomationSummary(grouped),
        actionKey: "billing_priorities",
        text: "Quero ver minhas prioridades de cobranca do dia",
        context: { automationType: "billing_priorities" },
        priority: 2,
        relatedEntityId: grouped.allPending[0]?.offerId || "",
        ctaLabel: "Ver prioridades",
        dismissLabel: "Agora nao",
      });
    }
  }

  if (hasWorkspaceModuleAccess(user, "calendar")) {
    const nextBooking = await loadUpcomingBookingOpportunity({
      workspaceId: user.workspaceId,
      ownerUserId: user._id,
      timeZone,
      now,
    });

    if (nextBooking?.bookingId) {
      items.push({
        id: `booking:${nextBooking.bookingId}`,
        type: "upcoming_booking",
        title: "Confirmar agenda proxima",
        summary: nextBooking.summary,
        actionKey: "next_booking",
        text: "Qual e o meu proximo compromisso?",
        context: {
          bookingId: nextBooking.bookingId,
          automationType: "upcoming_booking",
        },
        priority: 1,
        relatedEntityId: nextBooking.bookingId,
        ctaLabel: "Revisar agenda",
        dismissLabel: "Agora nao",
      });
    }
  }

  const resumeOpportunity = await loadResumeOpportunity({
    user,
    activeSession,
    selectedSession,
  });
  if (resumeOpportunity) {
    items.push(resumeOpportunity);
  }

  return items
    .filter((item) => item?.title && item?.summary)
    .sort((left, right) => Number(right?.priority || 0) - Number(left?.priority || 0))
    .slice(0, 6);
}

export async function listWebAgentAutomationOfferCandidates({
  user,
  automationType = "",
  limit = 5,
  now = new Date(),
}) {
  if (!user?._id || !user?.workspaceId) return [];

  const timeZone = await getWorkspaceAgendaTimeZone(user.workspaceId);
  const offers = await listPendingOffersForAutomation({
    workspaceId: user.workspaceId,
    ownerUserId: user._id,
    limit: Math.max(limit * 4, 20),
  });
  const grouped = groupPendingOfferAutomations({ offers, now, timeZone });
  const normalizedType = String(automationType || "").trim();

  if (normalizedType === "due_today") return grouped.dueToday.slice(0, limit);
  if (normalizedType === "overdue") return grouped.overdue.slice(0, limit);
  if (normalizedType === "stale_followup") return grouped.staleFollowup.slice(0, limit);
  return grouped.allPending.slice(0, limit);
}

export async function buildWebAgentAutomationSummaryMessage({
  user,
  automationType = "",
  now = new Date(),
  candidates: providedCandidates = null,
}) {
  const normalizedType = String(automationType || "").trim();
  const timeZone = await getWorkspaceAgendaTimeZone(user?.workspaceId);
  const candidates = Array.isArray(providedCandidates)
    ? providedCandidates
    : await listWebAgentAutomationOfferCandidates({
        user,
        automationType: normalizedType,
        limit: 8,
        now,
      });

  if (!candidates.length) {
    if (normalizedType === "due_today") {
      return "Hoje nao encontrei cobrancas vencendo na sua carteira.";
    }
    if (normalizedType === "overdue") {
      return "Nao encontrei cobrancas atrasadas na sua carteira agora.";
    }
    if (normalizedType === "stale_followup") {
      return "Nao encontrei propostas sem resposta recente para retomar agora.";
    }
    return "Sua carteira esta sem pendencias de cobranca neste momento.";
  }

  if (normalizedType === "billing_priorities") {
    const grouped = {
      dueToday: await listWebAgentAutomationOfferCandidates({
        user,
        automationType: "due_today",
        limit: 50,
        now,
      }),
      overdue: await listWebAgentAutomationOfferCandidates({
        user,
        automationType: "overdue",
        limit: 50,
        now,
      }),
      staleFollowup: await listWebAgentAutomationOfferCandidates({
        user,
        automationType: "stale_followup",
        limit: 50,
        now,
      }),
      allPending: candidates,
    };

    const lines = [
      "Suas prioridades de cobranca agora:",
      "",
      `- Vencendo hoje: ${grouped.dueToday.length}`,
      `- Atrasadas: ${grouped.overdue.length}`,
      `- Sem resposta recente: ${grouped.staleFollowup.length}`,
      "",
      "Separei as principais pendencias no seletor para voce revisar agora.",
    ];

    return lines.join("\n");
  }

  const titleMap = {
    due_today: "Cobrancas vencendo hoje",
    overdue: "Cobrancas atrasadas",
    stale_followup: "Propostas sem resposta recente",
  };

  return [
    `${titleMap[normalizedType] || "Pendencias de cobranca"}: ${candidates.length}`,
    "",
    ...candidates.map((candidate, index) => `${index + 1}. ${buildOfferOpportunityLine(candidate, timeZone)}`),
    "",
    "Se quiser, posso seguir com o lembrete de uma delas agora.",
  ].join("\n");
}

export async function resolveAutomationOfferCandidate({
  user,
  offerId = "",
}) {
  const normalizedOfferId = String(offerId || "").trim();
  if (!user?._id || !user?.workspaceId || !normalizedOfferId) return null;

  const timeZone = await getWorkspaceAgendaTimeZone(user.workspaceId);
  const offer = await Offer.findOne({
    _id: normalizedOfferId,
    workspaceId: user.workspaceId,
    ownerUserId: user._id,
    paymentStatus: "PENDING",
    status: { $nin: OFFER_TERMINAL_STATUSES },
  }).lean();

  return offer ? buildPendingOfferCandidate(offer, timeZone) : null;
}
