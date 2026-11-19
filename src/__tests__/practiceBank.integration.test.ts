import { randomUUID } from "crypto";
import { Pool } from "pg";
import { closeDatabasePool, getDb } from "../db/client";
import { createQuestion, updateQuestion, archiveQuestion } from "../services/questions/questionBankService";
import { listPracticeQuestions, prepareBankAttempt } from "../services/exercises/exerciseAttemptService";

const url = process.env.QUESTION_BANK_TEST_DATABASE_URL;
const integration = url ? describe : describe.skip;
type BankUser = Parameters<typeof createQuestion>[1];

integration("professor questions in the workbench", () => {
  let pool: Pool;
  const ids = { university: randomUUID(), course: randomUUID(), discipline: randomUUID(), other: randomUUID(), classA: randomUUID(), classB: randomUUID(), prof: randomUUID(), studentA: randomUUID(), studentB: randomUUID() };
  const prof = (): BankUser => ({ id: ids.prof, name: "P", email: "p@example.invalid", role: ["professor"], school: null, disciplines: [] });
  const base = { disciplineId: ids.discipline, weight: 1, subject: "operadores_logicos", concepts: [], language: "pt-BR" };
  const errorOf = async (run: () => Promise<unknown>) => { try { await run(); } catch (error) { return error; } return undefined; };
  const created: Record<string, string> = {};

  beforeAll(async () => {
    if (!url!.includes("_question_bank_test") || process.env.DATABASE_URL !== url)
      throw new Error("Both database URLs must point to the same isolated question bank test database");
    pool = new Pool({ connectionString: url });
    const q = (text: string, values: unknown[]) => pool.query(text, values);
    await q("INSERT INTO universities(id,name) VALUES($1,'U')", [ids.university]);
    await q("INSERT INTO courses(id,name,university_id) VALUES($1,'C',$2)", [ids.course, ids.university]);
    await q("INSERT INTO disciplines(id,name,course_id) VALUES($1,'Lógica',$3),($2,'Outra',$3)", [ids.discipline, ids.other, ids.course]);
    await q("INSERT INTO classes(id,name,course_id,registration_code) VALUES($1,'A',$3,$4),($2,'B',$3,$5)", [ids.classA, ids.classB, ids.course, `A-${ids.classA}`, `B-${ids.classB}`]);
    await q("INSERT INTO class_disciplines(class_id,discipline_id) VALUES($1,$2),($3,$4)", [ids.classA, ids.discipline, ids.classB, ids.other]);
    for (const account of [ids.prof, ids.studentA, ids.studentB])
      await q("INSERT INTO accounts(id,name,email) VALUES($1,'X',$2)", [account, `${account}@example.invalid`]);
    await q("INSERT INTO professor_disciplines(professor_id,discipline_id) VALUES($1,$2)", [ids.prof, ids.discipline]);
    await q("INSERT INTO student_profiles(account_id,school_id,course_id,class_id) VALUES($1,$3,$4,$5),($2,$3,$4,$6)", [ids.studentA, ids.studentB, ids.university, ids.course, ids.classA, ids.classB]);

    created.table = (await createQuestion(getDb(), prof(), { ...base, type: "truth_table", statement: "Monte a tabela.", content: { formula: "p -> q" }, practiceEnabled: true })).id;
    created.translation = (await createQuestion(getDb(), prof(), { ...base, type: "translation", statement: "Se chove, molha.", practiceEnabled: true,
      content: { legend: [{ letter: "c", text: "chove" }, { letter: "m", text: "molha" }], target: "c -> m" } })).id;
    created.parsons = (await createQuestion(getDb(), prof(), { ...base, type: "parsons", statement: "Ordene.", practiceEnabled: true, content: { solution: "a\n  b\nc", distractors: "d", alternatives: "" } })).id;
    created.hidden = (await createQuestion(getDb(), prof(), { ...base, type: "truth_table", statement: "Só para prova.", content: { formula: "p & q" } })).id;
    created.quiz = (await createQuestion(getDb(), prof(), { ...base, type: "quiz", statement: "?", content: { options: ["a", "b"], correct: 0 }, practiceEnabled: true })).id;
  });

  afterAll(async () => {
    await pool.query("DELETE FROM exercise_attempts WHERE student_id = ANY($1)", [[ids.studentA, ids.studentB]]).catch(() => undefined);
    await pool.query("DELETE FROM accounts WHERE id = ANY($1)", [[ids.prof, ids.studentA, ids.studentB]]);
    await pool.query("DELETE FROM universities WHERE id=$1", [ids.university]);
    await pool.end();
    await closeDatabasePool();
  });

  it("lists only practice questions of the student's class, without answer keys", async () => {
    const tables = await listPracticeQuestions(getDb(), ids.studentA, "truth_table");
    expect(tables.map((row) => row.id)).toEqual([created.table]);
    expect(tables[0].content).toEqual({ formula: "p → q" });
    const [translation] = await listPracticeQuestions(getDb(), ids.studentA, "translation");
    expect(translation.content).toEqual({ legend: [{ letter: "c", text: "chove" }, { letter: "m", text: "molha" }] });
    expect(JSON.stringify(translation)).not.toContain("→");
    const [parsons] = await listPracticeQuestions(getDb(), ids.studentA, "parsons");
    expect(Object.keys(parsons.content)).toEqual(["lines"]);
    expect(await listPracticeQuestions(getDb(), ids.studentB, "truth_table")).toEqual([]);
    expect(await errorOf(() => listPracticeQuestions(getDb(), ids.studentA, "quiz"))).toMatchObject({ statusCode: 400 });
  });

  it("never stores the flag on types the workbench cannot run", async () => {
    expect((await pool.query("SELECT practice_enabled FROM assessment_questions WHERE id=$1", [created.quiz])).rows[0].practice_enabled).toBe(false);
  });

  it("grades bank attempts with the stored answer key", async () => {
    const table = await prepareBankAttempt(getDb(), ids.studentA, { type: "truth_table", bankQuestionId: created.table, formula: "p | q", cells: {} });
    expect(table).toMatchObject({ exerciseId: `bank:${created.table}`, source: "bank", exerciseVersion: 1, subject: "operadores_logicos" });
    expect((table.submittedState as { formula: string }).formula).toBe("p → q");

    const right = await prepareBankAttempt(getDb(), ids.studentA, { type: "translation", bankQuestionId: created.translation, answer: "~c | m" });
    expect(right).toMatchObject({ isCorrect: true, response: { equivalentTo: "c → m" } });
    const wrong = await prepareBankAttempt(getDb(), ids.studentA, { type: "translation", bankQuestionId: created.translation, answer: "m -> c" });
    expect(wrong.isCorrect).toBe(false);
    expect(await errorOf(() => prepareBankAttempt(getDb(), ids.studentA, { type: "translation", bankQuestionId: created.translation, answer: "(" }))).toMatchObject({ statusCode: 400 });
  });

  it("refuses questions outside the class, hidden, archived or of another type", async () => {
    const denied = (studentId: string, body: Record<string, unknown>) => errorOf(() => prepareBankAttempt(getDb(), studentId, body));
    expect(await denied(ids.studentB, { type: "truth_table", bankQuestionId: created.table, cells: {} })).toMatchObject({ statusCode: 404 });
    expect(await denied(ids.studentA, { type: "truth_table", bankQuestionId: created.hidden, cells: {} })).toMatchObject({ statusCode: 404 });
    expect(await denied(ids.studentA, { type: "parsons", bankQuestionId: created.table, solution: [] })).toMatchObject({ statusCode: 400 });
    expect(await denied(ids.studentA, { type: "truth_table", bankQuestionId: "nope", cells: {} })).toMatchObject({ statusCode: 404 });
    await updateQuestion(getDb(), prof(), created.table, { ...base, statement: "Monte a tabela.", content: { formula: "p -> q" } });
    expect(await listPracticeQuestions(getDb(), ids.studentA, "truth_table")).toEqual([]);
    await archiveQuestion(getDb(), prof(), created.parsons);
    expect(await denied(ids.studentA, { type: "parsons", bankQuestionId: created.parsons, solution: [] })).toMatchObject({ statusCode: 404 });
  });
});
