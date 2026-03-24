// server/src/routes/bookings.routes.js
import express from "express";
import mongoose from "mongoose";

import { ensureAuth, tenantFromUser } from "../middleware/auth.js";
import {
  assertWorkspaceModuleAccess,
  canUseWorkspaceTeam,
  getScopedOwnerUserId,
  isWorkspaceOwnerUser,
} from "../utils/workspaceAccess.js";

import Booking from "../models/Booking.js";
import { User } from "../models/User.js";

const router = express.Router();

function assertCalendarModule(req) {
  assertWorkspaceModuleAccess({
    user: req.user,
    workspacePlan: req.user?.workspacePlan,
    workspaceOwnerUserId: req.user?.workspaceOwnerUserId,
    moduleKey: "calendar",
  });
}

function getScopedOwner(req) {
  return getScopedOwnerUserId({
    user: req.user,
    workspacePlan: req.user?.workspacePlan,
    workspaceOwnerUserId: req.user?.workspaceOwnerUserId,
  });
}

function normalizeBookingsScope(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (normalized === "mine") return "mine";
  if (normalized === "workspace") return "workspace";
  return "";
}

async function resolveBookingsScope(req, tenantId) {
  const workspacePlan = req.user?.workspacePlan || "start";
  const workspaceOwnerUserId = req.user?.workspaceOwnerUserId || null;
  const requestedScope = normalizeBookingsScope(req.query.scope);
  const requestedOwnerUserId = String(req.query.ownerUserId || "").trim();
  const isTeamPlan = canUseWorkspaceTeam(workspacePlan);
  const isOwner = isWorkspaceOwnerUser(req.user, workspaceOwnerUserId);
  const scopedOwnerUserId = getScopedOwner(req);

  if (!isTeamPlan) {
    return {
      appliedScope: requestedScope === "mine" ? "mine" : "workspace",
      ownerUserId: scopedOwnerUserId || null,
    };
  }

  if (!isOwner) {
    if (requestedScope === "workspace" || requestedOwnerUserId) {
      const err = new Error(
        "Somente o dono do workspace pode visualizar a agenda da equipe.",
      );
      err.status = 403;
      err.code = "WORKSPACE_BOOKINGS_SCOPE_FORBIDDEN";
      throw err;
    }

    return {
      appliedScope: "mine",
      ownerUserId: scopedOwnerUserId || req.user?._id || null,
    };
  }

  if (requestedScope === "mine") {
    return {
      appliedScope: "mine",
      ownerUserId: req.user?._id || null,
    };
  }

  if (requestedOwnerUserId) {
    if (!mongoose.isValidObjectId(requestedOwnerUserId)) {
      const err = new Error("Responsavel invalido.");
      err.status = 400;
      err.code = "INVALID_OWNER_USER_ID";
      throw err;
    }

    const responsibleUser = await User.findOne({
      _id: requestedOwnerUserId,
      workspaceId: tenantId,
    })
      .select("_id name")
      .lean();

    if (!responsibleUser) {
      const err = new Error(
        "Responsavel nao encontrado neste workspace.",
      );
      err.status = 404;
      err.code = "WORKSPACE_USER_NOT_FOUND";
      throw err;
    }

    return {
      appliedScope: "workspace",
      ownerUserId: responsibleUser._id,
    };
  }

  return {
    appliedScope: "workspace",
    ownerUserId: null,
  };
}

router.use(ensureAuth);
router.use(tenantFromUser);

/**
 * GET /api/bookings?from=ISO&to=ISO&status=HOLD,CONFIRMED
 */
