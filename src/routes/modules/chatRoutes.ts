import { Router } from "express";
import { asyncHandler } from "../../http/asyncHandler";
import { requireAuth } from "../../http/auth";
import {
  getChatGenerationJobStatus,
  listChatSessionMessages,
  listChatSessions,
  listOpenChatGenerationJobs,
  sendChatMessage,
  streamChatMessage,
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

function writeSse(res: import("express").Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

chatRouter.post(
  "/messages/stream",
  asyncHandler(async (req, res) => {
    const message = String(req.body.message || req.body.text || "").trim();
    const sessionId = req.body.sessionId
      ? String(req.body.sessionId)
      : undefined;

    const abortController = new AbortController();
    let completed = false;

    req.on("close", () => {
      if (!completed) abortController.abort();
    });

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    try {
      const result = await streamChatMessage(
        { userId: req.user!.id, message, sessionId },
        {
          signal: abortController.signal,
          onSession: (payload) => writeSse(res, "session", payload),
          onStatus: (stage) => writeSse(res, "status", { stage }),
          onRetrieval: (retrievedChunks) =>
            writeSse(res, "retrieval", { retrievedChunks }),
          onToken: (text) => writeSse(res, "token", { text }),
        },
      );

      completed = true;

      if (!result.aborted) {
        writeSse(res, "done", {
          provider: result.provider,
          retrievedChunks: result.retrievedChunks,
          timingsMs: result.timingsMs,
          usage: result.usage,
        });
      }
    } catch (error) {
      completed = true;
      if (!res.writableEnded) {
        writeSse(res, "error", {
          message:
            error instanceof Error
              ? error.message
              : "Erro ao processar mensagem.",
        });
      }
    } finally {
      completed = true;
      res.end();
    }
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
