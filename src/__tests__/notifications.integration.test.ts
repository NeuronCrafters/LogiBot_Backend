import { randomUUID } from "crypto";
import { Pool } from "pg";
import { closeDatabasePool, getDb } from "../db/client";
import {
  getNotificationPreferences,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notifyQuizCompletion,
  notifyQuizPublished,
  setNotificationPreferences,
} from "../services/notifications/notificationService";

const sendMail = jest.fn(async (_input: { to: string; subject: string; html: string }) => undefined);
jest.mock("../services/email/mailService", () => ({ sendMail: (input: { to: string; subject: string; html: string }) => sendMail(input) }));

const url = process.env.NOTIFICATIONS_TEST_DATABASE_URL;
const integration = url ? describe : describe.skip;
const APP = "https://app.example";

integration("notifications on PostgreSQL", () => {
  let pool: Pool;
  const id = () => randomUUID();
  const ids = { university: id(), course: id(), classA: id(), classB: id(), discipline: id(), professor: id(), s1: id(), s2: id(), s3: id(), inactive: id(), quiz: id() };

  beforeAll(async () => {
    if (!url!.includes("_notifications_test") || process.env.DATABASE_URL !== url)
      throw new Error("Both database URLs must point to the same isolated notifications test database");
    pool = new Pool({ connectionString: url });
    const q = (text: string, values: unknown[]) => pool.query(text, values);
    await q("INSERT INTO universities(id,name) VALUES($1,'U')", [ids.university]);
    await q("INSERT INTO courses(id,name,university_id) VALUES($1,'C',$2)", [ids.course, ids.university]);
    await q("INSERT INTO classes(id,name,course_id,registration_code) VALUES($1,'A',$3,$4),($2,'B',$3,$5)", [ids.classA, ids.classB, ids.course, `A-${ids.classA}`, `B-${ids.classB}`]);
    await q("INSERT INTO disciplines(id,name,course_id) VALUES($1,'Lógica',$2)", [ids.discipline, ids.course]);
    await q("INSERT INTO class_disciplines(class_id,discipline_id) VALUES($1,$2)", [ids.classA, ids.discipline]);
    const people: Array<[string, string, string, string | null]> = [
      [ids.professor, "Prof", "active", "pt-BR"], [ids.s1, "Ana", "active", "en-US"], [ids.s2, "Bia", "active", null],
      [ids.s3, "Caio", "active", null], [ids.inactive, "Davi", "inactive", null],
    ];
    for (const [account, name, status, language] of people)
      await q("INSERT INTO accounts(id,name,email,status,preferred_language) VALUES($1,$2,$3,$4,$5)", [account, name, `${account}@example.invalid`, status, language]);
    for (const [student, klass] of [[ids.s1, ids.classA], [ids.s2, ids.classA], [ids.s3, ids.classB], [ids.inactive, ids.classA]])
      await q("INSERT INTO student_profiles(account_id,school_id,course_id,class_id) VALUES($1,$2,$3,$4)", [student, ids.university, ids.course, klass]);
    await q("INSERT INTO professor_quizzes(id,professor_id,discipline_id,class_id,title,topic,status) VALUES($1,$2,$3,NULL,$4,'logic','published')",
      [ids.quiz, ids.professor, ids.discipline, "Quiz <1>"]);
    await setNotificationPreferences(getDb(), ids.s1, true);
    await setNotificationPreferences(getDb(), ids.professor, true);
  });

  afterAll(async () => {
    await pool.query("DELETE FROM accounts WHERE id = ANY($1)", [[ids.professor, ids.s1, ids.s2, ids.s3, ids.inactive]]);
    await pool.query("DELETE FROM universities WHERE id=$1", [ids.university]);
    await pool.end();
    await closeDatabasePool();
  });

  const attempt = (student: string) =>
    pool.query("INSERT INTO professor_quiz_attempts(quiz_id,student_id,score,total_questions) VALUES($1,$2,1,1)", [ids.quiz, student]);
  const progress = async () => (await pool.query(
    "SELECT params, read_at, updated_at FROM notifications WHERE recipient_id=$1 AND type='quiz_completion_progress'", [ids.professor])).rows;

  it("notifies only active students of the classes linked to the quiz discipline, once", async () => {
    sendMail.mockClear();
    const first = await notifyQuizPublished(getDb(), ids.quiz, APP);
    await first.emails;
    expect(first.recipients.sort()).toEqual([ids.s1, ids.s2].sort());
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0]).toMatchObject({ to: `${ids.s1}@example.invalid`, subject: "New quiz in your class: Quiz <1>" });
    expect(sendMail.mock.calls[0][0].html).toContain(`${APP}/quiz/${ids.quiz}`);

    const again = await notifyQuizPublished(getDb(), ids.quiz, APP);
    expect(again.recipients).toEqual([]);
    const { items, unreadCount } = await listNotifications(getDb(), ids.s2);
    expect(unreadCount).toBe(1);
    expect(items[0]).toMatchObject({ type: "quiz_published", link: `/quiz/${ids.quiz}`, params: { quizTitle: "Quiz <1>", disciplineName: "Lógica" } });
  });

  it("keeps one progress notification per quiz for the professor, counting first completions only", async () => {
    sendMail.mockClear();
    await attempt(ids.s1);
    await (await notifyQuizCompletion(getDb(), ids.quiz, ids.s1, APP)).emails;
    let rows = await progress();
    expect(rows).toHaveLength(1);
    expect(rows[0].params).toMatchObject({ completed: 1, total: 2, lastStudentName: "Ana" });
    expect(sendMail).toHaveBeenCalledTimes(1);

    await attempt(ids.s1);
    expect((await notifyQuizCompletion(getDb(), ids.quiz, ids.s1, APP)).recipients).toEqual([]);

    await markAllNotificationsRead(getDb(), ids.professor);
    const before = (await progress())[0].updated_at;
    await attempt(ids.s2);
    await (await notifyQuizCompletion(getDb(), ids.quiz, ids.s2, APP)).emails;
    rows = await progress();
    expect(rows).toHaveLength(1);
    expect(rows[0].params).toMatchObject({ completed: 2, total: 2, lastStudentName: "Bia" });
    expect(rows[0].read_at).toBeNull();
    expect(+rows[0].updated_at).toBeGreaterThanOrEqual(+before);
    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  it("only lets each person read and change their own notifications", async () => {
    const [own] = (await listNotifications(getDb(), ids.s1)).items;
    expect(await markNotificationRead(getDb(), ids.s2, own.id)).toBe(false);
    expect(await markNotificationRead(getDb(), ids.s1, own.id)).toBe(true);
    expect((await listNotifications(getDb(), ids.s1)).unreadCount).toBe(0);
    expect((await listNotifications(getDb(), ids.s2)).unreadCount).toBe(1);
    expect((await listNotifications(getDb(), ids.s3)).items).toEqual([]);
  });

  it("stores the e-mail preference, off by default", async () => {
    expect(await getNotificationPreferences(getDb(), ids.s2)).toEqual({ emailEnabled: false });
    await setNotificationPreferences(getDb(), ids.s2, true);
    expect(await getNotificationPreferences(getDb(), ids.s2)).toEqual({ emailEnabled: true });
    await setNotificationPreferences(getDb(), ids.s2, false);
    expect(await getNotificationPreferences(getDb(), ids.s2)).toEqual({ emailEnabled: false });
  });
});
