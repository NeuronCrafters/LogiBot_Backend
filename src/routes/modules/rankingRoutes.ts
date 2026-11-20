import { Router, type NextFunction, type Request, type Response } from "express";
import { getDb } from "../../db/client";
import { currentEnvironment } from "../../db/environment";
import { asyncHandler } from "../../http/asyncHandler";
import { requireAuth } from "../../http/auth";
import { AppError } from "../../exceptions/AppError";
import { RankingValidationError, clearSettings, getSettings, ranking, rankingScopes, saveSettings } from "../../services/ranking/rankingService";

export const rankingRouter = Router();
rankingRouter.use(requireAuth);

// Selections the person may open (and whether the ranking is open to their profile at all).
rankingRouter.get("/scopes", asyncHandler(async (req, res) => res.json(await rankingScopes(getDb(), req.user!))));
// The ranking of a class, course or institution, with the rules used.
rankingRouter.get("/", asyncHandler(async (req, res) => res.json(await ranking(getDb(), req.user!, { scope: req.query.scope, id: req.query.id }))));

/**
 * Rules are the owner's, on the real account (like the release of features). Mounted apart, so they
 * can be changed even while the ranking itself is turned off.
 */
export const rankingSettingsRouter = Router();
rankingSettingsRouter.use(requireAuth);
rankingSettingsRouter.use((_req: Request, _res: Response, next: NextFunction) =>
  next(currentEnvironment() === "production" ? undefined : new AppError("auth.accessDeniedCapital", 403)));
rankingSettingsRouter.get("/", asyncHandler(async (req, res) => res.json(await getSettings(getDb(), req.user!, req.query.institutionId))));
rankingSettingsRouter.put("/", asyncHandler(async (req, res) => res.json(await saveSettings(getDb(), req.user!, req.body))));
rankingSettingsRouter.post("/clear", asyncHandler(async (req, res) => { await clearSettings(getDb(), req.user!, req.body); return res.status(204).end(); }));

const validation = (error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (error instanceof RankingValidationError) return res.status(400).json({ code: error.code, message: error.message, issues: error.issues });
  return next(error);
};
rankingRouter.use(validation);
rankingSettingsRouter.use(validation);
