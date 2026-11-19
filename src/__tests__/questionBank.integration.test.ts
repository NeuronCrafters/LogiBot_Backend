import { randomUUID } from "crypto";
import { Pool } from "pg";
import { closeDatabasePool, getDb } from "../db/client";
import { AppError } from "../exceptions/AppError";
import {
  QuestionValidationError,
  archiveQuestion,
  createQuestion,
  importQuizQuestions,
  listQuestions,
  updateQuestion,
} from "../services/questions/questionBankService";

const url = process.env.QUESTION_BANK_TEST_DATABASE_URL;
const integration = url ? describe : describe.skip;
type BankUser = Parameters<typeof listQuestions>[1];

integration("question bank on PostgreSQL", () => {
  let pool: Pool;
  const ids = { university: randomUUID(), course: randomUUID(), discipline: randomUUID(), other: randomUUID(), profA: randomUUID(), profB: randomUUID(), coord: randomUUID(), quiz: randomUUID() };
  const user = (id: string, role: string[], disciplines: string[] = []): BankUser => ({ id, name: "x", email: "x@example.invalid", role, school: null, disciplines });
  const profA = () => user(ids.profA, ["professor"]);
  const profB = () => user(ids.profB, ["professor"]);
  const coordinator = () => user(ids.coord, ["professor", "course-coordinator"], [ids.discipline]);
  const quizBody = (extra: Record<string, unknown> = {}) => ({
    disciplineId: ids.discipline, type: "quiz", statement: "Quanto é 2 + 2?", weight: 1, subject: "operadores_logicos",
    concepts: ["aritmética"], language: "pt-BR", content: { options: ["3", "4"], correct: 1 }, ...extra,
  });
  const errorOf = async (run: () => Promise<unknown>) => { try { await run(); } catch (error) { return error; } return undefined; };

  beforeAll(async () => {
    if (!url!.includes("_question_bank_test") || process.env.DATABASE_URL !== url)
      throw new Error("Both database URLs must point to the same isolated question bank test database");
    pool = new Pool({ connectionString: url });
    const q = (text: string, values: unknown[]) => pool.query(text, values);
    await q("INSERT INTO universities(id,name) VALUES($1,'U')", [ids.university]);
    await q("INSERT INTO courses(id,name,university_id) VALUES($1,'C',$2)", [ids.course, ids.university]);
    await q("INSERT INTO disciplines(id,name,course_id) VALUES($1,'Lógica',$3),($2,'Outra',$3)", [ids.discipline, ids.other, ids.course]);
    for (const account of [ids.profA, ids.profB, ids.coord])
      await q("INSERT INTO accounts(id,name,email) VALUES($1,'P',$2)", [account, `${account}@example.invalid`]);
    await q("INSERT INTO professor_disciplines(professor_id,discipline_id) VALUES($1,$3),($2,$3)", [ids.profA, ids.profB, ids.discipline]);
    await q("INSERT INTO professor_quizzes(id,professor_id,discipline_id,title,topic,status,language) VALUES($1,$2,$3,'Quiz','condicionais','published','es-ES')", [ids.quiz, ids.profA, ids.discipline]);
    await q(`INSERT INTO professor_quiz_questions(quiz_id,question,options,correct_option,order_index) VALUES
      ($1,'¿Uno?','["a","b","c","d"]','C',0),($1,'¿Dos?','["x","y"]','a',1),($1,'Rota','["só uma"]','A',2)`, [ids.quiz]);
  });

  afterAll(async () => {
    await pool.query("DELETE FROM accounts WHERE id = ANY($1)", [[ids.profA, ids.profB, ids.coord]]);
    await pool.query("DELETE FROM universities WHERE id=$1", [ids.university]);
    await pool.end();
    await closeDatabasePool();
  });

  it("creates a normalized question for a discipline the professor teaches", async () => {
    const created = await createQuestion(getDb(), profA(), quizBody());
    expect(created).toMatchObject({ ownerId: ids.profA, disciplineName: "Lógica", type: "quiz", version: 1, concepts: ["aritmética"], content: { type: "quiz", options: ["3", "4"], correct: 1 } });
  });

  it("returns per-field issues and refuses other disciplines", async () => {
    const invalid = await errorOf(() => createQuestion(getDb(), profA(), quizBody({ statement: "", content: { options: ["a"], correct: 3 } })));
    expect(invalid).toBeInstanceOf(QuestionValidationError);
    expect((invalid as QuestionValidationError).issues.map((issue) => issue.field)).toEqual(["statement", "content.options", "content.correct"]);
    const denied = await errorOf(() => createQuestion(getDb(), profA(), quizBody({ disciplineId: ids.other })));
    expect(denied).toBeInstanceOf(AppError);
    expect(denied).toMatchObject({ statusCode: 403 });
  });

  it("stores Parsons lines with random ids", async () => {
    const created = await createQuestion(getDb(), profA(), quizBody({ type: "parsons", content: { solution: "a\n  b\nc", distractors: "d", alternatives: "" } }));
    const content = created.content as { lines: Array<{ id: string }>; solutions: Array<Array<[string, number]>> };
    expect(content.lines.every((line) => /^ln[0-9a-f]{10}$/.test(line.id))).toBe(true);
    expect(content.solutions[0].map((step) => step[1])).toEqual([0, 1, 0]);
  });

  it("scopes the list: own questions for professors, the discipline for coordinators", async () => {
    await createQuestion(getDb(), profB(), quizBody({ statement: "Questão do professor B" }));
    const forA = await listQuestions(getDb(), profA(), {});
    expect(forA.every((row) => row.ownerId === ids.profA)).toBe(true);
    expect(forA).toHaveLength(2);
    expect(await listQuestions(getDb(), coordinator(), {})).toHaveLength(3);
    expect(await listQuestions(getDb(), profA(), { type: "parsons" })).toHaveLength(1);
    expect(await listQuestions(getDb(), profA(), { type: "nope" })).toEqual([]);
  });

  it("versions edits, keeps the type and hides archived questions", async () => {
    const [question] = await listQuestions(getDb(), profA(), { type: "quiz" });
    const edited = await updateQuestion(getDb(), profA(), question.id, quizBody({ statement: "Quanto é 3 + 3?", content: { options: ["6", "9"], correct: 0 } }));
    expect(edited).toMatchObject({ version: 2, statement: "Quanto é 3 + 3?" });
    expect(await errorOf(() => updateQuestion(getDb(), profA(), question.id, quizBody({ type: "essay" })))).toMatchObject({ code: "questions.typeLocked" });
    expect(await errorOf(() => updateQuestion(getDb(), profB(), question.id, quizBody()))).toMatchObject({ statusCode: 403 });
    await archiveQuestion(getDb(), profA(), question.id);
    expect((await listQuestions(getDb(), profA(), { type: "quiz" }))).toHaveLength(0);
    expect((await pool.query("SELECT archived_at FROM assessment_questions WHERE id=$1", [question.id])).rows[0].archived_at).not.toBeNull();
  });

  it("imports quiz questions once, converting the answer letter", async () => {
    expect(await importQuizQuestions(getDb(), profA(), ids.quiz)).toEqual({ imported: 2, skipped: 0, invalid: 1 });
    const imported = await listQuestions(getDb(), profA(), { type: "quiz" });
    const first = imported.find((row) => row.statement === "¿Uno?")!;
    expect(first).toMatchObject({ language: "es-ES", subject: "condicionais", content: { options: ["a", "b", "c", "d"], correct: 2 } });
    expect(imported.find((row) => row.statement === "¿Dos?")!.content).toMatchObject({ correct: 0 });
    expect(await importQuizQuestions(getDb(), profA(), ids.quiz)).toEqual({ imported: 0, skipped: 2, invalid: 1 });
    expect(await errorOf(() => importQuizQuestions(getDb(), profB(), ids.quiz))).toMatchObject({ statusCode: 403 });
  });
});
