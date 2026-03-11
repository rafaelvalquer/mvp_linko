import { Router } from "express";
import mongoose from "mongoose";

import { asyncHandler } from "../utils/asyncHandler.js";
import { ensureAuth, ensureMasterAdmin } from "../middleware/auth.js";
import { Workspace } from "../models/Workspace.js";
import { User } from "../models/User.js";
import { Client } from "../models/Client.js";
import { Offer } from "../models/Offer.js";
import { MessageLog } from "../models/MessageLog.js";
import { WhatsAppOutbox } from "../models/WhatsAppOutbox.js";
import { getSystemHealthSnapshot, getSystemServicesStatus } from "../services/systemStatus.service.js";
import { isMasterAdminEmail } from "../utils/masterAdmin.js";

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
          "_id workspaceId to message status attempts maxAttempts nextAttemptAt lockedAt providerMessageId lastError meta sourceType sourceId createdAt updatedAt",
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
          "_id workspaceId offerId bookingId eventType channel provider to message status providerMessageId error sentAt createdAt updatedAt",
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

export default r;
