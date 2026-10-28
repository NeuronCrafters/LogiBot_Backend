import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../../db/client";
import { ragDocumentChunks, ragDocuments } from "../../db/schema";
import { logger } from "../../logger";
import {
  askOpenRouter,
  streamOpenRouter,
} from "../ai/openRouterService";
import {
  buildSystemPrompt,
  EMPTY_CONTEXT_TEXT,
  queryChroma,
  revalidateChunks,
} from "./contextRagStrategy";
import {
  measureChatTiming,
  type GenerationInput,
  type GenerationResult,
  type GenerationStreamCallbacks,
  type RuntimeRagSettings,
} from "./generationTypes";
import { buildRagRetrievalQuery } from "./ragRetrievalQuery";

const BOTH_HIT_BONUS = 10;
const MAX_LEXICAL_QUERY_LENGTH = 500;

function compactMessage(content: string) {
  return content.replace(/\s+/g, " ").trim().slice(0, MAX_LEXICAL_QUERY_LENGTH);
}

// Usa a mensagem crua do aluno (nao a query contextualizada de follow-up do
// ragRetrievalQuery), porque websearch_to_tsquery trata o texto instrucional
// extra da contextualizacao como palavras a serem exigidas via AND, o que
// zeraria os hits lexicais em quase toda pergunta de continuacao.
async function queryLexical(input: {
  classId: string;
  message: string;
  topK: number;
  timings?: GenerationInput["timings"];
}) {
  const searchText = compactMessage(input.message);
  if (!searchText) return [];

  const limit = Math.max(input.topK * 3, input.topK);
  const tsVector = sql`to_tsvector('portuguese', ${ragDocumentChunks.content})`;
  const tsQuery = sql`websearch_to_tsquery('portuguese', ${searchText})`;
  const rank = sql<number>`ts_rank(${tsVector}, ${tsQuery})`;

  const rows = await measureChatTiming(input.timings, "lexical query", () =>
    getDb()
      .select({
        chromaId: ragDocumentChunks.chromaId,
        rank,
      })
      .from(ragDocumentChunks)
      .innerJoin(ragDocuments, eq(ragDocuments.id, ragDocumentChunks.documentId))
      .where(
        and(
          eq(ragDocumentChunks.classId, input.classId),
          eq(ragDocuments.classId, input.classId),
          eq(ragDocuments.status, "ready"),
          isNull(ragDocuments.deletedAt),
          sql`${tsVector} @@ ${tsQuery}`,
        ),
      )
      .orderBy(desc(rank))
      .limit(limit),
  );

  const maxRank = rows[0]?.rank || 0;
  if (!maxRank) return [];

  return rows.map((row) => ({
    chromaId: row.chromaId,
    score: Math.round((row.rank / maxRank) * 100),
  }));
}

// Funde os candidatos de vetor (Chroma) e lexicais (Postgres FTS) num unico
// score 0-100, no mesmo formato que queryChroma ja retorna, para reaproveitar
// revalidateChunks sem mudanca nenhuma. Um chunk achado so por vetor recebe
// exatamente o score que receberia em modo "context" (minScore continua com
// o mesmo significado); achar nos dois soma um bonus fixo.
function fuseCandidates(
  vectorCandidates: { chromaId: string; score: number }[],
  lexicalCandidates: { chromaId: string; score: number }[],
) {
  const merged = new Map<
    string,
    { chromaId: string; vector?: number; lexical?: number }
  >();

  for (const candidate of vectorCandidates) {
    merged.set(candidate.chromaId, {
      chromaId: candidate.chromaId,
      vector: candidate.score,
    });
  }

  for (const candidate of lexicalCandidates) {
    const existing = merged.get(candidate.chromaId);
    if (existing) existing.lexical = candidate.score;
    else
      merged.set(candidate.chromaId, {
        chromaId: candidate.chromaId,
        lexical: candidate.score,
      });
  }

  return Array.from(merged.values())
    .map((entry) => {
      const base = Math.max(entry.vector ?? 0, entry.lexical ?? 0);
      const bothHit = entry.vector !== undefined && entry.lexical !== undefined;
      return {
        chromaId: entry.chromaId,
        score: Math.min(100, bothHit ? base + BOTH_HIT_BONUS : base),
      };
    })
    .sort((a, b) => b.score - a.score);
}

