import { Router } from "express";
import { getDb } from "../../db/client";
import { asyncHandler } from "../../http/asyncHandler";
import { requireAuth, requireRoles } from "../../http/auth";
import { feedbackSummary, listNotUseful, listSessionFeedback, saveFeedback } from "../../services/chat/chatFeedbackService";

export const chatFeedbackRouter = Router();
chatFeedbackRouter.use(requireAuth);

// Each person rates only answers of their own conversations, once (ratings are final).
chatFeedbackRouter.put(
  "/messages/:messageId",
  asyncHandler(async (req, res) => res.json(await saveFeedback(getDb(), req.user!.id, req.params.messageId, req.body))),
);

chatFeedbackRouter.get(
  "/sessions/:sessionId",
  asyncHandler(async (req, res) => res.json(await listSessionFeedback(getDb(), req.user!.id, req.params.sessionId))),
);

// Aggregated view to improve answers; small groups are hidden and no person is identified.
chatFeedbackRouter.get(
  "/summary",
  requireRoles(["admin"]),
  asyncHandler(async (req, res) => res.json(await feedbackSummary(getDb(), { days: req.query.days, institutionId: req.query.institutionId, courseId: req.query.courseId, classId: req.query.classId }))),
);

// The same answers as the summary's recent list, one page at a time.
chatFeedbackRouter.get(
  "/not-useful",
  requireRoles(["admin"]),
  asyncHandler(async (req, res) => res.json(await listNotUseful(getDb(), {
    days: req.query.days, institutionId: req.query.institutionId, courseId: req.query.courseId, classId: req.query.classId,
    page: req.query.page, pageSize: req.query.pageSize, rating: req.query.rating,
  }))),
);
