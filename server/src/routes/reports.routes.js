// server/src/routes/reports.routes.js
import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ensureAuth, tenantFromUser } from "../middleware/auth.js";
import { Offer } from "../models/Offer.js";
import { User } from "../models/User.js";
import {
  buildFeedbackReportsDashboard,
  buildFeedbackSummary,
} from "../services/feedbackReports.service.js";
import { buildGeneralReportsSnapshot } from "../services/generalReports.service.js";
import { buildMyPageAnalyticsReport } from "../services/myPageAnalytics.service.js";
import {
  buildGeneralReportPdfBuffer,
  buildRecurringReportPdfBuffer,
} from "../services/reportPdf.service.js";
import { buildRecurringReportsDashboard } from "../services/recurringReports.service.js";
import {
  assertWorkspaceModuleAccess,
} from "../utils/workspaceAccess.js";
import { resolveWorkspaceOwnerScope } from "../utils/workspaceOwnerScope.js";

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

function formatSaoPauloYMD(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDaysToYMD(ymd, days) {
  const base = new Date(`${ymd}T12:00:00-03:00`);
  base.setDate(base.getDate() + Number(days || 0));
  return formatSaoPauloYMD(base);
}

function resolveMyPageAnalyticsRange(rangeRaw, fromRaw, toRaw) {
  const range = String(rangeRaw || "30d").trim().toLowerCase();
  if (range === "custom") {
    const fromYMD = parseYMD(fromRaw);
    const toYMD = parseYMD(toRaw);
    if (!fromYMD || !toYMD) return null;
    return { range: "custom", fromYMD, toYMD };
  }

  const presetDays = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
  };
  const days = presetDays[range] || presetDays["30d"];
  const toYMD = formatSaoPauloYMD(new Date());
  const fromYMD = addDaysToYMD(toYMD, -(days - 1));
  return {
    range: presetDays[range] ? range : "30d",
    fromYMD,
    toYMD,
  };
}

