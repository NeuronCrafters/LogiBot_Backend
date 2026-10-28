import { eq } from "drizzle-orm";
import { getDb } from "../../db/client";
import { classRagSettings } from "../../db/schema";
import { AppError } from "../../exceptions/AppError";
import { logger } from "../../logger";
import type { RagMode, RagUser } from "./ragTypes";
import { assertCanManageRagClass } from "./ragPermissionService";

const ALLOWED_RAG_MODES = new Set<RagMode>(["none", "context", "self", "hybrid"]);

export type RagSettingsResponse = {
  classId: string;
  ragMode: RagMode;
  topK: number;
  minScore: number;
  systemPrompt: string | null;
  llmModel: string | null;
  embeddingModel: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

function normalizeRagMode(value: unknown): RagMode {
  const mode = String(value || "").trim() as RagMode;
  if (!ALLOWED_RAG_MODES.has(mode)) {
    throw new AppError("rag.modeInvalid", 400);
  }
  return mode;
}

function normalizeIntegerInRange(
  value: unknown,
  field: string,
  min: number,
  max: number,
) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new AppError({ key: "validation.range", params: { value0: field, value1: min, value2: max } }, 400);
  }
  return parsed;
}

function normalizeOptionalText(value: unknown, maxLength: number) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > maxLength)
    throw new AppError({ key: "validation.textLength", params: { value0: maxLength } }, 400);
  return text;
}

function toResponse(
  classId: string,
  row?: typeof classRagSettings.$inferSelect,
): RagSettingsResponse {
  return {
    classId,
    ragMode: (row?.ragMode as RagMode) || "none",
    topK: row?.topK ?? 4,
    minScore: row?.minScore ?? 40,
    systemPrompt: row?.systemPrompt ?? null,
    llmModel: row?.llmModel ?? null,
    embeddingModel: row?.embeddingModel ?? null,
    createdAt: row?.createdAt ?? null,
    updatedAt: row?.updatedAt ?? null,
  };
}

export async function getRagSettings(user: RagUser, classId: string) {
  await assertCanManageRagClass(user, classId);

  const [settings] = await getDb()
    .select()
    .from(classRagSettings)
    .where(eq(classRagSettings.classId, classId))
    .limit(1);

  return toResponse(classId, settings);
}

export async function updateRagSettings(
  user: RagUser,
  classId: string,
  input: {
    ragMode?: unknown;
    topK?: unknown;
    minScore?: unknown;
    systemPrompt?: unknown;
    llmModel?: unknown;
    embeddingModel?: unknown;
  },
) {
  await assertCanManageRagClass(user, classId);
  logger.info("RagSettings", "Updating settings.", { classId, userId: user.id, input });

  const existing = await getRagSettings(user, classId);
  const update = {
    ragMode:
      input.ragMode === undefined
        ? existing.ragMode
        : normalizeRagMode(input.ragMode),
    topK:
      input.topK === undefined
        ? existing.topK
        : normalizeIntegerInRange(input.topK, "topK", 1, 10),
    minScore:
      input.minScore === undefined
        ? existing.minScore
        : normalizeIntegerInRange(input.minScore, "minScore", 0, 100),
    systemPrompt:
      input.systemPrompt === undefined
        ? existing.systemPrompt
        : normalizeOptionalText(input.systemPrompt, 4000),
    llmModel:
      input.llmModel === undefined
        ? existing.llmModel
        : normalizeOptionalText(input.llmModel, 120),
    embeddingModel:
      input.embeddingModel === undefined
        ? existing.embeddingModel
        : normalizeOptionalText(input.embeddingModel, 120),
    updatedAt: new Date(),
  };

  const [settings] = await getDb()
    .insert(classRagSettings)
    .values({ classId, ...update })
    .onConflictDoUpdate({
      target: classRagSettings.classId,
      set: update,
    })
    .returning();

  logger.info("RagSettings", "Settings updated.", { classId, ragMode: update.ragMode, topK: update.topK, minScore: update.minScore });
  return toResponse(classId, settings);
}
