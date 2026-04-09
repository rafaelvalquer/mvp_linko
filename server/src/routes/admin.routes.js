import { Router } from "express";
import mongoose from "mongoose";

import { asyncHandler } from "../utils/asyncHandler.js";
import { ensureAuth, ensureMasterAdmin } from "../middleware/auth.js";
import { Workspace } from "../models/Workspace.js";
import { User } from "../models/User.js";
import { Client } from "../models/Client.js";
import { AppSettings } from "../models/AppSettings.js";
import { Offer } from "../models/Offer.js";
import { MessageLog } from "../models/MessageLog.js";
import { WhatsAppOutbox } from "../models/WhatsAppOutbox.js";
import { WhatsAppCommandSession } from "../models/WhatsAppCommandSession.js";
import OfferReminderLog from "../models/OfferReminderLog.js";
import { getSystemHealthSnapshot, getSystemServicesStatus } from "../services/systemStatus.service.js";
import { resolveWorkspaceNotificationContext } from "../services/notificationSettings.js";
import { getWhatsAppGatewayMonitorSnapshot } from "../services/waGateway.js";
import { isMasterAdminEmail } from "../utils/masterAdmin.js";
import { deleteWorkspaceAccountForAdmin } from "../services/admin/deleteWorkspaceAccount.service.js";

