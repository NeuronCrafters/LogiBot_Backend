import { and, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "../../db/client";
import { ragDocumentChunks, ragDocuments } from "../../db/schema";
import { AppError } from "../../exceptions/AppError";
import { logger } from "../../logger";
import { createEmbeddingProvider } from "../embeddings/embeddingServiceProvider";
import { getOrCreateRagCollection } from "../rag/chromaService";

const MAX_CHUNKS = 16;
const MIN_CHUNKS = 8;
const MAX_CHARS_PER_CHUNK = 1200;
const MAX_CONTEXT_CHARS = 12_000;

export type RetrievedQuizChunk = {
  chromaId: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  score: number;
  content: string;
};

export type SelectedDocument = {
  id: string;
  title: string;
  sourceType: string;
};

export type QuizRetrievalResult = {
  chunks: RetrievedQuizChunk[];
  selectedDocuments: SelectedDocument[];
};

function distanceToScore(distance: unknown): number {
  if (typeof distance !== "number" || !Number.isFinite(distance)) return 100;
  return Math.round((1 / (1 + Math.max(0, distance))) * 100);
}

export async function retrieveChunksForQuiz(input: {
  classId: string;
  theme: string;
  documentIds: string[];
  questionCount: number;
}): Promise<QuizRetrievalResult> {
  const { classId, theme, documentIds, questionCount } = input;

  if (!documentIds.length)
    throw new AppError(
      "Selecione ao menos um documento para gerar o quiz",
      400,
    );

  const db = getDb();

  const validDocs = await db
    .select({
      id: ragDocuments.id,
      title: ragDocuments.title,
      sourceType: ragDocuments.sourceType,
    })
    .from(ragDocuments)
    .where(
      and(
        inArray(ragDocuments.id, documentIds),
        eq(ragDocuments.classId, classId),
        eq(ragDocuments.status, "ready"),
        isNull(ragDocuments.deletedAt),
      ),
    );

  if (!validDocs.length)
    throw new AppError(
      "Nenhum documento selecionado está pronto para uso",
      400,
    );

  const validDocIds = new Set(validDocs.map((d) => d.id));
  const invalidIds = documentIds.filter((id) => !validDocIds.has(id));
  if (invalidIds.length)
    throw new AppError(
      `Documentos inválidos ou não prontos: ${invalidIds.join(", ")}`,
      400,
    );

  logger.info("QuizRetrieval", "Generating theme embedding.", {
    classId,
    questionCount,
    documentCount: validDocs.length,
    theme,
  });

  const provider = createEmbeddingProvider();
  const embeddingResult = await provider.embedTexts([theme], {
    timeoutMs: 15_000,
  });

  const collection = await getOrCreateRagCollection();
  const nResults = Math.max(questionCount * 6, 24);

  const chromaResult = await collection.query({
    queryEmbeddings: embeddingResult.embeddings,
    nResults,
    where: { classId },
  } as any);

  const ids = (chromaResult.ids?.[0] || []).filter(Boolean) as string[];
  const distances = chromaResult.distances?.[0] || [];

  const candidates = ids.map((chromaId, index) => ({
    chromaId,
    score: distanceToScore(distances[index]),
  }));

  logger.info("QuizRetrieval", "Chroma query done.", {
    candidateCount: candidates.length,
  });

  if (!candidates.length) return { chunks: [], selectedDocuments: validDocs };

  const chromaIds = candidates.map((c) => c.chromaId);

  const rows = await db
    .select({
      chromaId: ragDocumentChunks.chromaId,
      documentId: ragDocumentChunks.documentId,
      chunkIndex: ragDocumentChunks.chunkIndex,
      content: ragDocumentChunks.content,
      documentTitle: ragDocuments.title,
    })
    .from(ragDocumentChunks)
    .innerJoin(
      ragDocuments,
      eq(ragDocuments.id, ragDocumentChunks.documentId),
    )
    .where(
      and(
        inArray(ragDocumentChunks.chromaId, chromaIds),
        eq(ragDocumentChunks.classId, classId),
        inArray(ragDocumentChunks.documentId, [...validDocIds]),
        eq(ragDocuments.classId, classId),
        eq(ragDocuments.status, "ready"),
        isNull(ragDocuments.deletedAt),
      ),
    );

  const byChromaId = new Map(rows.map((r) => [r.chromaId, r]));

  const scored: RetrievedQuizChunk[] = candidates
    .filter((c) => byChromaId.has(c.chromaId))
    .map((c) => {
      const row = byChromaId.get(c.chromaId)!;
      return {
        chromaId: row.chromaId ?? c.chromaId,
        documentId: row.documentId,
        documentTitle: row.documentTitle,
        chunkIndex: row.chunkIndex,
        score: c.score,
        content: row.content,
      };
    })
    .sort((a, b) => b.score - a.score);

  const targetCount = Math.min(
    Math.max(questionCount * 2, MIN_CHUNKS),
    MAX_CHUNKS,
  );

  let totalChars = 0;
  const finalChunks: RetrievedQuizChunk[] = [];

  for (const chunk of scored) {
    if (finalChunks.length >= targetCount) break;
    const excerpt = chunk.content.slice(0, MAX_CHARS_PER_CHUNK);
    if (totalChars + excerpt.length > MAX_CONTEXT_CHARS) break;
    finalChunks.push({ ...chunk, content: excerpt });
    totalChars += excerpt.length;
  }

  logger.info("QuizRetrieval", "Final context selected.", {
    finalCount: finalChunks.length,
    totalChars,
  });

  return { chunks: finalChunks, selectedDocuments: validDocs };
}
