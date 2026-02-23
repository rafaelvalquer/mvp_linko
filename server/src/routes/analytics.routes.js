// server/src/routes/analytics.routes.js
import { Router } from "express";
import mongoose from "mongoose";

import { ensureAuth, tenantFromUser } from "../middleware/auth.js";
import { Offer } from "../models/Offer.js";

const r = Router();

const DEFAULT_TZ = "America/Sao_Paulo";

function clampTz(tzRaw) {
  const tz = String(tzRaw || "").trim();
  if (!tz) return DEFAULT_TZ;
  if (!/^[A-Za-z_\-]+\/[A-Za-z_\-]+(?:\/[A-Za-z_\-]+)?$/.test(tz))
    return DEFAULT_TZ;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
  } catch {
    return DEFAULT_TZ;
  }
  return tz;
}

function getTZParts(date, timeZone) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const map = {};
  for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

// Converte "componentes locais" -> Date UTC real (sem libs)
function zonedTimeToUtc(
  { year, month, day, hour = 0, minute = 0, second = 0 },
  timeZone,
) {
  const utcGuess = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second),
  );
  const asLocal = getTZParts(utcGuess, timeZone);
  const asIfUtc = new Date(
    Date.UTC(
      asLocal.year,
      asLocal.month - 1,
      asLocal.day,
      asLocal.hour,
      asLocal.minute,
      asLocal.second,
    ),
  );
  const offsetMs = asIfUtc.getTime() - utcGuess.getTime();
  const desired = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second),
  );
  return new Date(desired.getTime() - offsetMs);
}

