import { Offer } from "../../models/Offer.js";
import { dayRangeInTZ } from "../agendaSettings.js";
import { computeOfferDueDate } from "../paymentReminder.service.js";
import {
  getDateIsoForTimeZone,
  shiftDateIso,
} from "./whatsappAgendaQuery.service.js";

function normalizeComparableText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tokenize(value) {
  return normalizeComparableText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function buildRegexes(value) {
  const raw = String(value || "").trim();
  const tokens = tokenize(raw);
  const regexes = [];

  if (raw) regexes.push(new RegExp(escapeRegex(raw), "i"));
  if (tokens.length > 1) {
    regexes.push(
      new RegExp(tokens.map((token) => `(?=.*${escapeRegex(token)})`).join(""), "i"),
    );
  }
  if (tokens.length >= 1) regexes.push(new RegExp(escapeRegex(tokens[0]), "i"));

  return regexes;
}

function computeScore(label, query) {
  const normalizedLabel = normalizeComparableText(label);
  const normalizedQuery = normalizeComparableText(query);
  if (!normalizedLabel || !normalizedQuery) return 0;

  if (normalizedLabel === normalizedQuery) return 100;
  if (normalizedLabel.startsWith(normalizedQuery)) return 80;
  if (normalizedLabel.includes(normalizedQuery)) return 60;

  const queryTokens = tokenize(normalizedQuery);
  const matchedTokens = queryTokens.filter((token) =>
    normalizedLabel.includes(token),
  ).length;

  if (!queryTokens.length || !matchedTokens) return 0;
  return 30 + matchedTokens;
}

function normalizeStatus(value) {
  const status = String(value || "").trim().toUpperCase();
  return status === "CANCELED" ? "CANCELLED" : status;
}

function formatMoney(cents) {
  const value = Number(cents);
  if (!Number.isFinite(value)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

function formatDate(value, timeZone = "America/Sao_Paulo") {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getOfferTitle(offer = {}) {
  const title = String(offer?.title || "").trim();
  if (title) return title;

  const firstItem = Array.isArray(offer?.items) ? offer.items[0] : null;
  const itemLabel = String(firstItem?.description || "").trim();
  return itemLabel || "Proposta";
}

function buildOfferCandidate(offer = {}, timeZone = "America/Sao_Paulo") {
  const dueDate = computeOfferDueDate(offer);
  const title = getOfferTitle(offer);
  const createdLabel = formatDate(offer?.createdAt, timeZone);
  const dueLabel = dueDate ? formatDate(dueDate, timeZone) : "";
  const proofOriginalName = String(
    offer?.paymentProof?.originalName || offer?.paymentProof?.filename || "",
  ).trim();
  const proofMimeType = String(offer?.paymentProof?.mimeType || "").trim();
  const proofUploadedAt =
    offer?.paymentProof?.uploadedAt ||
    offer?.paymentProof?.createdAt ||
    offer?.updatedAt ||
    null;
  const labelParts = [
    String(offer?.customerName || "").trim() || "Cliente",
    title,
    formatMoney(offer?.totalCents ?? offer?.amountCents ?? 0),
    createdLabel ? `criada em ${createdLabel}` : "",
    dueLabel ? `vence em ${dueLabel}` : "",
  ].filter(Boolean);

  return {
    offerId: offer?._id ? String(offer._id) : "",
    ownerUserId: offer?.ownerUserId ? String(offer.ownerUserId) : "",
    customerName: String(offer?.customerName || "").trim(),
    title,
    totalCents: Number(offer?.totalCents ?? offer?.amountCents ?? 0) || 0,
    status: normalizeStatus(offer?.status),
    paymentStatus: normalizeStatus(offer?.paymentStatus),
    createdAt: offer?.createdAt || null,
    expiresAt: dueDate || offer?.expiresAt || null,
    publicToken: String(offer?.publicToken || "").trim(),
    paymentProofAvailable: !!offer?.paymentProof?.storage?.key,
    paymentProofOriginalName: proofOriginalName,
    paymentProofMimeType: proofMimeType,
    paymentProofUploadedAt: proofUploadedAt,
    customerWhatsApp: String(offer?.customerWhatsApp || "").trim(),
    acceptedAt: offer?.acceptedAt || null,
    confirmedAt: offer?.confirmedAt || null,
    paidAt: offer?.paidAt || null,
    rejectedAt: offer?.rejectedAt || null,
    cancelledAt: offer?.cancelledAt || null,
    displayLabel: labelParts.join(" - "),
    score: 0,
  };
}

function buildPendingOfferQuery({ workspaceId, ownerUserId = null } = {}) {
  const query = {
    workspaceId,
    paymentStatus: "PENDING",
    status: { $nin: ["EXPIRED", "CANCELLED", "CANCELED", "CONFIRMED", "PAID"] },
  };

  if (ownerUserId) query.ownerUserId = ownerUserId;
  return query;
}

function buildCancelableOfferQuery({ workspaceId, ownerUserId = null } = {}) {
  const query = {
    workspaceId,
    status: { $nin: ["EXPIRED", "CANCELLED", "CANCELED", "CONFIRMED", "PAID"] },
    paymentStatus: { $nin: ["CONFIRMED", "PAID"] },
  };

  if (ownerUserId) query.ownerUserId = ownerUserId;
  return query;
}

function buildWaitingConfirmationOfferQuery({
  workspaceId,
  ownerUserId = null,
} = {}) {
  const query = {
    workspaceId,
    paymentStatus: "WAITING_CONFIRMATION",
    "paymentProof.storage.key": { $exists: true, $ne: "" },
  };

  if (ownerUserId) query.ownerUserId = ownerUserId;
  return query;
}

function buildRecentOfferQuery({ workspaceId, ownerUserId = null } = {}) {
  const query = { workspaceId };
  if (ownerUserId) query.ownerUserId = ownerUserId;
  return query;
}

function buildOfferStatusQuery({ workspaceId, ownerUserId = null } = {}) {
  const query = { workspaceId };
  if (ownerUserId) query.ownerUserId = ownerUserId;
  return query;
}

function resolveOfferDueDate(offer = {}) {
  return computeOfferDueDate(offer) || offer?.expiresAt || null;
}

function buildOfferSearchQuery(regexes = []) {
  const safeRegexes = Array.isArray(regexes) ? regexes.filter(Boolean) : [];
  if (!safeRegexes.length) return null;

  return safeRegexes.flatMap((regex) => [
    { customerName: regex },
    { title: regex },
    { "items.description": regex },
  ]);
}

function computeOfferSearchScore(offer = {}, query = "") {
  const safeQuery = String(query || "").trim();
  if (!safeQuery) return 0;

  return Math.max(
    computeScore(offer?.customerName, safeQuery),
    computeScore(offer?.title, safeQuery),
    ...(Array.isArray(offer?.items)
      ? offer.items.map((item) => computeScore(item?.description, safeQuery))
      : [0]),
  );
}

function inferExpiringWindow(text = "") {
  const normalized = normalizeComparableText(text);
  if (!normalized) return "all";
  if (normalized.includes("hoje")) return "today";
  if (normalized.includes("semana")) return "week";
  return "all";
}

function getDayOfWeek(dateISO) {
  const date = new Date(`${String(dateISO || "").trim()}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return 1;
  return date.getUTCDay();
}

function resolveCreatedAtRange({
  targetCreatedDayKind = "unspecified",
  targetCreatedDateIso = "",
  now = new Date(),
  timeZone = "America/Sao_Paulo",
}) {
  const todayIso = getDateIsoForTimeZone(now, timeZone);

  if (targetCreatedDayKind === "explicit_date" && targetCreatedDateIso) {
    return dayRangeInTZ(targetCreatedDateIso, timeZone);
  }

  if (targetCreatedDayKind === "today") {
    return dayRangeInTZ(todayIso, timeZone);
  }

  if (targetCreatedDayKind === "yesterday") {
    return dayRangeInTZ(shiftDateIso(todayIso, -1), timeZone);
  }

  if (targetCreatedDayKind === "last_week") {
    const todayWeekday = getDayOfWeek(todayIso);
    const distanceToMonday = todayWeekday === 0 ? 6 : todayWeekday - 1;
    const currentWeekStartIso = shiftDateIso(todayIso, -distanceToMonday);
    const lastWeekStartIso = shiftDateIso(currentWeekStartIso, -7);
    const lastWeekEndIso = shiftDateIso(currentWeekStartIso, -1);
    const startRange = dayRangeInTZ(lastWeekStartIso, timeZone);
    const endRange = dayRangeInTZ(lastWeekEndIso, timeZone);
    return {
      dayStart: startRange.dayStart,
      dayEnd: endRange.dayEnd,
    };
  }

  return null;
}

export async function listPendingOffers({
  workspaceId,
  ownerUserId = null,
  limit = 10,
  timeZone = "America/Sao_Paulo",
}) {
  const docs = await Offer.find(
    buildPendingOfferQuery({
      workspaceId,
      ownerUserId,
    }),
  )
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Math.min(20, Number(limit) || 10)))
    .lean();

  return docs.map((offer) => buildOfferCandidate(offer, timeZone));
}

export async function listOffersWaitingConfirmation({
  workspaceId,
  ownerUserId = null,
  limit = 10,
  timeZone = "America/Sao_Paulo",
}) {
  const docs = await Offer.find(
    buildWaitingConfirmationOfferQuery({
      workspaceId,
      ownerUserId,
    }),
  )
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(Math.max(1, Math.min(20, Number(limit) || 10)))
    .lean();

  return docs.map((offer) => buildOfferCandidate(offer, timeZone));
}

export async function listRecentOffers({
  workspaceId,
  ownerUserId = null,
  limit = 10,
  now = new Date(),
  timeZone = "America/Sao_Paulo",
}) {
  const todayIso = getDateIsoForTimeZone(now, timeZone);
  const todayRange = dayRangeInTZ(todayIso, timeZone);

  const docs = await Offer.find({
    ...buildRecentOfferQuery({
      workspaceId,
      ownerUserId,
    }),
    createdAt: {
      $gte: todayRange.dayStart,
      $lt: todayRange.dayEnd,
    },
  })
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Math.min(20, Number(limit) || 10)))
    .lean();

  return docs.map((offer) => buildOfferCandidate(offer, timeZone));
}

export async function listExpiringOffers({
  workspaceId,
  ownerUserId = null,
  limit = 10,
  now = new Date(),
  timeZone = "America/Sao_Paulo",
  sourceText = "",
}) {
  const window = inferExpiringWindow(sourceText);
  const todayIso = getDateIsoForTimeZone(now, timeZone);
  const todayRange = dayRangeInTZ(todayIso, timeZone);
  const weekEndIso = shiftDateIso(todayIso, 6);
  const weekEndRange = dayRangeInTZ(weekEndIso, timeZone);

  const docs = await Offer.find(
    buildPendingOfferQuery({
      workspaceId,
      ownerUserId,
    }),
  )
    .sort({ createdAt: -1 })
    .limit(80)
    .lean();

  const withDueDates = docs
    .map((offer) => ({
      ...offer,
      dueAt: resolveOfferDueDate(offer),
    }))
    .filter((offer) => {
      const dueAt = offer?.dueAt ? new Date(offer.dueAt) : null;
      return dueAt && !Number.isNaN(dueAt.getTime());
    });

  const dueToday = withDueDates.filter((offer) => {
    const dueAt = new Date(offer.dueAt);
    return dueAt >= todayRange.dayStart && dueAt < todayRange.dayEnd;
  });

  const dueThisWeek = withDueDates.filter((offer) => {
    const dueAt = new Date(offer.dueAt);
    return dueAt >= todayRange.dayStart && dueAt < weekEndRange.dayEnd;
  });

  const selectedDocs =
    window === "today"
      ? dueToday
      : dueThisWeek;

  const items = selectedDocs
    .sort(
      (left, right) =>
        new Date(left.dueAt || 0).getTime() - new Date(right.dueAt || 0).getTime() ||
        new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime(),
    )
    .slice(0, Math.max(1, Math.min(20, Number(limit) || 10)))
    .map((offer) => ({
      ...buildOfferCandidate(offer, timeZone),
      expiresAt: offer.dueAt || offer.expiresAt || null,
    }));

  return {
    window,
    dueTodayCount: dueToday.length,
    dueThisWeekCount: dueThisWeek.length,
    items,
  };
}

export async function resolveOfferCandidates({
  workspaceId,
  ownerUserId = null,
  action = "payment_reminder",
  targetCustomerName = "",
  targetCreatedDayKind = "unspecified",
  targetCreatedDateIso = "",
  now = new Date(),
  timeZone = "America/Sao_Paulo",
  limit = 5,
}) {
  const baseQuery =
    action === "cancel"
      ? buildCancelableOfferQuery({ workspaceId, ownerUserId })
      : action === "payment_approval"
        ? buildWaitingConfirmationOfferQuery({ workspaceId, ownerUserId })
        : action === "status"
          ? buildOfferStatusQuery({ workspaceId, ownerUserId })
        : buildPendingOfferQuery({ workspaceId, ownerUserId });

  const regexes = buildRegexes(targetCustomerName);
  const offerSearchQuery = buildOfferSearchQuery(regexes);
  if (offerSearchQuery?.length) {
    baseQuery.$or = offerSearchQuery;
  }

  if (!["status", "resend"].includes(action)) {
    const createdRange = resolveCreatedAtRange({
      targetCreatedDayKind,
      targetCreatedDateIso,
      now,
      timeZone,
    });
    if (createdRange?.dayStart && createdRange?.dayEnd) {
      baseQuery.createdAt = {
        $gte: createdRange.dayStart,
        $lt: createdRange.dayEnd,
      };
    }
  }

  const docs = await Offer.find(baseQuery)
    .sort(
      action === "payment_approval"
        ? { updatedAt: -1, createdAt: -1 }
        : action === "status"
          ? { updatedAt: -1, createdAt: -1 }
        : { createdAt: -1 },
    )
    .limit(Math.max(limit * 4, 20))
    .lean();

  const candidates = docs.map((offer) => ({
    ...buildOfferCandidate(offer, timeZone),
    score: computeOfferSearchScore(offer, targetCustomerName),
  }));

  if (!String(targetCustomerName || "").trim()) {
    return candidates.slice(0, limit);
  }

  return candidates
    .filter((candidate) => candidate.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        new Date(right.createdAt || 0).getTime() -
          new Date(left.createdAt || 0).getTime(),
    )
    .slice(0, limit);
}
