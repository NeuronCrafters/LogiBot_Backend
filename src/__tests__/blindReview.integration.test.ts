import { randomUUID } from "crypto";
import { Pool } from "pg";
import { closeDatabasePool, getDb } from "../db/client";
import { closeExam, createExam, publishExam } from "../services/exams/examService";
import { getAttempt, listStudentExams, startExam, submitExam } from "../services/exams/examSubmissionService";
import { getBlindReview, getResults, releaseResults, saveReview } from "../services/exams/blindReviewService";
import { notifyExamResults } from "../services/notifications/notificationService";
import { createQuestion } from "../services/questions/questionBankService";

jest.mock("../services/email/mailService", () => ({ sendMail: jest.fn(async () => undefined) }));

const url = process.env.BLIND_REVIEW_TEST_DATABASE_URL;
const integration = url ? describe : describe.skip;
type StaffUser = Parameters<typeof createExam>[1];

integration("blind grading and release on PostgreSQL", () => {
  let pool: Pool;
  const ids = { university: randomUUID(), course: randomUUID(), klass: randomUUID(), discipline: randomUUID(), prof: randomUUID(), other: randomUUID(), s1: randomUUID(), s2: randomUUID(), s3: randomUUID() };
  const professor = (): StaffUser => ({ id: ids.prof, name: "P", email: "p@example.invalid", role: ["professor"], school: null, disciplines: [ids.discipline] });
  const stranger = (): StaffUser => ({ id: ids.other, name: "O", email: "o@example.invalid", role: ["professor"], school: null, disciplines: [] });
  const t0 = new Date("2030-05-01T12:00:00Z");
  const at = (minutes: number) => new Date(+t0 + minutes * 60000);
  const errorOf = async (run: () => Promise<unknown>) => { try { await run(); } catch (error) { return error; } return undefined; };
  let examId = "";

  beforeAll(async () => {
    if (!url!.includes("_blind_review_test") || process.env.DATABASE_URL !== url)
      throw new Error("Both database URLs must point to the same isolated blind review test database");
    pool = new Pool({ connectionString: url });
    const q = (text: string, values: unknown[]) => pool.query(text, values);
    await q("INSERT INTO universities(id,name) VALUES($1,'U')", [ids.university]);
    await q("INSERT INTO courses(id,name,university_id) VALUES($1,'C',$2)", [ids.course, ids.university]);
    await q("INSERT INTO classes(id,name,course_id,registration_code) VALUES($1,'A',$2,$3)", [ids.klass, ids.course, `A-${ids.klass}`]);
    await q("INSERT INTO disciplines(id,name,course_id) VALUES($1,'Lógica',$2)", [ids.discipline, ids.course]);
    await q("INSERT INTO class_disciplines(class_id,discipline_id) VALUES($1,$2)", [ids.klass, ids.discipline]);
    for (const [account, name] of [[ids.prof, "Prof"], [ids.other, "Outro"], [ids.s1, "Ana Souza"], [ids.s2, "Bruno Lima"], [ids.s3, "Carla Dias"]])
      await q("INSERT INTO accounts(id,name,email) VALUES($1,$2,$3)", [account, name, `${account}@example.invalid`]);
    await q("INSERT INTO professor_disciplines(professor_id,discipline_id) VALUES($1,$2)", [ids.prof, ids.discipline]);
    for (const student of [ids.s1, ids.s2, ids.s3])
      await q("INSERT INTO student_profiles(account_id,school_id,course_id,class_id) VALUES($1,$2,$3,$4)", [student, ids.university, ids.course, ids.klass]);
    const make = async (type: string, content: unknown, weight: number, statement: string) =>
      (await createQuestion(getDb(), professor(), { disciplineId: ids.discipline, type, statement, weight, subject: "operadores_logicos", concepts: ["condicional"], language: "pt-BR", content })).id;
    const questionIds = [
      await make("quiz", { options: ["V", "F"], correct: 1 }, 1, "Quanto vale p → q com p = V e q = F?"),
      await make("essay", { criteria: "Citar a tabela." }, 2, "Explique o condicional."),
      await make("essay", { criteria: "" }, 1, "Dê um exemplo."),
    ];
    examId = (await createExam(getDb(), professor(), { title: "Prova", disciplineId: ids.discipline, questionIds })).id;
    await publishExam(getDb(), professor(), examId, t0);
    for (const [student, choice, text1, text2] of [[ids.s1, 1, "Resposta completa de Ana", "Exemplo de Ana"], [ids.s2, 0, "Resposta curta", ""]] as const) {
      const attempt = await startExam(getDb(), student, examId, at(1));
      const byType = attempt.questions.map((question) => question.id);
      const [quiz, essay1, essay2] = [attempt.questions.find((q) => q.type === "quiz")!.id, ...attempt.questions.filter((q) => q.type === "essay").map((q) => q.id)];
      expect(byType).toHaveLength(3);
      await submitExam(getDb(), student, examId, { answers: { [quiz]: { choice }, [essay1]: { text: text1 }, [essay2]: { text: text2 } } }, at(10));
    }
  });

  afterAll(async () => {
    await pool.query("DELETE FROM accounts WHERE id = ANY($1)", [[ids.prof, ids.other, ids.s1, ids.s2, ids.s3]]);
    await pool.query("DELETE FROM universities WHERE id=$1", [ids.university]);
    await pool.end();
    await closeDatabasePool();
  });

  it("only opens grading once the exam is closed, and only to whoever manages it", async () => {
    expect(await errorOf(() => getBlindReview(getDb(), professor(), examId, at(20)))).toMatchObject({ code: "exams.reviewNotAvailable" });
    await closeExam(getDb(), professor(), examId, at(30));
    expect(await errorOf(() => getBlindReview(getDb(), stranger(), examId, at(31)))).toMatchObject({ statusCode: 403 });
  });

  it("lists essay answers anonymously, grouped by question, in a stable random order", async () => {
    const review = await getBlindReview(getDb(), professor(), examId, at(31));
    expect(review).toMatchObject({ reviewed: 0, total: 4, released: false });
    expect(review.questions.map((question) => [question.statement, question.criteria, question.items.length])).toEqual([
      ["Explique o condicional.", "Citar a tabela.", 2], ["Dê um exemplo.", "", 2],
    ]);
    const submissions = (await pool.query("SELECT id, started_at FROM exam_submissions WHERE exam_id=$1", [examId])).rows;
    const json = JSON.stringify(review);
    for (const secret of [ids.s1, ids.s2, "Ana Souza", "Bruno Lima", ...submissions.map((row) => row.id), "submittedAt", "startedAt", "objective", "studentId", "duration"])
      expect(json).not.toContain(secret);
    review.questions.forEach((question) => question.items.forEach((item) => expect(Object.keys(item).sort()).toEqual(["code", "comment", "id", "score", "text"])));
    const [first, second] = review.questions;
    expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(4);
    first.items.forEach((item) => expect(item.code).toMatch(/^[A-Z2-9]{5}$/));
    const again = await getBlindReview(getDb(), professor(), examId, at(32));
    expect(again.questions[0].items.map((item) => item.id)).toEqual(first.items.map((item) => item.id));
  });

  it("validates the rubric, audits each grade and refuses to release with pending answers", async () => {
    const review = await getBlindReview(getDb(), professor(), examId, at(33));
    const item = review.questions[0].items[0];
    expect(await errorOf(() => saveReview(getDb(), professor(), item.id, { score: 0.7 }))).toMatchObject({ code: "exams.reviewInvalid" });
    expect(await errorOf(() => saveReview(getDb(), stranger(), item.id, { score: 1 }))).toMatchObject({ statusCode: 403 });
    expect(await errorOf(() => releaseResults(getDb(), professor(), examId, at(34)))).toMatchObject({ code: "exams.reviewsPending", params: { pending: 4 } });
    const score = (text: string, scores: Record<string, number>) => scores[text];
    const scores: Record<string, number> = { "Resposta completa de Ana": 1, "Resposta curta": 0.5, "Exemplo de Ana": 0.5, "": 0 };
    for (const question of review.questions) {
      for (const answer of question.items) await saveReview(getDb(), professor(), answer.id, { score: score(answer.text, scores), comment: `  Comentário ${answer.code} ` }, at(35));
    }
    const audit = await pool.query("SELECT actor_id FROM exam_audit_log WHERE exam_id=$1 AND action='review'", [examId]);
    expect(audit.rows).toHaveLength(4);
    expect(audit.rows.every((row) => row.actor_id === ids.prof)).toBe(true);
  });

  it("releases grades, records exam attempts, notifies students and locks grading", async () => {
    const released = await releaseResults(getDb(), professor(), examId, at(40));
    expect(released.studentIds.sort()).toEqual([ids.s1, ids.s2].sort());
    const grades = (await pool.query("SELECT student_id, grade FROM exam_submissions WHERE exam_id=$1", [examId])).rows;
    expect(grades.find((row) => row.student_id === ids.s1).grade).toBe(8.75);
    expect(grades.find((row) => row.student_id === ids.s2).grade).toBe(2.5);
    const attempts = (await pool.query("SELECT exercise_type, mode, is_correct, concepts, source FROM exercise_attempts WHERE student_id=$1 ORDER BY exercise_type", [ids.s1])).rows;
    expect(attempts).toHaveLength(3);
    expect(attempts.every((row) => row.mode === "exam" && row.source === "bank" && row.concepts.includes("condicional"))).toBe(true);
    expect((await pool.query("SELECT action, actor_id FROM exam_audit_log WHERE exam_id=$1 AND action='release'", [examId])).rows).toEqual([{ action: "release", actor_id: ids.prof }]);

    await notifyExamResults(getDb(), examId, released.studentIds, "https://app.example");
    expect((await pool.query("SELECT recipient_id FROM notifications WHERE type='exam_results_released'")).rows.map((row) => row.recipient_id).sort()).toEqual([ids.s1, ids.s2].sort());

    const anyReview = (await getBlindReview(getDb(), professor(), examId, at(41))).questions[0].items[0];
    expect(await errorOf(() => saveReview(getDb(), professor(), anyReview.id, { score: 1 }))).toMatchObject({ code: "exams.reviewLocked" });
    expect(await errorOf(() => releaseResults(getDb(), professor(), examId, at(42)))).toMatchObject({ code: "exams.alreadyReleased" });
  });

  it("shows identified results to the professor and each student's own result", async () => {
    const results = await getResults(getDb(), professor(), examId);
    expect(results.rows.map((row) => [row.name, row.status, row.grade, row.objectiveCorrect, row.essayPoints])).toEqual([
      ["Ana Souza", "submitted", 8.75, 1, 1.5], ["Bruno Lima", "submitted", 2.5, 0, 0.5], ["Carla Dias", "missed", null, 0, 0],
    ]);
    expect(results.rows[0].durationMs).toBe(9 * 60000);

    const own = await getAttempt(getDb(), ids.s1, examId, at(50));
    expect(own).toMatchObject({ status: "released", grade: 8.75, totalWeight: 4 });
    const outcomes = (own as { questions: Array<{ type: string; outcome: string; points: number; comment: string }> }).questions;
    expect(outcomes.find((question) => question.type === "quiz")).toMatchObject({ outcome: "correct", points: 1, comment: "" });
    expect(outcomes.filter((question) => question.type === "essay").map((question) => question.comment.startsWith("Comentário "))).toEqual([true, true]);
    expect(JSON.stringify(own)).not.toContain("\"correct\":1");
    const bruno = (await getAttempt(getDb(), ids.s2, examId, at(50))) as { questions: Array<{ type: string; outcome: string }> };
    expect(bruno.questions.find((question) => question.type === "essay" && question.outcome === "blank")).toBeTruthy();
    expect((await listStudentExams(getDb(), ids.s1, at(50)))[0]).toMatchObject({ status: "released", grade: 8.75 });
  });
});
