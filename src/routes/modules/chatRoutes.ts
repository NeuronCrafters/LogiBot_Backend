import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { asyncHandler } from "../../http/asyncHandler";
import { requireAuth } from "../../http/auth";
import { getDb } from "../../db/client";
import { chatMessages, chatSessions } from "../../db/schema";
import { handleAsk } from "../routeHelpers";

export const chatRouter = Router();

chatRouter.use(requireAuth);

chatRouter.post("/messages", asyncHandler(async (req, res) => handleAsk(req, res)));

chatRouter.get("/sessions/:userId", asyncHandler(async (req, res) => {
  const rows = await getDb()
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.userId, req.params.userId))
    .orderBy(desc(chatSessions.lastActivityAt));
  return res.json(rows);
}));

chatRouter.get("/sessions/:userId/:sessionId/messages", asyncHandler(async (req, res) => {
  const [session] = await getDb()
    .select({ id: chatSessions.id })
    .from(chatSessions)
    .where(and(eq(chatSessions.userId, req.params.userId), eq(chatSessions.sessionId, req.params.sessionId)));
  if (!session) return res.json([]);
  const rows = await getDb()
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.chatSessionId, session.id))
    .orderBy(chatMessages.timestamp);
  return res.json(rows);
}));