const r = Router();

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function clampInt(value, fallback, { min = 1, max = MAX_LIMIT } = {}) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function parsePagination(query = {}) {
  const page = clampInt(query.page, 1, { min: 1, max: 100000 });
  const limit = clampInt(query.limit, DEFAULT_LIMIT, {
    min: 1,
    max: MAX_LIMIT,
  });

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

function buildPagination(total, page, limit) {
  const normalizedTotal = Number(total || 0);
  return {
    page,
    limit,
    total: normalizedTotal,
    totalPages: normalizedTotal > 0 ? Math.ceil(normalizedTotal / limit) : 0,
  };
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildRegex(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  return new RegExp(escapeRegex(normalized), "i");
}

function parseObjectId(value) {
  const normalized = String(value || "").trim();
  if (!normalized || !mongoose.isValidObjectId(normalized)) return null;
  return new mongoose.Types.ObjectId(normalized);
}

function parseDateBoundary(value, { endOfDay = false } = {}) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const date = new Date(isDateOnly ? `${raw}T00:00:00.000Z` : raw);
  if (Number.isNaN(date.getTime())) return null;

  if (endOfDay && isDateOnly) {
    return new Date(date.getTime() + 24 * 60 * 60 * 1000);
  }

  return date;
}

function buildCreatedAtRange({ dateFrom, dateTo }) {
  const from = parseDateBoundary(dateFrom);
  const to = parseDateBoundary(dateTo, { endOfDay: true });
  const range = {};

  if (from) range.$gte = from;
  if (to) range.$lt = to;

  return Object.keys(range).length ? range : null;
}

function reduceStatusCounts(rows = []) {
  return rows.reduce((acc, row) => {
    const key = String(row?._id || "").trim();
    if (!key) return acc;
    acc[key] = Number(row?.count || 0);
    return acc;
  }, {});
}

function buildMessagePreview(message, max = 120) {
  const compact = String(message || "").replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max)}...`;
}

function serializeWorkspaceSummary(workspace) {
  if (!workspace) return null;
  return {
    _id: workspace._id,
    name: workspace.name,
    slug: workspace.slug,
    plan: workspace.plan,
    planStatus: workspace.planStatus,
  };
}

function serializeOwner(owner) {
  if (!owner) return null;
  return {
    _id: owner._id,
    name: owner.name,
    email: owner.email,
    status: owner.status,
  };
}

function buildWorkspaceSearchPipeline(searchRegex, { plan, subscriptionStatus } = {}) {
  const pipeline = [
    {
      $lookup: {
        from: "users",
        let: { ownerUserId: "$ownerUserId" },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$ownerUserId"] } } },
          { $project: { _id: 1, name: 1, email: 1, status: 1 } },
        ],
        as: "ownerRows",
      },
    },
    {
      $addFields: {
        owner: { $ifNull: [{ $arrayElemAt: ["$ownerRows", 0] }, null] },
      },
    },
  ];

  if (plan) {
    pipeline.push({ $match: { plan } });
  }

  if (subscriptionStatus) {
    pipeline.push({ $match: { "subscription.status": subscriptionStatus } });
  }

  if (searchRegex) {
    pipeline.push({
      $match: {
        $or: [
          { name: searchRegex },
          { slug: searchRegex },
          { "owner.name": searchRegex },
          { "owner.email": searchRegex },
        ],
      },
    });
  }

  return pipeline;
}

async function loadWorkspaceMap(workspaceIds = []) {
  const ids = Array.from(
    new Set(workspaceIds.map((item) => String(item || "")).filter(Boolean)),
  );
  if (!ids.length) return new Map();

  const rows = await Workspace.find({ _id: { $in: ids } })
    .select("_id name slug plan planStatus")
    .lean();

  return new Map(rows.map((row) => [String(row._id), row]));
}

function logAdminAudit(req) {
  console.log("[admin-audit]", {
    at: new Date().toISOString(),
    email: req.user?.email || "",
    method: req.method,
    path: req.originalUrl,
  });
}

function buildLastActivityAt(...values) {
  return values.reduce((latest, current) => {
    if (!current) return latest;
    const date = current instanceof Date ? current : new Date(current);
    if (Number.isNaN(date.getTime())) return latest;
    if (!latest) return date;
    return date.getTime() > latest.getTime() ? date : latest;
  }, null);
}

function mapCountRows(rows = []) {
  return rows
    .map((row) => ({
      key: String(row?._id || "").trim(),
      count: Number(row?.count || 0),
    }))
    .filter((row) => row.key)
    .sort((a, b) => b.count - a.count);
}

function serializeOutboxEntry(item) {
  if (!item) return null;
  return {
    _id: item._id,
    to: item.to,
    status: item.status,
    sourceType: item.sourceType || "",
    providerMessageId: item.providerMessageId || "",
    deliveryState: item.deliveryState || "",
    deliveryLastAckCode:
      item.deliveryLastAckCode == null
        ? null
        : Number(item.deliveryLastAckCode),
    deliveryLastAckAt: item.deliveryLastAckAt || null,
    deliveredAt: item.deliveredAt || null,
    readAt: item.readAt || null,
    playedAt: item.playedAt || null,
    messagePreview: buildMessagePreview(item.message),
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
    sentAt: item.sentAt || null,
    nextAttemptAt: item.nextAttemptAt || null,
    attempts: Number(item.attempts || 0),
    maxAttempts: Number(item.maxAttempts || 0),
    error: item.lastError || null,
    payload: item,
  };
}

function serializeMessageLogEntry(item) {
  if (!item) return null;
  return {
    _id: item._id,
    eventType: item.eventType || "",
    to: item.to || "",
    status: item.status || "",
    provider: item.provider || "",
    providerMessageId: item.providerMessageId || "",
    deliveryState: item.deliveryState || "",
    deliveryLastAckCode:
      item.deliveryLastAckCode == null
        ? null
        : Number(item.deliveryLastAckCode),
    deliveryLastAckAt: item.deliveryLastAckAt || null,
    deliveredAt: item.deliveredAt || null,
    readAt: item.readAt || null,
    playedAt: item.playedAt || null,
    messagePreview: buildMessagePreview(item.message),
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
    sentAt: item.sentAt || null,
    error: item.error || null,
    payload: item,
  };
}

function serializeSessionEntry(item) {
  if (!item) return null;
  return {
    _id: item._id,
    flowType: item.flowType || "",
    state: item.state || "",
    requesterPhoneDigits: item.requesterPhoneDigits || "",
    requesterPushName: item.requesterPushName || "",
    lastUserMessageText: item.lastUserMessageText || "",
    lastQuestionKey: item.lastQuestionKey || "",
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
    error: item.lastError || null,
    payload: item,
  };
}

function buildRecentErrorRows({
  sessionErrors = [],
  outboxFailures = [],
  messageLogFailures = [],
  reminderFailures = [],
}) {
  const rows = [];

  sessionErrors.forEach((item) => {
    rows.push({
      _id: `session:${item._id}`,
      origin: "agent_session",
      sourceLabel: "Agente",
      code: item?.lastError?.code || item?.state || "SESSION_ERROR",
      message:
        item?.lastError?.message ||
        "Sessao do agente terminou com erro.",
      summary:
        item?.lastError?.message ||
        `${item?.flowType || "fluxo"} em ${item?.state || "estado desconhecido"}`,
      occurredAt: item?.updatedAt || item?.createdAt || null,
      payload: item,
    });
  });

  outboxFailures.forEach((item) => {
    rows.push({
      _id: `outbox:${item._id}`,
      origin: "whatsapp_outbox",
      sourceLabel: "Outbox",
      code: item?.lastError?.code || "OUTBOX_FAILED",
      message: item?.lastError?.message || "Falha na fila do WhatsApp.",
      summary: `${item?.status || "failed"} • ${buildMessagePreview(item?.message, 90)}`,
      occurredAt: item?.updatedAt || item?.createdAt || null,
      payload: item,
    });
  });

  messageLogFailures.forEach((item) => {
    rows.push({
      _id: `message_log:${item._id}`,
      origin: "message_log",
      sourceLabel: "Message log",
      code: item?.error?.code || "MESSAGE_LOG_FAILED",
      message: item?.error?.message || "Falha ao registrar envio.",
      summary: `${item?.eventType || "evento"} • ${buildMessagePreview(item?.message, 90)}`,
      occurredAt: item?.updatedAt || item?.createdAt || null,
      payload: item,
    });
  });

  reminderFailures.forEach((item) => {
    rows.push({
      _id: `offer_reminder:${item._id}`,
      origin: "offer_reminder",
      sourceLabel: "Lembrete",
      code: item?.error?.code || "REMINDER_FAILED",
      message: item?.error?.message || "Falha no lembrete de pagamento.",
      summary: `${item?.kind || "manual"} • ${buildMessagePreview(item?.message, 90)}`,
      occurredAt: item?.updatedAt || item?.createdAt || null,
      payload: item,
    });
  });

  return rows
    .sort(
      (a, b) =>
        new Date(b?.occurredAt || 0).getTime() - new Date(a?.occurredAt || 0).getTime(),
    )
    .slice(0, 10);
}

r.use(ensureAuth, ensureMasterAdmin);
r.use((req, _res, next) => {
  logAdminAudit(req);
  next();
});

r.get(
  "/admin/overview",
  asyncHandler(async (_req, res) => {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      health,
      workspaceCount,
      userCount,
      clientCount,
      offerCount,
      messageLogCount,
      whatsappOutboxCount,
      outboxStatusRows,
      messageLogStatusRows,
      outboxFailures24h,
      messageLogFailures24h,
    ] = await Promise.all([
      getSystemHealthSnapshot(),
      Workspace.countDocuments({}),
      User.countDocuments({}),
      Client.countDocuments({}),
      Offer.countDocuments({}),
      MessageLog.countDocuments({}),
      WhatsAppOutbox.countDocuments({}),
      WhatsAppOutbox.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      MessageLog.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      WhatsAppOutbox.countDocuments({
        status: "failed",
        updatedAt: { $gte: last24Hours },
      }),
      MessageLog.countDocuments({
        status: "FAILED",
        updatedAt: { $gte: last24Hours },
      }),
    ]);

    const services = health.services.map((item) => ({
      id: item.id,
      status: item.status,
      summary: item.summary,
      updatedAt: item.updatedAt,
    }));

    res.json({
      ok: true,
      overview: {
        generatedAt: new Date().toISOString(),
        totals: {
          workspaces: workspaceCount,
          users: userCount,
          clients: clientCount,
          offers: offerCount,
          messageLogs: messageLogCount,
          whatsappOutbox: whatsappOutboxCount,
        },
        whatsapp: {
          outboxStatusCounts: reduceStatusCounts(outboxStatusRows),
          messageLogStatusCounts: reduceStatusCounts(messageLogStatusRows),
          failuresLast24h: {
            outbox: outboxFailures24h,
            messageLogs: messageLogFailures24h,
          },
          gateway: health.waGateway,
        },
        services,
        database: {
          mongo: health.mongo,
        },
      },
    });
  }),
);

r.get(
  "/admin/services",
  asyncHandler(async (_req, res) => {
    const items = await getSystemServicesStatus();
    res.json({ ok: true, items });
  }),
);

r.get(
  "/admin/whatsapp/gateway/monitor",
  asyncHandler(async (req, res) => {
    const eventsLimit = clampInt(req.query.eventsLimit, 100, {
      min: 1,
      max: 200,
    });

    const monitor = await getWhatsAppGatewayMonitorSnapshot({ eventsLimit });

    res.json({
      ok: true,
      monitor,
    });
  }),
);

r.get(
  "/admin/workspaces",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const searchRegex = buildRegex(req.query.search || req.query.q);
    const plan = String(req.query.plan || "").trim().toLowerCase() || null;
    const subscriptionStatus =
      String(req.query.subscriptionStatus || "")
        .trim()
        .toLowerCase() || null;

    const basePipeline = buildWorkspaceSearchPipeline(searchRegex, {
      plan,
      subscriptionStatus,
    });

    const countPipeline = [...basePipeline, { $count: "count" }];
    const itemsPipeline = [
      ...basePipeline,
      {
        $lookup: {
          from: "users",
          let: { workspaceId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$workspaceId", "$$workspaceId"] } } },
            { $count: "total" },
          ],
          as: "userCountRows",
        },
      },
      {
        $lookup: {
          from: "clients",
          let: { workspaceId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$workspaceId", "$$workspaceId"] } } },
            { $count: "total" },
          ],
          as: "clientCountRows",
        },
      },
      {
        $lookup: {
          from: "offers",
          let: { workspaceId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$workspaceId", "$$workspaceId"] } } },
            { $group: { _id: null, total: { $sum: 1 }, lastActivityAt: { $max: "$updatedAt" } } },
          ],
          as: "offerCountRows",
        },
      },
      {
        $addFields: {
          counts: {
            users: {
              $ifNull: [{ $arrayElemAt: ["$userCountRows.total", 0] }, 0],
            },
            clients: {
              $ifNull: [{ $arrayElemAt: ["$clientCountRows.total", 0] }, 0],
            },
            offers: {
              $ifNull: [{ $arrayElemAt: ["$offerCountRows.total", 0] }, 0],
            },
          },
          lastActivityAt: {
            $ifNull: [{ $arrayElemAt: ["$offerCountRows.lastActivityAt", 0] }, "$updatedAt"],
          },
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          name: 1,
          slug: 1,
          plan: 1,
          planStatus: 1,
          createdAt: 1,
          updatedAt: 1,
          lastActivityAt: 1,
          counts: 1,
          owner: 1,
          subscription: {
            status: "$subscription.status",
            currentPeriodStart: "$subscription.currentPeriodStart",
            currentPeriodEnd: "$subscription.currentPeriodEnd",
          },
        },
      },
    ];

    const [countRows, items] = await Promise.all([
      Workspace.aggregate(countPipeline),
      Workspace.aggregate(itemsPipeline),
    ]);

    const total = Number(countRows?.[0]?.count || 0);

    res.json({
      ok: true,
      items: items.map((item) => ({
        ...item,
        owner: serializeOwner(item.owner),
      })),
      pagination: buildPagination(total, page, limit),
    });
  }),
);

r.delete(
  "/admin/workspaces/:workspaceId/account",
  asyncHandler(async (req, res) => {
    const workspaceId = parseObjectId(req.params.workspaceId);
    if (!workspaceId) {
      return res.status(400).json({
        ok: false,
        error: "Workspace invalido.",
        code: "workspace_id_invalid",
      });
    }

    const workspace = await Workspace.findById(workspaceId)
      .select("_id name slug")
      .lean();

    if (!workspace) {
      return res.status(404).json({
        ok: false,
        error: "Workspace nao encontrado.",
        code: "workspace_not_found",
      });
    }

    const expectedSlug = String(workspace.slug || "").trim();
    const confirmationText = String(req.body?.confirmationText || "").trim();

    if (!expectedSlug) {
      return res.status(400).json({
        ok: false,
        error: "Workspace sem slug. Exclusao bloqueada.",
        code: "workspace_slug_missing",
      });
    }

    if (confirmationText !== expectedSlug) {
      return res.status(400).json({
        ok: false,
        error: "Digite o slug do workspace exatamente para confirmar a exclusao.",
        code: "workspace_delete_confirmation_mismatch",
      });
    }

    const accountDeletion = await deleteWorkspaceAccountForAdmin(workspaceId);

    if (!accountDeletion) {
      return res.status(404).json({
        ok: false,
        error: "Workspace nao encontrado.",
        code: "workspace_not_found",
      });
    }

    return res.json({
      ok: true,
      accountDeletion,
    });
  }),
);

r.get(
  "/admin/users",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const searchRegex = buildRegex(req.query.search || req.query.q);
    const workspaceId = parseObjectId(req.query.workspaceId);
    const status = String(req.query.status || "").trim().toLowerCase() || null;

    const query = {};
    if (workspaceId) query.workspaceId = workspaceId;
    if (status) query.status = status;
    if (searchRegex) {
      query.$or = [{ name: searchRegex }, { email: searchRegex }];
    }

    const [total, users] = await Promise.all([
      User.countDocuments(query),
      User.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("_id name email workspaceId role status createdAt")
        .lean(),
    ]);

    const workspaceMap = await loadWorkspaceMap(users.map((user) => user.workspaceId));

    res.json({
      ok: true,
      items: users.map((user) => ({
        ...user,
        isMasterAdmin: isMasterAdminEmail(user.email),
        workspace: serializeWorkspaceSummary(
          workspaceMap.get(String(user.workspaceId || "")),
        ),
      })),
      pagination: buildPagination(total, page, limit),
    });
  }),
);

r.get(
  "/admin/clients",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const searchRegex = buildRegex(req.query.search || req.query.q);
    const searchDigits = String(req.query.search || req.query.q || "").replace(/\D+/g, "");
    const workspaceId = parseObjectId(req.query.workspaceId);

    const query = {};
    if (workspaceId) query.workspaceId = workspaceId;
    if (searchRegex) {
      query.$or = [
        { fullName: searchRegex },
        { email: searchRegex },
        { clientId: searchRegex },
        { phone: searchRegex },
      ];

      if (searchDigits) {
        query.$or.push({ phoneDigits: new RegExp(escapeRegex(searchDigits), "i") });
      }
    }

    const [total, clients] = await Promise.all([
      Client.countDocuments(query),
      Client.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("_id workspaceId clientId fullName email phone createdAt")
        .lean(),
    ]);

    const workspaceMap = await loadWorkspaceMap(
      clients.map((client) => client.workspaceId),
    );

    res.json({
      ok: true,
      items: clients.map((client) => ({
        ...client,
        workspace: serializeWorkspaceSummary(
          workspaceMap.get(String(client.workspaceId || "")),
        ),
      })),
      pagination: buildPagination(total, page, limit),
    });
  }),
);

r.get(
  "/admin/whatsapp/outbox",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const searchRegex = buildRegex(req.query.search || req.query.q);
    const workspaceId = parseObjectId(req.query.workspaceId);
    const createdAtRange = buildCreatedAtRange(req.query);
    const status = String(req.query.status || "").trim().toLowerCase() || null;
    const sourceType = String(req.query.sourceType || "").trim() || null;

    const query = {};
    if (workspaceId) query.workspaceId = workspaceId;
    if (status) query.status = status;
    if (sourceType) query.sourceType = sourceType;
    if (createdAtRange) query.createdAt = createdAtRange;
    if (searchRegex) {
      query.$or = [
        { to: searchRegex },
        { message: searchRegex },
        { providerMessageId: searchRegex },
        { dedupeKey: searchRegex },
        { "lastError.message": searchRegex },
      ];
    }

    const [total, items] = await Promise.all([
      WhatsAppOutbox.countDocuments(query),
      WhatsAppOutbox.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(
          "_id workspaceId to message status attempts maxAttempts nextAttemptAt lockedAt providerMessageId deliveryState deliveryLastAckCode deliveryLastAckAt deliveredAt readAt playedAt lastError meta sourceType sourceId createdAt updatedAt sentAt",
        )
        .lean(),
    ]);

    const workspaceMap = await loadWorkspaceMap(items.map((item) => item.workspaceId));

    res.json({
      ok: true,
      items: items.map((item) => ({
        ...item,
        messagePreview: buildMessagePreview(item.message),
        workspace: serializeWorkspaceSummary(
          workspaceMap.get(String(item.workspaceId || "")),
        ),
      })),
      pagination: buildPagination(total, page, limit),
    });
  }),
);

r.get(
  "/admin/whatsapp/message-logs",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const searchRegex = buildRegex(req.query.search || req.query.q);
    const workspaceId = parseObjectId(req.query.workspaceId);
    const createdAtRange = buildCreatedAtRange(req.query);
    const status = String(req.query.status || "").trim().toUpperCase() || null;
    const eventType = String(req.query.eventType || "").trim() || null;

    const query = {};
    if (workspaceId) query.workspaceId = workspaceId;
    if (status) query.status = status;
    if (eventType) query.eventType = eventType;
    if (createdAtRange) query.createdAt = createdAtRange;
    if (searchRegex) {
      query.$or = [
        { to: searchRegex },
        { message: searchRegex },
        { eventType: searchRegex },
        { providerMessageId: searchRegex },
        { "error.message": searchRegex },
      ];
    }

    const [total, items] = await Promise.all([
      MessageLog.countDocuments(query),
      MessageLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(
          "_id workspaceId offerId bookingId eventType channel provider to message status providerMessageId deliveryState deliveryLastAckCode deliveryLastAckAt deliveredAt readAt playedAt error sentAt createdAt updatedAt",
        )
        .lean(),
    ]);

    const workspaceMap = await loadWorkspaceMap(items.map((item) => item.workspaceId));

    res.json({
      ok: true,
      items: items.map((item) => ({
        ...item,
        messagePreview: buildMessagePreview(item.message),
        workspace: serializeWorkspaceSummary(
          workspaceMap.get(String(item.workspaceId || "")),
        ),
      })),
      pagination: buildPagination(total, page, limit),
    });
  }),
);

r.get(
  "/admin/tenants/:workspaceId/diagnostics",
  asyncHandler(async (req, res) => {
    const workspaceId = parseObjectId(req.params.workspaceId);
    if (!workspaceId) {
      return res.status(400).json({
        ok: false,
        error: "workspace_id_invalid",
        message: "Workspace invalido.",
      });
    }

    const days = clampInt(req.query.days, 7, { min: 1, max: 30 });
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const workspace = await Workspace.findById(workspaceId)
      .select(
        "_id name slug ownerUserId plan planStatus createdAt updatedAt payoutPixKeyType payoutPixKeyMasked pixReceiverName pixReceiverCity pixKeyEnabled payoutUpdatedAt subscription",
      )
      .lean();

    if (!workspace) {
      return res.status(404).json({
        ok: false,
        error: "workspace_not_found",
        message: "Workspace nao encontrado.",
      });
    }

    const [owner, settingsDoc, notificationContext] = await Promise.all([
      User.findById(workspace.ownerUserId)
        .select("_id name email status")
        .lean(),
      AppSettings.findOne({ workspaceId })
        .select("ownerUserId agenda.timezone updatedAt")
        .lean(),
      resolveWorkspaceNotificationContext({
        workspaceId,
        ownerUserId: workspace.ownerUserId,
        workspacePlan: workspace.plan,
      }),
    ]);

    const [
      totalOffers,
      pendingPaymentOffers,
      waitingConfirmationOffers,
      cancelledOffers,
      paidOffers,
      sessionTotal,
      sessionCompleted,
      sessionCancelledOrExpired,
      sessionErrors,
      sessionStateRows,
      sessionFlowRows,
      recentSessionErrors,
      recentSessions,
      currentOutboxStatusRows,
      recentOutboxStatusRows,
      outboxFailures,
      outboxRecentMessages,
      currentMessageLogStatusRows,
      recentMessageLogStatusRows,
      messageLogFailures,
      messageLogRecentMessages,
      reminderFailures,
      lastOffer,
      lastOutbox,
      lastMessageLog,
      lastSession,
      lastReminder,
    ] = await Promise.all([
      Offer.countDocuments({ workspaceId }),
      Offer.countDocuments({
        workspaceId,
        paymentStatus: "PENDING",
        status: { $nin: ["CANCELLED", "CANCELED", "EXPIRED", "CONFIRMED", "PAID"] },
      }),
      Offer.countDocuments({
        workspaceId,
        status: "WAITING_CONFIRMATION",
      }),
      Offer.countDocuments({
        workspaceId,
        status: { $in: ["CANCELLED", "CANCELED"] },
      }),
      Offer.countDocuments({
        workspaceId,
        $or: [{ paymentStatus: "PAID" }, { status: "PAID" }],
      }),
      WhatsAppCommandSession.countDocuments({
        workspaceId,
        createdAt: { $gte: since },
      }),
      WhatsAppCommandSession.countDocuments({
        workspaceId,
        createdAt: { $gte: since },
        state: "COMPLETED",
      }),
      WhatsAppCommandSession.countDocuments({
        workspaceId,
        createdAt: { $gte: since },
        state: { $in: ["CANCELLED", "EXPIRED"] },
      }),
      WhatsAppCommandSession.countDocuments({
        workspaceId,
        updatedAt: { $gte: since },
        $or: [
          { state: "ERROR" },
          { "lastError.message": { $exists: true, $nin: [null, ""] } },
          { "lastError.code": { $exists: true, $nin: [null, ""] } },
        ],
      }),
      WhatsAppCommandSession.aggregate([
        { $match: { workspaceId, createdAt: { $gte: since } } },
        { $group: { _id: "$state", count: { $sum: 1 } } },
      ]),
      WhatsAppCommandSession.aggregate([
        { $match: { workspaceId, createdAt: { $gte: since } } },
        { $group: { _id: "$flowType", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      WhatsAppCommandSession.find({
        workspaceId,
        updatedAt: { $gte: since },
        $or: [
          { state: "ERROR" },
          { "lastError.message": { $exists: true, $nin: [null, ""] } },
          { "lastError.code": { $exists: true, $nin: [null, ""] } },
        ],
      })
        .sort({ updatedAt: -1 })
        .limit(5)
        .select(
          "_id flowType state requesterPhoneDigits requesterPushName lastUserMessageText lastQuestionKey lastError createdAt updatedAt",
        )
        .lean(),
      WhatsAppCommandSession.find({
        workspaceId,
        createdAt: { $gte: since },
      })
        .sort({ updatedAt: -1 })
        .limit(5)
        .select(
          "_id flowType state requesterPhoneDigits requesterPushName lastUserMessageText createdAt updatedAt",
        )
        .lean(),
      WhatsAppOutbox.aggregate([
        { $match: { workspaceId } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      WhatsAppOutbox.aggregate([
        { $match: { workspaceId, createdAt: { $gte: since } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      WhatsAppOutbox.find({
        workspaceId,
        status: "failed",
        updatedAt: { $gte: since },
      })
        .sort({ updatedAt: -1 })
        .limit(5)
        .select(
          "_id to message status sourceType providerMessageId deliveryState deliveryLastAckCode deliveryLastAckAt deliveredAt readAt playedAt attempts maxAttempts nextAttemptAt lastError meta createdAt updatedAt sentAt",
        )
        .lean(),
      WhatsAppOutbox.find({
        workspaceId,
        status: "sent",
      })
        .sort({ sentAt: -1, updatedAt: -1 })
        .limit(5)
        .select(
          "_id to message status sourceType providerMessageId deliveryState deliveryLastAckCode deliveryLastAckAt deliveredAt readAt playedAt attempts maxAttempts nextAttemptAt lastError meta createdAt updatedAt sentAt",
        )
        .lean(),
      MessageLog.aggregate([
        { $match: { workspaceId } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      MessageLog.aggregate([
        { $match: { workspaceId, createdAt: { $gte: since } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      MessageLog.find({
        workspaceId,
        status: "FAILED",
        updatedAt: { $gte: since },
      })
        .sort({ updatedAt: -1 })
        .limit(5)
        .select(
          "_id eventType provider to message status providerMessageId deliveryState deliveryLastAckCode deliveryLastAckAt deliveredAt readAt playedAt error sentAt createdAt updatedAt",
        )
        .lean(),
      MessageLog.find({
        workspaceId,
        status: "SENT",
      })
        .sort({ sentAt: -1, createdAt: -1 })
        .limit(5)
        .select(
          "_id eventType provider to message status providerMessageId deliveryState deliveryLastAckCode deliveryLastAckAt deliveredAt readAt playedAt error sentAt createdAt updatedAt",
        )
        .lean(),
      OfferReminderLog.find({
        workspaceId,
        status: "failed",
        updatedAt: { $gte: since },
      })
        .sort({ updatedAt: -1 })
        .limit(5)
        .select(
          "_id kind status to message provider providerMessageId deliveryState deliveryLastAckCode deliveryLastAckAt deliveredAt readAt playedAt error meta sentAt createdAt updatedAt",
        )
        .lean(),
      Offer.findOne({ workspaceId }).sort({ updatedAt: -1 }).select("updatedAt").lean(),
      WhatsAppOutbox.findOne({ workspaceId })
        .sort({ updatedAt: -1 })
        .select("updatedAt")
        .lean(),
      MessageLog.findOne({ workspaceId })
        .sort({ updatedAt: -1 })
        .select("updatedAt")
        .lean(),
      WhatsAppCommandSession.findOne({ workspaceId })
        .sort({ updatedAt: -1 })
        .select("updatedAt")
        .lean(),
      OfferReminderLog.findOne({ workspaceId })
        .sort({ updatedAt: -1 })
        .select("updatedAt")
        .lean(),
    ]);

    const recentErrors = buildRecentErrorRows({
      sessionErrors: recentSessionErrors,
      outboxFailures,
      messageLogFailures,
      reminderFailures,
    });

    const lastActivityAt = buildLastActivityAt(
      workspace.updatedAt,
      lastOffer?.updatedAt,
      lastOutbox?.updatedAt,
      lastMessageLog?.updatedAt,
      lastSession?.updatedAt,
      lastReminder?.updatedAt,
    );

    const agendaTimezone =
      settingsDoc?.agenda?.timezone || "America/Sao_Paulo";
    const whatsappEnvironment =
      notificationContext?.capabilities?.environment?.whatsapp || {
        available: false,
        reason: "",
        reasons: [],
      };
    const pixConfigured = Boolean(
      workspace.payoutPixKeyType &&
        workspace.payoutPixKeyMasked &&
        workspace.pixReceiverName,
    );

    res.json({
      ok: true,
      diagnostics: {
        generatedAt: new Date().toISOString(),
        windowDays: days,
        workspace: {
          _id: workspace._id,
          name: workspace.name,
          slug: workspace.slug,
          plan: workspace.plan,
          planStatus: workspace.planStatus,
          createdAt: workspace.createdAt,
          updatedAt: workspace.updatedAt,
          lastActivityAt,
          subscription: {
            status: workspace.subscription?.status || "inactive",
            currentPeriodStart:
              workspace.subscription?.currentPeriodStart || null,
            currentPeriodEnd: workspace.subscription?.currentPeriodEnd || null,
            stripeCustomerId:
              workspace.subscription?.stripeCustomerId || "",
            stripeSubscriptionId:
              workspace.subscription?.stripeSubscriptionId || "",
          },
        },
        owner: serializeOwner(owner),
        pix: {
          enabled: workspace.pixKeyEnabled === true,
          connected: pixConfigured,
          status: pixConfigured
            ? workspace.pixKeyEnabled === true
              ? "active"
              : "inactive"
            : "warning",
          keyType: workspace.payoutPixKeyType || "",
          keyMasked: workspace.payoutPixKeyMasked || "",
          receiverName: workspace.pixReceiverName || "",
          receiverCity: workspace.pixReceiverCity || "",
          updatedAt: workspace.payoutUpdatedAt || null,
        },
        settings: {
          agendaTimezone,
          updatedAt: settingsDoc?.updatedAt || null,
        },
        notificationContextResolved: {
          plan: notificationContext?.plan || workspace.plan || "start",
          environment: {
            whatsapp: whatsappEnvironment,
          },
          masterEnabled:
            notificationContext?.settings?.whatsapp?.masterEnabled === true,
          featureAvailability: notificationContext?.featureAvailability || {},
        },
        agentUsage: {
          totalSessions: sessionTotal,
          completedSessions: sessionCompleted,
          cancelledOrExpiredSessions: sessionCancelledOrExpired,
          errorSessions: sessionErrors,
          stateCounts: reduceStatusCounts(sessionStateRows),
          flowCounts: mapCountRows(sessionFlowRows),
          recentSessions: recentSessions.map(serializeSessionEntry),
          recentErrors: recentSessionErrors.map(serializeSessionEntry),
          lastActivityAt: lastSession?.updatedAt || null,
        },
        outboxSummary: {
          currentStatusCounts: reduceStatusCounts(currentOutboxStatusRows),
          recentStatusCounts: reduceStatusCounts(recentOutboxStatusRows),
          failures: outboxFailures.map(serializeOutboxEntry),
          recentMessages: outboxRecentMessages.map(serializeOutboxEntry),
          lastActivityAt: lastOutbox?.updatedAt || null,
        },
        messageLogSummary: {
          currentStatusCounts: reduceStatusCounts(currentMessageLogStatusRows),
          recentStatusCounts: reduceStatusCounts(recentMessageLogStatusRows),
          failures: messageLogFailures.map(serializeMessageLogEntry),
          recentMessages: messageLogRecentMessages.map(serializeMessageLogEntry),
          lastActivityAt: lastMessageLog?.updatedAt || null,
        },
        offerHealth: {
          total: totalOffers,
          pendingPayment: pendingPaymentOffers,
          waitingConfirmation: waitingConfirmationOffers,
          cancelled: cancelledOffers,
          paid: paidOffers,
        },
        recentErrors,
      },
    });
  }),
);

export default r;
