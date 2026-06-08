import { randomUUID } from "crypto";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../db/client";
import { chatMessages, chatSessions, chatTopicCounts } from "../../db/schema";
import { AppError } from "../../exceptions/AppError";
import { logger } from "../../logger";
import {
  measureChatStage,
  observeChatStage,
} from "../../observability/metrics";
import { AgentMessage } from "../ai/digitalOceanAgentService";
import { generateChatResponse } from "../generation/generationService";
import { validateAndEnrichPrompt } from "../../utils/subjectExtractor";

const DEFAULT_CHAT_TITLE = "Nova Conversa";
const MAX_CHAT_TITLE_LENGTH = 56;

export function isDefaultChatTitle(title?: string | null) {
  return !title || title.trim() === DEFAULT_CHAT_TITLE;
}

export function buildChatSessionTitle(message: string) {
  const normalized = message
    .replace(/\s+/g, " ")
    .replace(/[`*_#>[\](){}]/g, "")
    .trim();

  if (!normalized) return DEFAULT_CHAT_TITLE;
  if (normalized.length <= MAX_CHAT_TITLE_LENGTH) return normalized;

  return `${normalized.slice(0, MAX_CHAT_TITLE_LENGTH - 1).trimEnd()}...`;
}

export async function addChatMessage(input: {
  userId: string;
  sessionId?: string;
  role: "user" | "assistant";
  content: string;
  topic?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const db = getDb();
  const currentSessionId = input.sessionId || randomUUID();
  const title =
    input.role === "user"
      ? buildChatSessionTitle(input.content)
      : DEFAULT_CHAT_TITLE;

  await db
    .insert(chatSessions)
    .values({ userId: input.userId, sessionId: currentSessionId, title })
    .onConflictDoUpdate({
      target: [chatSessions.userId, chatSessions.sessionId],
      set: { lastActivityAt: new Date() },
    });

  const [session] = await db
    .select({ id: chatSessions.id, title: chatSessions.title })
    .from(chatSessions)
    .where(
      and(
        eq(chatSessions.userId, input.userId),
        eq(chatSessions.sessionId, currentSessionId),
      ),
    );

  if (input.role === "user" && isDefaultChatTitle(session.title)) {
    await db
      .update(chatSessions)
      .set({ title })
      .where(eq(chatSessions.id, session.id));
  }

  await db.insert(chatMessages).values({
    chatSessionId: session.id,
    role: input.role,
    content: input.content,
    detectedTopic: input.topic || null,
    metadata: input.metadata || {},
  });

  return { sessionId: currentSessionId };
}

export async function getRecentChatMessages(
  userId: string,
  sessionId: string,
  limit = 10,
): Promise<AgentMessage[]> {
  const db = getDb();
  const [session] = await db
    .select({ id: chatSessions.id })
    .from(chatSessions)
    .where(
      and(
        eq(chatSessions.userId, userId),
        eq(chatSessions.sessionId, sessionId),
      ),
    );

  if (!session) return [];

  const rows = await db
    .select({ role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(eq(chatMessages.chatSessionId, session.id))
    .orderBy(desc(chatMessages.timestamp))
    .limit(limit);

  return rows
    .reverse()
    .filter((row) => row.role === "user" || row.role === "assistant")
    .map((row) => ({
      role: row.role as "user" | "assistant",
      content: row.content,
    }));
}

export async function incrementTopicCount(userId: string, topic: string) {
  await getDb()
    .insert(chatTopicCounts)
    .values({ userId, topic, count: 1 })
    .onConflictDoUpdate({
      target: [chatTopicCounts.userId, chatTopicCounts.topic],
      set: { count: sql`${chatTopicCounts.count} + 1` },
    });
}

export async function sendChatMessage(input: {
  userId: string;
  message: string;
  sessionId?: string;
}) {
  const message = String(input.message || "").trim();
  if (!message) throw new AppError("message e obrigatorio", 400);

  const totalStartedAt = process.hrtime.bigint();
  try {
    logger.info("Chat", "Message received.", {
      userId: input.userId,
      sessionId: input.sessionId || "(new)",
    });

    const enriched = validateAndEnrichPrompt(message);
    const detectedTopic = enriched?.subject ?? null;

    const userMessage = await measureChatStage("save_user_message", () =>
      addChatMessage({
        userId: input.userId,
        sessionId: input.sessionId,
        role: "user",
        content: message,
        topic: detectedTopic,
      }),
    );

    await measureChatStage("topic_count", async () => {
      if (!detectedTopic) return;
      logger.info("Chat", "Topic detected.", {
        userId: input.userId,
        topic: detectedTopic,
      });
      await incrementTopicCount(input.userId, detectedTopic);
    });

    const history = await measureChatStage("load_history", () =>
      getRecentChatMessages(input.userId, userMessage.sessionId),
    );

    const agentResponse = await measureChatStage("generate_response", () =>
      generateChatResponse({
        userId: input.userId,
        message,
        history,
      }),
    );

    const responseText = agentResponse.text;
    const provider = agentResponse.provider;
    const retrievedChunks = agentResponse.retrievedChunks;

    logger.info("Chat", "Response generated.", {
      userId: input.userId,
      sessionId: userMessage.sessionId,
      provider,
    });

    await measureChatStage("save_assistant_message", () =>
      addChatMessage({
        userId: input.userId,
        sessionId: userMessage.sessionId,
        role: "assistant",
        content: responseText,
        topic: detectedTopic,
        metadata: retrievedChunks?.length ? { retrievedChunks } : undefined,
      }),
    );

    return {
      responses: [{ text: responseText }],
      sessionId: userMessage.sessionId,
      detectedTopic,
      provider,
      retrievedChunks: retrievedChunks?.length ? retrievedChunks : undefined,
    };
  } finally {
    observeChatStage("total", totalStartedAt);
  }
}

export async function listChatSessions(userId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.userId, userId))
    .orderBy(desc(chatSessions.lastActivityAt));

  return Promise.all(
    rows.map(async (session) => {
      if (!isDefaultChatTitle(session.title)) return session;

      const [firstUserMessage] = await db
        .select({ content: chatMessages.content })
        .from(chatMessages)
        .where(
          and(
            eq(chatMessages.chatSessionId, session.id),
            eq(chatMessages.role, "user"),
          ),
        )
        .orderBy(asc(chatMessages.timestamp))
        .limit(1);

      if (!firstUserMessage?.content) return session;

      const title = buildChatSessionTitle(firstUserMessage.content);
      await db
        .update(chatSessions)
        .set({ title })
        .where(eq(chatSessions.id, session.id));

      return { ...session, title };
    }),
  );
}

export async function listChatSessionMessages(
  userId: string,
  sessionId: string,
) {
  const db = getDb();
  const [session] = await db
    .select({ id: chatSessions.id })
    .from(chatSessions)
    .where(
      and(
        eq(chatSessions.userId, userId),
        eq(chatSessions.sessionId, sessionId),
      ),
    );

  if (!session) return [];

  return db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.chatSessionId, session.id))
    .orderBy(asc(chatMessages.timestamp));
}
