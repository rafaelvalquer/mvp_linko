import OfferReminderLog from "../models/OfferReminderLog.js";
import { Offer } from "../models/Offer.js";

const TZ = "America/Sao_Paulo";
const DAY_MS = 24 * 60 * 60 * 1000;
const PAID_SET = new Set(["PAID", "CONFIRMED"]);
const STATUS_SET = new Set(["active", "paused", "ended", "error", "draft"]);

function normalizeStatus(value) {
  const text = String(value || "").trim().toUpperCase();
  if (!text) return "";
  return text === "CANCELED" ? "CANCELLED" : text;
}

function normalizeRecurringStatus(value) {
  const text = String(value || "all").trim().toLowerCase();
  return STATUS_SET.has(text) ? text : "all";
}

function buildTypeMatch(type) {
  const text = String(type || "all").trim().toLowerCase();
  if (text === "service") return { offerType: "service" };
  if (text === "product") return { offerType: "product" };
  return {};
}

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatYmdSP(value) {
  const date = toDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function startOfSpDay(value) {
  const ymd = formatYmdSP(value);
  if (!ymd) return null;
  return new Date(`${ymd}T00:00:00-03:00`);
}

function addDays(date, days) {
  const current = toDate(date);
  if (!current) return null;
  return new Date(current.getTime() + Number(days || 0) * DAY_MS);
}

function diffDaysSp(fromValue, toValue) {
  const from = startOfSpDay(fromValue);
  const to = startOfSpDay(toValue);
  if (!from || !to) return null;
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

function computeDueDate(row) {
  if (row?.validityEnabled !== true) return null;
  const days = Number(row?.validityDays);
  if (!Number.isFinite(days) || days <= 0) return null;
  const createdAt = toDate(row?.createdAt);
  if (!createdAt) return null;
  return startOfSpDay(addDays(createdAt, days));
}

function getPaidDate(row) {
  return toDate(row?.paidAt || row?.paymentLastPixUpdatedAt || row?.updatedAt);
}

function getAmountCents(row) {
  return Number(row?.totalCents ?? row?.amountCents ?? 0) || 0;
}

function getPaidAmountCents(row) {
  return Number(row?.paidAmountCents ?? getAmountCents(row)) || 0;
}

function isWithinRange(value, start, end) {
  const date = toDate(value);
  return !!date && date >= start && date < end;
}

function isPaidRow(row) {
  return (
    !!toDate(row?.paidAt) ||
    PAID_SET.has(normalizeStatus(row?.paymentStatus)) ||
    PAID_SET.has(normalizeStatus(row?.status))
  );
}

function isAwaitingConfirmation(row) {
  return normalizeStatus(row?.paymentStatus) === "WAITING_CONFIRMATION";
}

function getDelayBucket(days) {
  if (!Number.isFinite(days)) return "Sem vencimento";
  if (days < 0) return "Antecipado";
  if (days === 0) return "No dia";
  if (days <= 3) return "1-3 dias";
  if (days <= 7) return "4-7 dias";
  if (days <= 15) return "8-15 dias";
  return "16+ dias";
}

function getAgingBucket(days) {
  if (!Number.isFinite(days) || days <= 0) return "0 dia";
  if (days <= 3) return "1-3 dias";
  if (days <= 7) return "4-7 dias";
  if (days <= 15) return "8-15 dias";
  if (days <= 30) return "16-30 dias";
  return "31+ dias";
}

function buildDateSeries(start, end) {
  const items = [];
  for (let current = new Date(start); current < end; current = addDays(current, 1)) {
    const ymd = formatYmdSP(current);
    items.push({
      date: ymd,
      dueAmountCents: 0,
      dueCount: 0,
      paidAmountCents: 0,
      paidCount: 0,
    });
  }
  return items;
}

function monthDayLabel(ymd) {
  const parts = String(ymd || "").split("-");
  if (parts.length !== 3) return "";
  return `${parts[2]}/${parts[1]}`;
}

function weekdayKey(value) {
  const date = toDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
  }).format(date);
}

