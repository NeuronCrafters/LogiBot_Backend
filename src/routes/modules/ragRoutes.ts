import { Router } from "express";
import multer from "multer";
import { asyncHandler } from "../../http/asyncHandler";
import { requireAuth, requireRoles } from "../../http/auth";
import { listManageableRagClasses } from "../../services/rag/ragPermissionService";
import {
  getRagSettings,
  updateRagSettings,
} from "../../services/rag/ragSettingsService";
import {
  createRagDocument,
  deleteRagDocument,
  linkRagDocumentToClasses,
  listRagDocuments,
  reprocessRagDocument,
  setRagDocumentEnabled,
} from "../../services/rag/ragDocumentService";
import {
  RAG_MAX_FILE_SIZE_BYTES,
  RAG_UPLOAD_FIELD,
} from "../../services/rag/ragStorage";
import { generateRagTestResponse } from "../../services/generation/generationService";

export const ragRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: RAG_MAX_FILE_SIZE_BYTES, files: 1 },
});

ragRouter.use(requireAuth);
ragRouter.use(requireRoles(["admin", "professor", "course-coordinator"]));

ragRouter.get(
  "/classes",
  asyncHandler(async (req, res) => {
    return res.json({ classes: await listManageableRagClasses(req.user!) });
  }),
);

ragRouter.get(
  "/classes/:classId/settings",
  asyncHandler(async (req, res) => {
    return res.json(await getRagSettings(req.user!, req.params.classId));
  }),
);

ragRouter.patch(
  "/classes/:classId/settings",
  asyncHandler(async (req, res) => {
    return res.json(
      await updateRagSettings(req.user!, req.params.classId, {
        ragMode: req.body.ragMode,
        topK: req.body.topK,
        minScore: req.body.minScore,
        systemPrompt: req.body.systemPrompt,
        llmModel: req.body.llmModel,
        embeddingModel: req.body.embeddingModel,
      }),
    );
  }),
);

ragRouter.get(
  "/classes/:classId/documents",
  asyncHandler(async (req, res) => {
    return res.json({
      documents: await listRagDocuments(req.user!, req.params.classId),
    });
  }),
);

ragRouter.post(
  "/classes/:classId/documents",
  upload.single(RAG_UPLOAD_FIELD),
  asyncHandler(async (req, res) => {
    const result = await createRagDocument({
      user: req.user!,
      classId: req.params.classId,
      file: req.file,
      title: req.body.title,
    });

    return res.status(201).json(result);
  }),
);

ragRouter.delete(
  "/classes/:classId/documents/:documentId",
  asyncHandler(async (req, res) => {
    return res.json(
      await deleteRagDocument(req.user!, req.params.classId, req.params.documentId),
    );
  }),
);

ragRouter.patch(
  "/classes/:classId/documents/:documentId",
  asyncHandler(async (req, res) => {
    return res.json(
      await setRagDocumentEnabled(
        req.user!,
        req.params.classId,
        req.params.documentId,
        Boolean(req.body.enabled),
      ),
    );
  }),
);

ragRouter.post(
  "/documents/:documentId/classes",
  asyncHandler(async (req, res) => {
    const classIds = Array.isArray(req.body.classIds) ? req.body.classIds : [];
    return res.status(201).json(
      await linkRagDocumentToClasses(req.user!, req.params.documentId, classIds),
    );
  }),
);

ragRouter.post(
  "/documents/:documentId/reprocess",
  asyncHandler(async (req, res) => {
    return res.status(202).json(
      await reprocessRagDocument(req.user!, req.params.documentId),
    );
  }),
);

ragRouter.post(
  "/classes/:classId/test-chat",
  asyncHandler(async (req, res) => {
    const message = String(req.body.message || "").trim();
    if (!message) {
      return res.status(400).json({ message: "message e obrigatorio" });
    }

    const result = await generateRagTestResponse({
      user: req.user!,
      classId: req.params.classId,
      message,
      override: req.body.override,
    });

    return res.json({
      answer: result.text,
      provider: result.provider,
      retrievedChunks: result.retrievedChunks,
    });
  }),
);
