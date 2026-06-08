import { sql, eq } from "drizzle-orm";
import { getDb } from "../../db/client";
import {
  ragDocumentChunks,
  ragDocuments,
  ragIngestionJobs,
} from "../../db/schema";
import { logger } from "../../logger";
import { createEmbeddingProvider } from "../embeddings/embeddingServiceProvider";
import { chunkText } from "./ragChunkingService";
import {
  buildChromaId,
  deleteChunksFromChroma,
  upsertChunksIntoChroma,
} from "./ragChromaStore";
import {
  extractTextFromDocument,
  saveExtractedText,
} from "./ragTextExtractionService";

const EMBEDDING_BATCH_SIZE = 16;
const WORKER_SCOPE = "RagWorker";

type LockedJob = {
  jobId: string;
  documentId: string;
};

function rowsFromExecute(result: any): any[] {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.rows)) return result.rows;
  return [];
}

async function lockNextJob(): Promise<LockedJob | null> {
  const db = getDb();

  return db.transaction(async (tx) => {
    const result = await tx.execute(sql`
      select
        j.id as "jobId",
        j.document_id as "documentId"
      from rag_ingestion_jobs j
      inner join rag_documents d on d.id = j.document_id
      where j.status = 'pending'
        and d.deleted_at is null
      order by j.created_at asc
      limit 1
      for update skip locked
    `);

    const [row] = rowsFromExecute(result);
    if (!row) return null;

    const now = new Date();
    await tx
      .update(ragIngestionJobs)
      .set({
        status: "running",
        attempts: sql`${ragIngestionJobs.attempts} + 1`,
        lockedAt: now,
        updatedAt: now,
        errorMessage: null,
      })
      .where(eq(ragIngestionJobs.id, row.jobId));

    await tx
      .update(ragDocuments)
      .set({ status: "processing", updatedAt: now, errorMessage: null })
      .where(eq(ragDocuments.id, row.documentId));

    return { jobId: row.jobId, documentId: row.documentId };
  });
}

async function getDocument(documentId: string) {
  const [document] = await getDb()
    .select()
    .from(ragDocuments)
    .where(eq(ragDocuments.id, documentId))
    .limit(1);

  if (!document || document.deletedAt) {
    throw new Error("documento nao encontrado ou removido");
  }

  return document;
}

async function deleteExistingChunks(documentId: string) {
  const rows = await getDb()
    .select({ chromaId: ragDocumentChunks.chromaId })
    .from(ragDocumentChunks)
    .where(eq(ragDocumentChunks.documentId, documentId));

  const chromaIds = rows.map((row) => row.chromaId).filter(Boolean);
  if (chromaIds.length) await deleteChunksFromChroma(chromaIds);

  await getDb()
    .delete(ragDocumentChunks)
    .where(eq(ragDocumentChunks.documentId, documentId));
}

async function markJobDone(input: {
  jobId: string;
  documentId: string;
  extractedTextPath: string;
}) {
  const now = new Date();
  await getDb().transaction(async (tx) => {
    await tx
      .update(ragDocuments)
      .set({
        status: "ready",
        extractedTextPath: input.extractedTextPath,
        updatedAt: now,
        errorMessage: null,
      })
      .where(eq(ragDocuments.id, input.documentId));

    await tx
      .update(ragIngestionJobs)
      .set({
        status: "done",
        updatedAt: now,
        lockedAt: null,
        errorMessage: null,
      })
      .where(eq(ragIngestionJobs.id, input.jobId));
  });
}

async function markJobError(input: {
  jobId: string;
  documentId: string;
  error: unknown;
}) {
  const now = new Date();
  const message =
    input.error instanceof Error
      ? input.error.message.slice(0, 500)
      : "erro desconhecido";

  await getDb().transaction(async (tx) => {
    await tx
      .update(ragDocuments)
      .set({ status: "error", updatedAt: now, errorMessage: message })
      .where(eq(ragDocuments.id, input.documentId));

    await tx
      .update(ragIngestionJobs)
      .set({
        status: "error",
        updatedAt: now,
        lockedAt: null,
        errorMessage: message,
      })
      .where(eq(ragIngestionJobs.id, input.jobId));
  });
}

