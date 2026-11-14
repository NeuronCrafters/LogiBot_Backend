import { getLanguage, isMessageKey, normalizeLanguage, withLanguage, t, type Language, type MessageParams } from "../../i18n";
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
import { AgentMessage } from "../ai/openRouterService";
import {
  generateChatResponse,
  streamChatResponse,
} from "../generation/generationService";
import {
  addChatTiming,
  type ChatTimings,
  measureChatTiming,
  type RetrievedRagChunk,
} from "../generation/generationTypes";
import { validateAndEnrichPrompt } from "../../utils/subjectExtractor";

const MAX_CHAT_TITLE_LENGTH = 56;
export const activeChatMessage = sql`coalesce(${chatMessages.metadata}->>'superseded', 'false') <> 'true'`;
const activeStreams = new Set<string>();

export function isDefaultChatTitle(title?: string | null) {
  return !title || ["Nova Conversa", "New Conversation", "Nueva conversación"].includes(title.trim());
}

export function buildChatSessionTitle(message: string) {
  const normalized = message
    .replace(/\s+/g, " ")
    .replace(/[`*_#>[\](){}]/g, "")
    .trim();

  if (!normalized) return t("chat.defaultTitle");
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
      : t("chat.defaultTitle");

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
      metadata: { ...input.metadata, ...(input.role === "assistant" ? { outputLanguage: getLanguage() } : { requestLanguage: getLanguage() }) },
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
    .where(and(eq(chatMessages.chatSessionId, session.id), activeChatMessage))
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
  if (!message) throw new AppError("chat.messageRequired", 400);

  const enriched = validateAndEnrichPrompt(message);
  const detectedTopic = enriched?.subject ?? null;

  const userMessage = await addChatMessage({
    userId: input.userId,
    sessionId: input.sessionId,
    role: "user",
    content: message,
    topic: detectedTopic,
  });

  if (detectedTopic) {
    await incrementTopicCount(input.userId, detectedTopic);
  }

  const [job] = await getDb()
    .insert(chatGenerationJobs)
    .values({
      userId: input.userId,
      chatSessionId: userMessage.chatSessionId,
      userMessageId: userMessage.messageId,
      status: "queued",
      outputLanguage: getLanguage(),
    })
    .returning({ id: chatGenerationJobs.id });

  logger.info("Chat", "Message received and job queued.", {
    userId: input.userId,
    sessionId: userMessage.sessionId,
    jobId: job.id,
    topic: detectedTopic || undefined,
  });

  return {
    status: "queued" as const,
    outputLanguage: getLanguage(),
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
  outputLanguage: Language;
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

function isTechnicalFallback(provider: string) {
  return provider.toLowerCase().includes("fallback");
}

type StreamChatCallbacks = {
  signal?: AbortSignal;
  onSession?: (payload: {
    sessionId: string;
    userMessageId: string;
  }) => void | Promise<void>;
  onStatus?: (stage: "queued" | "history" | "rag" | "agent") => void | Promise<void>;
  onRetrieval?: (chunks: RetrievedRagChunk[]) => void | Promise<void>;
  onToken?: (text: string) => void | Promise<void>;
};

export async function editChatMessage(input: {
  userId: string; sessionId: string; messageId: string; message: string; topic: string | null;
}) {
  if (!/^[0-9a-f-]{36}$/i.test(input.messageId)) throw new AppError("chat.editNotFound", 404);
  return getDb().transaction(async tx => {
    const [session] = await tx.select().from(chatSessions)
      .where(and(eq(chatSessions.userId, input.userId), eq(chatSessions.sessionId, input.sessionId)))
      .for("update");
    if (!session) throw new AppError("chat.editNotFound", 404);
    const [openJob] = await tx.select({ id: chatGenerationJobs.id }).from(chatGenerationJobs)
      .where(and(eq(chatGenerationJobs.chatSessionId, session.id), inArray(chatGenerationJobs.status, ["queued", "running"]))).limit(1);
    if (openJob) throw new AppError("chat.generationInProgress", 409);
    const messages = await tx.select().from(chatMessages)
      .where(and(eq(chatMessages.chatSessionId, session.id), activeChatMessage))
      .orderBy(asc(chatMessages.timestamp), asc(chatMessages.id));
    const index = messages.findIndex(row => row.id === input.messageId && row.role === "user");
    if (index < 0) throw new AppError("chat.editNotFound", 404);
    const target = messages[index];
    const laterIds = messages.slice(index + 1).map(row => row.id);
    if (laterIds.length) await tx.update(chatMessages).set({
      metadata: sql`${chatMessages.metadata} || ${JSON.stringify({ superseded: true, supersededBy: target.id })}::jsonb`,
    }).where(inArray(chatMessages.id, laterIds));
    await tx.update(chatMessages).set({
      content: input.message,
      detectedTopic: input.topic,
      metadata: { ...(target.metadata as Record<string, unknown>), previousContent: target.content,
        editedAt: new Date().toISOString(), requestLanguage: getLanguage() },
    }).where(eq(chatMessages.id, target.id));
    await tx.update(chatSessions).set({
      lastActivityAt: new Date(),
      ...(messages.find(row => row.role === "user")?.id === target.id ? { title: buildChatSessionTitle(input.message) } : {}),
    }).where(eq(chatSessions.id, session.id));
    return { sessionId: session.sessionId, chatSessionId: session.id, messageId: target.id };
  });
}

export async function streamChatMessage(
  input: { userId: string; message: string; sessionId?: string; editMessageId?: string },
  callbacks: StreamChatCallbacks = {},
) {
  const sessionId = input.sessionId || randomUUID();
  const key = `${input.userId}:${sessionId}`;
  if (activeStreams.has(key)) throw new AppError("chat.generationInProgress", 409);
  activeStreams.add(key);
  try { return await runChatMessageStream({ ...input, sessionId }, callbacks); }
  finally { activeStreams.delete(key); }
}

async function runChatMessageStream(
  input: {
    userId: string;
    message: string;
    sessionId?: string;
    editMessageId?: string;
  },
  callbacks: StreamChatCallbacks = {},
) {
  const message = String(input.message || "").trim();
  if (!message) throw new AppError("chat.messageRequired", 400);

  const totalStartedAt = process.hrtime.bigint();
  const timingsMs: ChatTimings = {};

  logger.info("Chat", "Streaming message received.", {
    userId: input.userId,
    sessionId: input.sessionId || "(new)",
  });

  await callbacks.onStatus?.("queued");

  const enriched = validateAndEnrichPrompt(message);
  const detectedTopic = enriched?.subject ?? null;

  const userMessage = input.editMessageId ? await editChatMessage({
    userId: input.userId, sessionId: input.sessionId!, messageId: input.editMessageId, message, topic: detectedTopic,
  }) : await addChatMessage({
    userId: input.userId,
    sessionId: input.sessionId,
    role: "user",
    content: message,
    topic: detectedTopic,
  });

  await callbacks.onSession?.({
    sessionId: userMessage.sessionId,
    userMessageId: userMessage.messageId,
  });

  if (detectedTopic) {
    await incrementTopicCount(input.userId, detectedTopic);
  }

  await callbacks.onStatus?.("history");

  const history = await measureChatTiming(timingsMs, "db/history", () =>
    getRecentChatMessages(input.userId, userMessage.sessionId),
  );

  const agentResponse = await streamChatResponse(
    {
      userId: input.userId,
      message,
      history,
      timings: timingsMs,
    },
    {
      signal: callbacks.signal,
      onStatus: (stage) => callbacks.onStatus?.(stage),
      onRetrieval: callbacks.onRetrieval,
      onToken: callbacks.onToken,
    },
  );

  if (callbacks.signal?.aborted) {
    logger.warn("Chat", "Streaming message aborted before persistence.", {
      userId: input.userId,
      sessionId: userMessage.sessionId,
    });
    return {
      aborted: true as const,
      sessionId: userMessage.sessionId,
      userMessageId: userMessage.messageId,
      timingsMs,
    };
  }

  if (isTechnicalFallback(agentResponse.provider)) {
    throw new AppError("chat.technicalFallback", 503);
  }

  addChatTiming(timingsMs, "total", totalStartedAt);

  const assistantMessage = await addChatMessage({
    userId: input.userId,
    sessionId: userMessage.sessionId,
    role: "assistant",
    content: agentResponse.text,
    topic: detectedTopic,
    metadata: {
      provider: agentResponse.provider,
      usage: agentResponse.usage,
      timingsMs,
      retrievedChunks: agentResponse.retrievedChunks,
    },
  });

  logger.info("Chat", "Streaming response generated.", {
    userId: input.userId,
    sessionId: userMessage.sessionId,
    provider: agentResponse.provider,
    timingsMs,
  });

  return {
    aborted: false as const,
    sessionId: userMessage.sessionId,
    userMessageId: userMessage.messageId,
    assistantMessageId: assistantMessage.messageId,
    provider: agentResponse.provider,
    retrievedChunks: agentResponse.retrievedChunks,
    usage: agentResponse.usage,
    timingsMs,
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timer: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new AppError("chat.jobTimedOut", 504)),
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
        j.output_language as "outputLanguage",
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
      outputLanguage: normalizeLanguage(row.outputLanguage) || "pt-BR",
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
      errorCode: input.error instanceof AppError ? input.error.code || null : null,
      errorParams: input.error instanceof AppError ? input.error.params : {},
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

  return withLanguage(locked.outputLanguage, async () => {
    const totalStartedAt = process.hrtime.bigint();
    const timingsMs: ChatTimings = {};

    logger.info("ChatWorker", "Job started.", {
      jobId: locked.jobId,
      userId: locked.userId,
      sessionId: locked.sessionId,
      attemptNumber: locked.attemptNumber,
      outputLanguage: getLanguage(),
    });

    try {
      const result = await withTimeout(
        (async () => {
          const history = await measureChatTiming(timingsMs, "db/history", () =>
            getRecentChatMessages(locked.userId, locked.sessionId),
          );

          const agentResponse = await generateChatResponse({
            userId: locked.userId,
            message: locked.message,
            history,
            timings: timingsMs,
          });

          if (isTechnicalFallback(agentResponse.provider)) {
            throw new AppError("chat.technicalFallback", 503);
          }

          const assistantMessage = await addChatMessage({
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
          });

          return { agentResponse, assistantMessage };
        })(),
        getChatGenerationJobTimeoutMs(),
      );

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
        outputLanguage: getLanguage(),
        timingsMs,
      });

      return true;
    } catch (error) {
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
  });
}

async function getQueuePosition(job: {
  id: string;
  status: string;
  createdAt: Date;
}) {
  if (job.status !== "queued") return null;

  const maxAttempts = getChatGenerationMaxAttempts();

  // Mirrors lockNextChatJob's eligibility filter (status + attempts), so the
  // count reflects only jobs that can actually be picked up before this one —
  // jobs that exhausted their retries are about to become "failed" and should
  // not inflate the position shown to the user.
  const result = await getDb().execute(sql`
    select count(*)::int as "count"
    from chat_generation_jobs
    where status = 'queued'
      and attempts < ${maxAttempts}
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
      errorCode: chatGenerationJobs.errorCode,
      errorParams: chatGenerationJobs.errorParams,
      outputLanguage: chatGenerationJobs.outputLanguage,
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

  if (!row) throw new AppError("chat.jobNotFound", 404);

  const base = {
    status: row.status,
    jobId: row.id,
    outputLanguage: row.outputLanguage,
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
      errorMessage: row.errorCode && isMessageKey(row.errorCode)
        ? new AppError({ key: row.errorCode as import("../../i18n").MessageKey, params: row.errorParams as MessageParams }).message
        : getLanguage() === "pt-BR" && row.errorMessage ? row.errorMessage : t("chat.jobFailed"),
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
    .where(and(eq(chatMessages.chatSessionId, session.id), activeChatMessage))
    .orderBy(asc(chatMessages.timestamp));
}
