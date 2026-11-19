import { randomUUID } from "crypto";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import request from "supertest";
import { app } from "../server";
import { closeDatabasePool } from "../db/client";
import { chatSatisfaction, examResults, weeklyEngagement } from "../services/dashboard/dashboardComparisonService";

const url = process.env.COMPARISON_TEST_DATABASE_URL;
const integration = url ? describe : describe.skip;

integration("direct comparison data of the Dashboard on PostgreSQL", () => {
  let pool: Pool;
  const ids = { school: randomUUID(), other: randomUUID(), course: randomUUID(), otherCourse: randomUUID(), classA: randomUUID(), classB: randomUUID(), discipline: randomUUID() };
  const people = { professor: randomUUID(), admin: randomUUID(), outsider: randomUUID() };
  const students = Array.from({ length: 6 }, () => randomUUID());
  const lonely = randomUUID();
  const password = "senha-de-teste-123";
  const email = (id: string) => `${id}@example.invalid`;
  const now = new Date();
  const daysAgo = (days: number) => new Date(now.getTime() - days * 86400000);

  beforeAll(async () => {
    if (!url!.includes("_comparison_test") || process.env.DATABASE_URL !== url)
      throw new Error("Both database URLs must point to the same isolated comparison test database");
    process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-secret";
    delete process.env.API_KEY;
    pool = new Pool({ connectionString: url });
    const q = (text: string, values: unknown[] = []) => pool.query(text, values);
    await q("INSERT INTO universities(id,name) VALUES($1,'Instituição'),($2,'Outra')", [ids.school, ids.other]);
    await q("INSERT INTO courses(id,name,university_id) VALUES($1,'Computação',$2),($3,'Outro',$4)", [ids.course, ids.school, ids.otherCourse, ids.other]);
    await q("INSERT INTO classes(id,name,course_id,registration_code) VALUES($1,'A',$3,$4),($2,'B',$3,$5)", [ids.classA, ids.classB, ids.course, `A-${ids.classA}`, `B-${ids.classB}`]);
    await q("INSERT INTO disciplines(id,name,course_id) VALUES($1,'Lógica',$2)", [ids.discipline, ids.course]);
    await q("INSERT INTO class_disciplines(class_id,discipline_id) VALUES($1,$2)", [ids.classA, ids.discipline]);
    const hash = await bcrypt.hash(password, 4);
    for (const [key, id] of Object.entries(people)) await q("INSERT INTO accounts(id,name,email,password_hash,status) VALUES($1,$2,$3,$4,'active')", [id, key, email(id), hash]);
    await q("INSERT INTO account_roles(account_id,role) VALUES($1,'professor'),($2,'admin'),($3,'professor')", [people.professor, people.admin, people.outsider]);
    await q("INSERT INTO professor_profiles(account_id,school_id) VALUES($1,$2),($3,$4)", [people.professor, ids.school, people.outsider, ids.other]);
    await q("INSERT INTO professor_courses(professor_id,course_id) VALUES($1,$2),($3,$4)", [people.professor, ids.course, people.outsider, ids.otherCourse]);
    await q("INSERT INTO professor_classes(professor_id,class_id) VALUES($1,$2)", [people.professor, ids.classA]);
    for (const [index, id] of [...students, lonely].entries()) {
      const klass = id === lonely ? ids.classB : ids.classA;
      await q("INSERT INTO accounts(id,name,email) VALUES($1,$2,$3)", [id, `Aluno ${index}`, email(id)]);
      await q("INSERT INTO account_roles(account_id,role) VALUES($1,'student')", [id]);
      await q("INSERT INTO student_profiles(account_id,school_id,course_id,class_id) VALUES($1,$2,$3,$4)", [id, ids.school, ids.course, klass]);
      const analysis = (await q(`INSERT INTO user_analyses(user_id,name,email,school_id,school_name,course_id,course_name,class_id,class_name)
        VALUES($1,'x',$5,$2,'I',$3,'C',$4,'K') RETURNING id`, [id, ids.school, ids.course, klass, email(id)])).rows[0].id;
      // Half of class A is active this week, everyone was active three weeks ago.
      const starts = [daysAgo(21), ...(index < 3 ? [daysAgo(1)] : [])];
      for (const start of starts) await q("INSERT INTO analysis_sessions(analysis_id,session_start,session_end,session_duration,duration_source) VALUES($1,$2,$3,600,'recorded')", [analysis, start, new Date(start.getTime() + 600000)]);
    }
    // Exams: a released one (5 of 6 submitted) counts; a closed, unreleased one does not.
    for (const status of ["released", "closed"]) {
      const exam = (await q(`INSERT INTO exams(owner_id,discipline_id,class_id,title,status,released_at) VALUES($1,$2,$3,'Prova',$4,${status === "released" ? "now() - interval '2 days'" : "NULL"}) RETURNING id`,
        [people.professor, ids.discipline, ids.classA, status])).rows[0].id;
      for (const [index, student] of students.slice(0, 5).entries())
        await q("INSERT INTO exam_submissions(exam_id,student_id,status,started_at,submitted_at,layout,grade) VALUES($1,$2,'submitted',now(),now(),'{}',$3)", [exam, student, 6 + index * 0.5]);
    }
    // Chat ratings by class A students (5 of them, so the group is shown).
    for (const [index, student] of students.slice(0, 5).entries()) {
      const session = (await q("INSERT INTO chat_sessions(user_id,session_id) VALUES($1,'s') RETURNING id", [student])).rows[0].id;
      const message = (await q("INSERT INTO chat_messages(chat_session_id,role,content,detected_topic) VALUES($1,'assistant','r','condicionais') RETURNING id", [session])).rows[0].id;
      await q("INSERT INTO chat_message_feedback(account_id,message_id,rating) VALUES($1,$2,$3)", [student, message, index < 3 ? "up" : index === 3 ? "partial" : "down"]);
    }
  });

  afterAll(async () => {
    await pool.query("DELETE FROM accounts WHERE id = ANY($1)", [[...Object.values(people), ...students, lonely]]);
    await pool.query("DELETE FROM universities WHERE id = ANY($1)", [[ids.school, ids.other]]);
    await pool.end();
    await closeDatabasePool();
  });

  it("averages grades of released exams and counts who submitted", async () => {
    const result = await examResults({ universityId: ids.school, classId: ids.classA });
    expect(result.exams).toHaveLength(1);
    expect(result).toMatchObject({ expected: 6, submitted: 5, submissionRate: 0.833, averageGrade: 7 });
    expect((await examResults({ universityId: ids.school, classId: ids.classB })).exams).toHaveLength(0);
    expect((await examResults({ universityId: ids.school, disciplineId: ids.discipline })).submitted).toBe(5);
  });

  it("gives the share of students active each week, fair between groups of different sizes", async () => {
    const result = await weeklyEngagement({ universityId: ids.school, classId: ids.classA });
    expect(result.students).toBe(6);
    expect(result.weeks.map((week) => week.activeShare)).toEqual([1, 0.5]);
    expect(result.weeks[0]).toMatchObject({ activeStudents: 6, sessions: 6, minutes: 60 });
    const course = await weeklyEngagement({ universityId: ids.school, courseId: ids.course });
    expect(course.students).toBe(7);
  });

  it("shows chat satisfaction for groups, never for one student or tiny groups", async () => {
    expect(await chatSatisfaction({ universityId: ids.school, classId: ids.classA })).toMatchObject({ available: true, total: 5, up: 3, partial: 1, down: 1, score: 0.7 });
    expect(await chatSatisfaction({ universityId: ids.school, classId: ids.classB })).toMatchObject({ available: false, reason: "small" });
    expect(await chatSatisfaction({ universityId: ids.school, studentId: students[0] })).toEqual({ available: false, reason: "student" });
  });

  it("checks that the selection belongs to whoever asks", async () => {
    const signIn = async (id: string) => {
      const agent = request.agent(app);
      await agent.post("/auth/session").send({ email: email(id), password }).expect(200);
      return agent;
    };
    const selection = { universityId: ids.school, classId: ids.classA };
    await (await signIn(people.professor)).post("/dashboard/compare/exams").send(selection).expect(200);
    await (await signIn(people.outsider)).post("/dashboard/compare/exams").send(selection).expect(403);
    await (await signIn(people.outsider)).post("/dashboard/compare/engagement").send(selection).expect(403);
    const admin = await signIn(people.admin);
    expect((await admin.post("/dashboard/compare/chat-satisfaction").send(selection).expect(200)).body.available).toBe(true);
    await admin.post("/dashboard/compare/exams").send({ classId: ids.classA }).expect(400);
  });

  it("protects every Dashboard and analytics read with the same scope rule", async () => {
    const signIn = async (id: string) => {
      const agent = request.agent(app);
      await agent.post("/auth/session").send({ email: email(id), password }).expect(200);
      return agent;
    };
    const own = { universityId: ids.school, classId: ids.classA };
    const professor = await signIn(people.professor);
    // A professor only reads the disciplines they teach.
    await professor.get(`/logs/disciplines/${ids.discipline}/subjects/summary`).expect(403);
    await pool.query("INSERT INTO professor_disciplines(professor_id,discipline_id) VALUES($1,$2)", [people.professor, ids.discipline]);
    const outsider = await signIn(people.outsider);
    const admin = await signIn(people.admin);
    for (const path of ["/dashboard/topic-performance", "/dashboard/proficiency-radar", "/dashboard/effort-matrix", "/dashboard/learning-journey", "/dashboard/session-details", "/dashboard/access-pattern", "/logs/students/summary"]) {
      await professor.post(path).send(own).expect(200);
      await outsider.post(path).send(own).expect(403);
      await admin.post(path).send(own).expect(200);
    }
    for (const path of [`/logs/classes/${ids.classA}/summary`, `/logs/classes/${ids.classA}/accuracy`, `/logs/courses/${ids.course}/usage`, `/logs/disciplines/${ids.discipline}/subjects/summary`, `/logs/professor/students/${students[0]}`]) {
      await professor.get(path).expect(200);
      await outsider.get(path).expect(403);
    }
    // A professor never reads a whole institution, and broken ids or entities are refused before any query.
    await professor.get(`/logs/universities/${ids.school}/accuracy`).expect(403);
    await admin.get(`/logs/planets/${ids.school}/usage`).expect(400);
    await admin.post("/dashboard/topic-performance").send({ universityId: "not-an-id" }).expect(400);
  });
});