async function buildTenantScope(req, options = {}) {
  const scopeInfo = await resolveWorkspaceOwnerScope({
    user: req.user,
    workspaceId: req.tenantId,
    workspacePlan: req.user?.workspacePlan || "start",
    workspaceOwnerUserId: req.user?.workspaceOwnerUserId || null,
    scopeRaw: req.query.scope,
    ownerUserIdRaw: req.query.ownerUserId,
    defaultOwnerScope: options.defaultOwnerScope || "mine",
    forbiddenMessage:
      options.forbiddenMessage ||
      "Somente o dono do workspace pode visualizar os relatorios da equipe.",
    forbiddenCode: options.forbiddenCode || "WORKSPACE_REPORTS_SCOPE_FORBIDDEN",
  });

  const tenantMatch = { workspaceId: req.tenantId };
  if (scopeInfo.ownerUserId) tenantMatch.ownerUserId = scopeInfo.ownerUserId;

  return { scopeInfo, tenantMatch };
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

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[,"\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function formatRecurringPortfolioCsvRows(dashboard) {
  const rows = Array.isArray(dashboard?.portfolio) ? dashboard.portfolio : [];
  return rows.map((item) => ({
    recurringName: item?.recurringName || "",
    customerName: item?.customerName || "",
    recurringStatus: item?.recurringStatus || "",
    generatedCount: Number(item?.generatedCount || 0),
    paidCount: Number(item?.paidCount || 0),
    pendingCount: Number(item?.pendingCount || 0),
    overdueCount: Number(item?.overdueCount || 0),
    overdueAmountCents: Number(item?.overdueAmountCents || 0),
    awaitingConfirmationCount: Number(item?.awaitingConfirmationCount || 0),
    lastPaidAt: item?.lastPaidAt || "",
    nextDueAt: item?.nextDueAt || "",
    lastReminderAt: item?.lastReminderAt || "",
  }));
}

// Auth + tenant
r.use(ensureAuth, tenantFromUser);
r.use((req, _res, next) => {
  try {
    assertWorkspaceModuleAccess({
      user: req.user,
      workspacePlan: req.user?.workspacePlan,
      workspaceOwnerUserId: req.user?.workspaceOwnerUserId,
      moduleKey: "reports",
    });
    next();
  } catch (error) {
    next(error);
  }
});

r.get(
  "/reports/recurring/dashboard",
  asyncHandler(async (req, res) => {
    const fromYMD = parseYMD(req.query.from);
    const toYMD = parseYMD(req.query.to);
    const type = String(req.query.type || "all");
    const recurringStatus = String(req.query.recurringStatus || "all");

    if (!fromYMD || !toYMD) {
      return res
        .status(400)
        .json({ ok: false, error: "Parametros from/to invalidos" });
    }

    const { start, end } = rangeInSaoPaulo(fromYMD, toYMD);
    const days = daysBetween(start, end);
    if (days > MAX_DAYS + 1) {
      return res.status(400).json({
        ok: false,
        error: `Periodo maximo excedido (${MAX_DAYS} dias)`,
      });
    }

    const { scopeInfo } = await buildTenantScope(req);

    const dashboard = await buildRecurringReportsDashboard({
      tenantId: req.tenantId,
      userId: scopeInfo.ownerUserId || null,
      fromYMD,
      toYMD,
      type,
      recurringStatus,
      start,
      end,
      delinquentClientsLimit: 1000,
      portfolioLimit: 5000,
    });

    res.json({ ok: true, scope: scopeInfo.appliedScope, ...dashboard });
  }),
);

r.get(
  "/reports/recurring/export.csv",
  asyncHandler(async (req, res) => {
    const fromYMD = parseYMD(req.query.from);
    const toYMD = parseYMD(req.query.to);
    const type = String(req.query.type || "all");
    const recurringStatus = String(req.query.recurringStatus || "all");

    if (!fromYMD || !toYMD) {
      return res
        .status(400)
        .json({ ok: false, error: "Parametros from/to invalidos" });
    }

    const { start, end } = rangeInSaoPaulo(fromYMD, toYMD);
    const days = daysBetween(start, end);
    if (days > MAX_DAYS + 1) {
      return res.status(400).json({
        ok: false,
        error: `Periodo maximo excedido (${MAX_DAYS} dias)`,
      });
    }

    const { scopeInfo } = await buildTenantScope(req);

    const dashboard = await buildRecurringReportsDashboard({
      tenantId: req.tenantId,
      userId: scopeInfo.ownerUserId || null,
      fromYMD,
      toYMD,
      type,
      recurringStatus,
      start,
      end,
      delinquentClientsLimit: 1000,
      portfolioLimit: 5000,
    });

    const headers = [
      "recurringName",
      "customerName",
      "recurringStatus",
      "generatedCount",
      "paidCount",
      "pendingCount",
      "overdueCount",
      "overdueAmountCents",
      "awaitingConfirmationCount",
      "lastPaidAt",
      "nextDueAt",
      "lastReminderAt",
    ];
    const rows = formatRecurringPortfolioCsvRows(dashboard);
    const lines = [headers.join(",")];

    for (const row of rows) {
      lines.push(headers.map((header) => csvEscape(row[header])).join(","));
    }

    const filename = `relatorios_recorrencia_${fromYMD}_a_${toYMD}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(lines.join("\n"));
  }),
);

r.get(
  "/reports/recurring/export.pdf",
  asyncHandler(async (req, res) => {
    const fromYMD = parseYMD(req.query.from);
    const toYMD = parseYMD(req.query.to);
    const type = String(req.query.type || "all");
    const recurringStatus = String(req.query.recurringStatus || "all");

    if (!fromYMD || !toYMD) {
      return res
        .status(400)
        .json({ ok: false, error: "Parametros from/to invalidos" });
    }

    const { start, end } = rangeInSaoPaulo(fromYMD, toYMD);
    const days = daysBetween(start, end);
    if (days > MAX_DAYS + 1) {
      return res.status(400).json({
        ok: false,
        error: `Periodo maximo excedido (${MAX_DAYS} dias)`,
      });
    }

    const { scopeInfo } = await buildTenantScope(req);

    const dashboard = await buildRecurringReportsDashboard({
      tenantId: req.tenantId,
      userId: scopeInfo.ownerUserId || null,
      fromYMD,
      toYMD,
      type,
      recurringStatus,
      start,
      end,
    });

    const pdf = buildRecurringReportPdfBuffer(dashboard);
    const filename = `relatorios_recorrencia_${fromYMD}_a_${toYMD}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(pdf);
  }),
);

r.get(
  "/reports/feedback/dashboard",
  asyncHandler(async (req, res) => {
    const fromYMD = parseYMD(req.query.from);
    const toYMD = parseYMD(req.query.to);
    const type = String(req.query.type || "all");

    if (!fromYMD || !toYMD) {
      return res
        .status(400)
        .json({ ok: false, error: "Parametros from/to invalidos" });
    }

    const { start, end } = rangeInSaoPaulo(fromYMD, toYMD);
    const days = daysBetween(start, end);
    if (days > MAX_DAYS + 1) {
      return res.status(400).json({
        ok: false,
        error: `Periodo maximo excedido (${MAX_DAYS} dias)`,
      });
    }

    const { scopeInfo } = await buildTenantScope(req);

    const dashboard = await buildFeedbackReportsDashboard({
      tenantId: req.tenantId,
      userId: scopeInfo.ownerUserId || null,
      fromYMD,
      toYMD,
      type,
      start,
      end,
    });

    res.json({ ok: true, scope: scopeInfo.appliedScope, ...dashboard });
  }),
);

r.get(
  "/reports/my-page/analytics",
  asyncHandler(async (req, res) => {
    const resolvedRange = resolveMyPageAnalyticsRange(
      req.query.range,
      req.query.from,
      req.query.to,
    );

    if (!resolvedRange) {
      return res
        .status(400)
        .json({ ok: false, error: "Parametros de periodo invalidos" });
    }

    const { range, fromYMD, toYMD } = resolvedRange;
    const { start, end } = rangeInSaoPaulo(fromYMD, toYMD);
    const days = daysBetween(start, end);
    if (days > MAX_DAYS + 1) {
      return res.status(400).json({
        ok: false,
        error: `Periodo maximo excedido (${MAX_DAYS} dias)`,
      });
    }

    const pageId = String(req.query.pageId || "all").trim() || "all";
    const { scopeInfo } = await buildTenantScope(req);
    const report = await buildMyPageAnalyticsReport({
      tenantId: req.tenantId,
      ownerUserId: scopeInfo.ownerUserId || null,
      start,
      end,
      pageId,
    });

    res.json({
      ok: true,
      scope: scopeInfo.appliedScope,
      range,
      from: fromYMD,
      to: toYMD,
      ...report,
    });
  }),
);

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

    const { scopeInfo, tenantMatch } = await buildTenantScope(req);
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

    const [out, feedbackSummary] = await Promise.all([
      Offer.aggregate(pipeline).allowDiskUse(true),
      buildFeedbackSummary({
        tenantId: req.tenantId,
        userId: scopeInfo.ownerUserId || null,
        start,
        end,
        type,
      }),
    ]);
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
    res.json({
      ok: true,
      scope: scopeInfo.appliedScope,
      summary: s,
      feedbackSummary,
      onlyPaid,
    });
  }),
);

