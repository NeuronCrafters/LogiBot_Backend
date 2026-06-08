import { randomUUID } from "crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../../db/client";
import {
  chatGenerationJobs,
  chatMessages,
  chatSessions,
  chatTopicCounts,
} from "../../db/schema";
import { AppError } from "../../exceptions/AppError";
import { logger } from "../../logger";
import {
  measureChatStage,
  observeChatStage,
} from "../../observability/metrics";
import { AgentMessage } from "../ai/digitalOceanAgentService";
import { generateChatResponse } from "../generation/generationService";
import {
  addChatTiming,
  type ChatTimings,
  measureChatTiming,
} from "../generation/generationTypes";
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

  const [message] = await db
    .insert(chatMessages)
    .values({
      chatSessionId: session.id,
      role: input.role,
      content: input.content,
      detectedTopic: input.topic || null,
      metadata: input.metadata || {},
    })
    .returning({ id: chatMessages.id });

  return {
    sessionId: currentSessionId,
    chatSessionId: session.id,
    messageId: message.id,
  };
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

  const [job] = await getDb()
    .insert(chatGenerationJobs)
    .values({
      userId: input.userId,
      chatSessionId: userMessage.chatSessionId,
      userMessageId: userMessage.messageId,
      status: "queued",
    })
    .returning({ id: chatGenerationJobs.id });

  logger.info("Chat", "Generation job queued.", {
    userId: input.userId,
    sessionId: userMessage.sessionId,
    jobId: job.id,
  });

  return {
    status: "queued" as const,
    jobId: job.id,
    sessionId: userMessage.sessionId,
    userMessageId: userMessage.messageId,
    detectedTopic,
  };
}

type LockedChatJob = {
  jobId: string;
  userId: string;
  chatSessionId: string;
  sessionId: string;
  userMessageId: string;
  message: string;
  detectedTopic: string | null;
  attemptNumber: number;
};

function rowsFromExecute(result: any): any[] {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.rows)) return result.rows;
  return [];
}

function getChatGenerationMaxAttempts() {
  const value = Number(process.env.CHAT_GENERATION_MAX_ATTEMPTS || 1);
  return Number.isInteger(value) && value > 0 ? value : 1;
}

function getChatGenerationJobTimeoutMs() {
  const value = Number(process.env.CHAT_GENERATION_JOB_TIMEOUT_MS || 600_000);
  return Number.isFinite(value) && value > 0 ? value : 600_000;
}