function latestDate(a, b) {
  const x = toDate(a);
  const y = toDate(b);
  if (!x) return y;
  if (!y) return x;
  return x > y ? x : y;
}

function earliestDate(a, b) {
  const x = toDate(a);
  const y = toDate(b);
  if (!x) return y;
  if (!y) return x;
  return x < y ? x : y;
}

function average(list = []) {
  if (!list.length) return 0;
  const total = list.reduce((sum, value) => sum + value, 0);
  return total / list.length;
}

async function loadRecurringRows({ tenantId, userId, type, recurringStatus }) {
  const match = {
    workspaceId: tenantId,
    recurringOfferId: { $ne: null },
    ...buildTypeMatch(type),
  };
  if (userId) match.ownerUserId = userId;

  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: "recurring_offers",
        localField: "recurringOfferId",
        foreignField: "_id",
        as: "recurring",
      },
    },
    { $unwind: { path: "$recurring", preserveNullAndEmptyArrays: true } },
    ...(recurringStatus !== "all"
      ? [{ $match: { "recurring.status": recurringStatus } }]
      : []),
    {
      $project: {
        _id: 1,
        recurringOfferId: 1,
        recurringSequence: 1,
        recurringName: {
          $ifNull: ["$recurring.name", { $ifNull: ["$recurringNameSnapshot", "$title"] }],
        },
        recurringStatus: { $ifNull: ["$recurring.status", "draft"] },
        customerId: 1,
        customerName: 1,
        customerWhatsApp: 1,
        createdAt: 1,
        updatedAt: 1,
        paidAt: 1,
        paidAmountCents: 1,
        paymentStatus: 1,
        status: 1,
        totalCents: 1,
        amountCents: 1,
        validityEnabled: 1,
        validityDays: 1,
        publicToken: 1,
        title: 1,
        offerType: 1,
        paymentLastPixUpdatedAt: "$payment.lastPixUpdatedAt",
      },
    },
  ];

  return Offer.aggregate(pipeline).allowDiskUse(true);
}

async function loadReminderMap({ tenantId, offerIds }) {
  if (!offerIds.length) return new Map();

  const rows = await OfferReminderLog.aggregate([
    {
      $match: {
        workspaceId: tenantId,
        offerId: { $in: offerIds },
        status: "sent",
        sentAt: { $ne: null },
      },
    },
    { $sort: { sentAt: -1 } },
    {
      $group: {
        _id: "$offerId",
        sentAt: { $first: "$sentAt" },
        kind: { $first: "$kind" },
      },
    },
  ]).allowDiskUse(true);

  const map = new Map();
  for (const row of rows) {
    map.set(String(row._id), {
      sentAt: toDate(row.sentAt),
      kind: String(row.kind || ""),
    });
  }
  return map;
}

function annotateRows(rows, { start, end, today }) {
  return rows.map((row) => {
    const createdAt = toDate(row.createdAt);
    const paidDate = getPaidDate(row);
    const dueDate = computeDueDate(row);
    const amountCents = getAmountCents(row);
    const paidAmountCents = getPaidAmountCents(row);
    const paid = isPaidRow(row);
    const awaitingConfirmation = isAwaitingConfirmation(row);
    const customerName = String(row.customerName || "").trim() || "Cliente sem nome";
    const customerKey = row.customerId
      ? `id:${String(row.customerId)}`
      : `name:${customerName.toLowerCase()}`;
    const delayDays =
      paid && dueDate && paidDate ? diffDaysSp(dueDate, paidDate) : null;
    const overdueNow =
      !paid &&
      !awaitingConfirmation &&
      !!dueDate &&
      diffDaysSp(dueDate, today) > 0;

    return {
      ...row,
      createdAt,
      paidDate,
      dueDate,
      amountCents,
      paidAmountCents,
      paid,
      awaitingConfirmation,
      customerName,
      customerKey,
      createdInRange: isWithinRange(createdAt, start, end),
      paidInRange: isWithinRange(paidDate, start, end),
      dueInRange: isWithinRange(dueDate, start, end),
      delayDays,
      overdueNow,
      overdueDays: overdueNow ? diffDaysSp(dueDate, today) : 0,
      paidDayKey: paidDate ? formatYmdSP(paidDate) : "",
      dueDayKey: dueDate ? formatYmdSP(dueDate) : "",
      createdDayKey: createdAt ? formatYmdSP(createdAt) : "",
    };
  });
}

