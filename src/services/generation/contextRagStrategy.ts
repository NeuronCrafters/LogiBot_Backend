import { and, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "../../db/client";
import { ragDocumentChunks, ragDocumentClasses, ragDocuments } from "../../db/schema";
import { logger } from "../../logger";
import {
  askDigitalOceanAgent,
  streamDigitalOceanAgent,
} from "../ai/digitalOceanAgentService";
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

export const EMPTY_CONTEXT_TEXT =
  "Não encontrei informações suficientes nos materiais desta turma para responder com segurança. Você poderia descrever melhor a sua dúvida? Se possível, informe o tema, a linguagem de programação ou mostre um exemplo do que está tentando fazer.";

function distanceToScore(distance: unknown) {
  if (typeof distance !== "number" || !Number.isFinite(distance)) return 100;
  return Math.round((1 / (1 + Math.max(0, distance))) * 100);
}

// A identidade/regras de uso do RAG (quando responder, resposta parcial,
// frase canonica de "nao encontrei", seguranca do contexto etc.) vivem no
// system prompt configurado no proprio Agent da DigitalOcean (ver
// PROMPT_CHAT.md). Aqui so montamos o que e dinamico por request: a
// instrucao extra do professor (se houver) e os trechos recuperados.
export function buildSystemPrompt(settings: RuntimeRagSettings, chunks: RetrievedRagChunk[]) {
  const customPrompt = settings.systemPrompt
    ? `Instrucao adicional do professor para esta turma:\n${settings.systemPrompt}\n\n`
    : "";

  const context = chunks
    .map(
      (chunk, index) =>
        `[${index + 1}] ${chunk.documentTitle} - trecho ${chunk.chunkIndex + 1}\n${chunk.content}`,
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

// Documentos elegiveis pra essa turma: vinculados (proprios ou compartilhados
// de outra turma), habilitados e prontos. E essa lista, nao mais classId, que
// escopa a busca no Chroma e no Postgres — o mesmo padrao ja usado em
// quizAiRetrievalService.ts (where: { documentId: { $in: [...] } }).
export async function getEligibleDocumentIds(classId: string) {
  const rows = await getDb()
    .select({ documentId: ragDocumentClasses.documentId })
    .from(ragDocumentClasses)
    .innerJoin(ragDocuments, eq(ragDocuments.id, ragDocumentClasses.documentId))
    .where(
      and(
        eq(ragDocumentClasses.classId, classId),
        eq(ragDocumentClasses.enabled, true),
        eq(ragDocuments.status, "ready"),
        isNull(ragDocuments.deletedAt),
      ),
    );

  return rows.map((row) => row.documentId);
}

export async function queryChroma(input: {
  documentIds: string[];
  message: string;
  topK: number;
  timings?: GenerationInput["timings"];
}) {
  if (!input.documentIds.length) return [];

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
      where: { documentId: { $in: input.documentIds } },
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
  documentIds: string[];
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
        inArray(ragDocumentChunks.documentId, input.documentIds),
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

  const documentIds = await measureChatTiming(input.timings, "eligible documents", () =>
    getEligibleDocumentIds(input.settings.classId),
  );

  const candidates = await queryChroma({
    documentIds,
    message: retrievalQuery.query,
    topK: input.settings.topK,
    timings: input.timings,
  });

  const retrievedChunks = await revalidateChunks({
    documentIds,
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
      text: EMPTY_CONTEXT_TEXT,
      provider: "rag-context-empty",
      retrievedChunks: [],
    };
  }

  const agentResponse = await measureChatTiming(input.timings, input.agentTimingStage || "agent", () =>
    askDigitalOceanAgent([
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
      "Tive um problema tecnico ao processar sua mensagem. Pode tentar novamente?",
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

  const documentIds = await measureChatTiming(input.timings, "eligible documents", () =>
    getEligibleDocumentIds(input.settings.classId),
  );

  const candidates = await queryChroma({
    documentIds,
    message: retrievalQuery.query,
    topK: input.settings.topK,
    timings: input.timings,
  });

  const retrievedChunks = await revalidateChunks({
    documentIds,
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
    await callbacks.onToken?.(EMPTY_CONTEXT_TEXT);
    return {
      text: EMPTY_CONTEXT_TEXT,
      provider: "rag-context-empty",
      retrievedChunks: [],
    };
  }

  await callbacks.onStatus?.("agent");

  const agentResponse = await measureChatTiming(
    input.timings,
    input.agentTimingStage || "agent",
    () =>
      streamDigitalOceanAgent(
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
      "Tive um problema tecnico ao processar sua mensagem. Pode tentar novamente?",
    provider: agentResponse?.provider ?? "fallback",
    retrievedChunks,
    usage: agentResponse?.usage,
  };
}
