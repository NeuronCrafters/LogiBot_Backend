import path from "path";

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const MAX_DOCUMENTS_PER_CLASS = 30;

export const RAG_UPLOAD_FIELD = "file";
export const RAG_MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_BYTES;
export const RAG_MAX_DOCUMENTS_PER_CLASS = MAX_DOCUMENTS_PER_CLASS;

export type AllowedRagFile = {
  extension: "pdf" | "txt" | "docx";
  sourceType: "pdf" | "txt" | "docx";
  mimeTypes: string[];
};

export const ALLOWED_RAG_FILES: Record<string, AllowedRagFile> = {
  ".pdf": {
    extension: "pdf",
    sourceType: "pdf",
    mimeTypes: ["application/pdf"],
  },
  ".txt": {
    extension: "txt",
    sourceType: "txt",
    mimeTypes: ["text/plain", "application/octet-stream"],
  },
  ".docx": {
    extension: "docx",
    sourceType: "docx",
    mimeTypes: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/octet-stream",
    ],
  },
};

export function getRagUploadDir() {
  const configured = process.env.RAG_UPLOAD_DIR?.trim();
  if (configured) return path.resolve(configured);
  if (process.env.NODE_ENV === "production") {
    return "/tmp/logibots/uploads/rag";
  }
  return path.resolve(process.cwd(), "uploads", "rag");
}

export function getAllowedRagFile(originalName: string, mimeType: string) {
  const extension = path.extname(originalName || "").toLowerCase();
  const allowed = ALLOWED_RAG_FILES[extension];
  if (!allowed) return null;
  if (!allowed.mimeTypes.includes(mimeType)) return null;
  return allowed;
}

export function normalizeDisplayFileName(originalName: string) {
  const base = path.basename(originalName || "documento");
  return base.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 180);
}
