import { Router } from "express";
import { getDb } from "../../db/client";
import { AppError } from "../../exceptions/AppError";
import { asyncHandler } from "../../http/asyncHandler";
import { requireAuth } from "../../http/auth";
import {
  getNotificationPreferences,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  setNotificationPreferences,
} from "../../services/notifications/notificationService";

export const notificationRouter = Router();
notificationRouter.use(requireAuth);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Only the signed-in person's own notifications are ever read or changed.
notificationRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit ?? 30);
    return res.json(await listNotifications(getDb(), req.user!.id, Number.isFinite(limit) ? limit : 30));
  }),
);

notificationRouter.post(
  "/read-all",
  asyncHandler(async (req, res) => res.json({ updated: await markAllNotificationsRead(getDb(), req.user!.id) })),
);

notificationRouter.post(
  "/:id/read",
  asyncHandler(async (req, res) => {
    if (!UUID.test(req.params.id)) throw new AppError("notifications.notFound", 404);
    if (!(await markNotificationRead(getDb(), req.user!.id, req.params.id))) throw new AppError("notifications.notFound", 404);
    return res.status(204).end();
  }),
);

notificationRouter.get(
  "/preferences",
  asyncHandler(async (req, res) => res.json(await getNotificationPreferences(getDb(), req.user!.id))),
);

notificationRouter.put(
  "/preferences",
  asyncHandler(async (req, res) => {
    if (typeof req.body?.emailEnabled !== "boolean") throw new AppError("notifications.preferencesInvalid", 400);
    return res.json(await setNotificationPreferences(getDb(), req.user!.id, req.body.emailEnabled));
  }),
);
