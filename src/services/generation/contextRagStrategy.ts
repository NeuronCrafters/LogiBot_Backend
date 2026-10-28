import { t } from "../../i18n";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "../../db/client";
import { ragDocumentChunks, ragDocuments } from "../../db/schema";
import { logger } from "../../logger";
import {
  askOpenRouter,
  streamOpenRouter,
} from "../ai/openRouterService";
import { createEmbeddingProvider } from "../embeddings/embeddingServiceProvider";
import { getOrCreateRagCollection } from "../rag/chromaService";
import {
  measureChatTiming,
  type GenerationInput,
  type GenerationResult,
  type GenerationStreamCallbacks,
  type RetrievedRagChunk,
  type RuntimeRagSettings,
} from "./generationTypes";
import { buildRagRetrievalQuery } from "./ragRetrievalQuery";

export function getEmptyContextText() {
  return t("rag.emptyContext");
}

function distanceToScore(distance: unknown) {
  if (typeof distance !== "number" || !Number.isFinite(distance)) return 100;
  return Math.round((1 / (1 + Math.max(0, distance))) * 100);
}

export function buildSystemPrompt(settings: RuntimeRagSettings, chunks: RetrievedRagChunk[]) {
  const customPrompt = settings.systemPrompt
    ? t("rag.professorInstruction", { instruction: settings.systemPrompt })
    : "";

  const context = chunks
    .map(
      (chunk, index) =>
        `[${index + 1}] ${chunk.documentTitle} - ${t("common.chunk", { number: chunk.chunkIndex + 1 })}\n${chunk.content}`,
    )
    .join("\n\n");

  return `${customPrompt}<contexto_recuperado>
${context || "(sem contexto recuperado)"}
</contexto_recuperado>`;
}

function getEmbeddingQueryTimeoutMs() {
  const value = Number(process.env.EMBEDDING_QUERY_TIMEOUT_MS || 15_000);
  return Number.isFinite(value) && value > 0 ? value : 15_000;
}

export async function queryChroma(input: {
  classId: string;
  message: string;
  topK: number;
  timings?: GenerationInput["timings"];
}) {
  const provider = createEmbeddingProvider();
  const embeddingResult = await measureChatTiming(input.timings, "embedding", () =>
    provider.embedTexts([input.message], {
      timeoutMs: getEmbeddingQueryTimeoutMs(),
    }),
  );

  const result = await measureChatTiming(input.timings, "chroma query", async () => {
    const collection = await getOrCreateRagCollection();
    return collection.query({
      queryEmbeddings: embeddingResult.embeddings,
      nResults: Math.max(input.topK * 3, input.topK),
      where: { classId: input.classId },
    } as any);
  });

  const ids = (result.ids?.[0] || []).filter(Boolean) as string[];
  const distances = result.distances?.[0] || [];

  return ids.map((chromaId, index) => ({
    chromaId,
    score: distanceToScore(distances[index]),
  }));
}

export async function revalidateChunks(input: {
  classId: string;
  candidates: { chromaId: string; score: number }[];
  topK: number;
  minScore: number;
}) {
  const filteredCandidates = input.candidates.filter(
    (candidate) => candidate.score >= input.minScore,
  );

  const chromaIds = filteredCandidates.map((candidate) => candidate.chromaId);
  if (!chromaIds.length) return [];

  const rows = await getDb()
    .select({
      chromaId: ragDocumentChunks.chromaId,
      documentId: ragDocumentChunks.documentId,
      chunkIndex: ragDocumentChunks.chunkIndex,
      content: ragDocumentChunks.content,
      documentTitle: ragDocuments.title,
    })
    .from(ragDocumentChunks)
    .innerJoin(ragDocuments, eq(ragDocuments.id, ragDocumentChunks.documentId))
    .where(
      and(
        inArray(ragDocumentChunks.chromaId, chromaIds),
        eq(ragDocumentChunks.classId, input.classId),
        eq(ragDocuments.classId, input.classId),
        eq(ragDocuments.status, "ready"),
        isNull(ragDocuments.deletedAt),
      ),
    );

  const byId = new Map(rows.map((row) => [row.chromaId, row]));

  return filteredCandidates
    .map((candidate) => {
      const row = byId.get(candidate.chromaId);
      if (!row) return null;
      return {
        chromaId: row.chromaId,
        documentId: row.documentId,
        documentTitle: row.documentTitle,
        chunkIndex: row.chunkIndex,
        score: candidate.score,
        content: row.content,
      } satisfies RetrievedRagChunk;
    })
    .filter(Boolean)
    .slice(0, input.topK) as RetrievedRagChunk[];
}

