import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { and, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { getDb } from "../../db/client";
import {
  ragDocumentChunks,
  ragDocumentClasses,
  ragDocuments,
  ragIngestionJobs,
} from "../../db/schema";
import { AppError } from "../../exceptions/AppError";
import { logger } from "../../logger";
import type { RagUser } from "./ragTypes";
import {
  assertCanManageRagClass,
  assertCanManageRagDocument,
} from "./ragPermissionService";
import {
  decodeUploadedFileName,
  getAllowedRagFile,
  getRagUploadDir,
  normalizeDisplayFileName,
  RAG_MAX_DOCUMENTS_PER_CLASS,
} from "./ragStorage";
import { deleteChunksFromChroma } from "./ragChromaStore";
import { triggerWorkerJob } from "./ragWorkerClient";

type UploadedFile = Express.Multer.File;

function ensureFile(file?: UploadedFile) {
  if (!file) throw new AppError("arquivo e obrigatorio", 400);
  if (!file.buffer?.length) throw new AppError("arquivo vazio", 400);
  return file;
}

// Conta documentos vinculados (proprios ou compartilhados de outra turma) —
// um documento so compartilhado ainda ocupa uma vaga no limite da turma.
async function ensureDocumentLimit(classId: string) {
  const rows = await getDb()
    .select({ documentId: ragDocumentClasses.documentId })
    .from(ragDocumentClasses)
    .innerJoin(ragDocuments, eq(ragDocuments.id, ragDocumentClasses.documentId))
    .where(
      and(eq(ragDocumentClasses.classId, classId), isNull(ragDocuments.deletedAt)),
    )
    .limit(RAG_MAX_DOCUMENTS_PER_CLASS);

  if (rows.length >= RAG_MAX_DOCUMENTS_PER_CLASS) {
    throw new AppError(
      `limite de ${RAG_MAX_DOCUMENTS_PER_CLASS} documentos por turma atingido`,
      400,
    );
  }
}

async function getDocumentOrThrow(documentId: string) {
  const [document] = await getDb()
    .select()
    .from(ragDocuments)
    .where(eq(ragDocuments.id, documentId))
    .limit(1);

  if (!document || document.deletedAt)
    throw new AppError("documento nao encontrado", 404);

  return document;
}

export async function listRagDocuments(user: RagUser, classId: string) {
  await assertCanManageRagClass(user, classId);

  logger.info("RagDocuments", "Listing documents.", { classId, userId: user.id });
  const rows = await getDb()
    .select({
      id: ragDocuments.id,
      classId: ragDocuments.classId,
      uploadedBy: ragDocuments.uploadedBy,
      title: ragDocuments.title,
      originalFileName: ragDocuments.originalFileName,
      storedFileName: ragDocuments.storedFileName,
      filePath: ragDocuments.filePath,
      extractedTextPath: ragDocuments.extractedTextPath,
      sourceType: ragDocuments.sourceType,
      mimeType: ragDocuments.mimeType,
      fileSize: ragDocuments.fileSize,
      status: ragDocuments.status,
      errorMessage: ragDocuments.errorMessage,
      createdAt: ragDocuments.createdAt,
      updatedAt: ragDocuments.updatedAt,
      deletedAt: ragDocuments.deletedAt,
      enabled: ragDocumentClasses.enabled,
    })
    .from(ragDocumentClasses)
    .innerJoin(ragDocuments, eq(ragDocuments.id, ragDocumentClasses.documentId))
    .where(
      and(eq(ragDocumentClasses.classId, classId), isNull(ragDocuments.deletedAt)),
    )
    .orderBy(desc(ragDocuments.createdAt));

  return rows.map((row) => ({ ...row, isOwner: row.classId === classId }));
}

export async function createRagDocument(input: {
  user: RagUser;
  classId: string;
  file?: UploadedFile;
  title?: string;
}) {
  await assertCanManageRagClass(input.user, input.classId);
  await ensureDocumentLimit(input.classId);

  const file = ensureFile(input.file);
  const originalName = decodeUploadedFileName(file.originalname);
  const allowed = getAllowedRagFile(originalName, file.mimetype);
  if (!allowed) {
    throw new AppError("arquivo deve ser PDF, TXT ou DOCX valido", 400);
  }

  const documentId = randomUUID();
  const storedFileName = `${documentId}.${allowed.extension}`;
  const uploadDir = getRagUploadDir();
  const classDir = path.join(uploadDir, input.classId);
  const filePath = path.join(classDir, storedFileName);
  const originalFileName = normalizeDisplayFileName(originalName);
  const title = String(input.title || originalFileName).trim().slice(0, 180);

  logger.info("RagDocuments", "Creating document.", {
    classId: input.classId,
    userId: input.user.id,
    title,
    sourceType: allowed.sourceType,
    fileSize: file.size,
  });

  await fs.mkdir(classDir, { recursive: true });
  await fs.writeFile(filePath, file.buffer);

  try {
    const result = await getDb().transaction(async (tx) => {
      const [document] = await tx
        .insert(ragDocuments)
        .values({
          id: documentId,
          classId: input.classId,
          uploadedBy: input.user.id,
          title,
          originalFileName,
          storedFileName,
          filePath,
          sourceType: allowed.sourceType,
          mimeType: file.mimetype,
          fileSize: file.size,
          status: "uploaded",
        })
        .returning();

      await tx.insert(ragDocumentClasses).values({
        documentId: document.id,
        classId: input.classId,
        enabled: true,
      });

      const [job] = await tx
        .insert(ragIngestionJobs)
        .values({ documentId: document.id, status: "pending" })
        .returning();

      return { document, job };
    });

    logger.info("RagDocuments", "Document created.", {
      documentId: result.document.id,
      jobId: result.job.id,
      classId: input.classId,
    });
    triggerWorkerJob();
    return result;
  } catch (error) {
    logger.error("RagDocuments", "Failed to create document; rolling back file.", {
      classId: input.classId,
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    await fs.unlink(filePath).catch(() => undefined);
    throw error;
  }
}

// Vincula um documento ja pronto (sem reprocessar) a outras turmas que o
// usuario gerencia. Nao restringe por curso — qualquer turma gerenciavel.
export async function linkRagDocumentToClasses(
  user: RagUser,
  documentId: string,
  classIds: string[],
) {
  const document = await getDocumentOrThrow(documentId);
  await assertCanManageRagDocument(user, documentId);

  const uniqueClassIds = [...new Set(classIds)].filter(Boolean);
  if (!uniqueClassIds.length)
    throw new AppError("selecione ao menos uma turma", 400);

  const linkedClassIds: string[] = [];
  for (const classId of uniqueClassIds) {
    await assertCanManageRagClass(user, classId);
    await ensureDocumentLimit(classId);

    const [row] = await getDb()
      .insert(ragDocumentClasses)
      .values({ documentId, classId, enabled: true })
      .onConflictDoNothing()
      .returning();

    if (row) linkedClassIds.push(classId);
  }

  logger.info("RagDocuments", "Linked document to classes.", {
    documentId,
    classIds: linkedClassIds,
    userId: user.id,
  });

  return { document, linkedClassIds };
}

export async function setRagDocumentEnabled(
  user: RagUser,
  classId: string,
  documentId: string,
  enabled: boolean,
) {
  await assertCanManageRagClass(user, classId);

  const [updated] = await getDb()
    .update(ragDocumentClasses)
    .set({ enabled })
    .where(
      and(
        eq(ragDocumentClasses.documentId, documentId),
        eq(ragDocumentClasses.classId, classId),
      ),
    )
    .returning();

  if (!updated)
    throw new AppError("documento nao esta vinculado a esta turma", 404);

  logger.info("RagDocuments", "Toggled document enabled state.", {
    documentId,
    classId,
    enabled,
    userId: user.id,
  });

  return updated;
}

// Remove o vinculo do documento com essa turma. So quando esse era o ultimo
// vinculo restante e que o conteudo e de fato apagado (Postgres + Chroma) —
// generaliza o comportamento antigo, onde toda turma era a unica dona.
export async function deleteRagDocument(
  user: RagUser,
  classId: string,
  documentId: string,
) {
  await assertCanManageRagClass(user, classId);
  const document = await getDocumentOrThrow(documentId);

  const [link] = await getDb()
    .select()
    .from(ragDocumentClasses)
    .where(
      and(
        eq(ragDocumentClasses.documentId, documentId),
        eq(ragDocumentClasses.classId, classId),
      ),
    )
    .limit(1);

  if (!link) throw new AppError("documento nao esta vinculado a esta turma", 404);

  await getDb()
    .delete(ragDocumentClasses)
    .where(
      and(
        eq(ragDocumentClasses.documentId, documentId),
        eq(ragDocumentClasses.classId, classId),
      ),
    );

  logger.info("RagDocuments", "Unlinked document from class.", {
    documentId,
    classId,
    userId: user.id,
  });

  const [remainingLink] = await getDb()
    .select({ classId: ragDocumentClasses.classId })
    .from(ragDocumentClasses)
    .where(eq(ragDocumentClasses.documentId, documentId))
    .limit(1);

  if (remainingLink) {
    return { document, fullyDeleted: false };
  }

  const now = new Date();
  const chunkRows = await getDb()
    .select({ chromaId: ragDocumentChunks.chromaId })
    .from(ragDocumentChunks)
    .where(eq(ragDocumentChunks.documentId, document.id));

  const chromaIds = chunkRows.map((r) => r.chromaId).filter(Boolean) as string[];

  const [updated] = await getDb()
    .update(ragDocuments)
    .set({
      status: "deleted",
      deletedAt: now,
      updatedAt: now,
      errorMessage: null,
    })
    .where(eq(ragDocuments.id, document.id))
    .returning();

  if (chromaIds.length) {
    deleteChunksFromChroma(chromaIds).catch((err) =>
      logger.warn("RagDocuments", "Failed to delete chunks from Chroma; DB already soft-deleted.", {
        documentId,
        chromaCount: chromaIds.length,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    logger.info("RagDocuments", "Queued Chroma chunk deletion.", { documentId, chromaCount: chromaIds.length });
  }

  return { document: updated, fullyDeleted: true };
}

export async function reprocessRagDocument(user: RagUser, documentId: string) {
  const document = await getDocumentOrThrow(documentId);
  await assertCanManageRagDocument(user, documentId);
  logger.info("RagDocuments", "Reprocess requested.", { documentId, userId: user.id, currentStatus: document.status });

  const activeJobs = await getDb()
    .select({ id: ragIngestionJobs.id })
    .from(ragIngestionJobs)
    .where(
      and(
        eq(ragIngestionJobs.documentId, document.id),
        inArray(ragIngestionJobs.status, ["pending", "running"]),
      ),
    )
    .limit(1);

  if (activeJobs.length) {
    logger.warn("RagDocuments", "Reprocess blocked; ingestion already in progress.", { documentId });
    throw new AppError("documento ja possui ingestao em andamento", 409);
  }

  const result = await getDb().transaction(async (tx) => {
    const now = new Date();
    const [updatedDocument] = await tx
      .update(ragDocuments)
      .set({
        status: "uploaded",
        errorMessage: null,
        updatedAt: now,
      })
      .where(and(eq(ragDocuments.id, document.id), ne(ragDocuments.status, "deleted")))
      .returning();

    const [job] = await tx
      .insert(ragIngestionJobs)
      .values({ documentId: document.id, status: "pending" })
      .returning();

    return { document: updatedDocument, job };
  });

  logger.info("RagDocuments", "Reprocess job created.", { documentId, jobId: result.job.id });
  triggerWorkerJob();
  return result;
}
