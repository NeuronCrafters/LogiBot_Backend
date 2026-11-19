import { and, count, eq, gte } from "drizzle-orm";
import type { AnyDbClient } from "../../db/client";
import { classRagSettings, exerciseAttempts, exerciseHints } from "../../db/schema";
import { AppError } from "../../exceptions/AppError";
import { catalogs, getLanguage, t, type Language, type MessageKey } from "../../i18n";
import { logger } from "../../logger";
import { askOpenRouter } from "../ai/openRouterService";
import { assertChatOutput } from "../ai/chatOutputGuard";
import { queryChroma, revalidateChunks } from "../generation/contextRagStrategy";
import { isChromaConfigured } from "../rag/chromaService";
import { findParsonsExercise, findTranslationExercise } from "../logic/exerciseCatalog";
import { formatFormula, parseFormula } from "../logic/logicCore";

/**
 * Workbench hints (phase 7): up to three per exercise, each one going a step further —
 * 1) which concept to review, 2) where the mistake is, 3) a similar solved example.
 * Built from the student's own graded attempt (never from what the browser claims), with the
 * class material when the professor enabled the RAG base, and never with the answer.
 */
export const MAX_HINTS_PER_EXERCISE = 3;
export const MAX_HINTS_PER_HOUR = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AttemptRow = typeof exerciseAttempts.$inferSelect;
interface Material { title: string; content: string }

export interface HintContext {
  /** Facts about the mistake for the model (never the answer). */
  facts: string;
  concepts: string[];
  /** Text sent to the RAG search. */
  retrieval: string;
  /** True when the text gives the answer away. */
  leaks: (text: string) => boolean;
  /** Built-in hint for each level, used when the model is unavailable or its text is rejected. */
  fallback: (level: number) => string;
}

export const conceptLabel = (slug: string) => {
  const key = `exercises.concept.${slug}`;
  return key in catalogs["pt-BR"] ? t(key as MessageKey) : slug.replace(/_/g, " ");
};
const listOf = (concepts: string[]) => concepts.map(conceptLabel).join(", ") || t("exercises.hint.anyConcept");
const squash = (value: string) => value.replace(/\s+/g, "").toLowerCase();
/** Four or more truth values in a row (a filled column or row of the table). */
const TRUTH_RUN = /(?:\b(?:V|F|T|1|0|true|false|verdadeiro|falso|verdadero)\b[\s,;|/]*){4,}/i;
const MARKDOWN_TABLE = /^\s*\|.*\|\s*$(?:\r?\n^\s*\|.*\|\s*$){2,}/m;