function startOfDayInTZ(date, timeZone) {
  const p = getTZParts(date, timeZone);
  return zonedTimeToUtc(
    { year: p.year, month: p.month, day: p.day, hour: 0, minute: 0, second: 0 },
    timeZone,
  );
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function formatYMD(date, timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function round2(n) {
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

/**
 * Regras (consistentes):
 * - Pizza (distribuição): usa createdAt no período e AGRUPA por offer.status (default PUBLIC)
 * - Vendas por dia / Ticket médio: usa offer.status === "PAID" e paidAt (fallback updatedAt)
 */
r.get("/analytics/dashboard", ensureAuth, tenantFromUser, async (req, res) => {
  try {
    const tz = clampTz(req.query.tz);

    const tenantIdRaw = req.tenantId;
    const userIdRaw = req.user?._id;

    if (!mongoose.isValidObjectId(tenantIdRaw)) {
      return res.status(400).json({ ok: false, error: "workspace inválido" });
    }

    const tenantId =
      tenantIdRaw instanceof mongoose.Types.ObjectId
        ? tenantIdRaw
        : new mongoose.Types.ObjectId(String(tenantIdRaw));

    const userId =
      userIdRaw && mongoose.isValidObjectId(userIdRaw)
        ? userIdRaw instanceof mongoose.Types.ObjectId
          ? userIdRaw
          : new mongoose.Types.ObjectId(String(userIdRaw))
        : null;

    const baseMatch = {
      workspaceId: tenantId,
      ...(userId ? { ownerUserId: userId } : {}),
    };

    const now = new Date();
    const nowParts = getTZParts(now, tz);

    // mês atual (TZ)
    const monthStart = zonedTimeToUtc(
      {
        year: nowParts.year,
        month: nowParts.month,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
      },
      tz,
    );
    const nextMonthYear =
      nowParts.month === 12 ? nowParts.year + 1 : nowParts.year;
    const nextMonth = nowParts.month === 12 ? 1 : nowParts.month + 1;
    const monthEnd = zonedTimeToUtc(
      {
        year: nextMonthYear,
        month: nextMonth,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
      },
      tz,
    );

    const todayStart = startOfDayInTZ(now, tz);
    const tomorrowStart = addDays(todayStart, 1);
    const last7Start = addDays(todayStart, -6);
    const last30Start = addDays(todayStart, -29);

    // 1) monthDaily: quotes por createdAt + vendas por paidAt (fallback updatedAt), status=PAID
    const [quotesAgg, salesAgg] = await Promise.all([
      Offer.aggregate([
        {
          $match: {
            ...baseMatch,
            createdAt: { $gte: monthStart, $lt: monthEnd },
          },
        },
        {
          $group: {
            _id: {
              $dateTrunc: { date: "$createdAt", unit: "day", timezone: tz },
            },
            quotesCount: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Offer.aggregate([
        {
          $match: {
            ...baseMatch,
            status: "PAID",
            $or: [
              { paidAt: { $gte: monthStart, $lt: monthEnd } },
              {
                paidAt: { $in: [null] },
                updatedAt: { $gte: monthStart, $lt: monthEnd },
              },
            ],
          },
        },
        { $addFields: { payDate: { $ifNull: ["$paidAt", "$updatedAt"] } } },
        {
          $group: {
            _id: {
              $dateTrunc: { date: "$payDate", unit: "day", timezone: tz },
            },
            salesCount: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const quotesMap = new Map(
      (quotesAgg || []).map((row) => [
        formatYMD(row._id, tz),
        Number(row.quotesCount) || 0,
      ]),
    );
    const salesMap = new Map(
      (salesAgg || []).map((row) => [
        formatYMD(row._id, tz),
        Number(row.salesCount) || 0,
      ]),
    );

    const monthDaily = [];
    for (let d = new Date(monthStart); d < monthEnd; d = addDays(d, 1)) {
      const key = formatYMD(d, tz);
      monthDaily.push({
        date: key,
        salesCount: salesMap.get(key) || 0,
        quotesCount: quotesMap.get(key) || 0,
      });
    }

    // 2) last30Ticket: avg(totalCents)/100 por dia (status=PAID)
    const ticketAgg = await Offer.aggregate([
      {
        $match: {
          ...baseMatch,
          status: "PAID",
          $or: [
            { paidAt: { $gte: last30Start, $lt: tomorrowStart } },
            {
              paidAt: { $in: [null] },
              updatedAt: { $gte: last30Start, $lt: tomorrowStart },
            },
          ],
        },
      },
      {
        $addFields: {
          payDate: { $ifNull: ["$paidAt", "$updatedAt"] },
          ticketCents: { $ifNull: ["$totalCents", "$amountCents"] },
        },
      },
      {
        $group: {
          _id: { $dateTrunc: { date: "$payDate", unit: "day", timezone: tz } },
          avgCents: { $avg: "$ticketCents" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const ticketMap = new Map(
      (ticketAgg || []).map((row) => [
        formatYMD(row._id, tz),
        Number(row.avgCents),
      ]),
    );

    const last30Ticket = [];
    for (let i = 0; i < 30; i++) {
      const d = addDays(last30Start, i);
      const key = formatYMD(d, tz);
      const avgCents = ticketMap.get(key);
      last30Ticket.push({
        date: key,
        avgTicket: Number.isFinite(avgCents) ? round2(avgCents / 100) : null,
      });
    }

    // 3) paymentDist: AGRUPA por offer.status (default PUBLIC) usando createdAt
    async function distForRange(start, end) {
      const rows = await Offer.aggregate([
        { $match: { ...baseMatch, createdAt: { $gte: start, $lt: end } } },

        // pega APENAS o status da offer
        { $project: { statusRaw: "$status" } },

        // normaliza: trim + upper + default PUBLIC quando null/vazio
        {
          $addFields: {
            status: {
              $toUpper: {
                $trim: {
                  input: { $ifNull: ["$statusRaw", "PUBLIC"] },
                },
              },
            },
          },
        },
        {
          $addFields: {
            status: { $cond: [{ $eq: ["$status", ""] }, "PUBLIC", "$status"] },
          },
        },

        // normaliza variação de cancelamento
        {
          $addFields: {
            status: {
              $cond: [{ $eq: ["$status", "CANCELED"] }, "CANCELLED", "$status"],
            },
          },
        },

        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $project: { _id: 0, status: "$_id", count: 1 } },
      ]);

      return (rows || []).map((r) => ({
        status: String(r.status || "PUBLIC").toUpperCase(),
        count: Number(r.count) || 0,
      }));
    }

    const [distToday, distLast7, distLast30] = await Promise.all([
      distForRange(todayStart, tomorrowStart),
      distForRange(last7Start, tomorrowStart),
      distForRange(last30Start, tomorrowStart),
    ]);

    return res.json({
      ok: true,
      monthDaily,
      last30Ticket,
      paymentDist: { today: distToday, last7: distLast7, last30: distLast30 },
    });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, error: e?.message || "Falha ao carregar analytics." });
  }
});

export default r;
