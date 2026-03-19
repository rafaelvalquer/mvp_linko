import Booking from "../models/Booking.js";
import { Offer } from "../models/Offer.js";
import { User } from "../models/User.js";

const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const MAX_OFFERS = 15;
const MAX_CHANGES_PER_OFFER = 3;

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function isWithinWindow(value, start, end) {
  const date = toDate(value);
  if (!date || !start || !end) return false;
  return date.getTime() > start.getTime() && date.getTime() <= end.getTime();
}

function formatDateTime(value, timeZone = DEFAULT_TIMEZONE) {
  const date = toDate(value);
  if (!date) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function buildEventMessage(type, meta = {}) {
  if (type === "PAYMENT_PROOF_SUBMITTED") return "aguardando confirmacao";
  if (type === "PAYMENT_CONFIRMED") return "pagamento confirmado";
  if (type === "PAYMENT_REJECTED") return "comprovante recusado";
  if (type === "BOOKING_CANCELLED") return "agendamento cancelado";
  if (type === "OFFER_ACCEPTED") return "proposta aceita";
  if (type === "BOOKING_CREATED") return "agendamento criado";

  if (type === "BOOKING_RESCHEDULED") {
    const fromLabel = formatDateTime(meta.fromStartAt);
    const toLabel = formatDateTime(meta.toStartAt);

    if (fromLabel && toLabel) {
      return `de ${fromLabel} para ${toLabel}`;
    }
    return "agendamento reagendado";
  }

  return "atualizacao registrada";
}

function buildChange({ type, occurredAt, message, meta = {} }) {
  const date = toDate(occurredAt);
  if (!date) return null;

  return {
    type,
    occurredAt: date.toISOString(),
    message: String(message || "").trim() || buildEventMessage(type, meta),
    meta,
  };
}

function buildOfferLookupMap(offers = []) {
  const map = new Map();

  for (const offer of offers) {
    if (!offer?._id) continue;
    map.set(String(offer._id), offer);
  }

  return map;
}

function pushOfferEvent(bucketMap, offerId, change) {
  if (!offerId || !change) return;

  const key = String(offerId);
  const current = bucketMap.get(key) || [];
  current.push(change);
  bucketMap.set(key, current);
}

function buildGroupedItems(bucketMap, offerMap) {
  const items = [];

  for (const [offerId, changes] of bucketMap.entries()) {
    const offer = offerMap.get(offerId);
    if (!offer || !Array.isArray(changes) || changes.length === 0) continue;

    const sortedChanges = [...changes].sort(
      (left, right) =>
        new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
    );

    items.push({
      offerId,
      offerTitle: String(offer.title || "").trim() || "Proposta",
      customerName: String(offer.customerName || "").trim() || "Cliente",
      publicToken: String(offer.publicToken || "").trim(),
      status: String(offer.status || "").trim().toUpperCase() || "PUBLIC",
      paymentStatus:
        String(offer.paymentStatus || "").trim().toUpperCase() || "PENDING",
      latestChange: sortedChanges[0],
      changes: sortedChanges.slice(0, MAX_CHANGES_PER_OFFER),
    });
  }

  return items
    .sort(
      (left, right) =>
        new Date(right.latestChange?.occurredAt || 0).getTime() -
        new Date(left.latestChange?.occurredAt || 0).getTime(),
    )
    .slice(0, MAX_OFFERS);
}

function buildOfferEvents(offer, since, snapshotAt) {
  const events = [];

  if (isWithinWindow(offer?.acceptedAt, since, snapshotAt)) {
    events.push(
      buildChange({
        type: "OFFER_ACCEPTED",
        occurredAt: offer.acceptedAt,
        message: "proposta aceita",
      }),
    );
  }

  const proofUploadedAt = offer?.paymentProof?.uploadedAt;
  if (isWithinWindow(proofUploadedAt, since, snapshotAt)) {
    events.push(
      buildChange({
        type: "PAYMENT_PROOF_SUBMITTED",
        occurredAt: proofUploadedAt,
        message: "aguardando confirmacao",
      }),
    );
  }

  const paymentConfirmedAt = offer?.confirmedAt || offer?.paidAt;
  if (isWithinWindow(paymentConfirmedAt, since, snapshotAt)) {
    events.push(
      buildChange({
        type: "PAYMENT_CONFIRMED",
        occurredAt: paymentConfirmedAt,
        message: "pagamento confirmado",
      }),
    );
  }

  if (isWithinWindow(offer?.rejectedAt, since, snapshotAt)) {
    events.push(
      buildChange({
        type: "PAYMENT_REJECTED",
        occurredAt: offer.rejectedAt,
        message: "comprovante recusado",
      }),
    );
  }

  return events.filter(Boolean);
}

function buildBookingEvents(booking, since, snapshotAt) {
  const events = [];

  if (isWithinWindow(booking?.createdAt, since, snapshotAt)) {
    events.push(
      buildChange({
        type: "BOOKING_CREATED",
        occurredAt: booking.createdAt,
        message: "agendamento criado",
        meta: {
          bookingId: booking?._id ? String(booking._id) : "",
          startAt: toDate(booking?.startAt)?.toISOString() || null,
          endAt: toDate(booking?.endAt)?.toISOString() || null,
        },
      }),
    );
  }

  const history = Array.isArray(booking?.changeHistory) ? booking.changeHistory : [];
  for (const entry of history) {
    if (!isWithinWindow(entry?.changedAt, since, snapshotAt)) continue;

    const action = String(entry?.action || "").trim().toLowerCase();
    const type =
      action === "cancel" ? "BOOKING_CANCELLED" : "BOOKING_RESCHEDULED";

    const meta = {
      bookingId: booking?._id ? String(booking._id) : "",
      actor: String(entry?.actor || "").trim().toLowerCase() || null,
      fromStartAt: toDate(entry?.fromStartAt)?.toISOString() || null,
      fromEndAt: toDate(entry?.fromEndAt)?.toISOString() || null,
      toStartAt: toDate(entry?.toStartAt)?.toISOString() || null,
      toEndAt: toDate(entry?.toEndAt)?.toISOString() || null,
      reason: entry?.reason ? String(entry.reason) : null,
    };

    events.push(
      buildChange({
        type,
        occurredAt: entry.changedAt,
        message: buildEventMessage(type, meta),
        meta,
      }),
    );
  }

  return events.filter(Boolean);
}

async function loadOfferMapForUser({ workspaceId, userId, changedOfferIds }) {
  const offerIdList = [...changedOfferIds]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  if (offerIdList.length === 0) return new Map();

  const offers = await Offer.find({
    _id: { $in: offerIdList },
    workspaceId,
    ownerUserId: userId,
  })
    .select(
      "_id title customerName publicToken status paymentStatus acceptedAt paymentProof confirmedAt paidAt rejectedAt",
    )
    .lean();

  return buildOfferLookupMap(offers);
}

export async function ensureWhatsNewBaseline(userId) {
  if (!userId) return null;

  const now = new Date();
  const select =
    "_id name email workspaceId role status whatsNewLastSeenAt whatsappPhone";

  const initialized = await User.findOneAndUpdate(
    {
      _id: userId,
      $or: [
        { whatsNewLastSeenAt: { $exists: false } },
        { whatsNewLastSeenAt: null },
      ],
    },
    {
      $set: { whatsNewLastSeenAt: now },
    },
    {
      new: true,
    },
  ).select(select);

  if (initialized) return initialized;

  return User.findById(userId).select(select);
}

export async function listWhatsNewForUser({ user, snapshotAt = new Date() }) {
  if (!user?._id || !user?.workspaceId) {
    return {
      snapshotAt: toDate(snapshotAt)?.toISOString() || new Date().toISOString(),
      items: [],
    };
  }

  const snapshotDate = toDate(snapshotAt) || new Date();
  const since = toDate(user?.whatsNewLastSeenAt);
  if (!since) {
    return { snapshotAt: snapshotDate.toISOString(), items: [] };
  }

  const offerEventsQuery = {
    workspaceId: user.workspaceId,
    ownerUserId: user._id,
    $or: [
      { acceptedAt: { $gt: since, $lte: snapshotDate } },
      { "paymentProof.uploadedAt": { $gt: since, $lte: snapshotDate } },
      { confirmedAt: { $gt: since, $lte: snapshotDate } },
      { paidAt: { $gt: since, $lte: snapshotDate } },
      { rejectedAt: { $gt: since, $lte: snapshotDate } },
    ],
  };

  const bookingEventsQuery = {
    workspaceId: user.workspaceId,
    ownerUserId: user._id,
    $or: [
      { createdAt: { $gt: since, $lte: snapshotDate } },
      {
        changeHistory: {
          $elemMatch: {
            changedAt: { $gt: since, $lte: snapshotDate },
          },
        },
      },
    ],
  };

  const [changedOffers, changedBookings] = await Promise.all([
    Offer.find(offerEventsQuery)
      .select(
        "_id title customerName publicToken status paymentStatus acceptedAt paymentProof confirmedAt paidAt rejectedAt",
      )
      .lean(),
    Booking.find(bookingEventsQuery)
      .select(
        "_id offerId createdAt startAt endAt status changeHistory updatedAt",
      )
      .lean(),
  ]);

  const changedOfferIds = new Set();
  for (const offer of changedOffers || []) {
    if (offer?._id) changedOfferIds.add(String(offer._id));
  }
  for (const booking of changedBookings || []) {
    if (booking?.offerId) changedOfferIds.add(String(booking.offerId));
  }

  const offerMap =
    changedOffers?.length && changedOfferIds.size === changedOffers.length
      ? buildOfferLookupMap(changedOffers)
      : await loadOfferMapForUser({
          workspaceId: user.workspaceId,
          userId: user._id,
          changedOfferIds,
        });

  const bucketMap = new Map();

  for (const offer of changedOffers || []) {
    const offerId = offer?._id ? String(offer._id) : "";
    const events = buildOfferEvents(offer, since, snapshotDate);
    for (const change of events) {
      pushOfferEvent(bucketMap, offerId, change);
    }
  }

  for (const booking of changedBookings || []) {
    const offerId = booking?.offerId ? String(booking.offerId) : "";
    const events = buildBookingEvents(booking, since, snapshotDate);
    for (const change of events) {
      pushOfferEvent(bucketMap, offerId, change);
    }
  }

  return {
    snapshotAt: snapshotDate.toISOString(),
    items: buildGroupedItems(bucketMap, offerMap),
  };
}