export function buildHintContext(attempt: Pick<AttemptRow, "exerciseType" | "exerciseId" | "concepts" | "submittedState" | "result">, language: Language): HintContext {
  const concepts = (attempt.concepts as string[]) || [];
  const generic = (level: number) => level === 1
    ? t("exercises.hint.fallback1", { concepts: listOf(concepts) })
    : level === 2 ? t("exercises.hint.fallback2Generic") : t("exercises.hint.fallback3");

  if (attempt.exerciseType === "truth_table") {
    const state = attempt.submittedState as { formula?: string };
    const result = attempt.result as { wrong?: Array<{ row: number; column: string; concept: string }>; empty?: number; total?: number };
    const wrong = result.wrong ?? [];
    const first = wrong[0];
    const wrongConcepts = Array.from(new Set(wrong.map((item) => item.concept)));
    return {
      concepts: wrongConcepts.length ? wrongConcepts : concepts,
      retrieval: `${t("exercises.hint.truthTable")} ${state.formula ?? ""} ${listOf(wrongConcepts.length ? wrongConcepts : concepts)}`,
      facts: [
        `${t("exercises.hint.factExercise")}: ${t("exercises.hint.truthTable")} — ${state.formula ?? ""}`,
        `${t("exercises.hint.factWrongCells")}: ${wrong.length}; ${t("exercises.hint.factEmptyCells")}: ${result.empty ?? 0}`,
        `${t("exercises.hint.factConcepts")}: ${listOf(wrongConcepts.length ? wrongConcepts : concepts)}`,
        first ? `${t("exercises.hint.factFirstMistake")}: ${t("exercises.hint.cell", { column: first.column, row: first.row + 1 })}` : "",
      ].filter(Boolean).join("\n"),
      leaks: (text) => TRUTH_RUN.test(text) || MARKDOWN_TABLE.test(text),
      fallback: (level) => level === 2 && first
        ? t("exercises.hint.fallback2TruthTable", { column: first.column, row: first.row + 1, concept: conceptLabel(first.concept) })
        : generic(level),
    };
  }

  if (attempt.exerciseType === "translation") {
    const exercise = findTranslationExercise(attempt.exerciseId.replace(/^translation:/, ""));
    const state = attempt.submittedState as { answer?: string };
    const result = attempt.result as { counterexample?: Record<string, boolean>; answerValue?: boolean; expectedValue?: boolean };
    const target = exercise ? squash(formatFormula(parseFormula(exercise.target))) : null;
    const assignment = Object.keys(result.counterexample ?? {})
      .map((letter) => `${letter} = ${t(result.counterexample![letter] ? "exercises.hint.true" : "exercises.hint.false")}`).join(", ");
    const value = (flag?: boolean) => t(flag ? "exercises.hint.true" : "exercises.hint.false");
    return {
      concepts,
      retrieval: `${exercise?.sentence[language] ?? ""} ${listOf(concepts)}`,
      facts: [
        `${t("exercises.hint.factExercise")}: ${t("exercises.hint.translation")} — "${exercise?.sentence[language] ?? ""}"`,
        exercise ? `${t("exercises.hint.factLegend")}: ${exercise.legend.map((entry) => `${entry.letter} = ${entry.text[language]}`).join("; ")}` : "",
        `${t("exercises.hint.factStudentAnswer")}: ${state.answer ?? ""}`,
        assignment ? `${t("exercises.hint.factCounterexample")}: ${assignment} → ${t("exercises.hint.factValues", { actual: value(result.answerValue), expected: value(result.expectedValue) })}` : "",
        `${t("exercises.hint.factConcepts")}: ${listOf(concepts)}`,
      ].filter(Boolean).join("\n"),
      leaks: (text) => !!target && squash(text).includes(target),
      fallback: (level) => level === 2 && assignment
        ? t("exercises.hint.fallback2Translation", { assignment, actual: value(result.answerValue), expected: value(result.expectedValue) })
        : generic(level),
    };
  }

  if (attempt.exerciseType === "parsons") {
    const exercise = findParsonsExercise(attempt.exerciseId.replace(/^parsons:/, ""));
    const result = attempt.result as { misplaced?: number; wrongIndent?: number; distractors?: number; missing?: number };
    const solutionLines = exercise ? exercise.lines.filter((line) => !line.distractor).map((line) => squash(line.text[language])).filter((line) => line.length >= 6) : [];
    return {
      concepts,
      retrieval: `${exercise?.statement[language] ?? ""} ${listOf(concepts)}`,
      facts: [
        `${t("exercises.hint.factExercise")}: ${t("exercises.hint.parsons")} — "${exercise?.statement[language] ?? ""}"`,
        t("exercises.hint.factParsons", { misplaced: result.misplaced ?? 0, indent: result.wrongIndent ?? 0, distractors: result.distractors ?? 0, missing: result.missing ?? 0 }),
        `${t("exercises.hint.factConcepts")}: ${listOf(concepts)}`,
      ].join("\n"),
      // Dictating two program lines (or a code block) would give the order away.
      leaks: (text) => /```|~~~/.test(text) || solutionLines.filter((line) => squash(text).includes(line)).length >= 2,
      fallback: (level) => level === 2
        ? t("exercises.hint.fallback2Parsons", { misplaced: result.misplaced ?? 0, indent: result.wrongIndent ?? 0, distractors: result.distractors ?? 0 })
        : generic(level),
    };
  }

  return {
    concepts,
    retrieval: listOf(concepts),
    facts: `${t("exercises.hint.factConcepts")}: ${listOf(concepts)}`,
    leaks: (text) => TRUTH_RUN.test(text) || /```/.test(text),
    fallback: generic,
  };
}

/** Excerpts of the class material, only when the professor turned the RAG base on for the class. */
async function classMaterial(db: AnyDbClient, classId: string | null, query: string): Promise<Material[]> {
  if (!classId || !isChromaConfigured()) return [];
  try {
    const [settings] = await db.select().from(classRagSettings).where(eq(classRagSettings.classId, classId)).limit(1);
    if (!settings || settings.ragMode === "none") return [];
    const candidates = await queryChroma({ classId, message: query, topK: 3 });
    const chunks = await revalidateChunks({ classId, candidates, topK: 3, minScore: settings.minScore ?? 40 });
    return chunks.map((chunk) => ({ title: chunk.documentTitle, content: chunk.content.slice(0, 1200) }));
  } catch (error) {
    // The material improves the hint but is never required.
    logger.warn("Hints", "Class material unavailable.", { message: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

async function writeHint(context: HintContext, level: number, material: Material[], language: Language) {
  const response = await askOpenRouter([
    { role: "system", content: t("exercises.hint.system") },
    { role: "system", content: t(`exercises.hint.level${level}` as MessageKey) },
    { role: "user", content: [
      context.facts,
      material.length ? `${t("exercises.hint.factMaterial")}:\n${material.map((item) => `[${item.title}] ${item.content}`).join("\n---\n")}` : "",
    ].filter(Boolean).join("\n\n") },
  ], { includeChatPrompt: false, timeoutMs: 15000, queueTimeoutMs: 3000 });
  const text = response?.text?.trim() ?? "";
  if (!text) return null;
  try {
    assertChatOutput(text, language);
  } catch {
    return null;
  }
  if (context.leaks(text) || text.length > 1200) return null;
  return text;
}

export async function hintStatus(db: AnyDbClient, studentId: string, exerciseId: string) {
  const rows = await db
    .select({ level: exerciseHints.level, text: exerciseHints.text, createdAt: exerciseHints.createdAt })
    .from(exerciseHints)
    .where(and(eq(exerciseHints.studentId, studentId), eq(exerciseHints.exerciseId, exerciseId)))
    .orderBy(exerciseHints.level);
  return { hints: rows, remaining: Math.max(0, MAX_HINTS_PER_EXERCISE - rows.length) };
}

/** Gives the next hint for the student's wrong attempt. */
export async function requestHint(db: AnyDbClient, studentId: string, body: unknown) {
  const attemptId = body && typeof body === "object" ? (body as Record<string, unknown>).attemptId : undefined;
  if (typeof attemptId !== "string" || !UUID.test(attemptId)) throw new AppError("exercises.hintAttemptInvalid", 400);
  const [attempt] = await db.select().from(exerciseAttempts)
    .where(and(eq(exerciseAttempts.id, attemptId), eq(exerciseAttempts.studentId, studentId))).limit(1);
  if (!attempt) throw new AppError("exercises.hintAttemptInvalid", 404);
  if (attempt.mode !== "practice") throw new AppError("exercises.hintExam", 403);
  if (attempt.isCorrect) throw new AppError("exercises.hintNotNeeded", 409);

  const given = await hintStatus(db, studentId, attempt.exerciseId);
  if (given.remaining === 0) throw new AppError({ key: "exercises.hintLimit", params: { max: MAX_HINTS_PER_EXERCISE } }, 409);
  const [{ total: lastHour }] = await db.select({ total: count() }).from(exerciseHints)
    .where(and(eq(exerciseHints.studentId, studentId), gte(exerciseHints.createdAt, new Date(Date.now() - 3600000))));
  if (Number(lastHour) >= MAX_HINTS_PER_HOUR) throw new AppError("exercises.hintRateLimit", 429);

  const level = given.hints.length + 1;
  const language = getLanguage();
  const context = buildHintContext(attempt, language);
  const material = await classMaterial(db, attempt.classId, context.retrieval);
  let text: string | null = null;
  try {
    text = await writeHint(context, level, material, language);
  } catch (error) {
    logger.warn("Hints", "Model hint failed; using the built-in text.", { message: error instanceof Error ? error.message : String(error) });
  }
  const source = text ? "ai" : "fallback";
  const finalText = text ?? context.fallback(level);

  const [saved] = await db.insert(exerciseHints).values({
    studentId, attemptId: attempt.id, exerciseId: attempt.exerciseId, level, source,
    usedMaterial: !!text && material.length > 0, text: finalText, language,
  }).onConflictDoNothing().returning({ id: exerciseHints.id, createdAt: exerciseHints.createdAt });
  // Another request took this level at the same time.
  if (!saved) throw new AppError({ key: "exercises.hintLimit", params: { max: MAX_HINTS_PER_EXERCISE } }, 409);

  return {
    level,
    text: finalText,
    remaining: MAX_HINTS_PER_EXERCISE - level,
    usedMaterial: !!text && material.length > 0,
    materials: text ? Array.from(new Set(material.map((item) => item.title))) : [],
    concepts: context.concepts,
  };
}
