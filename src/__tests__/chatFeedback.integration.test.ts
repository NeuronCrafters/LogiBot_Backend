import { randomUUID } from "crypto";
import { Pool } from "pg";
import { closeDatabasePool, getDb } from "../db/client";
import { feedbackSummary, listNotUseful, listSessionFeedback, saveFeedback } from "../services/chat/chatFeedbackService";

const url = process.env.CHAT_FEEDBACK_TEST_DATABASE_URL;
const integration = url ? describe : describe.skip;

integration("chat answer feedback on PostgreSQL", () => {
  let pool: Pool;
  const owner = randomUUID();
  const other = randomUUID();
  const students = Array.from({ length: 5 }, () => randomUUID());
  const ids: Record<string, string> = {};
  const uni = randomUUID(), course = randomUUID(), klass = randomUUID();
  const errorOf = async (run: () => Promise<unknown>) => { try { await run(); } catch (error) { return error; } return undefined; };

  beforeAll(async () => {
    if (!url!.includes("_chat_feedback_test") || process.env.DATABASE_URL !== url)
      throw new Error("Both database URLs must point to the same isolated chat feedback test database");
    pool = new Pool({ connectionString: url });
    const q = (text: string, values: unknown[]) => pool.query(text, values);
    for (const account of [owner, other, ...students]) {
      await q("INSERT INTO accounts(id,name,email) VALUES($1,'Pessoa',$2)", [account, `${account}@example.invalid`]);
      await q("INSERT INTO account_roles(account_id,role) VALUES($1,'student')", [account]);
    }
    await q("INSERT INTO account_roles(account_id,role) VALUES($1,'professor')", [owner]);
    const session = (await q("INSERT INTO chat_sessions(user_id,session_id) VALUES($1,'s1') RETURNING id", [owner])).rows[0].id;
    ids.question = (await q("INSERT INTO chat_messages(chat_session_id,role,content,timestamp) VALUES($1,'user','O que é p → q?',now() - interval '1 minute') RETURNING id", [session])).rows[0].id;
    ids.answer = (await q("INSERT INTO chat_messages(chat_session_id,role,content,detected_topic,metadata) VALUES($1,'assistant','É o condicional.','condicionais','{\"outputLanguage\":\"pt-BR\"}') RETURNING id", [session])).rows[0].id;
    ids.old = (await q("INSERT INTO chat_messages(chat_session_id,role,content,metadata) VALUES($1,'assistant','Antiga','{\"superseded\":\"true\"}') RETURNING id", [session])).rows[0].id;
    await q("INSERT INTO universities(id,name) VALUES($1,'U')", [uni]);
    await q("INSERT INTO courses(id,name,university_id) VALUES($1,'Computação',$2)", [course, uni]);
    await q("INSERT INTO classes(id,name,course_id,registration_code) VALUES($1,'A',$2,$3)", [klass, course, `A-${klass}`]);
    for (const student of students.slice(0, 2))
      await q("INSERT INTO student_profiles(account_id,school_id,course_id,class_id) VALUES($1,$2,$3,$4)", [student, uni, course, klass]);
    for (const student of students) {
      const own = (await q("INSERT INTO chat_sessions(user_id,session_id) VALUES($1,'s') RETURNING id", [student])).rows[0].id;
      await q("INSERT INTO chat_messages(chat_session_id,role,content) VALUES($1,'user','Pergunta')", [own]);
      ids[student] = (await q("INSERT INTO chat_messages(chat_session_id,role,content,detected_topic) VALUES($1,'assistant','Resposta','condicionais') RETURNING id", [own])).rows[0].id;
    }
  });

  afterAll(async () => {
    await pool.query("DELETE FROM accounts WHERE id = ANY($1)", [[owner, other, ...students]]);
    await pool.query("DELETE FROM universities WHERE id=$1", [uni]);
    await pool.end();
    await closeDatabasePool();
  });

  it("stores one final rating per answer", async () => {
    expect(await saveFeedback(getDb(), owner, ids.answer, { rating: "down", reason: "incorrect", comment: "Errou a tabela" })).toMatchObject({ rating: "down", reason: "incorrect" });
    expect(await errorOf(() => saveFeedback(getDb(), owner, ids.answer, { rating: "up" }))).toMatchObject({ statusCode: 409, code: "chatFeedback.alreadyRated" });
    expect(await listSessionFeedback(getDb(), owner, "s1")).toEqual([{ messageId: ids.answer, rating: "down", reason: "incorrect", comment: "Errou a tabela" }]);
  });

  it("only rates active assistant answers of one's own conversations", async () => {
    expect(await errorOf(() => saveFeedback(getDb(), other, ids.answer, { rating: "up" }))).toMatchObject({ statusCode: 404 });
    expect(await errorOf(() => saveFeedback(getDb(), owner, ids.question, { rating: "up" }))).toMatchObject({ statusCode: 404 });
    expect(await errorOf(() => saveFeedback(getDb(), owner, ids.old, { rating: "up" }))).toMatchObject({ statusCode: 404 });
    expect(await errorOf(() => saveFeedback(getDb(), owner, "nope", { rating: "up" }))).toMatchObject({ statusCode: 404 });
  });

  it("summarizes by profile without identifying anyone and hides small groups", async () => {
    const ratings = ["up", "up", "partial", "down", "up"];
    for (let i = 0; i < students.length; i++) await saveFeedback(getDb(), students[i], ids[students[i]], { rating: ratings[i] });

    const summary = await feedbackSummary(getDb(), { days: 7 });
    expect(summary).toMatchObject({ total: 6, up: 3, partial: 1, down: 2, score: 3.5 / 6, reasons: { incorrect: 1, none: 2 } });
    expect(summary.byRole.groups).toEqual([{ key: "student", up: 3, partial: 1, down: 1, total: 5, score: 0.7 }]);
    expect(summary.byRole.hidden).toBe(1);
    expect(summary.byTopic.groups[0]).toMatchObject({ key: "condicionais", total: 6 });
    const recent = summary.recentNotUseful.find((item) => item.comment === "Errou a tabela")!;
    expect(recent).toMatchObject({ rating: "down", question: "O que é p → q?", answer: "É o condicional.", language: "pt-BR" });
    expect(JSON.stringify(summary)).not.toMatch(new RegExp([owner, ...students].join("|")));
    expect(JSON.stringify(summary)).not.toContain("example.invalid");
  });

  it("filters by institution, course and class", async () => {
    const byClass = await feedbackSummary(getDb(), { days: 7, classId: klass });
    expect(byClass).toMatchObject({ total: 2, up: 2 });
    expect(byClass.byCourse).toEqual({ groups: [], hidden: 2 });
    expect((await feedbackSummary(getDb(), { days: 7, institutionId: uni })).total).toBe(2);
    expect((await feedbackSummary(getDb(), { days: 7, courseId: randomUUID() })).total).toBe(0);
  });

  it("lists the answers that were not fully useful one page at a time", async () => {
    const first = await listNotUseful(getDb(), { days: 7, pageSize: 6 });
    expect(first).toMatchObject({ total: 3, page: 1, pageSize: 6, totalPages: 1 });
    expect(first.items.map((item) => item.rating).sort()).toEqual(["down", "down", "partial"]);
    expect(first.items.find((item) => item.comment === "Errou a tabela")).toMatchObject({ question: "O que é p → q?", answer: "É o condicional." });
    expect(JSON.stringify(first)).not.toMatch(new RegExp([owner, ...students].join("|")));

    // Unknown page sizes fall back to 12 and a page past the end shows the last one.
    expect(await listNotUseful(getDb(), { days: 7, pageSize: 7, page: 9 })).toMatchObject({ pageSize: 12, page: 1, totalPages: 1 });
    expect((await listNotUseful(getDb(), { days: 7, rating: "partial" })).total).toBe(1);
    expect((await listNotUseful(getDb(), { days: 7, classId: klass })).total).toBe(0);
    expect(await errorOf(() => listNotUseful(getDb(), { rating: "up" }))).toMatchObject({ statusCode: 400 });
  });
});
