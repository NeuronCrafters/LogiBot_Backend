import { gradeAnswer, isAnswered, sanitizeAnswer, shuffle, studentQuestionView, type QuestionSnapshot } from "../services/exams/examGrading";
import { checkQuestion } from "../services/logic/questionCore";

// Opaque ids, like the random ones the API generates (they must not reveal the line kind).
const ids = (kind: "line" | "distractor", index: number) => (kind === "line" ? `k${index + 1}` : `k${index + 9}`);
function snapshot(type: string, content: unknown, statement = "Enunciado"): QuestionSnapshot {
  const result = checkQuestion({ type, statement, weight: 1, subject: null, concepts: [], language: "pt-BR", content }, ids);
  if (result.ok === false) throw new Error(JSON.stringify(result.issues));
  const { content: normalized, language, subject, concepts } = result.question;
  return { statement, language, subject, concepts, content: normalized };
}

const quiz = snapshot("quiz", { options: ["3", "4"], correct: 1 });
const truth = snapshot("truth_table", { formula: "p -> q" });
const translation = snapshot("translation", { legend: [{ letter: "p", text: "chove" }, { letter: "q", text: "molha" }], target: "p -> q" });
const parsons = snapshot("parsons", { solution: "a\n  b", distractors: "z", alternatives: "" });
const essay = snapshot("essay", { criteria: "SEGREDO DO CRITÉRIO" });

describe("exam questions as students see them", () => {
  it.each([
    ["quiz", quiz, ["correct"]],
    ["truth table", truth, []],
    ["translation", translation, ["target", "p → q"]],
    ["parsons", parsons, ["solutions", "distractor"]],
    ["essay", essay, ["criteria", "SEGREDO"]],
  ])("never include the answer of a %s question", (_label, item, secrets) => {
    const view = JSON.stringify(studentQuestionView(item as QuestionSnapshot, "eq-1", 2));
    (secrets as string[]).forEach((secret) => expect(view).not.toContain(secret));
    expect(view).toContain("Enunciado");
  });

  it("shows Parsons lines in the order fixed for the student, including distractors unmarked", () => {
    const view = studentQuestionView(parsons, "eq-1", 1, ["k9", "k2", "k1"]);
    expect(view.content).toEqual({ lines: [{ id: "k9", text: "z" }, { id: "k2", text: "b" }, { id: "k1", text: "a" }] });
  });

  it("shuffles without losing or duplicating items", () => {
    const items = Array.from({ length: 50 }, (_, index) => index);
    const shuffled = shuffle(items);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
  });
});

describe("exam answers", () => {
  it("keep only well-formed answers", () => {
    expect(sanitizeAnswer(quiz.content, { choice: 1 })).toEqual({ choice: 1 });
    expect(sanitizeAnswer(quiz.content, { choice: 7 })).toBeNull();
    expect(sanitizeAnswer(truth.content, { cells: { "0|p → q": true, "9|x": false, "1|p → q": "V" } })).toEqual({ cells: { "0|p → q": true } });
    expect(sanitizeAnswer(translation.content, { text: "x".repeat(201) })).toBeNull();
    expect(sanitizeAnswer(parsons.content, { solution: [{ id: "intruso", indent: 0 }] })).toBeNull();
    expect(sanitizeAnswer(essay.content, { text: "Minha resposta" })).toEqual({ text: "Minha resposta" });
    expect(sanitizeAnswer(essay.content, "texto solto")).toBeNull();
  });

  it("know when a question was left blank", () => {
    expect(isAnswered({ choice: null })).toBe(false);
    expect(isAnswered({ cells: {} })).toBe(false);
    expect(isAnswered({ text: "  " })).toBe(false);
    expect(isAnswered({ solution: [{ id: "a", indent: 0 }] })).toBe(true);
  });

  it("grade every objective type on the server and leave essays to the professor", () => {
    expect(gradeAnswer(quiz.content, { choice: 1 })).toMatchObject({ correct: true });
    expect(gradeAnswer(quiz.content, null)).toMatchObject({ correct: false });
    expect(gradeAnswer(truth.content, { cells: { "0|p → q": true, "1|p → q": false, "2|p → q": true, "3|p → q": true } })).toMatchObject({ correct: true });
    expect(gradeAnswer(translation.content, { text: "~p | q" })).toMatchObject({ correct: true });
    expect(gradeAnswer(translation.content, { text: "p ->" })).toMatchObject({ correct: false, details: { status: "invalid" } });
    expect(gradeAnswer(parsons.content, { solution: [{ id: "k1", indent: 0 }, { id: "k2", indent: 1 }] })).toMatchObject({ correct: true });
    expect(gradeAnswer(parsons.content, null)).toMatchObject({ correct: false, details: { missing: 2 } });
    expect(gradeAnswer(essay.content, { text: "x" })).toBeNull();
  });
});
