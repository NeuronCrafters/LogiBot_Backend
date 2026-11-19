import { randomUUID } from "crypto";
import { Pool } from "pg";
import { closeDatabasePool, getDb } from "../db/client";
import { withLanguage } from "../i18n";
import { askOpenRouter } from "../services/ai/openRouterService";
import { hintStatus, requestHint } from "../services/exercises/hintService";

jest.mock("../services/ai/openRouterService", () => ({ askOpenRouter: jest.fn() }));
const model = askOpenRouter as jest.MockedFunction<typeof askOpenRouter>;
const url = process.env.HINTS_TEST_DATABASE_URL;
const integration = url ? describe : describe.skip;

integration("workbench hints on PostgreSQL", () => {
  let pool: Pool;
  const student = randomUUID(), other = randomUUID();
  const attempts: Record<string, string> = {};
  const errorOf = async (run: () => Promise<unknown>) => { try { await run(); } catch (error) { return error; } return undefined; };
  const insertAttempt = async (key: string, values: { mode?: string; correct?: boolean; exerciseId?: string; owner?: string }) => {
    attempts[key] = (await pool.query(
      `INSERT INTO exercise_attempts(student_id,mode,exercise_type,exercise_id,source,subject,concepts,attempt_number,is_correct,engine_version,submitted_state,result)
       VALUES($1,$2,'truth_table',$3,'catalog','propositional_logic','["conditional"]',1,$4,'1',$5,$6) RETURNING id`,
      [values.owner ?? student, values.mode ?? "practice", values.exerciseId ?? "tt-1", values.correct ?? false,
        JSON.stringify({ formula: "p → q", cells: {} }), JSON.stringify({ wrong: [{ row: 1, column: "p → q", concept: "conditional" }], empty: 0, total: 4 })],
    )).rows[0].id;
  };

  beforeAll(async () => {
    if (!url!.includes("_hints_test") || process.env.DATABASE_URL !== url)
      throw new Error("Both database URLs must point to the same isolated hints test database");
    pool = new Pool({ connectionString: url });
    for (const id of [student, other]) await pool.query("INSERT INTO accounts(id,name,email) VALUES($1,'Aluno',$2)", [id, `${id}@example.invalid`]);
    await insertAttempt("wrong", {});
    await insertAttempt("right", { correct: true, exerciseId: "tt-2" });
    await insertAttempt("exam", { mode: "exam", exerciseId: "tt-3" });
    await insertAttempt("someoneElse", { owner: other, exerciseId: "tt-4" });
  });

  afterAll(async () => {
    await pool.query("DELETE FROM accounts WHERE id = ANY($1)", [[student, other]]);
    await pool.end();
    await closeDatabasePool();
  });

  const ask = () => withLanguage("pt-BR", () => requestHint(getDb(), student, { attemptId: attempts.wrong }));

  it("gives up to three progressive hints and then stops", async () => {
    model.mockResolvedValueOnce({ text: "Pense no condicional: em que única situação ele é falso? Olhe com calma a linha em que o antecedente é verdadeiro.", provider: "openrouter" });
    expect(await ask()).toMatchObject({ level: 1, remaining: 2, text: expect.stringContaining("condicional") });

    // A text that fills the table is rejected and replaced by the built-in hint.
    model.mockResolvedValueOnce({ text: "A coluna correta é V F V V, basta copiar.", provider: "openrouter" });
    const second = await ask();
    expect(second).toMatchObject({ level: 2, remaining: 1 });
    expect(second.text).toBe("Confira a coluna p → q na linha 2: aplique a regra de condicional aos valores dessa linha.");

    // Model unavailable: built-in hint as well.
    model.mockResolvedValueOnce(null);
    expect(await ask()).toMatchObject({ level: 3, remaining: 0 });
    expect(await errorOf(ask)).toMatchObject({ statusCode: 409, code: "exercises.hintLimit" });

    const sources = (await pool.query("SELECT level, source FROM exercise_hints WHERE student_id=$1 ORDER BY level", [student])).rows;
    expect(sources).toEqual([{ level: 1, source: "ai" }, { level: 2, source: "fallback" }, { level: 3, source: "fallback" }]);
    expect((await hintStatus(getDb(), student, "tt-1")).remaining).toBe(0);
  });

  it("refuses hints during exams, for correct answers and for other people's attempts", async () => {
    const run = (attemptId: string) => errorOf(() => requestHint(getDb(), student, { attemptId }));
    expect(await run(attempts.exam)).toMatchObject({ statusCode: 403, code: "exercises.hintExam" });
    expect(await run(attempts.right)).toMatchObject({ statusCode: 409, code: "exercises.hintNotNeeded" });
    expect(await run(attempts.someoneElse)).toMatchObject({ statusCode: 404 });
    expect(await run("not-an-id")).toMatchObject({ statusCode: 400 });
  });
});
