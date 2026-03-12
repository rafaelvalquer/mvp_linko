import { Offer } from "../models/Offer.js";

const PAID_SET = ["PAID", "CONFIRMED"];

function buildTenantMatch({ tenantId, userId }) {
  const match = { workspaceId: tenantId };
  if (userId) match.ownerUserId = userId;
  return match;
}

function buildTypeMatch(type) {
  if (type === "service") return { offerType: "service" };
  if (type === "product") return { offerType: "product" };
  return {};
}

function addPaidFieldsStage() {
  return {
    $addFields: {
      isPaid: {
        $or: [
          { $in: ["$paymentStatus", PAID_SET] },
          { $in: ["$status", PAID_SET] },
        ],
      },
      paidDate: {
        $ifNull: [
          "$paidAt",
          { $ifNull: ["$payment.lastPixUpdatedAt", "$updatedAt"] },
        ],
      },
      paidCents: {
        $ifNull: [
          "$paidAmountCents",
          { $ifNull: ["$totalCents", "$amountCents"] },
        ],
      },
    },
  };
}

function dateToStringDayExpr(field) {
  return {
    $dateToString: {
      format: "%Y-%m-%d",
      date: field,
      timezone: "America/Sao_Paulo",
    },
  };
}

export async function buildGeneralReportsSnapshot({
  tenantId,
  userId,
  fromYMD,
  toYMD,
  start,
  end,
  type = "all",
  onlyPaid = true,
  transactionsLimit = 200,
}) {
  const tenantMatch = buildTenantMatch({ tenantId, userId });
  const typeMatch = buildTypeMatch(type);
  const transactionWindow = onlyPaid
    ? [{ $match: { isPaid: true, paidDate: { $gte: start, $lt: end } } }]
    : [{ $match: { paidDate: { $gte: start, $lt: end } } }];

  const [summaryOut, revenueDaily, createdPaidOut, topClients, topItems, transactions] =
    await Promise.all([
      Offer.aggregate([
        { $match: { ...tenantMatch, ...typeMatch } },
        addPaidFieldsStage(),
        {
          $facet: {
            created: [
              { $match: { createdAt: { $gte: start, $lt: end } } },
              { $count: "n" },
            ],
            paid: [
              { $match: { isPaid: true, paidDate: { $gte: start, $lt: end } } },
              {
                $group: {
                  _id: null,
                  paidRevenueCents: { $sum: "$paidCents" },
                  paidCount: { $sum: 1 },
                },
              },
            ],
          },
        },
        {
          $project: {
            createdCount: { $ifNull: [{ $arrayElemAt: ["$created.n", 0] }, 0] },
            paidRevenueCents: {
              $ifNull: [{ $arrayElemAt: ["$paid.paidRevenueCents", 0] }, 0],
            },
            paidCount: { $ifNull: [{ $arrayElemAt: ["$paid.paidCount", 0] }, 0] },
          },
        },
        {
          $addFields: {
            avgTicketCents: {
              $cond: [
                { $gt: ["$paidCount", 0] },
                { $divide: ["$paidRevenueCents", "$paidCount"] },
                0,
              ],
            },
            conversionPct: {
              $cond: [
                { $gt: ["$createdCount", 0] },
                {
                  $multiply: [{ $divide: ["$paidCount", "$createdCount"] }, 100],
                },
                0,
              ],
            },
          },
        },
      ]).allowDiskUse(true),
      Offer.aggregate([
        { $match: { ...tenantMatch, ...typeMatch } },
        addPaidFieldsStage(),
        { $match: { isPaid: true, paidDate: { $gte: start, $lt: end } } },
        {
          $group: {
            _id: dateToStringDayExpr("$paidDate"),
            paidRevenueCents: { $sum: "$paidCents" },
          },
        },
        { $project: { _id: 0, date: "$_id", paidRevenueCents: 1 } },
        { $sort: { date: 1 } },
      ]).allowDiskUse(true),
      Offer.aggregate([
        { $match: { ...tenantMatch, ...typeMatch } },
        addPaidFieldsStage(),
        {
          $facet: {
            created: [
              { $match: { createdAt: { $gte: start, $lt: end } } },
              {
                $group: {
                  _id: dateToStringDayExpr("$createdAt"),
                  createdCount: { $sum: 1 },
                },
              },
              { $project: { _id: 0, date: "$_id", createdCount: 1 } },
            ],
            paid: [
              { $match: { isPaid: true, paidDate: { $gte: start, $lt: end } } },
              {
                $group: {
                  _id: dateToStringDayExpr("$paidDate"),
                  paidCount: { $sum: 1 },
                },
              },
              { $project: { _id: 0, date: "$_id", paidCount: 1 } },
            ],
          },
        },
      ]).allowDiskUse(true),
      Offer.aggregate([
        { $match: { ...tenantMatch, ...typeMatch } },
        addPaidFieldsStage(),
        ...transactionWindow,
        {
          $group: {
            _id: "$customerName",
            paidRevenueCents: { $sum: { $cond: ["$isPaid", "$paidCents", 0] } },
            paidCount: { $sum: { $cond: ["$isPaid", 1, 0] } },
          },
        },
        {
          $project: {
            _id: 0,
            customerName: "$_id",
            paidRevenueCents: 1,
            paidCount: 1,
          },
        },
        { $sort: { paidRevenueCents: -1 } },
        { $limit: 20 },
      ]).allowDiskUse(true),
      Offer.aggregate([
        { $match: { ...tenantMatch, ...typeMatch } },
        addPaidFieldsStage(),
        ...transactionWindow,
        { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            itemDesc: { $ifNull: ["$items.description", "$title"] },
            itemQty: { $ifNull: ["$items.qty", 1] },
          },
        },
        {
          $group: {
            _id: "$itemDesc",
            paidRevenueCents: { $sum: { $cond: ["$isPaid", "$paidCents", 0] } },
            qty: { $sum: "$itemQty" },
          },
        },
        {
          $project: { _id: 0, description: "$_id", paidRevenueCents: 1, qty: 1 },
        },
        { $sort: { paidRevenueCents: -1 } },
        { $limit: 20 },
      ]).allowDiskUse(true),
      Offer.aggregate([
        { $match: { ...tenantMatch, ...typeMatch } },
        addPaidFieldsStage(),
        ...transactionWindow,
        {
          $project: {
            _id: 0,
            publicToken: 1,
            title: 1,
            customerName: 1,
            status: 1,
            paymentStatus: 1,
            paidCents: 1,
            paidDate: dateToStringDayExpr("$paidDate"),
          },
        },
        { $sort: { paidDate: -1 } },
        { $limit: Math.max(1, Number(transactionsLimit) || 200) },
      ]).allowDiskUse(true),
    ]);

  const created = summaryOut?.[0] || {
    paidRevenueCents: 0,
    paidCount: 0,
    createdCount: 0,
    avgTicketCents: 0,
    conversionPct: 0,
  };

  const createdDaily = createdPaidOut?.[0]?.created || [];
  const paidDaily = createdPaidOut?.[0]?.paid || [];
  const createdVsPaidMap = new Map();

  for (const item of createdDaily) {
    createdVsPaidMap.set(item.date, {
      date: item.date,
      createdCount: item.createdCount || 0,
      paidCount: 0,
    });
  }

  for (const item of paidDaily) {
    const current = createdVsPaidMap.get(item.date) || {
      date: item.date,
      createdCount: 0,
      paidCount: 0,
    };
    current.paidCount = item.paidCount || 0;
    createdVsPaidMap.set(item.date, current);
  }

  return {
    filters: {
      from: fromYMD,
      to: toYMD,
      type: String(type || "all").trim().toLowerCase() || "all",
      onlyPaid: onlyPaid === true,
    },
    summary: created,
    revenueDaily,
    createdVsPaidDaily: Array.from(createdVsPaidMap.values()).sort((a, b) =>
      String(a.date).localeCompare(String(b.date)),
    ),
    topClients,
    topItems,
    transactions,
  };
}
