import request from "supertest";
import { app } from "../server";
import { AppError } from "../exceptions/AppError";
import {
  MAX_ATTEMPT_EVENTS,
  PRACTICE_SUBJECT,
  parseTruthTableAttempt,
  prepareExerciseAttempt,
  recordExerciseAttempt,
  recordTruthTableAttempt,
} from "../services/exercises/exerciseAttemptService";
import { LOGIC_ENGINE_VERSION } from "../services/logic/logicCore";
import { PARSONS_ENGINE_VERSION } from "../services/logic/parsonsCore";
import { ALGORITHM_SUBJECT, TRANSLATION_SUBJECT } from "../services/logic/exerciseCatalog";

jest.mock("../db/client", () => ({
  checkDatabase: jest.fn(async () => undefined),
  closeDatabasePool: jest.fn(async () => undefined),
  getDb: jest.fn(),
  getExpressDb: jest.fn(),
}));

const errorOf = (run: () => unknown): unknown => {
  try { run(); } catch (error) { return error; }
  return undefined;
};

const validBody = () => ({
  type: "truth_table",
  source: "catalog",
  formula: "(p -> q) & ~q",
  cells: { "0|p → q": true, "1|p → q": false, "3|(p → q) ∧ ¬q": false },
  events: [{ t: 0, action: "load" }, { t: 1200, action: "mark", row: 0, column: "p → q", value: true }],
  hintsUsed: 0,
  durationMs: 1500,
});

describe("exercise attempts: payload validation", () => {
  it("normalizes the formula and derives identity and concepts on the server", () => {
    const input = parseTruthTableAttempt(validBody());
    expect(input.formula).toBe("(p → q) ∧ ¬q");
    expect(input.exerciseId).toBe("truth_table:(p → q) ∧ ¬q");
    expect(input.concepts).toEqual(["negation", "conjunction", "conditional"]);
    expect(input.events).toHaveLength(2);
    expect(input.durationMs).toBe(1500);
  });

  it("keeps only boolean cells that belong to the table and ignores client-side results", () => {
    const body = { ...validBody(), cells: { "0|p → q": true, "9|p → q": false, "0|r": true, "1|¬q": null }, correct: true, right: 12 };
    const input = parseTruthTableAttempt(body);
    expect(input.cells).toEqual({ "0|p → q": true });
    expect(input).not.toHaveProperty("correct");
  });

  it("asks large tables with the final column only and grades just that column", () => {
    const formula = "p & q & r & s & t & u & v & w & x & y";
    const cells: Record<string, boolean> = {};
    // Only the first row (all true) is true for a conjunction of ten propositions.
    for (let row = 0; row < 1024; row++) cells[`${row}|((((((((p ∧ q) ∧ r) ∧ s) ∧ t) ∧ u) ∧ v) ∧ w) ∧ x) ∧ y`] = row === 0;
    const events = [{ t: 0, action: "load" }, { t: 10, action: "mark", row: 1023, column: "x", value: false }];
    const input = parseTruthTableAttempt({ ...validBody(), formula, columns: "final", cells, events });
    expect(input.columns).toBe("final");
    expect(input.exerciseId).toMatch(/#final$/);
    expect(Object.keys(input.cells)).toHaveLength(1024);
    const attempt = prepareExerciseAttempt({ ...validBody(), formula, columns: "final", cells, events });
    expect(attempt).toMatchObject({ isCorrect: true, response: { columns: "final", total: 1024, right: 1024 } });
  });

  it.each([
    ["a non-object body", null, "exercises.payloadInvalid"],
    ["an unsupported type", { ...validBody(), type: "parsons" }, "exercises.typeInvalid"],
    ["an unknown source", { ...validBody(), source: "bank" }, "exercises.payloadInvalid"],
    ["a formula without operator", { ...validBody(), formula: "p" }, "exercises.formulaInvalid"],
    ["a formula with eleven propositions", { ...validBody(), formula: "p & q & r & s & t & u & v & w & x & y & z", columns: "final" }, "exercises.formulaInvalid"],
    ["a table too large to fill every column", { ...validBody(), formula: "p & q & r & s & t & u & v & w & x & y" }, "exercises.formulaInvalid"],
    ["an unknown column mode", { ...validBody(), columns: "some" }, "exercises.payloadInvalid"],
    ["an event row beyond the largest table", { ...validBody(), events: [{ t: 0, action: "mark", row: 1024 }] }, "exercises.eventsInvalid"],
    ["a malformed formula", { ...validBody(), formula: "(p &" }, "exercises.formulaInvalid"],
    ["cells sent as an array", { ...validBody(), cells: [] }, "exercises.cellsInvalid"],
    ["a cell value that is not boolean", { ...validBody(), cells: { "0|p → q": "V" } }, "exercises.cellsInvalid"],
    ["too many events", { ...validBody(), events: Array.from({ length: MAX_ATTEMPT_EVENTS + 1 }, () => ({ t: 0, action: "mark" })) }, "exercises.eventsInvalid"],
    ["an unknown event action", { ...validBody(), events: [{ t: 0, action: "script" }] }, "exercises.eventsInvalid"],
    ["a negative event time", { ...validBody(), events: [{ t: -1, action: "mark" }] }, "exercises.eventsInvalid"],
    ["hints out of range", { ...validBody(), hintsUsed: 999 }, "exercises.payloadInvalid"],
    ["a negative duration", { ...validBody(), durationMs: -5 }, "exercises.payloadInvalid"],
  ])("rejects %s", (_label, body, code) => {
    const error = errorOf(() => parseTruthTableAttempt(body));
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code, statusCode: 400 });
  });
});

