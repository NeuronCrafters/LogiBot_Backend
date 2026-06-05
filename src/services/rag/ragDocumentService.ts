import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { and, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { getDb } from "../../db/client";
import { ragDocuments, ragIngestionJobs } from "../../db/schema";
import { AppError } from "../../exceptions/AppError";
import type { RagUser } from "./ragTypes";
import { assertCanManageRagClass } from "./ragPermissionService";
import {
  getAllowedRagFile,
  getRagUploadDir,
  normalizeDisplayFileName,
  RAG_MAX_DOCUMENTS_PER_CLASS,
} from "./ragStorage";

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

    return result;
  } catch (error) {
    await fs.unlink(filePath).catch(() => undefined);
    throw error;
  }
}

export async function deleteRagDocument(user: RagUser, documentId: string) {
  const document = await getDocumentForUser(user, documentId);
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

  return result;
}
