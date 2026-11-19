import { randomUUID } from "crypto";
import { Pool } from "pg";
import { closeDatabasePool, getDb } from "../db/client";
import { ExamValidationError, closeExam, createExam, getManagedExam, listManagedExams, publishExam, updateExam } from "../services/exams/examService";
import { getAttempt, listStudentExams, saveDraft, startExam, submitExam } from "../services/exams/examSubmissionService";
import { notifyExamPublished } from "../services/notifications/notificationService";
import { createQuestion, updateQuestion } from "../services/questions/questionBankService";

jest.mock("../services/email/mailService", () => ({ sendMail: jest.fn(async () => undefined) }));

const url = process.env.EXAMS_TEST_DATABASE_URL;
const integration = url ? describe : describe.skip;
type StaffUser = Parameters<typeof createExam>[1];

integration("exams on PostgreSQL", () => {
  let pool: Pool;
  const ids = { university: randomUUID(), course: randomUUID(), classA: randomUUID(), classB: randomUUID(), discipline: randomUUID(), other: randomUUID(), prof: randomUUID(), s1: randomUUID(), s2: randomUUID(), s3: randomUUID() };
  const professor = (): StaffUser => ({ id: ids.prof, name: "P", email: "p@example.invalid", role: ["professor"], school: null, disciplines: [ids.discipline] });
  const questions: Record<string, string> = {};
  const t0 = new Date("2030-03-01T12:00:00Z");
  const at = (minutes: number) => new Date(+t0 + minutes * 60000);
  const errorOf = async (run: () => Promise<unknown>) => { try { await run(); } catch (error) { return error; } return undefined; };
  const base = (extra: Record<string, unknown> = {}) => ({ title: "Prova 1", disciplineId: ids.discipline, questionIds: Object.values(questions), ...extra });

  beforeAll(async () => {
    if (!url!.includes("_exams_test") || process.env.DATABASE_URL !== url)
      throw new Error("Both database URLs must point to the same isolated exams test database");
    pool = new Pool({ connectionString: url });
    const q = (text: string, values: unknown[]) => pool.query(text, values);
    await q("INSERT INTO universities(id,name) VALUES($1,'U')", [ids.university]);
    await q("INSERT INTO courses(id,name,university_id) VALUES($1,'C',$2)", [ids.course, ids.university]);
    await q("INSERT INTO classes(id,name,course_id,registration_code) VALUES($1,'A',$3,$4),($2,'B',$3,$5)", [ids.classA, ids.classB, ids.course, `A-${ids.classA}`, `B-${ids.classB}`]);
    await q("INSERT INTO disciplines(id,name,course_id) VALUES($1,'Lógica',$3),($2,'Outra',$3)", [ids.discipline, ids.other, ids.course]);
    await q("INSERT INTO class_disciplines(class_id,discipline_id) VALUES($1,$2)", [ids.classA, ids.discipline]);
    for (const [account, name] of [[ids.prof, "Prof"], [ids.s1, "Ana"], [ids.s2, "Bia"], [ids.s3, "Caio"]])
      await q("INSERT INTO accounts(id,name,email) VALUES($1,$2,$3)", [account, name, `${account}@example.invalid`]);
    await q("INSERT INTO professor_disciplines(professor_id,discipline_id) VALUES($1,$2)", [ids.prof, ids.discipline]);
    for (const [student, klass] of [[ids.s1, ids.classA], [ids.s2, ids.classA], [ids.s3, ids.classB]])
      await q("INSERT INTO student_profiles(account_id,school_id,course_id,class_id) VALUES($1,$2,$3,$4)", [student, ids.university, ids.course, klass]);
    const make = async (type: string, content: unknown, statement = `Questão ${type}`) =>
      (await createQuestion(getDb(), professor(), { disciplineId: ids.discipline, type, statement, weight: 1, subject: null, concepts: [], language: "pt-BR", content })).id;
    questions.quiz = await make("quiz", { options: ["3", "4"], correct: 1 });
    questions.truth = await make("truth_table", { formula: "p -> q" });
    questions.translation = await make("translation", { legend: [{ letter: "p", text: "chove" }, { letter: "q", text: "molha" }], target: "p -> q" });
    questions.parsons = await make("parsons", { solution: "a\n  b", distractors: "z", alternatives: "" });
    questions.essay = await make("essay", { criteria: "critério secreto" });
  });

  afterAll(async () => {
    await pool.query("DELETE FROM accounts WHERE id = ANY($1)", [[ids.prof, ids.s1, ids.s2, ids.s3]]);
    await pool.query("DELETE FROM universities WHERE id=$1", [ids.university]);
    await pool.end();
    await closeDatabasePool();
  });

  it("validates the exam form field by field", async () => {
    const error = await errorOf(() => createExam(getDb(), professor(), { title: "", disciplineId: ids.discipline, questionIds: [], opensAt: "2030-03-02T00:00:00Z", closesAt: "2030-03-01T00:00:00Z", timeLimitMinutes: 0, classId: ids.classB }));
    expect(error).toBeInstanceOf(ExamValidationError);
    expect((error as ExamValidationError).issues.map((issue) => `${issue.field}:${issue.code}`)).toEqual([
      "title:REQUIRED", "closesAt:WINDOW_INVALID", "timeLimitMinutes:TIME_LIMIT_RANGE", "questionIds:QUESTIONS_REQUIRED", "classId:CLASS_OUTSIDE_DISCIPLINE",
    ]);
    const foreign = await errorOf(() => createExam(getDb(), professor(), base({ questionIds: [randomUUID()] })));
    expect((foreign as ExamValidationError).issues).toEqual([{ field: "questionIds", code: "QUESTION_UNAVAILABLE", params: { position: 1 } }]);
  });

  let examId = "";
  it("publishes a frozen copy of the questions and notifies the class", async () => {
    const draft = await createExam(getDb(), professor(), base({ shuffle: true }));
    examId = draft.id;
    expect(draft).toMatchObject({ state: "draft", questions: expect.any(Array), audience: 2 });
    const published = await publishExam(getDb(), professor(), examId, t0);
    expect(published.state).toBe("open");
    expect(await errorOf(() => updateExam(getDb(), professor(), examId, base()))).toMatchObject({ statusCode: 409 });

    await updateQuestion(getDb(), professor(), questions.quiz, { disciplineId: ids.discipline, type: "quiz", statement: "Mudou depois", weight: 1, subject: null, concepts: [], language: "pt-BR", content: { options: ["x", "y"], correct: 0 } });
    expect((await getManagedExam(getDb(), professor(), examId)).questions.map((question) => question.statement)).toContain("Questão quiz");

    await notifyExamPublished(getDb(), examId, "https://app.example");
    const notified = await pool.query("SELECT recipient_id FROM notifications WHERE type='exam_published' AND group_key=$1", [`exam_published:${examId}`]);
    expect(notified.rows.map((row) => row.recipient_id).sort()).toEqual([ids.s1, ids.s2].sort());
  });

  it("is visible only to the class and never sends answers to the student", async () => {
    expect(await listStudentExams(getDb(), ids.s3, at(1))).toEqual([]);
    expect(await errorOf(() => startExam(getDb(), ids.s3, examId, at(1)))).toMatchObject({ statusCode: 404 });
    expect((await listStudentExams(getDb(), ids.s1, at(1)))[0]).toMatchObject({ id: examId, status: "available", questionCount: 5 });

    const attempt = await startExam(getDb(), ids.s1, examId, at(1));
    const json = JSON.stringify(attempt);
    ["\"correct\"", "target", "solutions", "distractor", "critério secreto"].forEach((secret) => expect(json).not.toContain(secret));
    const again = await startExam(getDb(), ids.s1, examId, at(2));
    expect(again.questions.map((question) => question.id)).toEqual(attempt.questions.map((question) => question.id));
    expect(again.startedAt).toEqual(attempt.startedAt);
  });

  it("saves drafts, submits once and grades on the server", async () => {
    const attempt = await startExam(getDb(), ids.s1, examId, at(3));
    const byType = (type: string) => attempt.questions.find((question) => question.type === type)!;
    const parsons = byType("parsons");
    const lines = (parsons.content as { lines: Array<{ id: string; text: string }> }).lines;
    const lineId = (text: string) => lines.find((line) => line.text === text)!.id;
    const answers = {
      [byType("quiz").id]: { choice: 1 },
      [byType("truth_table").id]: { cells: { "0|p → q": true, "1|p → q": false, "2|p → q": true, "3|p → q": false } },
      [byType("translation").id]: { text: "~p | q" },
      [parsons.id]: { solution: [{ id: lineId("a"), indent: 0 }, { id: lineId("b"), indent: 1 }] },
      [byType("essay").id]: { text: "Minha explicação." },
      intruder: { choice: 0 },
    };
    await saveDraft(getDb(), ids.s1, examId, { answers, events: { [byType("quiz").id]: [{ t: 10, action: "choose" }, { t: 5, action: "<script>" }] } }, at(4));
    const reloaded = await getAttempt(getDb(), ids.s1, examId, at(5));
    expect(reloaded).toMatchObject({ status: "in_progress", answers: { [byType("quiz").id]: { choice: 1 } } });
    expect((reloaded as { answers: Record<string, unknown> }).answers).not.toHaveProperty("intruder");

    expect(await submitExam(getDb(), ids.s1, examId, { answers }, at(6))).toMatchObject({ status: "submitted", submitReason: "student" });
    expect(await errorOf(() => submitExam(getDb(), ids.s1, examId, { answers }, at(7)))).toMatchObject({ statusCode: 409 });
    const row = (await pool.query("SELECT objective_results, events FROM exam_submissions WHERE exam_id=$1 AND student_id=$2", [examId, ids.s1])).rows[0];
    const results = row.objective_results as Record<string, { correct: boolean }>;
    const correct: Record<string, boolean> = {};
    Object.keys(results).forEach((id) => { correct[attempt.questions.find((q) => q.id === id)!.type] = results[id].correct; });
    expect(correct).toEqual({ quiz: true, truth_table: false, translation: true, parsons: true });
    expect(row.events[byType("quiz").id]).toEqual([{ t: 10, action: "choose" }]);
    expect((await listStudentExams(getDb(), ids.s1, at(8)))[0]).toMatchObject({ status: "submitted" });
    expect(JSON.stringify(await listStudentExams(getDb(), ids.s1, at(8)))).not.toContain("objective");
    expect((await listManagedExams(getDb(), professor(), at(8)))[0]).toMatchObject({ submitted: 1, inProgress: 0 });
    const progress = await pool.query("SELECT params FROM notifications WHERE recipient_id=$1 AND type='exam_submission_progress'", [ids.prof]);
    expect(progress.rows[0].params).toMatchObject({ submitted: 1, total: 2, lastStudentName: "Ana" });
  });

  it("submits what was saved when the time limit ends", async () => {
    const timed = await createExam(getDb(), professor(), base({ title: "Com tempo", questionIds: [questions.quiz], timeLimitMinutes: 30 }));
    await publishExam(getDb(), professor(), timed.id, t0);
    const attempt = await startExam(getDb(), ids.s2, timed.id, at(0));
    expect(+new Date(attempt.deadlineAt!)).toBe(+at(30));
    // Published after the bank edit above, so it froze version 2 of the quiz question (correct option: 0).
    await saveDraft(getDb(), ids.s2, timed.id, { answers: { [attempt.questions[0].id]: { choice: 0 } } }, at(10));
    expect(await errorOf(() => saveDraft(getDb(), ids.s2, timed.id, { answers: {} }, at(31)))).toMatchObject({ code: "exams.timeUp" });
    const row = (await pool.query("SELECT status, submit_reason, objective_results FROM exam_submissions WHERE exam_id=$1 AND student_id=$2", [timed.id, ids.s2])).rows[0];
    expect(row).toMatchObject({ status: "submitted", submit_reason: "time_limit" });
    const [only] = Object.keys(row.objective_results).map((key) => row.objective_results[key]);
    expect(only).toMatchObject({ correct: true });
  });

  it("closes by date or by the professor, sending open attempts and marking missed ones", async () => {
    const dated = await createExam(getDb(), professor(), base({ title: "Com data", questionIds: [questions.quiz], closesAt: at(60).toISOString() }));
    await publishExam(getDb(), professor(), dated.id, t0);
    await startExam(getDb(), ids.s1, dated.id, at(10));
    const list = await listStudentExams(getDb(), ids.s1, at(61));
    expect(list.find((item) => item.id === dated.id)).toMatchObject({ status: "submitted" });
    expect((await listStudentExams(getDb(), ids.s2, at(61))).find((item) => item.id === dated.id)).toMatchObject({ status: "missed" });
    expect((await pool.query("SELECT submit_reason FROM exam_submissions WHERE exam_id=$1", [dated.id])).rows[0].submit_reason).toBe("exam_closed");

    const manual = await createExam(getDb(), professor(), base({ title: "Manual", questionIds: [questions.quiz] }));
    await publishExam(getDb(), professor(), manual.id, t0);
    await startExam(getDb(), ids.s2, manual.id, at(1));
    expect((await closeExam(getDb(), professor(), manual.id, at(2))).state).toBe("closed");
    expect((await pool.query("SELECT status, submit_reason FROM exam_submissions WHERE exam_id=$1", [manual.id])).rows[0]).toMatchObject({ status: "submitted", submit_reason: "exam_closed" });
    expect(await errorOf(() => startExam(getDb(), ids.s1, manual.id, at(3)))).toMatchObject({ code: "exams.closed" });
  });

  it("keeps scheduled exams closed until they open", async () => {
    const later = await createExam(getDb(), professor(), base({ title: "Depois", questionIds: [questions.quiz], opensAt: at(120).toISOString() }));
    await publishExam(getDb(), professor(), later.id, t0);
    expect((await listStudentExams(getDb(), ids.s1, at(5))).find((item) => item.id === later.id)).toMatchObject({ status: "upcoming" });
    expect(await errorOf(() => startExam(getDb(), ids.s1, later.id, at(5)))).toMatchObject({ code: "exams.notOpenYet" });
    expect(await startExam(getDb(), ids.s1, later.id, at(121))).toMatchObject({ status: "in_progress" });
  });
});