async function retrieveHybridChunks(input: GenerationInput & { settings: RuntimeRagSettings }) {
  const retrievalQuery = buildRagRetrievalQuery({
    message: input.message,
    history: input.history,
  });

  const [vectorCandidates, lexicalCandidates] = await Promise.all([
    queryChroma({
      classId: input.settings.classId,
      message: retrievalQuery.query,
      topK: input.settings.topK,
      timings: input.timings,
    }),
    queryLexical({
      classId: input.settings.classId,
      message: input.message,
      topK: input.settings.topK,
      timings: input.timings,
    }),
  ]);

  const fusedCandidates = fuseCandidates(vectorCandidates, lexicalCandidates);

  const retrievedChunks = await revalidateChunks({
    classId: input.settings.classId,
    candidates: fusedCandidates,
    topK: input.settings.topK,
    minScore: input.settings.minScore,
  });

  return { retrievalQuery, vectorCandidates, lexicalCandidates, retrievedChunks };
}

export async function generateHybridRagResponse(
  input: GenerationInput & { settings: RuntimeRagSettings },
): Promise<GenerationResult> {
  const { retrievalQuery, vectorCandidates, lexicalCandidates, retrievedChunks } =
    await retrieveHybridChunks(input);

  logger.info("HybridRAG", "Context retrieved for chat.", {
    classId: input.settings.classId,
    topK: input.settings.topK,
    minScore: input.settings.minScore,
    vectorCandidateCount: vectorCandidates.length,
    lexicalCandidateCount: lexicalCandidates.length,
    retrievedCount: retrievedChunks.length,
    contextualizedQuery: retrievalQuery.contextualized,
    previousUserMessageCount: retrievalQuery.previousUserMessageCount,
  });

  if (!retrievedChunks.length) {
    return {
      text: EMPTY_CONTEXT_TEXT,
      provider: "rag-hybrid-empty",
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
      "Tive um problema tecnico ao processar sua mensagem. Pode tentar novamente?",
    provider: agentResponse?.provider ?? "fallback",
    retrievedChunks,
  };
}

export async function streamHybridRagResponse(
  input: GenerationInput & { settings: RuntimeRagSettings },
  callbacks: GenerationStreamCallbacks = {},
): Promise<GenerationResult> {
  await callbacks.onStatus?.("rag");

  const { retrievalQuery, vectorCandidates, lexicalCandidates, retrievedChunks } =
    await retrieveHybridChunks(input);

  logger.info("HybridRAG", "Context retrieved for streaming chat.", {
    classId: input.settings.classId,
    topK: input.settings.topK,
    minScore: input.settings.minScore,
    vectorCandidateCount: vectorCandidates.length,
    lexicalCandidateCount: lexicalCandidates.length,
    retrievedCount: retrievedChunks.length,
    contextualizedQuery: retrievalQuery.contextualized,
    previousUserMessageCount: retrievalQuery.previousUserMessageCount,
  });

  await callbacks.onRetrieval?.(retrievedChunks);

  if (!retrievedChunks.length) {
    await callbacks.onToken?.(EMPTY_CONTEXT_TEXT);
    return {
      text: EMPTY_CONTEXT_TEXT,
      provider: "rag-hybrid-empty",
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
      "Tive um problema tecnico ao processar sua mensagem. Pode tentar novamente?",
    provider: agentResponse?.provider ?? "fallback",
    retrievedChunks,
    usage: agentResponse?.usage,
  };
}
