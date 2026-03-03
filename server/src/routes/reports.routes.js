// server/src/routes/reports.routes.js
import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ensureAuth, tenantFromUser } from "../middleware/auth.js";
import { Offer } from "../models/Offer.js";

const r = Router();

const MAX_DAYS = Number(process.env.REPORTS_MAX_DAYS || 365);
const PAID_SET = ["PAID", "CONFIRMED"];

function parseYMD(s) {
  const v = String(s || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return v;
}

function rangeInSaoPaulo(fromYMD, toYMD) {
  // intervalo inclusivo no calendário: [from 00:00 -03:00, to+1 00:00 -03:00)
  const start = new Date(`${fromYMD}T00:00:00-03:00`);
  const end0 = new Date(`${toYMD}T00:00:00-03:00`);
  const end = new Date(end0.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function daysBetween(a, b) {
  const ms = b.getTime() - a.getTime();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

function buildTenantMatch(req) {
  const tenantId = req.tenantId;
  const userId = req.user?._id;

  const m = { workspaceId: tenantId };
  if (userId) m.ownerUserId = userId;
  return m;
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

// Auth + tenant
r.use(ensureAuth, tenantFromUser);

r.get(
  "/reports/summary",
  asyncHandler(async (req, res) => {
    const fromYMD = parseYMD(req.query.from);
    const toYMD = parseYMD(req.query.to);
    const type = String(req.query.type || "all");
    const onlyPaid = String(req.query.onlyPaid || "1") === "1";

    if (!fromYMD || !toYMD) {
      return res
        .status(400)
        .json({ ok: false, error: "Parâmetros from/to inválidos" });
    }

    const { start, end } = rangeInSaoPaulo(fromYMD, toYMD);
    const days = daysBetween(start, end);
    if (days > MAX_DAYS + 1) {
      return res.status(400).json({
        ok: false,
        error: `Período máximo excedido (${MAX_DAYS} dias)`,
      });
    }

    const tenantMatch = buildTenantMatch(req);
    const typeMatch = buildTypeMatch(type);

    const pipeline = [
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
    ];

    const out = await Offer.aggregate(pipeline).allowDiskUse(true);
    const s = out?.[0] || {
      paidRevenueCents: 0,
      paidCount: 0,
      createdCount: 0,
      avgTicketCents: 0,
      conversionPct: 0,
    };

    // onlyPaid afeta apenas tabelas/exports no front; KPIs seguem o filtro do endpoint (pagos sempre calculados por isPaid)
    // createdCount sempre é "emitidas" (createdAt range). paidCount/revenue sempre pagos no range.
    // Se o usuário selecionar "Todos", ele vai enxergar transações adicionais na tabela (endpoint /transactions).
    res.json({ ok: true, summary: s, onlyPaid });
  }),
);

r.get(
  "/reports/revenue-daily",
  asyncHandler(async (req, res) => {
    const fromYMD = parseYMD(req.query.from);
    const toYMD = parseYMD(req.query.to);
    const type = String(req.query.type || "all");

    if (!fromYMD || !toYMD) {
      return res
        .status(400)
        .json({ ok: false, error: "Parâmetros from/to inválidos" });
    }

    const { start, end } = rangeInSaoPaulo(fromYMD, toYMD);
    if (daysBetween(start, end) > MAX_DAYS + 1) {
      return res
        .status(400)
        .json({
          ok: false,
          error: `Período máximo excedido (${MAX_DAYS} dias)`,
        });
    }

    const tenantMatch = buildTenantMatch(req);
    const typeMatch = buildTypeMatch(type);

    const pipeline = [
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
    ];

    const items = await Offer.aggregate(pipeline).allowDiskUse(true);
    res.json({ ok: true, items });
  }),
);

r.get(
  "/reports/created-vs-paid-daily",
  asyncHandler(async (req, res) => {
    const fromYMD = parseYMD(req.query.from);
    const toYMD = parseYMD(req.query.to);
    const type = String(req.query.type || "all");

    if (!fromYMD || !toYMD) {
      return res
        .status(400)
        .json({ ok: false, error: "Parâmetros from/to inválidos" });
    }

    const { start, end } = rangeInSaoPaulo(fromYMD, toYMD);
    if (daysBetween(start, end) > MAX_DAYS + 1) {
      return res
        .status(400)
        .json({
          ok: false,
          error: `Período máximo excedido (${MAX_DAYS} dias)`,
        });
    }

    const tenantMatch = buildTenantMatch(req);
    const typeMatch = buildTypeMatch(type);

    const pipeline = [
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
    ];

    const out = await Offer.aggregate(pipeline).allowDiskUse(true);
    const created = out?.[0]?.created || [];
    const paid = out?.[0]?.paid || [];

    const map = new Map();
    for (const c of created)
      map.set(c.date, {
        date: c.date,
        createdCount: c.createdCount || 0,
        paidCount: 0,
      });
    for (const p of paid) {
      const cur = map.get(p.date) || {
        date: p.date,
        createdCount: 0,
        paidCount: 0,
      };
      cur.paidCount = p.paidCount || 0;
      map.set(p.date, cur);
    }

    const items = Array.from(map.values()).sort((a, b) =>
      String(a.date).localeCompare(String(b.date)),
    );
    res.json({ ok: true, items });
  }),
);

r.get(
  "/reports/top-clients",
  asyncHandler(async (req, res) => {
    const fromYMD = parseYMD(req.query.from);
    const toYMD = parseYMD(req.query.to);
    const type = String(req.query.type || "all");
    const onlyPaid = String(req.query.onlyPaid || "1") === "1";

    if (!fromYMD || !toYMD) {
      return res
        .status(400)
        .json({ ok: false, error: "Parâmetros from/to inválidos" });
    }

    const { start, end } = rangeInSaoPaulo(fromYMD, toYMD);
    if (daysBetween(start, end) > MAX_DAYS + 1) {
      return res
        .status(400)
        .json({
          ok: false,
          error: `Período máximo excedido (${MAX_DAYS} dias)`,
        });
    }

    const tenantMatch = buildTenantMatch(req);
    const typeMatch = buildTypeMatch(type);

    const pipeline = [
      { $match: { ...tenantMatch, ...typeMatch } },
      addPaidFieldsStage(),
      ...(onlyPaid
        ? [{ $match: { isPaid: true, paidDate: { $gte: start, $lt: end } } }]
        : [{ $match: { paidDate: { $gte: start, $lt: end } } }]),
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
    ];

    const items = await Offer.aggregate(pipeline).allowDiskUse(true);
    res.json({ ok: true, items });
  }),
);

r.get(
  "/reports/top-items",
  asyncHandler(async (req, res) => {
    const fromYMD = parseYMD(req.query.from);
    const toYMD = parseYMD(req.query.to);
    const type = String(req.query.type || "all");
    const onlyPaid = String(req.query.onlyPaid || "1") === "1";

    if (!fromYMD || !toYMD) {
      return res
        .status(400)
        .json({ ok: false, error: "Parâmetros from/to inválidos" });
    }

    const { start, end } = rangeInSaoPaulo(fromYMD, toYMD);
    if (daysBetween(start, end) > MAX_DAYS + 1) {
      return res
        .status(400)
        .json({
          ok: false,
          error: `Período máximo excedido (${MAX_DAYS} dias)`,
        });
    }

    const tenantMatch = buildTenantMatch(req);
    const typeMatch = buildTypeMatch(type);

    const pipeline = [
      { $match: { ...tenantMatch, ...typeMatch } },
      addPaidFieldsStage(),
      ...(onlyPaid
        ? [{ $match: { isPaid: true, paidDate: { $gte: start, $lt: end } } }]
        : [{ $match: { paidDate: { $gte: start, $lt: end } } }]),
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
    ];

    const items = await Offer.aggregate(pipeline).allowDiskUse(true);
    res.json({ ok: true, items });
  }),
);

r.get(
  "/reports/transactions",
  asyncHandler(async (req, res) => {
    const fromYMD = parseYMD(req.query.from);
    const toYMD = parseYMD(req.query.to);
    const type = String(req.query.type || "all");
    const onlyPaid = String(req.query.onlyPaid || "1") === "1";

    if (!fromYMD || !toYMD) {
      return res
        .status(400)
        .json({ ok: false, error: "Parâmetros from/to inválidos" });
    }

    const { start, end } = rangeInSaoPaulo(fromYMD, toYMD);
    if (daysBetween(start, end) > MAX_DAYS + 1) {
      return res
        .status(400)
        .json({
          ok: false,
          error: `Período máximo excedido (${MAX_DAYS} dias)`,
        });
    }

    const tenantMatch = buildTenantMatch(req);
    const typeMatch = buildTypeMatch(type);

    const pipeline = [
      { $match: { ...tenantMatch, ...typeMatch } },
      addPaidFieldsStage(),
      ...(onlyPaid
        ? [{ $match: { isPaid: true, paidDate: { $gte: start, $lt: end } } }]
        : [{ $match: { paidDate: { $gte: start, $lt: end } } }]),
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
      { $limit: 200 },
    ];

    const items = await Offer.aggregate(pipeline).allowDiskUse(true);
    res.json({ ok: true, items });
  }),
);

r.get(
  "/reports/export.csv",
  asyncHandler(async (req, res) => {
    // mesma lógica do /transactions, mas retorna CSV
    const fromYMD = parseYMD(req.query.from);
    const toYMD = parseYMD(req.query.to);
    const type = String(req.query.type || "all");
    const onlyPaid = String(req.query.onlyPaid || "1") === "1";

    if (!fromYMD || !toYMD) {
      return res
        .status(400)
        .json({ ok: false, error: "Parâmetros from/to inválidos" });
    }

    const { start, end } = rangeInSaoPaulo(fromYMD, toYMD);
    if (daysBetween(start, end) > MAX_DAYS + 1) {
      return res
        .status(400)
        .json({
          ok: false,
          error: `Período máximo excedido (${MAX_DAYS} dias)`,
        });
    }

    const tenantMatch = buildTenantMatch(req);
    const typeMatch = buildTypeMatch(type);

    const pipeline = [
      { $match: { ...tenantMatch, ...typeMatch } },
      addPaidFieldsStage(),
      ...(onlyPaid
        ? [{ $match: { isPaid: true, paidDate: { $gte: start, $lt: end } } }]
        : [{ $match: { paidDate: { $gte: start, $lt: end } } }]),
      {
        $project: {
          _id: 0,
          date: dateToStringDayExpr("$paidDate"),
          customer: "$customerName",
          title: "$title",
          status: "$status",
          paymentStatus: "$paymentStatus",
          paidAmountCents: "$paidCents",
          publicToken: "$publicToken",
        },
      },
      { $sort: { date: -1 } },
      { $limit: 2000 },
    ];

    const rows = await Offer.aggregate(pipeline).allowDiskUse(true);

    const headers = [
      "date",
      "customer",
      "title",
      "status",
      "paymentStatus",
      "paidAmountCents",
      "publicToken",
    ];

    function csvEscape(v) {
      const s = String(v ?? "");
      if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    }

    const lines = [headers.join(",")];
    for (const r0 of rows) {
      lines.push(headers.map((h) => csvEscape(r0[h])).join(","));
    }

    const csv = lines.join("\n");
    const filename = `relatorios_${fromYMD}_a_${toYMD}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  }),
);

r.get(
  "/reports/export.pdf",
  asyncHandler(async (_req, res) => {
    // MVP sem dependência nova: mantém rota, mas retorna "em breve"
    res.status(501).json({ ok: false, error: "Exportação PDF em breve" });
  }),
);

export default r;

/*
Índices recomendados (se ainda não existirem):
- { workspaceId: 1, ownerUserId: 1, createdAt: -1 }
- { workspaceId: 1, ownerUserId: 1, paidAt: -1 }
- { workspaceId: 1, ownerUserId: 1, paymentStatus: 1 }
*/
