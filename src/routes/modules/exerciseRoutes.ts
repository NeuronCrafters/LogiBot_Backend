import { Router } from "express";
import { getDb } from "../../db/client";
import { AppError } from "../../exceptions/AppError";
import { asyncHandler } from "../../http/asyncHandler";
import { requireAuth } from "../../http/auth";
import { withLiveSession } from "../../services/auth/sessionLifecycleService";
import { listPracticeQuestions, prepareBankAttempt, prepareExerciseAttempt, recordExerciseAttempt } from "../../services/exercises/exerciseAttemptService";
import { hintStatus, requestHint } from "../../services/exercises/hintService";
import { requireFeature } from "../../services/features/featureService";

export const exerciseRouter = Router();
exerciseRouter.use(requireAuth);

// ── Professor questions offered in the workbench (no answer keys) ──────────
exerciseRouter.get(
  "/bank",
  asyncHandler(async (req, res) => {
    if (!req.user!.role.includes("student")) throw new AppError("exercises.studentsOnly", 403);
    return res.json(await listPracticeQuestions(getDb(), req.user!.id, req.query.type));
  }),
);

// ── Workbench attempt: graded on the server, client result is only feedback ──
exerciseRouter.post(
  "/attempts",
  asyncHandler(async (req, res) => {
    if (!req.user!.role.includes("student")) throw new AppError("exercises.studentsOnly", 403);
    const body = req.body && typeof req.body === "object" ? req.body : {};
    // Bank questions are graded with the answer key stored on the server.
    const attempt = body.bankQuestionId !== undefined ? await prepareBankAttempt(getDb(), req.user!.id, body) : prepareExerciseAttempt(body);
    const payload = await withLiveSession(getDb(), req.authSessionId!, req.user!.id, (db) =>
      recordExerciseAttempt(db, req.user!.id, attempt),
    );
    return res.status(201).json(payload);
  }),
);

// ── Hints (phase 7): up to 3 per exercise, built from the student's own wrong attempt ──
exerciseRouter.get(
  "/hints",
  requireFeature("practice_hints"),
  asyncHandler(async (req, res) => {
    if (!req.user!.role.includes("student")) throw new AppError("exercises.studentsOnly", 403);
    const exerciseId = typeof req.query.exerciseId === "string" ? req.query.exerciseId.slice(0, 200) : "";
    if (!exerciseId) throw new AppError("exercises.exerciseNotFound", 404);
    return res.json(await hintStatus(getDb(), req.user!.id, exerciseId));
  }),
);

exerciseRouter.post(
  "/hints",
  requireFeature("practice_hints"),
  asyncHandler(async (req, res) => {
    if (!req.user!.role.includes("student")) throw new AppError("exercises.studentsOnly", 403);
    return res.status(201).json(await requestHint(getDb(), req.user!.id, req.body));
  }),
);
