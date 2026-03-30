import { Offer } from "../models/Offer.js";

function dateToStringDayExpr(field) {
  return {
    $dateToString: {
      format: "%Y-%m-%d",
      date: field,
      timezone: "America/Sao_Paulo",
    },
  };
}

function buildTypeMatch(type) {
  const normalized = String(type || "all").trim().toLowerCase();
  if (normalized === "service") return { offerType: "service" };
  if (normalized === "product") return { offerType: "product" };
  return {};
}

export function buildFeedbackReportBaseMatch({
  tenantId,
  userId,
  type = "all",
}) {
  const match = {
    workspaceId: tenantId,
    "feedback.rating": { $gte: 1, $lte: 5 },
  };

  if (userId) match.ownerUserId = userId;

  return {
    ...match,
    ...buildTypeMatch(type),
  };
}

export function normalizeFeedbackSummary(raw = null) {
  const current = raw || {};
  const responsesCount = Number(current.responsesCount || 0);
  const averageRating = Number(current.averageRating || 0);
  const positiveCount = Number(current.positiveCount || 0);
  const lowRatingsCount = Number(current.lowRatingsCount || 0);
  const contactRequestedCount = Number(current.contactRequestedCount || 0);

  return {
    responsesCount,
    averageRating,
    positiveCount,
    positivePct:
      responsesCount > 0 ? (positiveCount / responsesCount) * 100 : 0,
    lowRatingsCount,
    contactRequestedCount,
  };
}

export function fillFeedbackDistribution(items = []) {
  const counts = new Map(
    (Array.isArray(items) ? items : []).map((item) => [
      Number(item?.rating || 0),
      Number(item?.count || 0),
    ]),
  );

  return [1, 2, 3, 4, 5].map((rating) => ({
    rating,
    count: counts.get(rating) || 0,
  }));
}

export async function buildFeedbackSummary({
  tenantId,
  userId,
  start,
  end,
  type = "all",
}) {
  const baseMatch = buildFeedbackReportBaseMatch({
    tenantId,
    userId,
    type,
  });

  const rows = await Offer.aggregate([
    {
      $match: {
        ...baseMatch,
        "feedback.respondedAt": { $gte: start, $lt: end },
      },
    },
    {
      $group: {
        _id: null,
        responsesCount: { $sum: 1 },
        averageRating: { $avg: "$feedback.rating" },
        positiveCount: {
          $sum: {
            $cond: [{ $gte: ["$feedback.rating", 4] }, 1, 0],
          },
        },
        lowRatingsCount: {
          $sum: {
            $cond: [{ $lte: ["$feedback.rating", 3] }, 1, 0],
          },
        },
        contactRequestedCount: {
          $sum: {
            $cond: [{ $eq: ["$feedback.contactRequested", true] }, 1, 0],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        responsesCount: 1,
        averageRating: 1,
        positiveCount: 1,
        lowRatingsCount: 1,
        contactRequestedCount: 1,
      },
    },
  ]).allowDiskUse(true);

  return normalizeFeedbackSummary(rows?.[0] || null);
}

export async function buildFeedbackReportsDashboard({
  tenantId,
  userId,
  fromYMD,
  toYMD,
  start,
  end,
  type = "all",
  responsesLimit = 30,
  actionRequiredLimit = 20,
}) {
  const baseMatch = buildFeedbackReportBaseMatch({
    tenantId,
    userId,
    type,
  });
  const periodMatch = {
    ...baseMatch,
    "feedback.respondedAt": { $gte: start, $lt: end },
  };

  const [summary, distribution, trend, responses, actionRequired] =
    await Promise.all([
      buildFeedbackSummary({
        tenantId,
        userId,
        start,
        end,
        type,
      }),
      Offer.aggregate([
        { $match: periodMatch },
        {
          $group: {
            _id: "$feedback.rating",
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            rating: "$_id",
            count: 1,
          },
        },
        { $sort: { rating: 1 } },
      ]).allowDiskUse(true),
      Offer.aggregate([
        { $match: periodMatch },
        {
          $group: {
            _id: dateToStringDayExpr("$feedback.respondedAt"),
            responsesCount: { $sum: 1 },
            averageRating: { $avg: "$feedback.rating" },
            lowRatingsCount: {
              $sum: {
                $cond: [{ $lte: ["$feedback.rating", 3] }, 1, 0],
              },
            },
            contactRequestedCount: {
              $sum: {
                $cond: [{ $eq: ["$feedback.contactRequested", true] }, 1, 0],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            date: "$_id",
            responsesCount: 1,
            averageRating: 1,
            lowRatingsCount: 1,
            contactRequestedCount: 1,
          },
        },
        { $sort: { date: 1 } },
      ]).allowDiskUse(true),
      Offer.aggregate([
        { $match: periodMatch },
        {
          $project: {
            _id: 0,
            offerId: "$_id",
            publicToken: 1,
            customerName: 1,
            title: 1,
            offerType: 1,
            rating: "$feedback.rating",
            comment: "$feedback.comment",
            contactRequested: "$feedback.contactRequested",
            respondedAt: "$feedback.respondedAt",
          },
        },
        { $sort: { respondedAt: -1 } },
        { $limit: Math.max(1, Number(responsesLimit) || 30) },
      ]).allowDiskUse(true),
      Offer.aggregate([
        {
          $match: {
            ...periodMatch,
            $or: [
              { "feedback.contactRequested": true },
              { "feedback.rating": { $lte: 3 } },
            ],
          },
        },
        {
          $project: {
            _id: 0,
            offerId: "$_id",
            publicToken: 1,
            customerName: 1,
            title: 1,
            offerType: 1,
            rating: "$feedback.rating",
            comment: "$feedback.comment",
            contactRequested: "$feedback.contactRequested",
            respondedAt: "$feedback.respondedAt",
          },
        },
        {
          $sort: {
            contactRequested: -1,
            rating: 1,
            respondedAt: -1,
          },
        },
        { $limit: Math.max(1, Number(actionRequiredLimit) || 20) },
      ]).allowDiskUse(true),
    ]);

  return {
    filters: {
      from: fromYMD,
      to: toYMD,
      type: String(type || "all").trim().toLowerCase() || "all",
    },
    summary,
    distribution: fillFeedbackDistribution(distribution),
    trend,
    responses,
    actionRequired,
  };
}