function buildSummary(rows, today) {
  const generatedRows = rows.filter((row) => row.createdInRange);
  const paidRows = rows.filter((row) => row.paid && row.paidInRange);
  const overdueRows = rows.filter((row) => row.overdueNow && row.dueInRange);
  const onTimeRows = paidRows.filter((row) => Number.isFinite(row.delayDays));
  const pendingNoDueRows = generatedRows.filter(
    (row) => !row.paid && !row.awaitingConfirmation && !row.dueDate,
  );
  const awaitingConfirmationRows = generatedRows.filter(
    (row) => !row.paid && row.awaitingConfirmation,
  );

  return {
    recurringCount: new Set(generatedRows.map((row) => String(row.recurringOfferId))).size,
    generatedCount: generatedRows.length,
    paidCount: paidRows.length,
    pendingCount: generatedRows.filter((row) => !row.paid).length,
    overdueCount: overdueRows.length,
    overdueAmountCents: overdueRows.reduce((sum, row) => sum + row.amountCents, 0),
    paidRevenueCents: paidRows.reduce((sum, row) => sum + row.paidAmountCents, 0),
    delinquentClientsCount: new Set(
      overdueRows.map((row) => row.customerKey),
    ).size,
    avgDaysToPay: Number(average(onTimeRows.map((row) => row.delayDays || 0)).toFixed(1)),
    onTimeRatePct: onTimeRows.length
      ? Number(
          (
            (onTimeRows.filter((row) => (row.delayDays || 0) <= 0).length /
              onTimeRows.length) *
            100
          ).toFixed(1),
        )
      : 0,
    awaitingConfirmationCount: awaitingConfirmationRows.length,
    awaitingConfirmationAmountCents: awaitingConfirmationRows.reduce(
      (sum, row) => sum + row.amountCents,
      0,
    ),
    pendingNoDueDateCount: pendingNoDueRows.length,
    pendingNoDueDateAmountCents: pendingNoDueRows.reduce(
      (sum, row) => sum + row.amountCents,
      0,
    ),
    asOfDate: formatYmdSP(today),
  };
}

function buildDueVsPaidDaily(rows, start, end) {
  const items = buildDateSeries(start, end);
  const map = new Map(items.map((item) => [item.date, item]));

  for (const row of rows) {
    if (row.dueInRange && row.dueDayKey && map.has(row.dueDayKey)) {
      const current = map.get(row.dueDayKey);
      current.dueAmountCents += row.amountCents;
      current.dueCount += 1;
    }

    if (row.paid && row.paidInRange && row.paidDayKey && map.has(row.paidDayKey)) {
      const current = map.get(row.paidDayKey);
      current.paidAmountCents += row.paidAmountCents;
      current.paidCount += 1;
    }
  }

  return items.map((item) => ({
    ...item,
    label: monthDayLabel(item.date),
  }));
}

