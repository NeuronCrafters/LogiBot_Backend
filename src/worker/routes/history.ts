import { Hono } from "hono";
import { HttpError } from "../errors";
import { requireAuth } from "../http/auth";
import { getSessionChatMessages, getUserChatSessions } from "../services/chatHistory";
import type { AppBindings } from "../types";

export const historyRoutes = new Hono<AppBindings>();

historyRoutes.use("/history/*", requireAuth);

historyRoutes.get("/history/chat/sessions/:userId", async (c) => {
  const user = c.get("user")!;
  const { userId } = c.req.param();

  if (user.id !== userId && !user.role.includes("admin")) {
    throw new HttpError("acesso nao autorizado", 403);
  }

  const sessions = await getUserChatSessions(c.env, userId);
  return c.json(sessions);
});

historyRoutes.get("/history/chat/messages/:userId/:sessionId", async (c) => {
  const user = c.get("user")!;
  const { userId, sessionId } = c.req.param();

  if (user.id !== userId && !user.role.includes("admin")) {
    throw new HttpError("acesso nao autorizado", 403);
  }

  const session = await getSessionChatMessages(c.env, userId, sessionId);
  if (!session) return c.json({ messages: [] });
  return c.json(session);
});