describe("exercise attempts: recording", () => {
  function fakeDb(previousAttempts: number, profile: { classId: string } | null) {
    const inserted: Record<string, unknown>[] = [];
    let selectCall = 0;
    const db = {
      select: jest.fn(() => {
        selectCall++;
        const rows = selectCall === 1 ? (profile ? [profile] : []) : [{ total: previousAttempts }];
        const chain: Record<string, unknown> = {};
        chain.from = () => chain;
        chain.where = () => (selectCall === 1 ? chain : Promise.resolve(rows));
        chain.limit = () => Promise.resolve(rows);
        return chain;
      }),
      insert: jest.fn(() => ({
        values: (values: Record<string, unknown>) => {
          inserted.push(values);
          return { returning: () => Promise.resolve([{ id: "attempt-id" }]) };
        },
      })),
    };
    return { db, inserted };
  }

  it("grades on the server, numbers the attempt and stores the context", async () => {
    const { db, inserted } = fakeDb(2, { classId: "class-id" });
    const input = parseTruthTableAttempt(validBody());
    const response = await recordTruthTableAttempt(db as never, "student-id", input);

    expect(response).toMatchObject({
      attemptId: "attempt-id",
      attemptNumber: 3,
      correct: false,
      total: 12,
      right: 2,
      empty: 9,
      engineVersion: LOGIC_ENGINE_VERSION,
    });
    expect(response.wrong).toEqual([{ row: 3, column: "(p → q) ∧ ¬q", concept: "conjunction" }]);
    expect(Object.keys(response.marks)).toHaveLength(12);

    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      studentId: "student-id",
      classId: "class-id",
      mode: "practice",
      exerciseType: "truth_table",
      exerciseId: "truth_table:(p → q) ∧ ¬q",
      source: "catalog",
      subject: PRACTICE_SUBJECT,
      concepts: ["negation", "conjunction", "conditional"],
      attemptNumber: 3,
      isCorrect: false,
      submittedState: { formula: "(p → q) ∧ ¬q", cells: input.cells },
    });
    expect(inserted[0].result).not.toHaveProperty("marks");
  });

  it("starts at attempt 1 and tolerates a missing student profile", async () => {
    const { db, inserted } = fakeDb(0, null);
    const response = await recordTruthTableAttempt(db as never, "student-id", parseTruthTableAttempt(validBody()));
    expect(response.attemptNumber).toBe(1);
    expect(inserted[0].classId).toBeNull();
  });
});

describe("exercise attempts: route", () => {
  it("requires a session", async () => {
    await request(app).post("/exercises/attempts").send(validBody()).expect(401);
  });
});

describe("exercise attempts: translation", () => {
  const body = (answer: string, extra: Record<string, unknown> = {}) => ({ type: "translation", exerciseId: "tr-rain-street", answer, ...extra });

  it("accepts an equivalent formula and only then reveals the canonical one", () => {
    const attempt = prepareExerciseAttempt(body("~p | q"));
    expect(attempt).toMatchObject({
      exerciseType: "translation", exerciseId: "translation:tr-rain-street", exerciseVersion: 1, source: "catalog",
      subject: TRANSLATION_SUBJECT, concepts: ["conditional"], isCorrect: true, engineVersion: LOGIC_ENGINE_VERSION,
      submittedState: { answer: "~p | q" },
    });
    expect(attempt.response).toEqual({ concepts: ["conditional"], correct: true, normalizedAnswer: "¬p ∨ q", equivalentTo: "p → q" });
  });

  it("does not repeat the formula when the answer is written like the expected one", () => {
    expect(prepareExerciseAttempt(body("p -> q")).response).not.toHaveProperty("equivalentTo");
  });

  it("returns a counterexample without revealing the expected formula", () => {
    const attempt = prepareExerciseAttempt(body("q -> p"));
    expect(attempt.isCorrect).toBe(false);
    expect(attempt.response).toEqual({
      concepts: ["conditional"], correct: false, normalizedAnswer: "q → p",
      counterexample: { p: true, q: false }, answerValue: true, expectedValue: false,
    });
  });

  it.each([
    ["an unknown exercise", body("p", { exerciseId: "nope" }), "exercises.exerciseNotFound", 404],
    ["a syntax error", body("p ->"), "exercises.answerInvalid", 400],
    ["a proposition outside the legend", body("p -> r"), "exercises.answerInvalid", 400],
    ["a non-string answer", body("p", { answer: 3 }), "exercises.answerInvalid", 400],
    ["a custom source", body("p", { source: "custom" }), "exercises.payloadInvalid", 400],
  ])("rejects %s without recording", (_label, payload, code, statusCode) => {
    expect(errorOf(() => prepareExerciseAttempt(payload))).toMatchObject({ code, statusCode });
  });
});