r.get(
  "/reports/performance-by-user",
  asyncHandler(async (req, res) => {
    const fromYMD = parseYMD(req.query.from);
    const toYMD = parseYMD(req.query.to);
    const type = String(req.query.type || "all");

    if (!fromYMD || !toYMD) {
      return res
        .status(400)
        .json({ ok: false, error: "ParÃ¢metros from/to invÃ¡lidos" });
    }

    const { start, end } = rangeInSaoPaulo(fromYMD, toYMD);
    const days = daysBetween(start, end);
    if (days > MAX_DAYS + 1) {
      return res.status(400).json({
        ok: false,
        error: `PerÃ­odo mÃ¡ximo excedido (${MAX_DAYS} dias)`,
      });
    }

    const { scopeInfo, tenantMatch } = await buildTenantScope(req);
    const typeMatch = buildTypeMatch(type);

    const rows = await Offer.aggregate([
      { $match: { ...tenantMatch, ...typeMatch } },
      addPaidFieldsStage(),
      {
        $group: {
          _id: "$ownerUserId",
          createdCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ["$createdAt", start] },
                    { $lt: ["$createdAt", end] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          paidCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$isPaid", true] },
                    { $gte: ["$paidDate", start] },
                    { $lt: ["$paidDate", end] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          paidRevenueCents: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$isPaid", true] },
                    { $gte: ["$paidDate", start] },
                    { $lt: ["$paidDate", end] },
                  ],
                },
                "$paidCents",
                0,
              ],
            },
          },
        },
      },
    ]).allowDiskUse(true);

    let users = [];
    if (scopeInfo.ownerUserId) {
      users = await User.find({
        _id: scopeInfo.ownerUserId,
        workspaceId: req.tenantId,
      })
        .select("_id name status")
        .lean();
    } else if (scopeInfo.appliedScope === "workspace") {
      users = await User.find({ workspaceId: req.tenantId })
        .select("_id name status")
        .sort({ role: 1, name: 1 })
        .lean();
    } else {
      users = await User.find({
        _id: req.user?._id,
        workspaceId: req.tenantId,
      })
        .select("_id name status")
        .lean();
    }

    const metricsByUser = new Map(
      (rows || []).map((row) => [
        String(row._id || ""),
        {
          createdCount: Number(row.createdCount || 0),
          paidCount: Number(row.paidCount || 0),
          paidRevenueCents: Number(row.paidRevenueCents || 0),
        },
      ]),
    );

    const items = (users || [])
      .map((user) => {
        const metrics = metricsByUser.get(String(user._id)) || {
          createdCount: 0,
          paidCount: 0,
          paidRevenueCents: 0,
        };
        const conversionPct =
          metrics.createdCount > 0
            ? Math.round((metrics.paidCount / metrics.createdCount) * 10000) /
              100
            : 0;

        return {
          ownerUserId: user._id,
          responsibleUser: {
            _id: user._id,
            name: user.name || "",
            status: user.status || "active",
          },
          createdCount: metrics.createdCount,
          paidCount: metrics.paidCount,
          paidRevenueCents: metrics.paidRevenueCents,
          conversionPct,
        };
      })
      .sort(
        (a, b) =>
          b.paidRevenueCents - a.paidRevenueCents ||
          b.paidCount - a.paidCount ||
          b.createdCount - a.createdCount ||
          String(a?.responsibleUser?.name || "").localeCompare(
            String(b?.responsibleUser?.name || ""),
            "pt-BR",
          ),
      );

    res.json({ ok: true, scope: scopeInfo.appliedScope, items });
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

    const { tenantMatch } = await buildTenantScope(req);
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

    const { tenantMatch } = await buildTenantScope(req);
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

    const { tenantMatch } = await buildTenantScope(req);
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

    const { tenantMatch } = await buildTenantScope(req);
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

    const { tenantMatch } = await buildTenantScope(req);
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

    const { tenantMatch } = await buildTenantScope(req);
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
  "/reports/export.pdf-legacy",
  asyncHandler(async (req, res) => {
    // MVP sem dependência nova: mantém rota, mas retorna "em breve"
    res.status(501).json({ ok: false, error: "Exportação PDF em breve" });
  }),
);