function buildDelayBuckets(rows) {
  const order = [
    "Antecipado",
    "No dia",
    "1-3 dias",
    "4-7 dias",
    "8-15 dias",
    "16+ dias",
  ];
  const map = new Map(order.map((label) => [label, { bucket: label, count: 0, amountCents: 0 }]));

  for (const row of rows) {
    if (!row.paidInRange || !Number.isFinite(row.delayDays)) continue;
    const bucket = getDelayBucket(row.delayDays);
    if (!map.has(bucket)) continue;
    const current = map.get(bucket);
    current.count += 1;
    current.amountCents += row.paidAmountCents;
  }

  return order.map((label) => map.get(label));
}

function buildWeekdayDistribution(rows) {
  const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const labels = {
    Mon: "Seg",
    Tue: "Ter",
    Wed: "Qua",
    Thu: "Qui",
    Fri: "Sex",
    Sat: "Sab",
    Sun: "Dom",
  };
  const map = new Map(
    order.map((key) => [key, { key, label: labels[key], count: 0, amountCents: 0 }]),
  );

  for (const row of rows) {
    if (!row.paid || !row.paidInRange || !row.paidDate) continue;
    const key = weekdayKey(row.paidDate);
    if (!map.has(key)) continue;
    const current = map.get(key);
    current.count += 1;
    current.amountCents += row.paidAmountCents;
  }

  return order.map((key) => map.get(key));
}

function buildAgingBuckets(rows) {
  const order = ["1-3 dias", "4-7 dias", "8-15 dias", "16-30 dias", "31+ dias"];
  const map = new Map(order.map((label) => [label, { bucket: label, count: 0, amountCents: 0 }]));

  for (const row of rows) {
    if (!row.overdueNow || !row.dueInRange) continue;
    const bucket = getAgingBucket(row.overdueDays);
    if (!map.has(bucket)) continue;
    const current = map.get(bucket);
    current.count += 1;
    current.amountCents += row.amountCents;
  }

  return order.map((label) => map.get(label));
}

function buildDelinquentClients(rows, reminderMap, limit = 20) {
  const map = new Map();

  for (const row of rows) {
    if (!row.overdueNow || !row.dueInRange) continue;
    const key = row.customerKey;
    if (!map.has(key)) {
      map.set(key, {
        customerKey: key,
        customerName: row.customerName,
        recurringIds: new Set(),
        overdueCount: 0,
        overdueAmountCents: 0,
        maxDelayDays: 0,
        lastReminderAt: null,
        lastReminderKind: "",
        primaryRecurringId: row.recurringOfferId,
        primaryRecurringName: row.recurringName,
      });
    }

    const current = map.get(key);
    current.recurringIds.add(String(row.recurringOfferId));
    current.overdueCount += 1;
    current.overdueAmountCents += row.amountCents;
    current.maxDelayDays = Math.max(current.maxDelayDays, row.overdueDays || 0);

    if ((row.overdueDays || 0) >= current.maxDelayDays) {
      current.primaryRecurringId = row.recurringOfferId;
      current.primaryRecurringName = row.recurringName;
    }

    const reminder = reminderMap.get(String(row._id));
    if (reminder?.sentAt) {
      current.lastReminderAt = latestDate(current.lastReminderAt, reminder.sentAt);
      if (
        current.lastReminderAt &&
        reminder.sentAt &&
        current.lastReminderAt.getTime() === reminder.sentAt.getTime()
      ) {
        current.lastReminderKind = reminder.kind || "";
      }
    }
  }

  return Array.from(map.values())
    .map((item) => ({
      customerKey: item.customerKey,
      customerName: item.customerName,
      recurringCount: item.recurringIds.size,
      overdueCount: item.overdueCount,
      overdueAmountCents: item.overdueAmountCents,
      maxDelayDays: item.maxDelayDays,
      lastReminderAt: item.lastReminderAt,
      lastReminderKind: item.lastReminderKind,
      primaryRecurringId: item.primaryRecurringId,
      primaryRecurringName: item.primaryRecurringName,
    }))
    .sort((a, b) => {
      if (b.overdueAmountCents !== a.overdueAmountCents) {
        return b.overdueAmountCents - a.overdueAmountCents;
      }
      return b.maxDelayDays - a.maxDelayDays;
    })
    .slice(0, Math.max(1, Number(limit) || 20));
}

