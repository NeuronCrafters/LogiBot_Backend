import { Router } from "express";
import { getDb } from "../../db/client";
import { asyncHandler } from "../../http/asyncHandler";
import type { NextFunction, Request, Response } from "express";
import { requireAuth } from "../../http/auth";
import { currentEnvironment } from "../../db/environment";
import { AppError } from "../../exceptions/AppError";
import { isOwner } from "../../services/sandbox/sandboxConfig";
import { FEATURES, clearRule, featuresFor, listRules, setRule } from "../../services/features/featureService";

export const featureRouter = Router();
featureRouter.use(requireAuth);

/** Releasing features is reserved to the platform owner, on their real account. */
function requireOwner(req: Request, _res: Response, next: NextFunction) {
  if (currentEnvironment() !== "production" || !isOwner(req.user)) return next(new AppError("auth.accessDeniedCapital", 403));
  return next();
}

featureRouter.get(
  "/me",
  asyncHandler(async (req, res) => res.json({ features: await featuresFor(getDb(), req.user!) })),
);

featureRouter.get(
  "/rules",
  requireOwner,
  asyncHandler(async (_req, res) => res.json({ features: FEATURES, rules: await listRules(getDb()) })),
);

featureRouter.put(
  "/rules",
  requireOwner,
  asyncHandler(async (req, res) => res.json(await setRule(getDb(), req.user!.id, req.body))),
);

// POST instead of DELETE with a body, which some proxies drop.
featureRouter.post(
  "/rules/clear",
  requireOwner,
  asyncHandler(async (req, res) => {
    await clearRule(getDb(), req.body);
    return res.status(204).end();
  }),
);
