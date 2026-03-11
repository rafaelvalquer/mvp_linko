// server/src/routes/settings.routes.js
import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ensureAuth, tenantFromUser } from "../middleware/auth.js";
import { AppSettings } from "../models/AppSettings.js";
import {
  DEFAULT_AGENDA,
  mergeAgenda,
  sanitizeAgendaPatch,
} from "../services/agendaSettings.js";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  mergeNotificationSettings,
  sanitizeNotificationPatch,
  resolveWorkspaceNotificationContext,
} from "../services/notificationSettings.js";

const r = Router();

r.use(ensureAuth, tenantFromUser);

/**
 * GET /settings
 * - retorna settings do tenant (workspaceId + ownerUserId)
 * - lazy create com defaults compatíveis
 */
r.get(
  "/settings",
  asyncHandler(async (req, res) => {
    const workspaceId = req.tenantId;
    const ownerUserId = req.user?._id;

    let doc = await AppSettings.findOne({ workspaceId, ownerUserId }).lean();

    if (!doc) {
      const created = await AppSettings.create({
        workspaceId,
        ownerUserId,
        version: 1,
        agenda: DEFAULT_AGENDA,
        notifications: DEFAULT_NOTIFICATION_SETTINGS,
        data: {},
      });
      doc = created.toObject();
    }

    const context = await resolveWorkspaceNotificationContext({
      workspaceId,
      ownerUserId,
    });

    return res.json({
      ok: true,
      settings: {
        ...doc,
        agenda: mergeAgenda(DEFAULT_AGENDA, doc?.agenda || {}),
        notifications: mergeNotificationSettings(
          DEFAULT_NOTIFICATION_SETTINGS,
          doc?.notifications || {},
        ),
      },
      capabilities: {
        notifications: {
          ...(context.capabilities || {}),
          availability: context.featureAvailability || {},
        },
      },
    });
  }),
);

/**
 * PATCH /settings/agenda
 * - atualiza SOMENTE o bloco agenda
 * - valida e merge com o existente
 */
r.patch(
  "/settings/agenda",
  asyncHandler(async (req, res) => {
    const workspaceId = req.tenantId;
    const ownerUserId = req.user?._id;

    const existing =
      (await AppSettings.findOne({ workspaceId, ownerUserId }).lean()) || null;

    const baseAgenda = existing?.agenda
      ? mergeAgenda(DEFAULT_AGENDA, existing.agenda)
      : DEFAULT_AGENDA;

    const rawAgenda = req.body?.agenda ?? req.body ?? {};
    const patch = sanitizeAgendaPatch(rawAgenda);
    const nextAgenda = mergeAgenda(baseAgenda, patch);

    const updated = await AppSettings.findOneAndUpdate(
      { workspaceId, ownerUserId },
      {
        $set: { agenda: nextAgenda },
        $setOnInsert: {
          version: 1,
          data: {},
          notifications: DEFAULT_NOTIFICATION_SETTINGS,
        },
      },
      { new: true, upsert: true },
    ).lean();

    return res.json({ ok: true, settings: updated });
  }),
);

r.patch(
  "/settings/notifications",
  asyncHandler(async (req, res) => {
    const workspaceId = req.tenantId;
    const ownerUserId = req.user?._id;

    const existing =
      (await AppSettings.findOne({ workspaceId, ownerUserId }).lean()) || null;

    const baseNotifications = mergeNotificationSettings(
      DEFAULT_NOTIFICATION_SETTINGS,
      existing?.notifications || {},
    );

    const rawNotifications = req.body?.notifications ?? req.body ?? {};
    const patch = sanitizeNotificationPatch(rawNotifications);
    const nextNotifications = mergeNotificationSettings(baseNotifications, patch);

    const updated = await AppSettings.findOneAndUpdate(
      { workspaceId, ownerUserId },
      {
        $set: { notifications: nextNotifications },
        $setOnInsert: {
          version: 1,
          data: {},
          agenda: DEFAULT_AGENDA,
        },
      },
      { new: true, upsert: true },
    ).lean();

    const context = await resolveWorkspaceNotificationContext({
      workspaceId,
      ownerUserId,
    });

    return res.json({
      ok: true,
      settings: {
        ...updated,
        notifications: mergeNotificationSettings(
          DEFAULT_NOTIFICATION_SETTINGS,
          updated?.notifications || nextNotifications,
        ),
      },
      capabilities: {
        notifications: {
          ...(context.capabilities || {}),
          availability: context.featureAvailability || {},
        },
      },
    });
  }),
);

export default r;
