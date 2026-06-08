import { Router } from "express";
import { asyncHandler } from "../../http/asyncHandler";
import { requireAuth } from "../../http/auth";
import {
  getChatGenerationJobStatus,
  listChatSessionMessages,
  listChatSessions,
  listOpenChatGenerationJobs,
  sendChatMessage,
} from "../../services/chat/chatService";

export const chatRouter = Router();

chatRouter.use(requireAuth);

chatRouter.post(
  "/messages",
  asyncHandler(async (req, res) => {
    const message = String(req.body.message || req.body.text || "").trim();
    const sessionId = req.body.sessionId
      ? String(req.body.sessionId)
      : undefined;
    return res
      .status(202)
      .json(await sendChatMessage({ userId: req.user!.id, message, sessionId }));
  }),
);

chatRouter.get(
  "/jobs/:jobId",
  asyncHandler(async (req, res) => {
    return res.json(
      await getChatGenerationJobStatus(req.user!.id, req.params.jobId),
    );
  }),
);

chatRouter.get(
  "/sessions/:userId",
  asyncHandler(async (req, res) => {
    return res.json(await listChatSessions(req.params.userId));
  }),
);

chatRouter.get(
  "/sessions/:userId/:sessionId/jobs/open",
  asyncHandler(async (req, res) => {
    return res.json(
      await listOpenChatGenerationJobs(req.user!.id, req.params.sessionId),
    );
  }),
);

chatRouter.get(
  "/sessions/:userId/:sessionId/messages",
  asyncHandler(async (req, res) => {
    return res.json(
      await listChatSessionMessages(req.params.userId, req.params.sessionId),
    );
  }),
);