function isTechnicalFallback(text: string, provider: string) {
  return (
    provider.toLowerCase().includes("fallback") ||
    text.toLowerCase().includes("tive um problema tecnico")
  );
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timer: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error("tempo maximo do job de chat excedido")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function lockNextChatJob(): Promise<LockedChatJob | null> {
  const db = getDb();
  const maxAttempts = getChatGenerationMaxAttempts();

  return db.transaction(async (tx) => {
    const result = await tx.execute(sql`
      select
        j.id as "jobId",
        j.user_id as "userId",
        j.chat_session_id as "chatSessionId",
        j.user_message_id as "userMessageId",
        j.attempts as "attempts",
        s.session_id as "sessionId",
        m.content as "message",
        m.detected_topic as "detectedTopic"
      from chat_generation_jobs j
      inner join chat_sessions s on s.id = j.chat_session_id
      inner join chat_messages m on m.id = j.user_message_id
      where j.status = 'queued'
        and j.attempts < ${maxAttempts}
      order by j.created_at asc
      limit 1
      for update skip locked
    `);

    const [row] = rowsFromExecute(result);
    if (!row) return null;

    const now = new Date();
    await tx
      .update(chatGenerationJobs)
      .set({
        status: "running",
        attempts: sql`${chatGenerationJobs.attempts} + 1`,
        lockedAt: now,
        startedAt: now,
        updatedAt: now,
        errorMessage: null,
      })
      .where(eq(chatGenerationJobs.id, row.jobId));

    return {
      jobId: row.jobId,
      userId: row.userId,
      chatSessionId: row.chatSessionId,
      sessionId: row.sessionId,
      userMessageId: row.userMessageId,
      message: row.message,
      detectedTopic: row.detectedTopic,
      attemptNumber: Number(row.attempts || 0) + 1,
    };
  });
}

async function markChatJobFailed(input: {
  jobId: string;
  attemptNumber: number;
  error: unknown;
}) {
  const now = new Date();
  const message =
    input.error instanceof Error
      ? input.error.message.slice(0, 500)
      : "erro desconhecido";
  const shouldRetry = input.attemptNumber < getChatGenerationMaxAttempts();

  await getDb()
    .update(chatGenerationJobs)
    .set({
      status: shouldRetry ? "queued" : "failed",
      errorMessage: message,
      lockedAt: null,
      updatedAt: now,
      completedAt: shouldRetry ? null : now,
    })
    .where(eq(chatGenerationJobs.id, input.jobId));
}

async function markChatJobDone(input: {
  jobId: string;
  assistantMessageId: string;
  provider: string;
  retrievedChunks: unknown[];
  timingsMs: ChatTimings;
}) {
  const now = new Date();
  await getDb()
    .update(chatGenerationJobs)
    .set({
      status: "done",
      assistantMessageId: input.assistantMessageId,
      provider: input.provider,
      retrievedChunks: input.retrievedChunks,
      timingsMs: input.timingsMs,
      errorMessage: null,
      lockedAt: null,
      completedAt: now,
      updatedAt: now,
    })
    .where(eq(chatGenerationJobs.id, input.jobId));
}

export async function processNextChatGenerationJob() {
  const locked = await lockNextChatJob();
  if (!locked) return false;

  const totalStartedAt = process.hrtime.bigint();
  const timingsMs: ChatTimings = {};

  logger.info("ChatWorker", "Job started.", {
    jobId: locked.jobId,
    userId: locked.userId,
    sessionId: locked.sessionId,
    attemptNumber: locked.attemptNumber,
  });

  try {
    const result = await withTimeout(
      (async () => {
        const history = await measureChatStage("load_history", () =>
          measureChatTiming(timingsMs, "db/history", () =>
            getRecentChatMessages(locked.userId, locked.sessionId),
          ),
        );

        const agentResponse = await measureChatStage("generate_response", () =>
          generateChatResponse({
            userId: locked.userId,
            message: locked.message,
            history,
            timings: timingsMs,
          }),
        );

        if (isTechnicalFallback(agentResponse.text, agentResponse.provider)) {
          throw new Error("Agent retornou fallback tecnico");
        }

        const assistantMessage = await measureChatStage("save_assistant_message", () =>
          addChatMessage({
            userId: locked.userId,
            sessionId: locked.sessionId,
            role: "assistant",
            content: agentResponse.text,
            topic: locked.detectedTopic,
            metadata: {
              chatGenerationJobId: locked.jobId,
              provider: agentResponse.provider,
              timingsMs,
              retrievedChunks: agentResponse.retrievedChunks,
            },
          }),
        );

        return { agentResponse, assistantMessage };
      })(),
      getChatGenerationJobTimeoutMs(),
    );

    observeChatStage("total", totalStartedAt);
    addChatTiming(timingsMs, "total", totalStartedAt);

    await markChatJobDone({
      jobId: locked.jobId,
      assistantMessageId: result.assistantMessage.messageId,
      provider: result.agentResponse.provider,
      retrievedChunks: result.agentResponse.retrievedChunks,
      timingsMs,
    });

    logger.info("ChatWorker", "Job completed.", {
      jobId: locked.jobId,
      userId: locked.userId,
      sessionId: locked.sessionId,
      provider: result.agentResponse.provider,
      timingsMs,
    });

    return true;
  } catch (error) {
    observeChatStage("total", totalStartedAt);
    addChatTiming(timingsMs, "total", totalStartedAt);

    logger.error("ChatWorker", "Job failed.", {
      jobId: locked.jobId,
      userId: locked.userId,
      sessionId: locked.sessionId,
      message: error instanceof Error ? error.message : String(error),
      timingsMs,
    });
    await markChatJobFailed({
      jobId: locked.jobId,
      attemptNumber: locked.attemptNumber,
      error,
    });
    return true;
  }
}

async function getQueuePosition(job: {
  id: string;
  status: string;
  createdAt: Date;
}) {
  if (job.status !== "queued") return null;

  const result = await getDb().execute(sql`
    select count(*)::int as "count"
    from chat_generation_jobs
    where status = 'queued'
      and created_at <= ${job.createdAt}
  `);

  const [row] = rowsFromExecute(result);
  const count = Number(row?.count || 0);
  return count > 0 ? count : null;
}

export async function getChatGenerationJobStatus(userId: string, jobId: string) {
  const [row] = await getDb()
    .select({
      id: chatGenerationJobs.id,
      status: chatGenerationJobs.status,
      provider: chatGenerationJobs.provider,
      retrievedChunks: chatGenerationJobs.retrievedChunks,
      timingsMs: chatGenerationJobs.timingsMs,
      errorMessage: chatGenerationJobs.errorMessage,
      userMessageId: chatGenerationJobs.userMessageId,
      assistantMessageId: chatGenerationJobs.assistantMessageId,
      createdAt: chatGenerationJobs.createdAt,
      startedAt: chatGenerationJobs.startedAt,
      completedAt: chatGenerationJobs.completedAt,
      sessionId: chatSessions.sessionId,
      assistantText: chatMessages.content,
    })
    .from(chatGenerationJobs)
    .innerJoin(chatSessions, eq(chatSessions.id, chatGenerationJobs.chatSessionId))
    .leftJoin(chatMessages, eq(chatMessages.id, chatGenerationJobs.assistantMessageId))
    .where(
      and(
        eq(chatGenerationJobs.id, jobId),
        eq(chatGenerationJobs.userId, userId),
      ),
    )
    .limit(1);

  if (!row) throw new AppError("job de chat nao encontrado", 404);

  const base = {
    status: row.status,
    jobId: row.id,
    sessionId: row.sessionId,
    userMessageId: row.userMessageId,
    timingsMs: row.timingsMs || {},
    startedAt: row.startedAt,
    completedAt: row.completedAt,
  };

  if (row.status === "done") {
    return {
      ...base,
      responses: [{ text: row.assistantText || "" }],
      provider: row.provider,
      retrievedChunks: row.retrievedChunks || [],
    };
  }

  if (row.status === "failed") {
    return {
      ...base,
      errorMessage:
        row.errorMessage ||
        "Nao consegui concluir sua resposta agora. Tente novamente.",
    };
  }

  return {
    ...base,
    queuePosition: await getQueuePosition({
      id: row.id,
      status: row.status,
      createdAt: row.createdAt,
    }),
  };
}

export async function listOpenChatGenerationJobs(
  userId: string,
  sessionId: string,
) {
  const rows = await getDb()
    .select({
      id: chatGenerationJobs.id,
      status: chatGenerationJobs.status,
      userMessageId: chatGenerationJobs.userMessageId,
      timingsMs: chatGenerationJobs.timingsMs,
      startedAt: chatGenerationJobs.startedAt,
      createdAt: chatGenerationJobs.createdAt,
      sessionId: chatSessions.sessionId,
    })
    .from(chatGenerationJobs)
    .innerJoin(chatSessions, eq(chatSessions.id, chatGenerationJobs.chatSessionId))
    .where(
      and(
        eq(chatGenerationJobs.userId, userId),
        eq(chatSessions.sessionId, sessionId),
        inArray(chatGenerationJobs.status, ["queued", "running"]),
      ),
    )
    .orderBy(asc(chatGenerationJobs.createdAt));

  return Promise.all(
    rows.map(async (row) => ({
      status: row.status,
      jobId: row.id,
      sessionId: row.sessionId,
      userMessageId: row.userMessageId,
      timingsMs: row.timingsMs || {},
      startedAt: row.startedAt,
      queuePosition: await getQueuePosition({
        id: row.id,
        status: row.status,
        createdAt: row.createdAt,
      }),
    })),
  );
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