r.get(
  "/reports/export.pdf",
  asyncHandler(async (req, res) => {
    const fromYMD = parseYMD(req.query.from);
    const toYMD = parseYMD(req.query.to);
    const type = String(req.query.type || "all");
    const onlyPaid = String(req.query.onlyPaid || "1") === "1";

    if (!fromYMD || !toYMD) {
      return res
        .status(400)
        .json({ ok: false, error: "ParÃ¢metros from/to invÃ¡lidos" });
    }

    const { start, end } = rangeInSaoPaulo(fromYMD, toYMD);
    if (daysBetween(start, end) > MAX_DAYS + 1) {
      return res.status(400).json({
        ok: false,
        error: `PerÃ­odo mÃ¡ximo excedido (${MAX_DAYS} dias)`,
      });
    }

    const { scopeInfo } = await buildTenantScope(req);

    const snapshot = await buildGeneralReportsSnapshot({
      tenantId: req.tenantId,
      userId: scopeInfo.ownerUserId || null,
      fromYMD,
      toYMD,
      start,
      end,
      type,
      onlyPaid,
      transactionsLimit: 2000,
    });

    const pdf = buildGeneralReportPdfBuffer(snapshot);
    const filename = `relatorios_${fromYMD}_a_${toYMD}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(pdf);
  }),
);

export default r;

/*
Índices recomendados (se ainda não existirem):
- { workspaceId: 1, ownerUserId: 1, createdAt: -1 }
- { workspaceId: 1, ownerUserId: 1, paidAt: -1 }
- { workspaceId: 1, ownerUserId: 1, paymentStatus: 1 }
*/
