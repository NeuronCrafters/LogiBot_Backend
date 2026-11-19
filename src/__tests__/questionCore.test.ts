import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import { checkQuestion, parsonsEditorSource, type QuestionInput } from "../services/logic/questionCore";

// Same cases as LogiBot_Frontend/src/shared/logic/__tests__/questionCore.test.ts.
interface Fixtures {
  questionCoreSha256: string;
  questions: Array<{ name: string; input: QuestionInput; question?: unknown; issues?: unknown[] }>;
  parsonsEditorRoundTrip: { content: Parameters<typeof parsonsEditorSource>[0]; expected: unknown };
}
const logicDir = join(__dirname, "../services/logic");
const fixtures: Fixtures = JSON.parse(readFileSync(join(logicDir, "exercises.fixtures.json"), "utf8"));
const coreSource = readFileSync(join(logicDir, "questionCore.ts"), "utf8");
const deterministicIds = (kind: "line" | "distractor", index: number) => `${kind}-${index}`;

describe("questionCore", () => {
  it("matches the hash recorded in the shared fixtures", () => {
    expect(createHash("sha256").update(coreSource.replace(/\r\n/g, "\n"), "utf8").digest("hex")).toBe(fixtures.questionCoreSha256);
  });

  it.each(fixtures.questions)("$name", ({ input, question, issues }) => {
    const result = checkQuestion(input, deterministicIds);
    expect(result).toEqual(question ? { ok: true, question } : { ok: false, issues });
  });

  it("rebuilds the editor text of a stored Parsons question", () => {
    expect(parsonsEditorSource(fixtures.parsonsEditorRoundTrip.content)).toEqual(fixtures.parsonsEditorRoundTrip.expected);
  });

  it("round-trips the editor text through validation", () => {
    const source = parsonsEditorSource(fixtures.parsonsEditorRoundTrip.content);
    const again = checkQuestion({ type: "parsons", statement: "x", weight: 1, subject: null, concepts: [], language: "pt-BR", content: source }, deterministicIds);
    expect(again.ok && again.question.content).toEqual(fixtures.parsonsEditorRoundTrip.content);
  });
});