router.get("/bookings", async (req, res, next) => {
  try {
    assertCalendarModule(req);
    const tenantId = req.tenantId;
    if (!tenantId)
      return res.status(401).json({ ok: false, error: "Unauthorized" });

    const from = String(req.query.from || "").trim();
    const to = String(req.query.to || "").trim();
    const statusRaw = String(req.query.status || "").trim();

    const q = { workspaceId: tenantId };
    const scopeInfo = await resolveBookingsScope(req, tenantId);
    if (scopeInfo.ownerUserId) q.ownerUserId = scopeInfo.ownerUserId;

    if (from || to) {
      q.startAt = {};
      if (from) {
        const d = new Date(from);
        if (!Number.isNaN(d.getTime())) q.startAt.$gte = d;
      }
      if (to) {
        const d = new Date(to);
        if (!Number.isNaN(d.getTime())) q.startAt.$lte = d;
      }
      if (!Object.keys(q.startAt).length) delete q.startAt;
    }

    if (statusRaw) {
      const arr = statusRaw
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      if (arr.length) q.status = { $in: arr };
    }

    const docs = await Booking.find(q)
      .sort({ startAt: 1 })
      .populate("offerId", "_id title publicToken")
      .populate("ownerUserId", "_id name")
      .lean();

    const items = (docs || []).map((b) => ({
      _id: b._id,
      ownerUserId: b?.ownerUserId?._id || b?.ownerUserId || null,
      responsibleUser: b?.ownerUserId
        ? {
            _id: b.ownerUserId._id || null,
            name: b.ownerUserId.name || "",
          }
        : null,
      startAt: b.startAt,
      endAt: b.endAt,
      status: b.status,
      holdExpiresAt: b.holdExpiresAt || null,
      customerName: b.customerName || "",
      customerWhatsApp: b.customerWhatsApp || "",
      offer: b.offerId
        ? {
            _id: b.offerId._id,
            title: b.offerId.title,
            publicToken: b.offerId.publicToken,
          }
        : null,
    }));

    return res.json({
      ok: true,
      scope: scopeInfo.appliedScope,
      items,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * PATCH /api/bookings/:id/cancel
 * -> status CANCELLED (tenant-aware)
 */
router.patch("/bookings/:id/cancel", async (req, res, next) => {
  try {
    assertCalendarModule(req);
    const tenantId = req.tenantId;
    const { id } = req.params;
    const scopedOwnerUserId = getScopedOwner(req);

    if (!tenantId)
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ ok: false, error: "ID inválido." });

    const current = await Booking.findOne({
      _id: id,
      workspaceId: tenantId,
      ...(scopedOwnerUserId ? { ownerUserId: scopedOwnerUserId } : {}),
    })
      .select("startAt endAt")
      .lean();

    const actionAt = new Date();
    const doc = await Booking.findOneAndUpdate(
      {
        _id: id,
        workspaceId: tenantId,
        ...(scopedOwnerUserId ? { ownerUserId: scopedOwnerUserId } : {}),
      },
      {
        $set: {
          status: "CANCELLED",
          cancelledAt: actionAt,
          cancelledBy: "workspace",
          cancelReason: null,
        },
        $push: {
          changeHistory: {
            action: "cancel",
            actor: "workspace",
            changedAt: actionAt,
            fromStartAt: current?.startAt || null,
            fromEndAt: current?.endAt || null,
            toStartAt: null,
            toEndAt: null,
            reason: null,
          },
        },
      },
      { new: true },
    )
      .populate("offerId", "_id title publicToken")
      .populate("ownerUserId", "_id name")
      .lean();

    if (!doc)
      return res
        .status(404)
        .json({ ok: false, error: "Booking não encontrado." });

    return res.json({
      ok: true,
      booking: {
        _id: doc._id,
        ownerUserId: doc?.ownerUserId?._id || doc?.ownerUserId || null,
        responsibleUser: doc?.ownerUserId
          ? {
              _id: doc.ownerUserId._id || null,
              name: doc.ownerUserId.name || "",
            }
          : null,
        startAt: doc.startAt,
        endAt: doc.endAt,
        status: doc.status,
        holdExpiresAt: doc.holdExpiresAt || null,
        customerName: doc.customerName || "",
        customerWhatsApp: doc.customerWhatsApp || "",
        offer: doc.offerId
          ? {
              _id: doc.offerId._id,
              title: doc.offerId.title,
              publicToken: doc.offerId.publicToken,
            }
          : null,
      },
    });
  } catch (e) {
    next(e);
  }
});

export default router;
