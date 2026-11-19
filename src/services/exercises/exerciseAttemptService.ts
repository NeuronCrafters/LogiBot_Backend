import { and, count, eq, inArray, isNull } from "drizzle-orm";
import type { AnyDbClient } from "../../db/client";
import { assessmentQuestions, classDisciplines, exerciseAttempts, exerciseHints, studentProfiles } from "../../db/schema";
import type { QuestionContent } from "../logic/questionCore";
import { shuffle } from "../exams/examGrading";
import { AppError } from "../../exceptions/AppError";
import {
  LOGIC_ENGINE_VERSION,
  MAX_FORMULA_LENGTH,
  buildTruthTable,
  checkTruthTableFormula,
  isTruthTableColumns,
  type TruthTableColumns,
  conceptsOf,
  formatFormula,
  gradeTranslation,
  gradeTruthTable,
  parseFormula,
  truthTableCellKey,
  type Assignment,
  type CellMark,
  type ConceptSlug,
  type TruthTableGrade,
} from "../logic/logicCore";
import {
  PARSONS_ENGINE_VERSION,
  MAX_PARSONS_INDENT,
  checkParsonsPlacements,
  gradeParsons,
  type ParsonsLineMark,
  type ParsonsPlacement,
} from "../logic/parsonsCore";
import { findParsonsExercise, findTranslationExercise } from "../logic/exerciseCatalog";

/** Subject (existing catalog level) of the built-in truth tables; concepts are its sub-tags. */
export const PRACTICE_SUBJECT = "propositional_logic";
/** Enough for a 1024-row table filled cell by cell, with corrections. */
export const MAX_ATTEMPT_EVENTS = 3000;
export const MAX_ATTEMPT_DURATION_MS = 24 * 60 * 60 * 1000;
export const MAX_HINTS_USED = 50;
const EVENT_ACTIONS = ["load", "mark", "clear", "edit", "insert", "select", "move", "indent", "reset"] as const;
const SOURCES = ["catalog", "custom"] as const;

export type ExerciseType = "truth_table" | "translation" | "parsons";
export type PracticeEventAction = (typeof EVENT_ACTIONS)[number];
export interface PracticeEvent {
  t: number;
  action: PracticeEventAction;
  row?: number;
  column?: string;
  value?: boolean | null;
  line?: string;
  from?: "bank" | "solution";
  to?: "bank" | "solution";
  position?: number;
  indent?: number;
  via?: "drag" | "button" | "keyboard";
  text?: string;
}

interface CommonAttemptFields {
  events: PracticeEvent[];
  hintsUsed: number;
  durationMs: number | null;
}

export interface TruthTableAttemptInput extends CommonAttemptFields {
  exerciseId: string;
  formula: string;
  source: (typeof SOURCES)[number];
  concepts: ConceptSlug[];
  cells: Record<string, boolean>;
  /** Columns asked: every subformula or only the final one. */
  columns: TruthTableColumns;
}

export interface TruthTableAttemptResponse {
  attemptId: string;
  attemptNumber: number;
  exerciseId: string;
  formula: string;
  concepts: ConceptSlug[];
  correct: boolean;
  total: number;
  right: number;
  empty: number;
  wrong: TruthTableGrade["wrong"];
  errorsByConcept: TruthTableGrade["errorsByConcept"];
  marks: Record<string, CellMark>;
  engineVersion: string;
}

export interface TranslationAttemptResponse {
  attemptId: string;
  attemptNumber: number;
  exerciseId: string;
  concepts: string[];
  correct: boolean;
  normalizedAnswer: string;
  /** Canonical expected formula, only revealed when the answer is correct but written differently. */
  equivalentTo?: string;
  counterexample?: Assignment;
  answerValue?: boolean;
  expectedValue?: boolean;
  engineVersion: string;
}

export interface ParsonsAttemptResponse {
  attemptId: string;
  attemptNumber: number;
  exerciseId: string;
  concepts: string[];
  correct: boolean;
  marks: Record<string, ParsonsLineMark>;
  misplaced: number;
  wrongIndent: number;
  distractors: number;
  missing: number;
  engineVersion: string;
}