function buildPortfolio(rows, reminderMap, today, limit = 30) {
  const map = new Map();

  for (const row of rows) {
    if (!row.createdInRange && !row.paidInRange && !row.dueInRange && !row.overdueNow) {
      continue;
    }

    const key = String(row.recurringOfferId);
    if (!map.has(key)) {
      map.set(key, {
        recurringOfferId: row.recurringOfferId,
        recurringName: row.recurringName || "Recorrencia",
        recurringStatus: row.recurringStatus || "draft",
        customerName: row.customerName,
        generatedCount: 0,
        paidCount: 0,
        pendingCount: 0,
        overdueCount: 0,
        overdueAmountCents: 0,
        awaitingConfirmationCount: 0,
        lastPaidAt: null,
        nextDueAt: null,
        lastReminderAt: null,
      });
    }

    const current = map.get(key);
    if (row.createdInRange) current.generatedCount += 1;
    if (row.paid && row.paidInRange) current.paidCount += 1;

    if (!row.paid) {
      current.pendingCount += 1;
      if (row.awaitingConfirmation) current.awaitingConfirmationCount += 1;
    }

    if (row.overdueNow && row.dueInRange) {
      current.overdueCount += 1;
      current.overdueAmountCents += row.amountCents;
    }

    if (row.paidDate) {
      current.lastPaidAt = latestDate(current.lastPaidAt, row.paidDate);
    }

    if (!row.paid && !row.awaitingConfirmation && row.dueDate && row.dueDate >= today) {
      current.nextDueAt = earliestDate(current.nextDueAt, row.dueDate);
    }

    const reminder = reminderMap.get(String(row._id));
    if (reminder?.sentAt) {
      current.lastReminderAt = latestDate(current.lastReminderAt, reminder.sentAt);
    }
  }

  return Array.from(map.values())
    .sort((a, b) => {
      if (b.overdueAmountCents !== a.overdueAmountCents) {
        return b.overdueAmountCents - a.overdueAmountCents;
      }
      if (b.pendingCount !== a.pendingCount) return b.pendingCount - a.pendingCount;
      return b.generatedCount - a.generatedCount;
    })
    .slice(0, Math.max(1, Number(limit) || 30));
}

export async function buildRecurringReportsDashboard({
  tenantId,
  userId,
  fromYMD,
  toYMD,
  type = "all",
  recurringStatus = "all",
  start,
  end,
  delinquentClientsLimit = 20,
  portfolioLimit = 30,
}) {
  const normalizedRecurringStatus = normalizeRecurringStatus(recurringStatus);
  const rows = await loadRecurringRows({
    tenantId,
    userId,
    type,
    recurringStatus: normalizedRecurringStatus,
  });

  const today = startOfSpDay(new Date());
  const annotated = annotateRows(rows, { start, end, today });
  const reminderMap = await loadReminderMap({
    tenantId,
    offerIds: annotated.map((row) => row._id),
  });

  return {
    filters: {
      from: fromYMD,
      to: toYMD,
      type: String(type || "all").trim().toLowerCase() || "all",
      recurringStatus: normalizedRecurringStatus,
    },
    summary: buildSummary(annotated, today),
    dueVsPaidDaily: buildDueVsPaidDaily(annotated, start, end),
    paymentDelayBuckets: buildDelayBuckets(annotated),
    paymentWeekdayDistribution: buildWeekdayDistribution(annotated),
    overdueAgingBuckets: buildAgingBuckets(annotated),
    delinquentClients: buildDelinquentClients(
      annotated,
      reminderMap,
      delinquentClientsLimit,
    ),
    portfolio: buildPortfolio(
      annotated,
      reminderMap,
      today,
      portfolioLimit,
    ),
  };
}
