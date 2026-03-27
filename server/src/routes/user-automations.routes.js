import { Router } from "express";

import { ensureAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { canUseAutomations } from "../utils/planFeatures.js";
import {
  buildAutomationCandidate,
  createUserAutomation,
  deleteUserAutomation,
  duplicateUserAutomation,
  getUserAutomationPlanSummary,
  listUserAutomationTemplates,
  listUserAutomations,
  pauseUserAutomation,
  resumeUserAutomation,
  runUserAutomationNow,
} from "../services/userAutomations.service.js";

const r = Router();

function normalizeText(value) {
  return String(value || "").trim();
}

function assertAutomationPlanAllowed(req) {
  if (canUseAutomations(req.user?.workspacePlan || "start")) return;

  const err = new Error(
    "Automações da Lumina ficam disponíveis apenas nos planos Pro, Business e Enterprise.",
  );
  err.status = 403;
  err.code = "AUTOMATIONS_PLAN_NOT_ALLOWED";
  throw err;
}

function serializeHistoryEntry(entry = {}) {
  return {
    status: normalizeText(entry?.status || ""),
    source: normalizeText(entry?.source || ""),
    ranAt: entry?.ranAt || null,
    message: normalizeText(entry?.message || ""),
    channels: Array.isArray(entry?.channels)
      ? entry.channels.map((item) => normalizeText(item)).filter(Boolean)
      : [],
    error:
      entry?.error && typeof entry.error === "object"
        ? {
            message: normalizeText(entry.error.message || ""),
            code: normalizeText(entry.error.code || ""),
          }
        : null,
  };
}

function serializeAutomationItem(automation = {}) {
  const candidate = buildAutomationCandidate(automation);
  const history = Array.isArray(automation?.history)
    ? automation.history.slice(-10).reverse().map((entry) => serializeHistoryEntry(entry))
    : [];

  return {
    id: candidate.automationId,
    name: candidate.name,
    templateKey: candidate.templateKey,
    templateLabel: candidate.templateLabel,
    channel: candidate.channel,
    frequency: candidate.frequency,
    dayOfWeek: candidate.dayOfWeek,
    timeOfDay: candidate.timeOfDay,
    timeZone: normalizeText(automation?.timeZone || ""),
    status: candidate.status,
    displayLabel: candidate.displayLabel,
    nextRunAt: candidate.nextRunAt,
    lastRunAt: candidate.lastRunAt,
    lastSuccessfulRunAt: automation?.lastSuccessfulRunAt || null,
    lastFailedRunAt: automation?.lastFailedRunAt || null,
    runCount: Number(automation?.runCount || 0),
    successCount: Number(automation?.successCount || 0),
    failureCount: Number(automation?.failureCount || 0),
    createdAt: automation?.createdAt || null,
    updatedAt: automation?.updatedAt || null,
    lastError:
      automation?.lastError && typeof automation.lastError === "object"
        ? {
            message: normalizeText(automation.lastError.message || ""),
            code: normalizeText(automation.lastError.code || ""),
            at: automation.lastError.at || null,
          }
        : null,
    history,
  };
}

r.use(ensureAuth);

r.get(
  "/automations",
  asyncHandler(async (req, res) => {
    assertAutomationPlanAllowed(req);

    const [items, templates] = await Promise.all([
      listUserAutomations({
        userId: req.user?._id,
        workspaceId: req.user?.workspaceId,
        limit: 100,
      }),
      Promise.resolve(listUserAutomationTemplates()),
    ]);

    const serializedItems = items.map((item) => serializeAutomationItem(item));
    const activeCount = serializedItems.filter((item) => item.status === "active").length;

    return res.json({
      ok: true,
      planSummary: getUserAutomationPlanSummary(req.user?.workspacePlan || "start"),
      templates,
      activeCount,
      items: serializedItems,
    });
  }),
);

r.post(
  "/automations",
  asyncHandler(async (req, res) => {
    assertAutomationPlanAllowed(req);

    const automation = await createUserAutomation({
      user: req.user,
      templateKey: req.body?.templateKey,
      channel: req.body?.channel,
      frequency: req.body?.frequency,
      dayOfWeek: req.body?.dayOfWeek,
      timeOfDay: req.body?.timeOfDay,
    });

    return res.status(201).json({
      ok: true,
      item: serializeAutomationItem(automation),
    });
  }),
);

r.post(
  "/automations/:id/pause",
  asyncHandler(async (req, res) => {
    assertAutomationPlanAllowed(req);

    const automation = await pauseUserAutomation({
      automationId: req.params.id,
      user: req.user,
    });

    return res.json({
      ok: true,
      item: serializeAutomationItem(automation),
    });
  }),
);

r.post(
  "/automations/:id/resume",
  asyncHandler(async (req, res) => {
    assertAutomationPlanAllowed(req);

    const automation = await resumeUserAutomation({
      automationId: req.params.id,
      user: req.user,
    });

    return res.json({
      ok: true,
      item: serializeAutomationItem(automation),
    });
  }),
);

r.post(
  "/automations/:id/run-now",
  asyncHandler(async (req, res) => {
    assertAutomationPlanAllowed(req);

    const result = await runUserAutomationNow({
      automationId: req.params.id,
      user: req.user,
    });

    return res.json({
      ok: true,
      item: serializeAutomationItem(result?.automation || {}),
      execution:
        result?.execution && typeof result.execution === "object"
          ? {
              status: normalizeText(result.execution.status || ""),
              message: normalizeText(result.execution.message || ""),
              results: Array.isArray(result.execution.results)
                ? result.execution.results
                : [],
            }
          : null,
    });
  }),
);

r.post(
  "/automations/:id/duplicate",
  asyncHandler(async (req, res) => {
    assertAutomationPlanAllowed(req);

    const automation = await duplicateUserAutomation({
      automationId: req.params.id,
      user: req.user,
    });

    return res.status(201).json({
      ok: true,
      item: serializeAutomationItem(automation),
    });
  }),
);

r.delete(
  "/automations/:id",
  asyncHandler(async (req, res) => {
    assertAutomationPlanAllowed(req);

    const removed = await deleteUserAutomation({
      automationId: req.params.id,
      user: req.user,
    });

    return res.json({
      ok: true,
      deletedId: normalizeText(removed?._id || ""),
    });
  }),
);

export default r;
