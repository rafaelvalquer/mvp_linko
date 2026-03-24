//server/src/middleware/auth.js

import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { Workspace } from "../models/Workspace.js";
import { enrichUserWithMasterAccess } from "../utils/masterAdmin.js";
import {
  normalizeWorkspacePlan,
  isWorkspaceOwnerUser,
  resolveModulePermissions,
} from "../utils/workspaceAccess.js";

function getBearerToken(req) {
  const h = String(req.headers?.authorization || "");
  if (!h.toLowerCase().startsWith("bearer ")) return "";
  return h.slice(7).trim();
}

export async function authOptional(req, _res, next) {
  try {
    const t = getBearerToken(req);
    if (!t) return next();

    const payload = jwt.verify(t, env.jwtSecret);
    const userId = payload?.sub || payload?.userId;
    if (!userId) return next();

    const u = await User.findById(userId).lean();
    if (!u || u.status !== "active") return next();
    const workspace = await Workspace.findById(u.workspaceId)
      .select("_id ownerUserId plan")
      .lean();
    const workspacePlan = normalizeWorkspacePlan(workspace?.plan || "start");
    const isWorkspaceOwner = isWorkspaceOwnerUser(u, workspace?.ownerUserId);

    req.user = enrichUserWithMasterAccess({
      _id: u._id,
      name: u.name,
      email: u.email,
      workspaceId: u.workspaceId,
      role: u.role,
      profile: u.profile || (u.role === "owner" ? "owner" : "sales"),
      status: u.status,
      permissions: u.permissions || {},
      workspacePlan,
      workspaceOwnerUserId: workspace?.ownerUserId || null,
      isWorkspaceOwner,
      modulePermissions: resolveModulePermissions({
        user: {
          ...u,
          isWorkspaceOwner,
        },
        workspacePlan,
        workspaceOwnerUserId: workspace?.ownerUserId || null,
      }),
      whatsNewLastSeenAt: u.whatsNewLastSeenAt || null,
      whatsappPhone: u.whatsappPhone || "",
    });
    return next();
  } catch {
    return next();
  }
}

export function ensureAuth(req, res, next) {
  if (!req.user)
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  return next();
}

export function ensureMasterAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  if (req.user.isMasterAdmin !== true) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }

  return next();
}

export function tenantFromUser(req, _res, next) {
  req.tenantId = req.user?.workspaceId;
  return next();
}
