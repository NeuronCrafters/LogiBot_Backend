import { and, desc, eq, sql } from "drizzle-orm";
import { chatMessages, chatSessions, chatTopicCounts } from "../../db/schema";
import { getDb } from "../db/client";
import type { Env } from "../types";

export async function addChatMessage(
  env: Env,
  input: {
    userId: string;
    sessionId?: string;
    role: "user" | "assistant";
    content: string;
    topic?: string | null;
  },
): Promise<{ sessionId: string }> {
  const db = getDb(env);
  const currentSessionId = input.sessionId ?? crypto.randomUUID();

  await db
    .insert(chatSessions)
    .values({ userId: input.userId, sessionId: currentSessionId, title: "Nova Conversa" })
    .onConflictDoUpdate({
      target: [chatSessions.userId, chatSessions.sessionId],
      set: { lastActivityAt: new Date() },
    });

  const [session] = await db
    .select({ id: chatSessions.id })
    .from(chatSessions)
    .where(and(eq(chatSessions.userId, input.userId), eq(chatSessions.sessionId, currentSessionId)));

  await db.insert(chatMessages).values({
    chatSessionId: session.id,
    role: input.role,
    content: input.content,
    detectedTopic: input.topic ?? null,
  });

  return { sessionId: currentSessionId };
}

export async function getUserChatSessions(env: Env, userId: string) {
  const db = getDb(env);
  return db
    .select({
      sessionId: chatSessions.sessionId,
      title: chatSessions.title,
      startedAt: chatSessions.startedAt,
      lastActivityAt: chatSessions.lastActivityAt,
    })
    .from(chatSessions)
    .where(eq(chatSessions.userId, userId))
    .orderBy(desc(chatSessions.lastActivityAt));
}

export async function getSessionChatMessages(env: Env, userId: string, sessionId: string) {
  const db = getDb(env);
  const [session] = await db
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.userId, userId), eq(chatSessions.sessionId, sessionId)));

  if (!session) return null;

  const messages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.chatSessionId, session.id))
    .orderBy(chatMessages.timestamp);

  return {
    sessionId: session.sessionId,
    title: session.title,
    startedAt: session.startedAt,
    lastActivityAt: session.lastActivityAt,
    messages,
  };
}

export async function incrementTopicCount(env: Env, userId: string, topic: string) {
  const db = getDb(env);
  await db
    .insert(chatTopicCounts)
    .values({ userId, topic, count: 1 })
    .onConflictDoUpdate({
      target: [chatTopicCounts.userId, chatTopicCounts.topic],
      set: { count: sql`${chatTopicCounts.count} + 1` },
    });
}
