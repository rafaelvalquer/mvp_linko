import mongoose from "mongoose";

import { User } from "../models/User.js";
import {
  canUseWorkspaceTeam,
  getScopedOwnerUserId,
  isWorkspaceOwnerUser,
} from "./workspaceAccess.js";

export function normalizeWorkspaceViewScope(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (normalized === "mine") return "mine";
  if (normalized === "workspace") return "workspace";
  return "";
}

export async function resolveWorkspaceOwnerScope({
  user,
  workspaceId,
  workspacePlan = "start",
  workspaceOwnerUserId = null,
  scopeRaw,
  ownerUserIdRaw,
  defaultOwnerScope = "mine",
  forbiddenMessage = "Somente o dono do workspace pode visualizar a operacao da equipe.",
  forbiddenCode = "WORKSPACE_SCOPE_FORBIDDEN",
  invalidOwnerCode = "INVALID_OWNER_USER_ID",
  missingOwnerCode = "WORKSPACE_USER_NOT_FOUND",
}) {
  const requestedScope = normalizeWorkspaceViewScope(scopeRaw);
  const requestedOwnerUserId = String(ownerUserIdRaw || "").trim();
  const isTeamPlan = canUseWorkspaceTeam(workspacePlan);
  const isOwner = isWorkspaceOwnerUser(user, workspaceOwnerUserId);
  const scopedOwnerUserId = getScopedOwnerUserId({
    user,
    workspacePlan,
    workspaceOwnerUserId,
  });

  if (!isTeamPlan) {
    return {
      appliedScope: requestedScope || defaultOwnerScope,
      ownerUserId: scopedOwnerUserId || null,
      isOwner,
      isTeamPlan,
      responsibleUser: null,
    };
  }

  if (!isOwner) {
    if (requestedScope === "workspace" || requestedOwnerUserId) {
      const err = new Error(forbiddenMessage);
      err.status = 403;
      err.code = forbiddenCode;
      throw err;
    }

    return {
      appliedScope: "mine",
      ownerUserId: scopedOwnerUserId || user?._id || null,
      isOwner,
      isTeamPlan,
      responsibleUser: null,
    };
  }

  const appliedScope = requestedScope || defaultOwnerScope;

  if (appliedScope === "mine") {
    return {
      appliedScope: "mine",
      ownerUserId: user?._id || null,
      isOwner,
      isTeamPlan,
      responsibleUser: null,
    };
  }

  if (requestedOwnerUserId) {
    if (!mongoose.isValidObjectId(requestedOwnerUserId)) {
      const err = new Error("Responsavel invalido.");
      err.status = 400;
      err.code = invalidOwnerCode;
      throw err;
    }

    const responsibleUser = await User.findOne({
      _id: requestedOwnerUserId,
      workspaceId,
    })
      .select("_id name")
      .lean();

    if (!responsibleUser) {
      const err = new Error("Responsavel nao encontrado neste workspace.");
      err.status = 404;
      err.code = missingOwnerCode;
      throw err;
    }

    return {
      appliedScope: "workspace",
      ownerUserId: responsibleUser._id,
      isOwner,
      isTeamPlan,
      responsibleUser,
    };
  }

  return {
    appliedScope: "workspace",
    ownerUserId: null,
    isOwner,
    isTeamPlan,
    responsibleUser: null,
  };
}
