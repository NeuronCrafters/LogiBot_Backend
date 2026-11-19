import { Router } from "express";
import { getDb } from "../../db/client";
import { asyncHandler } from "../../http/asyncHandler";
import { requireAuth } from "../../http/auth";
import { conceptProficiency, proficiencyScopes } from "../../services/concepts/conceptProficiencyService";

export const conceptRouter = Router();
conceptRouter.use(requireAuth);

// Selections the person may open (own data, classes taught, network or everything).
conceptRouter.get("/scopes", asyncHandler(async (req, res) => res.json(await proficiencyScopes(getDb(), req.user!))));

// Proficiency per concept for one selection; exams count only after their results are released.
conceptRouter.get(
  "/proficiency",
  asyncHandler(async (req, res) => res.json(await conceptProficiency(getDb(), req.user!, { scope: req.query.scope, id: req.query.id, days: req.query.days }))),
);
