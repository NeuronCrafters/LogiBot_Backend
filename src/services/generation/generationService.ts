import { eq } from "drizzle-orm";
import { getDb } from "../../db/client";
import { classRagSettings, studentProfiles } from "../../db/schema";
import { logger } from "../../logger";
import { assertCanManageRagClass } from "../rag/ragPermissionService";
import type { RagMode, RagUser } from "../rag/ragTypes";
import { generateContextRagResponse } from "./contextRagStrategy";
import type {
  GenerationResult,
  RuntimeRagSettings,
} from "./generationTypes";
import { generateNoRagResponse } from "./noRagStrategy";
import { generateSelfRagResponse } from "./selfRagStrategy";
import type { AgentMessage } from "../ai/digitalOceanAgentService";

type RagOverride = {
  ragMode?: unknown;
  topK?: unknown;
  minScore?: unknown;
  systemPrompt?: unknown;
};

const ALLOWED_RAG_MODES = new Set<RagMode>(["none", "context", "self"]);

function normalizeMode(value: unknown, fallback: RagMode): RagMode {
  const mode = String(value || "").trim() as RagMode;
  return ALLOWED_RAG_MODES.has(mode) ? mode : fallback;
}

function normalizeInt(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizePrompt(value: unknown, fallback: string | null) {
  if (value === undefined) return fallback;
  if (value === null) return null;
  const prompt = String(value).trim();
  return prompt ? prompt.slice(0, 4000) : null;
}

async function getStudentClassId(userId: string) {
  const [profile] = await getDb()
    .select({ classId: studentProfiles.classId })
    .from(studentProfiles)
    .where(eq(studentProfiles.accountId, userId))
    .limit(1);

  return profile?.classId ?? null;
}

async function getRuntimeRagSettings(classId: string, override?: RagOverride) {
  const [row] = await getDb()
    .select()
    .from(classRagSettings)
    .where(eq(classRagSettings.classId, classId))
    .limit(1);

  const base: RuntimeRagSettings = {
    classId,
    ragMode: (row?.ragMode as RagMode) || "none",
    topK: row?.topK ?? 4,
    minScore: row?.minScore ?? 60,
    systemPrompt: row?.systemPrompt ?? null,
  };

  if (!override) return base;

  return {
    classId,
    ragMode: normalizeMode(override.ragMode, base.ragMode),
    topK: normalizeInt(override.topK, base.topK, 1, 10),
    minScore: normalizeInt(override.minScore, base.minScore, 0, 100),
    systemPrompt: normalizePrompt(override.systemPrompt, base.systemPrompt),
  };
}

async function generateWithSettings(input: {
  message: string;
  history: AgentMessage[];
  settings: RuntimeRagSettings;
}): Promise<GenerationResult> {
  logger.info("Generation", "Generating response.", {
    classId: input.settings.classId,
    ragMode: input.settings.ragMode,
    topK: input.settings.topK,
    minScore: input.settings.minScore,
  });

  if (input.settings.ragMode === "none") {
    return generateNoRagResponse(input);
  }

  if (input.settings.ragMode === "self") {
    return generateSelfRagResponse({
      message: input.message,
      history: input.history,
      settings: input.settings,
    });
  }

  return generateContextRagResponse({
    message: input.message,
    history: input.history,
    settings: input.settings,
  });
}

export async function generateChatResponse(input: {
  userId: string;
  message: string;
  history: AgentMessage[];
}) {
  const classId = await getStudentClassId(input.userId);
  if (!classId) {
    logger.info("Generation", "No class found for student; using no-RAG.", { userId: input.userId });
    return generateNoRagResponse(input);
  }

  const settings = await getRuntimeRagSettings(classId);
  return generateWithSettings({ ...input, settings });
}

export async function generateRagTestResponse(input: {
  user: RagUser;
  classId: string;
  message: string;
  override?: RagOverride;
}) {
  await assertCanManageRagClass(input.user, input.classId);
  const settings = await getRuntimeRagSettings(input.classId, input.override);

  return generateWithSettings({
    message: input.message,
    history: [{ role: "user", content: input.message }],
    settings,
  });
}