export async function generateContextRagResponse(
  input: GenerationInput & { settings: RuntimeRagSettings },
): Promise<GenerationResult> {
  const retrievalQuery = buildRagRetrievalQuery({
    message: input.message,
    history: input.history,
  });

  const candidates = await queryChroma({
    classId: input.settings.classId,
    message: retrievalQuery.query,
    topK: input.settings.topK,
    timings: input.timings,
  });

  const retrievedChunks = await revalidateChunks({
    classId: input.settings.classId,
    candidates,
    topK: input.settings.topK,
    minScore: input.settings.minScore,
  });

  logger.info("ContextRAG", "Context retrieved for chat.", {
    classId: input.settings.classId,
    topK: input.settings.topK,
    minScore: input.settings.minScore,
    candidateCount: candidates.length,
    retrievedCount: retrievedChunks.length,
    contextualizedQuery: retrievalQuery.contextualized,
    previousUserMessageCount: retrievalQuery.previousUserMessageCount,
  });

  if (!retrievedChunks.length) {
    return {
      text: getEmptyContextText(),
      provider: "rag-context-empty",
      retrievedChunks: [],
    };
  }

  const agentResponse = await measureChatTiming(input.timings, input.agentTimingStage || "agent", () =>
    askOpenRouter([
      {
        role: "system",
        content: buildSystemPrompt(input.settings, retrievedChunks),
      },
      ...input.history,
    ], {
      timeoutMs: input.agentTimeoutMs,
      queueTimeoutMs: input.agentQueueTimeoutMs,
    }),
  );

  return {
    text:
      agentResponse?.text ??
      t("chat.fallback"),
    provider: agentResponse?.provider ?? "fallback",
    retrievedChunks,
  };
}

export async function streamContextRagResponse(
  input: GenerationInput & { settings: RuntimeRagSettings },
  callbacks: GenerationStreamCallbacks = {},
): Promise<GenerationResult> {
  await callbacks.onStatus?.("rag");

  const retrievalQuery = buildRagRetrievalQuery({
    message: input.message,
    history: input.history,
  });

  const candidates = await queryChroma({
    classId: input.settings.classId,
    message: retrievalQuery.query,
    topK: input.settings.topK,
    timings: input.timings,
  });

  const retrievedChunks = await revalidateChunks({
    classId: input.settings.classId,
    candidates,
    topK: input.settings.topK,
    minScore: input.settings.minScore,
  });

  logger.info("ContextRAG", "Context retrieved for streaming chat.", {
    classId: input.settings.classId,
    topK: input.settings.topK,
    minScore: input.settings.minScore,
    candidateCount: candidates.length,
    retrievedCount: retrievedChunks.length,
    contextualizedQuery: retrievalQuery.contextualized,
    previousUserMessageCount: retrievalQuery.previousUserMessageCount,
  });

  await callbacks.onRetrieval?.(retrievedChunks);

  if (!retrievedChunks.length) {
    await callbacks.onToken?.(getEmptyContextText());
    return {
      text: getEmptyContextText(),
      provider: "rag-context-empty",
      retrievedChunks: [],
    };
  }

  await callbacks.onStatus?.("agent");

  const agentResponse = await measureChatTiming(
    input.timings,
    input.agentTimingStage || "agent",
    () =>
      streamOpenRouter(
        [
          {
            role: "system",
            content: buildSystemPrompt(input.settings, retrievedChunks),
          },
          ...input.history,
        ],
        {
          signal: callbacks.signal,
          onToken: callbacks.onToken,
          timeoutMs: input.agentTimeoutMs,
          queueTimeoutMs: input.agentQueueTimeoutMs,
        },
      ),
  );

  return {
    text:
      agentResponse?.text ??
      t("chat.fallback"),
    provider: agentResponse?.provider ?? "fallback",
    retrievedChunks,
    usage: agentResponse?.usage,
  };
}