async function insertChunks(input: {
  documentId: string;
  classId: string;
  chunks: ReturnType<typeof chunkText>;
  embeddingModel: string | null;
}) {
  if (!input.chunks.length) return;

  await getDb().insert(ragDocumentChunks).values(
    input.chunks.map((chunk) => ({
      documentId: input.documentId,
      classId: input.classId,
      chunkIndex: chunk.index,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      chromaId: buildChromaId(input.documentId, chunk.index),
      metadata: {
        embeddingModel: input.embeddingModel,
      },
    })),
  );
}

async function embedInBatches(texts: string[]) {
  const provider = createEmbeddingProvider();
  const embeddings: number[][] = [];
  let model: string | null = null;
  let dimensions = 0;

  const totalBatches = Math.ceil(texts.length / EMBEDDING_BATCH_SIZE);
  logger.info(WORKER_SCOPE, "Starting embedding.", { totalTexts: texts.length, totalBatches, batchSize: EMBEDDING_BATCH_SIZE });

  for (let index = 0; index < texts.length; index += EMBEDDING_BATCH_SIZE) {
    const batchNumber = Math.floor(index / EMBEDDING_BATCH_SIZE) + 1;
    const batch = texts.slice(index, index + EMBEDDING_BATCH_SIZE);
    const startedAt = Date.now();
    const result = await provider.embedTexts(batch);
    model = result.model || model;
    dimensions = result.dimensions || dimensions;
    embeddings.push(...result.embeddings);

    logger.info(WORKER_SCOPE, `Batch ${batchNumber}/${totalBatches} embedded.`, {
      batchSize: batch.length,
      dimensions: result.dimensions,
      model: result.model,
      elapsedMs: Date.now() - startedAt,
    });
  }

  logger.info(WORKER_SCOPE, "All batches embedded.", { totalEmbeddings: embeddings.length, model, dimensions });
  return { embeddings, model, dimensions };
}

export async function processNextRagJob() {
  const locked = await lockNextJob();
  if (!locked) return false;

  logger.info(WORKER_SCOPE, "Job started.", locked);

  try {
    const document = await getDocument(locked.documentId);
    await deleteExistingChunks(document.id);

    const text = await extractTextFromDocument({
      filePath: document.filePath,
      sourceType: document.sourceType,
    });
    const extractedTextPath = await saveExtractedText({
      originalFilePath: document.filePath,
      text,
    });

    logger.info(WORKER_SCOPE, "Text extracted.", {
      documentId: document.id,
      classId: document.classId,
      characters: text.length,
    });

    const chunks = chunkText(text);
    if (!chunks.length) {
      throw new Error("documento sem texto util para indexacao");
    }

    logger.info(WORKER_SCOPE, "Chunks created.", {
      documentId: document.id,
      chunkCount: chunks.length,
    });

    const embeddingResult = await embedInBatches(
      chunks.map((chunk) => chunk.content),
    );

    await upsertChunksIntoChroma({
      chunks,
      embeddings: embeddingResult.embeddings,
      metadata: {
        documentId: document.id,
        classId: document.classId,
        uploadedBy: document.uploadedBy,
        sourceType: document.sourceType,
        title: document.title,
        embeddingModel: embeddingResult.model,
      },
    });

    await insertChunks({
      documentId: document.id,
      classId: document.classId,
      chunks,
      embeddingModel: embeddingResult.model,
    });

    await markJobDone({
      jobId: locked.jobId,
      documentId: document.id,
      extractedTextPath,
    });

    logger.info(WORKER_SCOPE, "Job completed.", {
      jobId: locked.jobId,
      documentId: document.id,
      chunkCount: chunks.length,
      dimensions: embeddingResult.dimensions,
      model: embeddingResult.model,
    });

    return true;
  } catch (error) {
    logger.error(WORKER_SCOPE, "Job failed.", {
      ...locked,
      message: error instanceof Error ? error.message : String(error),
    });
    await markJobError({
      jobId: locked.jobId,
      documentId: locked.documentId,
      error,
    });
    return true;
  }
}
