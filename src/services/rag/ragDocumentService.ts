import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { and, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { getDb } from "../../db/client";
import { ragDocuments, ragIngestionJobs } from "../../db/schema";
import { AppError } from "../../exceptions/AppError";
import { logger } from "../../logger";
import type { RagUser } from "./ragTypes";
import { assertCanManageRagClass } from "./ragPermissionService";
import {
  getAllowedRagFile,
  getRagUploadDir,
  normalizeDisplayFileName,
  RAG_MAX_DOCUMENTS_PER_CLASS,
} from "./ragStorage";
import { triggerWorkerJob } from "./ragWorkerClient";

type UploadedFile = Express.Multer.File;

function ensureFile(file?: UploadedFile) {
  if (!file) throw new AppError("arquivo e obrigatorio", 400);
  if (!file.buffer?.length) throw new AppError("arquivo vazio", 400);
  return file;
}

async function ensureDocumentLimit(classId: string) {
  const rows = await getDb()
    .select({ id: ragDocuments.id })
    .from(ragDocuments)
    .where(and(eq(ragDocuments.classId, classId), isNull(ragDocuments.deletedAt)))
    .limit(RAG_MAX_DOCUMENTS_PER_CLASS);

  if (rows.length >= RAG_MAX_DOCUMENTS_PER_CLASS) {
    throw new AppError(
      `limite de ${RAG_MAX_DOCUMENTS_PER_CLASS} documentos por turma atingido`,
      400,
    );
  }
}

async function getDocumentForUser(user: RagUser, documentId: string) {
  const [document] = await getDb()
    .select()
    .from(ragDocuments)
    .where(eq(ragDocuments.id, documentId))
    .limit(1);

  if (!document || document.deletedAt)
    throw new AppError("documento nao encontrado", 404);

  await assertCanManageRagClass(user, document.classId);
  return document;
}

export async function listRagDocuments(user: RagUser, classId: string) {
  await assertCanManageRagClass(user, classId);

  logger.info("RagDocuments", "Listing documents.", { classId, userId: user.id });
  return getDb()
    .select()
    .from(ragDocuments)
    .where(and(eq(ragDocuments.classId, classId), isNull(ragDocuments.deletedAt)))
    .orderBy(desc(ragDocuments.createdAt));
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
  const allowed = getAllowedRagFile(file.originalname, file.mimetype);
  if (!allowed) {
    throw new AppError("arquivo deve ser PDF, TXT ou DOCX valido", 400);
  }

  const documentId = randomUUID();
  const storedFileName = `${documentId}.${allowed.extension}`;
  const uploadDir = getRagUploadDir();
  const classDir = path.join(uploadDir, input.classId);
  const filePath = path.join(classDir, storedFileName);
  const originalFileName = normalizeDisplayFileName(file.originalname);
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

export async function deleteRagDocument(user: RagUser, documentId: string) {
  const document = await getDocumentForUser(user, documentId);
  logger.info("RagDocuments", "Deleting document.", { documentId, classId: document.classId, userId: user.id });
  const now = new Date();

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

  return updated;
}

export async function reprocessRagDocument(user: RagUser, documentId: string) {
  const document = await getDocumentForUser(user, documentId);
  logger.info("RagDocuments", "Reprocess requested.", { documentId, classId: document.classId, userId: user.id, currentStatus: document.status });

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
