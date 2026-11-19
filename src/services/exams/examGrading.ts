import { randomInt } from "crypto";
import { MAX_FORMULA_LENGTH, buildTruthTable, gradeTranslation, gradeTruthTable, truthTableCellKey } from "../logic/logicCore";
import { checkParsonsPlacements, gradeParsons, type ParsonsPlacement } from "../logic/parsonsCore";
import type { QuestionContent, QuestionLanguage } from "../logic/questionCore";

export const MAX_ESSAY_LENGTH = 10000;

/** What the exam keeps of a bank question at publication time (server-only: it contains the answers). */
export interface QuestionSnapshot {
  statement: string;
  language: QuestionLanguage;
  subject: string | null;
  concepts: string[];
  content: QuestionContent;
}

export type ExamAnswer =
  | { choice: number | null }
  | { cells: Record<string, boolean> }
  | { text: string }
  | { solution: ParsonsPlacement[] };

export interface ObjectiveResult {
  correct: boolean;
  details: Record<string, unknown>;
}

/** Unbiased shuffle with a cryptographic source (question order and Parsons lines). */
export function shuffle<T>(items: T[]): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    const swap = result[i];
    result[i] = result[j];
    result[j] = swap;
  }
  return result;
}

/**
 * Question as the student sees it: never the correct option, the expected formula,
 * the Parsons solution or distractor flags, nor the essay criteria.
 */
export function studentQuestionView(snapshot: QuestionSnapshot, examQuestionId: string, weight: number, lineOrder?: string[]) {
  const base = { id: examQuestionId, type: snapshot.content.type, statement: snapshot.statement, language: snapshot.language, weight };
  const content = snapshot.content;
  switch (content.type) {
    case "quiz": return { ...base, content: { options: content.options } };
    case "truth_table": return { ...base, content: { formula: content.formula, columns: content.columns ?? "all" } };
    case "translation": return { ...base, content: { legend: content.legend } };
    case "parsons": {
      const order = lineOrder && lineOrder.length === content.lines.length ? lineOrder : content.lines.map((line) => line.id);
      const text: Record<string, string> = {};
      content.lines.forEach((line) => { text[line.id] = line.text; });
      return { ...base, content: { lines: order.map((id) => ({ id, text: text[id] })) } };
    }
    case "essay": return { ...base, content: {} };
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Keeps only a well-formed answer for this question; anything else is treated as unanswered. */
export function sanitizeAnswer(content: QuestionContent, raw: unknown): ExamAnswer | null {
  if (!isRecord(raw)) return null;
  switch (content.type) {
    case "quiz": {
      const choice = raw.choice;
      if (choice === null || choice === undefined) return { choice: null };
      return typeof choice === "number" && choice % 1 === 0 && choice >= 0 && choice < content.options.length ? { choice } : null;
    }
    case "truth_table": {
      if (!isRecord(raw.cells)) return null;
      const table = buildTruthTable(content.formula, content.columns ?? "all");
      const cells: Record<string, boolean> = {};
      table.rows.forEach((_row, rowIndex) => table.columns.forEach((column) => {
        const key = truthTableCellKey(rowIndex, column.key);
        const value = (raw.cells as Record<string, unknown>)[key];
        if (Object.prototype.hasOwnProperty.call(raw.cells, key) && typeof value === "boolean") cells[key] = value;
      }));
      return { cells };
    }
    case "translation":
      return typeof raw.text === "string" && raw.text.length <= MAX_FORMULA_LENGTH ? { text: raw.text } : null;
    case "essay":
      return typeof raw.text === "string" && raw.text.length <= MAX_ESSAY_LENGTH ? { text: raw.text } : null;
    case "parsons": {
      const check = checkParsonsPlacements(content, raw.solution);
      return check.ok ? { solution: check.placements } : null;
    }
  }
}

export function isAnswered(answer: ExamAnswer | null | undefined): boolean {
  if (!answer) return false;
  if ("choice" in answer) return answer.choice !== null;
  if ("cells" in answer) return Object.keys(answer.cells).length > 0;
  if ("text" in answer) return answer.text.trim().length > 0;
  return answer.solution.length > 0;
}

/** Official grading of objective questions; essays return null (graded by the professor in phase 6). */
export function gradeAnswer(content: QuestionContent, answer: ExamAnswer | null): ObjectiveResult | null {
  switch (content.type) {
    case "quiz": {
      const choice = answer && "choice" in answer ? answer.choice : null;
      return { correct: choice === content.correct, details: { choice } };
    }
    case "truth_table": {
      const grade = gradeTruthTable(content.formula, answer && "cells" in answer ? answer.cells : {}, content.columns ?? "all");
      return { correct: grade.correct, details: { right: grade.right, total: grade.total, empty: grade.empty, errorsByConcept: grade.errorsByConcept } };
    }
    case "translation": {
      const text = answer && "text" in answer ? answer.text : "";
      const grade = gradeTranslation(content.target, content.legend.map((entry) => entry.letter), text);
      return { correct: grade.status === "correct", details: { ...grade } };
    }
    case "parsons": {
      const grade = gradeParsons(content, answer && "solution" in answer ? answer.solution : []);
      return { correct: grade.correct, details: { ...grade } };
    }
    case "essay":
      return null;
  }
}
