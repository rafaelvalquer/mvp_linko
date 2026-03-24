// server/src/routes/recurring-offers.routes.js
import { Router } from "express";
import mongoose from "mongoose";
import { ensureAuth, tenantFromUser } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  assertRecurringFeatureForTenant,
  createRecurringOffer,
  duplicateRecurringOffer,
  endRecurringOffer,
  getRecurringOfferDetails,
  getRecurringOfferHistory,
  getRecurringOfferLinkedOffers,
  listRecurringOffers,
  pauseRecurringOffer,
  resumeRecurringOffer,
  runRecurringOfferNow,
  updateRecurringOffer,
} from "../services/recurring-offers.service.js";
import {
  assertWorkspaceModuleAccess,
  getScopedOwnerUserId,
} from "../utils/workspaceAccess.js";
import { resolveWorkspaceOwnerScope } from "../utils/workspaceOwnerScope.js";

const r = Router();

function assertRecurringModule(req, moduleKey = "offers") {
  assertWorkspaceModuleAccess({
    user: req.user,
    workspacePlan: req.user?.workspacePlan,
    workspaceOwnerUserId: req.user?.workspaceOwnerUserId,
    moduleKey,
  });
}

function getScopedOwner(req) {
  return getScopedOwnerUserId({
    user: req.user,
    workspacePlan: req.user?.workspacePlan,
    workspaceOwnerUserId: req.user?.workspaceOwnerUserId,
  });
}

r.use(ensureAuth, tenantFromUser);

r.use(
  "/recurring-offers",
  asyncHandler(async (req, res, next) => {
    await assertRecurringFeatureForTenant(req.tenantId);
    assertRecurringModule(req, "offers");
    next();
  }),
);

function ensureId(req, res) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(400).json({ ok: false, error: "invalid id" });
    return false;
  }
  return true;
}

r.get(
  "/recurring-offers",
  asyncHandler(async (req, res) => {
    const scopeInfo = await resolveWorkspaceOwnerScope({
      user: req.user,
      workspaceId: req.tenantId,
      workspacePlan: req.user?.workspacePlan || "start",
      workspaceOwnerUserId: req.user?.workspaceOwnerUserId || null,
      scopeRaw: req.query.scope,
      ownerUserIdRaw: req.query.ownerUserId,
      defaultOwnerScope: "mine",
      forbiddenMessage:
        "Somente o dono do workspace pode visualizar as recorrencias da equipe.",
      forbiddenCode: "WORKSPACE_RECURRING_SCOPE_FORBIDDEN",
    });

    const items = await listRecurringOffers({
      tenantId: req.tenantId,
      userId: scopeInfo.ownerUserId,
      status: req.query?.status || "all",
      query: req.query?.q || "",
      bucket: req.query?.bucket || "",
    });

    res.json({ ok: true, scope: scopeInfo.appliedScope, items });
  }),
);

r.post(
  "/recurring-offers",
  asyncHandler(async (req, res) => {
    assertRecurringModule(req, "newOffer");
    const data = await createRecurringOffer({
      tenantId: req.tenantId,
      userId: getScopedOwner(req) || req.user?._id,
      body: req.body,
      origin: req.headers.origin || req.headers.referer || "",
    });

    res.json({
      ok: true,
      recurring: data.recurring,
      firstOffer: data.firstOffer || null,
      runResult: data.runResult || null,
    });
  }),
);

r.get(
  "/recurring-offers/:id",
  asyncHandler(async (req, res) => {
    if (!ensureId(req, res)) return;

    const data = await getRecurringOfferDetails({
      recurringId: req.params.id,
      tenantId: req.tenantId,
      userId: getScopedOwner(req),
    });

    res.json({ ok: true, ...data });
  }),
);

r.patch(
  "/recurring-offers/:id",
  asyncHandler(async (req, res) => {
    if (!ensureId(req, res)) return;

    const recurring = await updateRecurringOffer({
      recurringId: req.params.id,
      tenantId: req.tenantId,
      userId: getScopedOwner(req),
      body: req.body,
    });

    res.json({ ok: true, recurring });
  }),
);

r.post(
  "/recurring-offers/:id/pause",
  asyncHandler(async (req, res) => {
    if (!ensureId(req, res)) return;

    const recurring = await pauseRecurringOffer({
      recurringId: req.params.id,
      tenantId: req.tenantId,
      userId: getScopedOwner(req),
    });
    res.json({ ok: true, recurring });
  }),
);

r.post(
  "/recurring-offers/:id/resume",
  asyncHandler(async (req, res) => {
    if (!ensureId(req, res)) return;

    const recurring = await resumeRecurringOffer({
      recurringId: req.params.id,
      tenantId: req.tenantId,
      userId: getScopedOwner(req),
    });
    res.json({ ok: true, recurring });
  }),
);

r.post(
  "/recurring-offers/:id/run-now",
  asyncHandler(async (req, res) => {
    if (!ensureId(req, res)) return;

    const data = await runRecurringOfferNow({
      recurringId: req.params.id,
      tenantId: req.tenantId,
      userId: getScopedOwner(req) || req.user?._id,
      origin: req.headers.origin || req.headers.referer || "",
    });

    res.json({
      ok: true,
      recurring: data.recurring,
      offer: data.offer || null,
      execution: data.execution || null,
    });
  }),
);

r.post(
  "/recurring-offers/:id/end",
  asyncHandler(async (req, res) => {
    if (!ensureId(req, res)) return;

    const recurring = await endRecurringOffer({
      recurringId: req.params.id,
      tenantId: req.tenantId,
      userId: getScopedOwner(req),
    });
    res.json({ ok: true, recurring });
  }),
);

r.post(
  "/recurring-offers/:id/duplicate",
  asyncHandler(async (req, res) => {
    if (!ensureId(req, res)) return;

    const recurring = await duplicateRecurringOffer({
      recurringId: req.params.id,
      tenantId: req.tenantId,
      userId: getScopedOwner(req),
    });
    res.json({ ok: true, recurring });
  }),
);

r.get(
  "/recurring-offers/:id/offers",
  asyncHandler(async (req, res) => {
    if (!ensureId(req, res)) return;

    const items = await getRecurringOfferLinkedOffers({
      recurringId: req.params.id,
      tenantId: req.tenantId,
      userId: getScopedOwner(req),
    });
    res.json({ ok: true, items });
  }),
);

r.get(
  "/recurring-offers/:id/history",
  asyncHandler(async (req, res) => {
    if (!ensureId(req, res)) return;

    const items = await getRecurringOfferHistory({
      recurringId: req.params.id,
      tenantId: req.tenantId,
      userId: getScopedOwner(req),
    });
    res.json({ ok: true, items });
  }),
);

export default r;
