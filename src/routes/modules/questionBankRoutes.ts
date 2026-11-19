import { Router, type NextFunction, type Request, type Response } from "express";
import { getDb } from "../../db/client";
import { asyncHandler } from "../../http/asyncHandler";
import { requireAuth, requireRoles } from "../../http/auth";
import { t } from "../../i18n";
import { featuresFor } from "../../services/features/featureService";
import { AppError } from "../../exceptions/AppError";
import {
  QuestionValidationError,
  archiveQuestion,
  createQuestion,
  getQuestion,
  importQuizQuestions,
  listQuestions,
  updateQuestion,
} from "../../services/questions/questionBankService";

export const questionBankRouter = Router();
questionBankRouter.use(requireAuth);
questionBankRouter.use(requireRoles(["professor", "course-coordinator", "admin"]));

const body = (req: Request) => (req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {});

/**
 * Question types whose feature is turned off in the release page. They disappear from the bank
 * for every profile: not listed, not opened, not created, not edited.
 */
async function hiddenTypes(req: Request): Promise<string[]> {
  const released = await featuresFor(getDb(), req.user!);
  return released.practice_parsons ? [] : ["parsons"];
}

/** A question of a hidden type behaves as if it did not exist. */
async function visibleQuestion(req: Request) {
  const question = await getQuestion(getDb(), req.user!, req.params.id);
  if ((await hiddenTypes(req)).indexOf(question.type) !== -1) throw new AppError("questions.notFound", 404);
  return question;
}

questionBankRouter.get("/", asyncHandler(async (req, res) => {
  const hidden = await hiddenTypes(req);
  const rows = await listQuestions(getDb(), req.user!, { disciplineId: req.query.disciplineId, type: req.query.type });
  return res.json(rows.filter((row) => hidden.indexOf(row.type) === -1));
}));

questionBankRouter.post("/import-quiz/:quizId", asyncHandler(async (req, res) =>
  res.json(await importQuizQuestions(getDb(), req.user!, req.params.quizId))));

questionBankRouter.get("/:id", asyncHandler(async (req, res) => res.json(await visibleQuestion(req))));

questionBankRouter.post("/", asyncHandler(async (req, res) => {
  const payload = body(req);
  if ((await hiddenTypes(req)).indexOf(String((payload as { type?: unknown }).type)) !== -1)
    throw new AppError("questions.typeUnavailable", 403);
  return res.status(201).json(await createQuestion(getDb(), req.user!, payload));
}));

questionBankRouter.put("/:id", asyncHandler(async (req, res) => {
  await visibleQuestion(req);
  return res.json(await updateQuestion(getDb(), req.user!, req.params.id, body(req)));
}));

questionBankRouter.delete("/:id", asyncHandler(async (req, res) => {
  await visibleQuestion(req);
  await archiveQuestion(getDb(), req.user!, req.params.id);
  return res.status(204).end();
}));

// Field-level validation errors go back as a list, so the form can mark each field.
questionBankRouter.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
  if (!(error instanceof QuestionValidationError)) return next(error);
  return res.status(400).json({ code: "questions.invalid", message: t("questions.invalid", {}, req.language), issues: error.issues });
});
