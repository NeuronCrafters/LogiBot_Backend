import { Router, type NextFunction, type Request, type Response } from "express";
import { getDb } from "../../db/client";
import { getFrontendOrigin } from "../../config/env";
import { asyncHandler } from "../../http/asyncHandler";
import { requireAuth, requireRoles } from "../../http/auth";
import { t } from "../../i18n";
import { notifyExamPublished, notifyExamResults, notifySafely } from "../../services/notifications/notificationService";
import { getBlindReview, getResults, releaseResults, saveReview } from "../../services/exams/blindReviewService";
import {
  ExamValidationError,
  closeExam,
  createExam,
  deleteExam,
  getManagedExam,
  listManagedExams,
  publishExam,
  updateExam,
} from "../../services/exams/examService";
import { getAttempt, listStudentExams, saveDraft, startExam, submitExam } from "../../services/exams/examSubmissionService";

export const examRouter = Router();
examRouter.use(requireAuth);
const origin = (req: Request) => getFrontendOrigin(req.get("origin"));

// ── Staff: build, publish and close exams ────────────────────────────────────
const manage = Router();
manage.use(requireRoles(["professor", "course-coordinator", "admin"]));
manage.get("/", asyncHandler(async (req, res) => res.json(await listManagedExams(getDb(), req.user!))));
manage.post("/", asyncHandler(async (req, res) => res.status(201).json(await createExam(getDb(), req.user!, req.body))));
manage.get("/:id", asyncHandler(async (req, res) => res.json(await getManagedExam(getDb(), req.user!, req.params.id))));
manage.put("/:id", asyncHandler(async (req, res) => res.json(await updateExam(getDb(), req.user!, req.params.id, req.body))));
manage.delete("/:id", asyncHandler(async (req, res) => {
  await deleteExam(getDb(), req.user!, req.params.id);
  return res.status(204).end();
}));
manage.post("/:id/publish", asyncHandler(async (req, res) => {
  const exam = await publishExam(getDb(), req.user!, req.params.id);
  await notifySafely("exam_published", () => notifyExamPublished(getDb(), exam.id, origin(req)));
  return res.json(exam);
}));
manage.post("/:id/close", asyncHandler(async (req, res) => res.json(await closeExam(getDb(), req.user!, req.params.id))));
// Blind grading: the payload never identifies students (RNF02).
manage.get("/:id/blind-review", asyncHandler(async (req, res) => res.json(await getBlindReview(getDb(), req.user!, req.params.id))));
manage.put("/blind-review/:reviewId", asyncHandler(async (req, res) => res.json(await saveReview(getDb(), req.user!, req.params.reviewId, req.body))));
manage.post("/:id/release", asyncHandler(async (req, res) => {
  const result = await releaseResults(getDb(), req.user!, req.params.id);
  await notifySafely("exam_results", () => notifyExamResults(getDb(), result.examId, result.studentIds, origin(req)));
  return res.json({ examId: result.examId, released: true, submissions: result.submissions });
}));
manage.get("/:id/results", asyncHandler(async (req, res) => res.json(await getResults(getDb(), req.user!, req.params.id))));
examRouter.use("/manage", manage);

// ── Students: take an exam ───────────────────────────────────────────────────
const student = requireRoles(["student"]);
examRouter.get("/student", student, asyncHandler(async (req, res) => res.json(await listStudentExams(getDb(), req.user!.id))));
examRouter.get("/:id/attempt", student, asyncHandler(async (req, res) => res.json(await getAttempt(getDb(), req.user!.id, req.params.id))));
examRouter.post("/:id/start", student, asyncHandler(async (req, res) => res.json(await startExam(getDb(), req.user!.id, req.params.id))));
examRouter.put("/:id/draft", student, asyncHandler(async (req, res) => res.json(await saveDraft(getDb(), req.user!.id, req.params.id, req.body))));
examRouter.post("/:id/submit", student, asyncHandler(async (req, res) =>
  res.json(await submitExam(getDb(), req.user!.id, req.params.id, req.body, new Date(), origin(req)))));

examRouter.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
  if (!(error instanceof ExamValidationError)) return next(error);
  return res.status(400).json({ code: "exams.invalid", message: t("exams.invalid", {}, req.language), issues: error.issues });
});