/** A graded attempt ready to be stored, plus the fields returned to the student. */
interface PreparedAttempt extends CommonAttemptFields {
  exerciseType: ExerciseType;
  exerciseId: string;
  exerciseVersion: number;
  source: "catalog" | "custom" | "bank";
  subject: string;
  concepts: string[];
  isCorrect: boolean;
  engineVersion: string;
  submittedState: unknown;
  result: unknown;
  response: Record<string, unknown>;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isWholeNumber = (value: unknown, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= max;

const oneOf = <T extends string>(value: unknown, options: readonly T[]): value is T =>
  typeof value === "string" && (options as readonly string[]).indexOf(value) !== -1;

function parseEvents(raw: unknown): PracticeEvent[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > MAX_ATTEMPT_EVENTS) throw new AppError("exercises.eventsInvalid", 400);
  const invalid = () => new AppError("exercises.eventsInvalid", 400);
  return raw.map((item) => {
    if (!isPlainObject(item) || !isWholeNumber(item.t, MAX_ATTEMPT_DURATION_MS)) throw invalid();
    if (!oneOf(item.action, EVENT_ACTIONS)) throw invalid();
    const event: PracticeEvent = { t: item.t as number, action: item.action as PracticeEventAction };
    if (item.row !== undefined) { if (!isWholeNumber(item.row, 1023)) throw invalid(); event.row = item.row as number; }
    if (item.column !== undefined) {
      if (typeof item.column !== "string" || item.column.length > 200) throw invalid();
      event.column = item.column;
    }
    if (item.value !== undefined) {
      if (item.value !== null && typeof item.value !== "boolean") throw invalid();
      event.value = item.value as boolean | null;
    }
    if (item.line !== undefined) {
      if (typeof item.line !== "string" || item.line.length > 40) throw invalid();
      event.line = item.line;
    }
    if (item.from !== undefined) { if (!oneOf(item.from, ["bank", "solution"] as const)) throw invalid(); event.from = item.from as PracticeEvent["from"]; }
    if (item.to !== undefined) { if (!oneOf(item.to, ["bank", "solution"] as const)) throw invalid(); event.to = item.to as PracticeEvent["to"]; }
    if (item.position !== undefined) { if (!isWholeNumber(item.position, 255)) throw invalid(); event.position = item.position as number; }
    if (item.indent !== undefined) { if (!isWholeNumber(item.indent, MAX_PARSONS_INDENT)) throw invalid(); event.indent = item.indent as number; }
    if (item.via !== undefined) { if (!oneOf(item.via, ["drag", "button", "keyboard"] as const)) throw invalid(); event.via = item.via as PracticeEvent["via"]; }
    if (item.text !== undefined) {
      if (typeof item.text !== "string" || item.text.length > MAX_FORMULA_LENGTH) throw invalid();
      event.text = item.text;
    }
    return event;
  });
}

function parseCommon(body: Record<string, unknown>): CommonAttemptFields {
  const rawHints = body.hintsUsed === undefined ? 0 : body.hintsUsed;
  if (!isWholeNumber(rawHints, MAX_HINTS_USED)) throw new AppError("exercises.payloadInvalid", 400);
  const rawDuration = body.durationMs === undefined || body.durationMs === null ? null : body.durationMs;
  if (rawDuration !== null && !isWholeNumber(rawDuration, MAX_ATTEMPT_DURATION_MS)) throw new AppError("exercises.payloadInvalid", 400);
  return { events: parseEvents(body.events), hintsUsed: rawHints as number, durationMs: rawDuration as number | null };
}

/** Catalog exercises are always identified by id; a custom source makes no sense for them. */
function requireCatalogSource(body: Record<string, unknown>) {
  if (body.source !== undefined && body.source !== "catalog") throw new AppError("exercises.payloadInvalid", 400);
}

/* ── Truth table ──────────────────────────────────────────────────────────── */

/**
 * Validates a truth-table attempt sent by the client. The client's own grading is
 * ignored: only the formula and the submitted cells are kept, and only cells that
 * belong to the table of that formula.
 */
export function parseTruthTableAttempt(body: unknown): TruthTableAttemptInput {
  if (!isPlainObject(body)) throw new AppError("exercises.payloadInvalid", 400);
  if (body.type !== "truth_table") throw new AppError("exercises.typeInvalid", 400);
  if (!oneOf(body.source, SOURCES)) throw new AppError("exercises.payloadInvalid", 400);
  if (typeof body.formula !== "string") throw new AppError("exercises.formulaInvalid", 400);
  const columns = body.columns === undefined ? "all" : body.columns;
  if (!isTruthTableColumns(columns)) throw new AppError("exercises.payloadInvalid", 400);
  const check = checkTruthTableFormula(body.formula, columns);
  if (check.ok === false) throw new AppError("exercises.formulaInvalid", 400);

  if (!isPlainObject(body.cells)) throw new AppError("exercises.cellsInvalid", 400);
  const table = buildTruthTable(check.normalized, columns);
  const cells: Record<string, boolean> = {};
  table.rows.forEach((_row, rowIndex) => {
    table.columns.forEach((column) => {
      const key = truthTableCellKey(rowIndex, column.key);
      const value = Object.prototype.hasOwnProperty.call(body.cells, key) ? (body.cells as Record<string, unknown>)[key] : undefined;
      if (value === undefined || value === null) return;
      if (typeof value !== "boolean") throw new AppError("exercises.cellsInvalid", 400);
      cells[key] = value;
    });
  });

  return {
    // The same formula asked with the final column only is another exercise.
    exerciseId: "truth_table:" + check.normalized + (columns === "final" ? "#final" : ""),
    formula: check.normalized,
    columns,
    source: body.source as TruthTableAttemptInput["source"],
    concepts: conceptsOf(check.formula),
    cells,
    ...parseCommon(body),
  };
}

function prepareTruthTable(input: TruthTableAttemptInput): PreparedAttempt {
  const grade = gradeTruthTable(input.formula, input.cells, input.columns);
  const { marks, ...summary } = grade;
  return {
    exerciseType: "truth_table",
    exerciseId: input.exerciseId,
    exerciseVersion: 1,
    source: input.source,
    subject: PRACTICE_SUBJECT,
    concepts: input.concepts,
    isCorrect: grade.correct,
    engineVersion: LOGIC_ENGINE_VERSION,
    submittedState: { formula: input.formula, columns: input.columns, cells: input.cells },
    result: summary,
    response: { formula: input.formula, columns: input.columns, concepts: input.concepts, ...summary, marks },
    events: input.events,
    hintsUsed: input.hintsUsed,
    durationMs: input.durationMs,
  };
}

/* ── Translation ──────────────────────────────────────────────────────────── */

function prepareTranslation(body: Record<string, unknown>): PreparedAttempt {
  requireCatalogSource(body);
  const exercise = typeof body.exerciseId === "string" ? findTranslationExercise(body.exerciseId) : undefined;
  if (!exercise) throw new AppError("exercises.exerciseNotFound", 404);
  if (typeof body.answer !== "string" || body.answer.length > MAX_FORMULA_LENGTH) throw new AppError("exercises.answerInvalid", 400);
  const letters = exercise.legend.map((entry) => entry.letter);
  const grade = gradeTranslation(exercise.target, letters, body.answer);
  // Syntax is checked in the browser first; an invalid answer here is not an attempt.
  if (grade.status === "invalid") throw new AppError("exercises.answerInvalid", 400);
  const concepts: string[] = conceptsOf(parseFormula(exercise.target));
  const response: Record<string, unknown> = { concepts, correct: grade.status === "correct", normalizedAnswer: grade.normalizedAnswer };
  if (grade.status === "correct" && !grade.identicalToTarget) response.equivalentTo = formatFormula(parseFormula(exercise.target));
  if (grade.status === "incorrect") {
    response.counterexample = grade.counterexample;
    response.answerValue = grade.answerValue;
    response.expectedValue = grade.expectedValue;
  }
  return {
    exerciseType: "translation",
    exerciseId: "translation:" + exercise.id,
    exerciseVersion: exercise.version,
    source: "catalog",
    subject: exercise.subject,
    concepts,
    isCorrect: grade.status === "correct",
    engineVersion: LOGIC_ENGINE_VERSION,
    submittedState: { answer: body.answer },
    result: grade,
    response,
    ...parseCommon(body),
  };
}

/* ── Parsons ──────────────────────────────────────────────────────────────── */

function prepareParsons(body: Record<string, unknown>): PreparedAttempt {
  requireCatalogSource(body);
  const exercise = typeof body.exerciseId === "string" ? findParsonsExercise(body.exerciseId) : undefined;
  if (!exercise) throw new AppError("exercises.exerciseNotFound", 404);
  const check = checkParsonsPlacements(exercise, body.solution);
  if (check.ok === false) throw new AppError("exercises.solutionInvalid", 400);
  const placements: ParsonsPlacement[] = check.placements;
  const grade = gradeParsons(exercise, placements);
  const { solutionIndex, ...visible } = grade;
  return {
    exerciseType: "parsons",
    exerciseId: "parsons:" + exercise.id,
    exerciseVersion: exercise.version,
    source: "catalog",
    subject: exercise.subject,
    concepts: exercise.concepts,
    isCorrect: grade.correct,
    engineVersion: PARSONS_ENGINE_VERSION,
    submittedState: { solution: placements },
    result: { ...visible, solutionIndex },
    response: { concepts: exercise.concepts, ...visible },
    ...parseCommon(body),
  };
}

/* ── Professor-registered questions offered in the workbench ─────────────── */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRACTICE_TYPES: ExerciseType[] = ["truth_table", "translation", "parsons"];

async function classDisciplineIds(db: AnyDbClient, studentId: string): Promise<string[]> {
  const [profile] = await db.select({ classId: studentProfiles.classId }).from(studentProfiles).where(eq(studentProfiles.accountId, studentId)).limit(1);
  if (!profile) return [];
  const rows = await db.select({ id: classDisciplines.disciplineId }).from(classDisciplines).where(eq(classDisciplines.classId, profile.classId));
  return rows.map((row) => row.id);
}

/**
 * Practice questions of the student's class disciplines, without answer keys:
 * the formula of a truth table is the exercise itself; translations hide the
 * expected formula and Parsons hides the solution (lines are shuffled).
 */
export async function listPracticeQuestions(db: AnyDbClient, studentId: string, type: unknown) {
  if (typeof type !== "string" || PRACTICE_TYPES.indexOf(type as ExerciseType) === -1) throw new AppError("exercises.typeInvalid", 400);
  const disciplineIds = await classDisciplineIds(db, studentId);
  if (!disciplineIds.length) return [];
  const rows = await db.select().from(assessmentQuestions).where(and(
    inArray(assessmentQuestions.disciplineId, disciplineIds), eq(assessmentQuestions.type, type),
    eq(assessmentQuestions.practiceEnabled, true), isNull(assessmentQuestions.archivedAt),
  ));
  return rows.map((row) => {
    const content = row.content as QuestionContent;
    const base = { id: row.id, type: row.type, statement: row.statement, language: row.language, concepts: row.concepts };
    if (content.type === "truth_table") return { ...base, content: { formula: content.formula, columns: content.columns ?? "all" } };
    if (content.type === "translation") return { ...base, content: { legend: content.legend } };
    if (content.type === "parsons") return { ...base, content: { lines: shuffle(content.lines.map((line) => ({ id: line.id, text: line.text }))) } };
    return { ...base, content: {} };
  });
}

/** Grades an attempt on a bank question with the answer key stored on the server. */
export async function prepareBankAttempt(db: AnyDbClient, studentId: string, body: Record<string, unknown>): Promise<PreparedAttempt> {
  const questionId = body.bankQuestionId;
  if (typeof questionId !== "string" || !UUID.test(questionId)) throw new AppError("exercises.exerciseNotFound", 404);
  const [question] = await db.select().from(assessmentQuestions).where(and(
    eq(assessmentQuestions.id, questionId), eq(assessmentQuestions.practiceEnabled, true), isNull(assessmentQuestions.archivedAt),
  )).limit(1);
  if (!question || (await classDisciplineIds(db, studentId)).indexOf(question.disciplineId) === -1) throw new AppError("exercises.exerciseNotFound", 404);
  if (body.type !== question.type) throw new AppError("exercises.typeInvalid", 400);
  const content = question.content as QuestionContent;
  const identity = {
    exerciseId: "bank:" + question.id, exerciseVersion: question.version, source: "bank" as const,
    subject: question.subject ?? PRACTICE_SUBJECT, concepts: question.concepts,
  };

  if (content.type === "truth_table") {
    // The question decides the columns, whatever the browser sends.
    const input = parseTruthTableAttempt({ ...body, source: "catalog", formula: content.formula, columns: content.columns ?? "all" });
    const prepared = prepareTruthTable(input);
    return { ...prepared, ...identity, response: { ...prepared.response, concepts: identity.concepts } };
  }
  if (content.type === "translation") {
    if (typeof body.answer !== "string" || body.answer.length > MAX_FORMULA_LENGTH) throw new AppError("exercises.answerInvalid", 400);
    const grade = gradeTranslation(content.target, content.legend.map((entry) => entry.letter), body.answer);
    if (grade.status === "invalid") throw new AppError("exercises.answerInvalid", 400);
    const response: Record<string, unknown> = { concepts: identity.concepts, correct: grade.status === "correct", normalizedAnswer: grade.normalizedAnswer };
    if (grade.status === "correct" && !grade.identicalToTarget) response.equivalentTo = content.target;
    if (grade.status === "incorrect") Object.assign(response, { counterexample: grade.counterexample, answerValue: grade.answerValue, expectedValue: grade.expectedValue });
    return {
      exerciseType: "translation", ...identity, isCorrect: grade.status === "correct", engineVersion: LOGIC_ENGINE_VERSION,
      submittedState: { answer: body.answer }, result: grade, response, ...parseCommon(body),
    };
  }
  if (content.type === "parsons") {
    const check = checkParsonsPlacements(content, body.solution);
    if (check.ok === false) throw new AppError("exercises.solutionInvalid", 400);
    const grade = gradeParsons(content, check.placements);
    const { solutionIndex, ...visible } = grade;
    return {
      exerciseType: "parsons", ...identity, isCorrect: grade.correct, engineVersion: PARSONS_ENGINE_VERSION,
      submittedState: { solution: check.placements }, result: { ...visible, solutionIndex }, response: { concepts: identity.concepts, ...visible }, ...parseCommon(body),
    };
  }
  throw new AppError("exercises.typeInvalid", 400);
}

/* ── Dispatch and storage ─────────────────────────────────────────────────── */

/** Validates and grades any workbench attempt (pure: no database access). */
export function prepareExerciseAttempt(body: unknown): PreparedAttempt {
  if (!isPlainObject(body)) throw new AppError("exercises.payloadInvalid", 400);
  if (body.type === "truth_table") return prepareTruthTable(parseTruthTableAttempt(body));
  if (body.type === "translation") return prepareTranslation(body);
  if (body.type === "parsons") return prepareParsons(body);
  throw new AppError("exercises.typeInvalid", 400);
}

/** Stores a prepared attempt with its number and the student's class, and returns the official result. */
export async function recordExerciseAttempt(db: AnyDbClient, studentId: string, attempt: PreparedAttempt) {
  const [profile] = await db
    .select({ classId: studentProfiles.classId })
    .from(studentProfiles)
    .where(eq(studentProfiles.accountId, studentId))
    .limit(1);
  const [previous] = await db
    .select({ total: count() })
    .from(exerciseAttempts)
    .where(and(eq(exerciseAttempts.studentId, studentId), eq(exerciseAttempts.exerciseId, attempt.exerciseId)));
  const attemptNumber = Number(previous ? previous.total : 0) + 1;
  // Hints are counted on the server; the browser's number is kept only if it is higher.
  const [hints] = await db
    .select({ total: count() })
    .from(exerciseHints)
    .where(and(eq(exerciseHints.studentId, studentId), eq(exerciseHints.exerciseId, attempt.exerciseId)));
  const hintsUsed = Math.max(attempt.hintsUsed, Number(hints ? hints.total : 0));

  const [saved] = await db
    .insert(exerciseAttempts)
    .values({
      studentId,
      classId: profile ? profile.classId : null,
      mode: "practice",
      exerciseType: attempt.exerciseType,
      exerciseId: attempt.exerciseId,
      exerciseVersion: attempt.exerciseVersion,
      source: attempt.source,
      subject: attempt.subject,
      concepts: attempt.concepts,
      attemptNumber,
      isCorrect: attempt.isCorrect,
      hintsUsed,
      durationMs: attempt.durationMs,
      engineVersion: attempt.engineVersion,
      submittedState: attempt.submittedState,
      result: attempt.result,
      events: attempt.events,
    })
    .returning({ id: exerciseAttempts.id });

  return {
    attemptId: saved.id,
    attemptNumber,
    exerciseId: attempt.exerciseId,
    ...attempt.response,
    engineVersion: attempt.engineVersion,
  };
}

/** Grades on the server (official result) and stores a truth-table attempt. */
export async function recordTruthTableAttempt(
  db: AnyDbClient,
  studentId: string,
  input: TruthTableAttemptInput,
): Promise<TruthTableAttemptResponse> {
  return (await recordExerciseAttempt(db, studentId, prepareTruthTable(input))) as unknown as TruthTableAttemptResponse;
}