describe("exercise attempts: parsons", () => {
  const solution = [["read", 0], ["if", 0], ["even", 1], ["else", 0], ["odd", 1], ["endif", 0]].map(([id, indent]) => ({ id, indent }));
  const body = (lines: unknown) => ({ type: "parsons", exerciseId: "pa-even-odd", solution: lines });

  it("grades a correct arrangement", () => {
    const attempt = prepareExerciseAttempt(body(solution));
    expect(attempt).toMatchObject({
      exerciseType: "parsons", exerciseId: "parsons:pa-even-odd", subject: ALGORITHM_SUBJECT,
      concepts: ["input_output", "selection"], isCorrect: true, engineVersion: PARSONS_ENGINE_VERSION,
    });
    expect(attempt.response).toMatchObject({ correct: true, misplaced: 0, wrongIndent: 0, distractors: 0, missing: 0 });
    expect(attempt.response).not.toHaveProperty("solutionIndex");
  });

  it("marks only the lines outside the longest common subsequence", () => {
    const attempt = prepareExerciseAttempt(body([{ id: "while", indent: 0 }, ...solution]));
    expect(attempt.response).toMatchObject({ correct: false, distractors: 1, misplaced: 0 });
    expect((attempt.response.marks as Record<string, string>).read).toBe("correct");
  });

  it.each([
    ["an unknown line", [{ id: "rm -rf", indent: 0 }]],
    ["a repeated line", [{ id: "read", indent: 0 }, { id: "read", indent: 0 }]],
    ["an indentation out of range", [{ id: "read", indent: 9 }]],
    ["a non-list solution", { read: 0 }],
  ])("rejects %s", (_label, lines) => {
    expect(errorOf(() => prepareExerciseAttempt(body(lines)))).toMatchObject({ code: "exercises.solutionInvalid", statusCode: 400 });
  });

  it("accepts the interaction log of drag and buttons", () => {
    const events = [{ t: 0, action: "load" }, { t: 900, action: "move", line: "read", from: "bank", to: "solution", position: 0, indent: 0, via: "drag" }];
    expect(prepareExerciseAttempt({ ...body(solution), events }).events).toEqual(events);
    expect(errorOf(() => prepareExerciseAttempt({ ...body(solution), events: [{ t: 0, action: "move", via: "mouse" }] }))).toMatchObject({ code: "exercises.eventsInvalid" });
  });

  it("stores the attempt with its type", async () => {
    const inserted: Record<string, unknown>[] = [];
    let call = 0;
    const db = {
      select: () => {
        call++;
        const chain: Record<string, unknown> = {};
        chain.from = () => chain;
        chain.where = () => (call === 1 ? chain : Promise.resolve([{ total: 0 }]));
        chain.limit = () => Promise.resolve([{ classId: "class-id" }]);
        return chain;
      },
      insert: () => ({ values: (values: Record<string, unknown>) => { inserted.push(values); return { returning: () => Promise.resolve([{ id: "attempt-id" }]) }; } }),
    };
    const response = await recordExerciseAttempt(db as never, "student-id", prepareExerciseAttempt(body(solution)));
    expect(response).toMatchObject({ attemptId: "attempt-id", attemptNumber: 1, exerciseId: "parsons:pa-even-odd", correct: true });
    expect(inserted[0]).toMatchObject({ exerciseType: "parsons", exerciseVersion: 1, classId: "class-id", isCorrect: true });
  });
});

describe("exercise attempts: dispatch", () => {
  it("rejects unknown types", () => {
    expect(errorOf(() => prepareExerciseAttempt({ type: "essay" }))).toMatchObject({ code: "exercises.typeInvalid", statusCode: 400 });
  });
});
