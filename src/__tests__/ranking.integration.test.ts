import { randomUUID } from "crypto";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import request from "supertest";
import { parseRules, RankingValidationError } from "../services/ranking/rankingService";

const url = process.env.RANKING_TEST_DATABASE_URL;
const integration = url ? describe : describe.skip;

it("accepts only known periods, whole weights from 0 to 100 and true/false visibility", () => {
  expect(parseRules({ periodDays: 7, weights: { quiz: 0 }, visibleTo: { student: true } })).toEqual({ periodDays: 7, weights: { quiz: 0 }, visibleTo: { student: true } });
  try {
    parseRules({ periodDays: 12, weights: { practice: 101, exam: 1.5 }, visibleTo: { admin: "yes" } });
    throw new Error("should fail");
  } catch (error) {
    expect((error as RankingValidationError).issues.map((issue) => issue.field)).toEqual(["periodDays", "weights.practice", "weights.exam", "visibleTo.admin"]);
  }
});

integration("ranking on PostgreSQL", () => {
  let pool: Pool;
  let app: import("express").Express;
  let client: typeof import("../db/client");
  const ids = { school: randomUUID(), courseC: randomUUID(), courseD: randomUUID(), classA: randomUUID(), classB: randomUUID(), classZ: randomUUID(), discipline: randomUUID() };
  const staff = { professor: randomUUID(), coordinator: randomUUID(), admin: randomUUID(), owner: randomUUID() };
  const a = Array.from({ length: 5 }, () => randomUUID());
  const b = Array.from({ length: 5 }, () => randomUUID());
  const z = Array.from({ length: 2 }, () => randomUUID());
  const everyone = [...Object.values(staff), ...a, ...b, ...z];
  const password = "senha-de-teste-123";
  const email = (id: string) => (id === staff.owner ? "owner-ranking@example.invalid" : `${id}@example.invalid`);
  const days = (count: number) => new Date(Date.now() - count * 86400000);

  beforeAll(async () => {
    if (!url!.includes("_ranking_test") || process.env.DATABASE_URL !== url)
      throw new Error("Both database URLs must point to the same isolated ranking test database");
    process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-secret";
    process.env.OWNER_EMAILS = "owner-ranking@example.invalid";
    delete process.env.API_KEY;
    client = await import("../db/client");
    app = (await import("../server")).app;
    pool = new Pool({ connectionString: url });
    const q = (text: string, values: unknown[] = []) => pool.query(text, values);
    await q("INSERT INTO universities(id,name) VALUES($1,'Instituto')", [ids.school]);
    await q("INSERT INTO courses(id,name,university_id) VALUES($1,'Informática',$3),($2,'Mecânica',$3)", [ids.courseC, ids.courseD, ids.school]);
    await q("INSERT INTO classes(id,name,course_id,registration_code) VALUES($1,'A',$4,$6),($2,'B',$4,$7),($3,'Z',$5,$8)", [ids.classA, ids.classB, ids.classZ, ids.courseC, ids.courseD, `A-${ids.classA}`, `B-${ids.classB}`, `Z-${ids.classZ}`]);
    await q("INSERT INTO disciplines(id,name,course_id) VALUES($1,'Lógica',$2)", [ids.discipline, ids.courseC]);
    const hash = await bcrypt.hash(password, 4);
    const names: Record<string, string> = {};
    a.forEach((id, index) => { names[id] = `Aluno A${index + 1}`; });
    b.forEach((id, index) => { names[id] = `Aluno B${index + 1}`; });
    z.forEach((id, index) => { names[id] = `Aluno Z${index + 1}`; });
    for (const id of everyone) await q("INSERT INTO accounts(id,name,email,password_hash,status) VALUES($1,$2,$3,$4,'active')", [id, names[id] ?? "Equipe", email(id), hash]);
    await q("INSERT INTO account_roles(account_id,role) VALUES($1,'professor'),($2,'professor'),($2,'course-coordinator'),($3,'admin'),($4,'admin')", [staff.professor, staff.coordinator, staff.admin, staff.owner]);
    for (const id of [...a, ...b, ...z]) await q("INSERT INTO account_roles(account_id,role) VALUES($1,'student')", [id]);
    await q("INSERT INTO professor_profiles(account_id,school_id) VALUES($1,$3),($2,$3)", [staff.professor, staff.coordinator, ids.school]);
    await q("INSERT INTO professor_classes(professor_id,class_id) VALUES($1,$2)", [staff.professor, ids.classA]);
    await q("INSERT INTO professor_courses(professor_id,course_id) VALUES($1,$2)", [staff.coordinator, ids.courseC]);
    for (const [list, course, klass] of [[a, ids.courseC, ids.classA], [b, ids.courseC, ids.classB], [z, ids.courseD, ids.classZ]] as Array<[string[], string, string]>)
      for (const id of list) await q("INSERT INTO student_profiles(account_id,school_id,course_id,class_id) VALUES($1,$2,$3,$4)", [id, ids.school, course, klass]);

    // Workbench: A1 solves x1 (twice), x2, misses x3; x4 is older than the period. B1 solves one.
    const attempt = (student: string, exercise: string, correct: boolean, at: Date) => q(`INSERT INTO exercise_attempts(student_id,exercise_type,exercise_id,source,subject,attempt_number,is_correct,engine_version,submitted_state,result,mode,created_at)
      VALUES($1,'truth_table',$2,'catalog','logic',1,$3,'1.1.0','{}','{}','practice',$4)`, [student, exercise, correct, at]);
    await attempt(a[0], "x1", true, days(1)); await attempt(a[0], "x1", true, days(1)); await attempt(a[0], "x2", true, days(2));
    await attempt(a[0], "x3", false, days(2)); await attempt(a[0], "x4", true, days(60)); await attempt(b[0], "x1", true, days(3));
    // Quiz: A2 answers 3 right and 1 wrong.
    const quiz = randomUUID(); const question = randomUUID(); const quizAttempt = randomUUID();
    await q("INSERT INTO professor_quizzes(id,professor_id,discipline_id,title,topic) VALUES($1,$2,$3,'Quiz','logica')", [quiz, staff.professor, ids.discipline]);
    await q("INSERT INTO professor_quiz_questions(id,quiz_id,question,options,correct_option) VALUES($1,$2,'?','[\"a\",\"b\"]','A')", [question, quiz]);
    await q("INSERT INTO professor_quiz_attempts(id,quiz_id,student_id,completed_at) VALUES($1,$2,$3,$4)", [quizAttempt, quiz, a[1], days(1)]);
    for (const correct of [true, true, true, false]) await q("INSERT INTO professor_quiz_answers(attempt_id,question_id,selected_option,is_correct) VALUES($1,$2,'A',$3)", [quizAttempt, question, correct]);
    // Released exams: A3 got 8 three days ago; Z1 got 10 twenty days ago.
    for (const [student, grade, released] of [[a[2], 8, days(3)], [z[0], 10, days(20)]] as Array<[string, number, Date]>) {
      const exam = randomUUID();
      await q("INSERT INTO exams(id,owner_id,discipline_id,title,status,released_at) VALUES($1,$2,$3,'Prova','released',$4)", [exam, staff.professor, ids.discipline, released]);
      await q("INSERT INTO exam_submissions(exam_id,student_id,started_at,layout,status,grade) VALUES($1,$2,$3,'{}','submitted',$4)", [exam, student, released, grade]);
    }
    // Flash cards: A4 masters two cards (box 4) and is still learning a third.
    const deck = randomUUID();
    await q("INSERT INTO flashcard_decks(id,owner_id,discipline_id,title,published) VALUES($1,$2,$3,'Baralho',true)", [deck, staff.professor, ids.discipline]);
    for (const box of [4, 5, 2]) {
      const card = randomUUID();
      await q("INSERT INTO flashcards(id,deck_id,front,back) VALUES($1,$2,'f','b')", [card, deck]);
      await q("INSERT INTO flashcard_reviews(student_id,card_id,box,due_at,updated_at) VALUES($1,$2,$3,now(),now())", [a[3], card, box]);
    }
  });

  afterAll(async () => {
    await pool.query("DELETE FROM ranking_settings");
    await pool.query("DELETE FROM feature_rules WHERE scope_id = $1", [ids.school]);
    await pool.query("DELETE FROM accounts WHERE id = ANY($1)", [everyone]);
    await pool.query("DELETE FROM universities WHERE id = $1", [ids.school]);
    await pool.end();
    await client.closeDatabasePool();
  });

  const signIn = async (id: string) => {
    const agent = request.agent(app);
    await agent.post("/auth/session").send({ email: email(id), password }).expect(200);
    return agent;
  };
  const board = (body: { students: Array<{ name: string | null; points: number; position: number }> }) => body.students.map((row) => [row.position, row.name, row.points]);

  it("gives the professor the classes they teach, with points from each activity", async () => {
    const professor = await signIn(staff.professor);
    const scopes = (await professor.get("/ranking/scopes").expect(200)).body;
    expect(scopes).toMatchObject({ allowed: true, level: "professor", institutions: [], courses: [] });
    expect(scopes.classes.map((item: { id: string }) => item.id)).toEqual([ids.classA]);
    const classA = (await professor.get("/ranking").query({ scope: "class", id: ids.classA }).expect(200)).body;
    expect(board(classA)).toEqual([[1, "Aluno A3", 80], [2, "Aluno A1", 20], [3, "Aluno A2", 15], [4, "Aluno A4", 4], [5, "Aluno A5", 0]]);
    expect(classA.students[0].breakdown).toEqual({ practice: 0, quiz: 0, exam: 80, flashcards: 0 });
    expect(classA.rules).toMatchObject({ periodDays: 30, weights: { practice: 10, quiz: 5, exam: 10, flashcards: 2 } });
    await professor.get("/ranking").query({ scope: "class", id: ids.classB }).expect(404);
    await professor.get("/ranking").query({ scope: "course", id: ids.courseC }).expect(404);
  });

  it("compares the classes of the coordinated course by the average per student", async () => {
    const coordinator = await signIn(staff.coordinator);
    const scopes = (await coordinator.get("/ranking/scopes").expect(200)).body;
    expect(scopes.courses.map((item: { id: string }) => item.id)).toEqual([ids.courseC]);
    expect(scopes.classes.map((item: { id: string }) => item.id).sort()).toEqual([ids.classA, ids.classB].sort());
    const course = (await coordinator.get("/ranking").query({ scope: "course", id: ids.courseC }).expect(200)).body;
    expect(course.groupLevel).toBe("class");
    expect(course.groups.map((group: { name: string; averagePoints: number; position: number }) => [group.position, group.name, group.averagePoints])).toEqual([[1, "A", 23.8], [2, "B", 2]]);
    expect(course.students).toHaveLength(10);
    await coordinator.get("/ranking").query({ scope: "course", id: ids.courseD }).expect(404);
    await coordinator.get("/ranking").query({ scope: "institution", id: ids.school }).expect(404);
  });

  it("gives the admin the institution, leaving small groups out of the comparison", async () => {
    const admin = await signIn(staff.admin);
    const institution = (await admin.get("/ranking").query({ scope: "institution", id: ids.school }).expect(200)).body;
    expect(institution.groups.map((group: { name: string }) => group.name)).toEqual(["Informática"]);
    expect(institution.hiddenGroups).toBe(1);
    expect(board(institution)[0]).toEqual([1, "Aluno Z1", 100]);
    expect(institution.viewer.canConfigure).toBe(false);
  });

  it("follows the owner's rules: students, names, weights, period and the release of the feature", async () => {
    const student = await signIn(a[0]);
    expect((await student.get("/ranking/scopes").expect(200)).body.allowed).toBe(false);
    await student.get("/ranking").query({ scope: "class", id: ids.classA }).expect(403);
    const admin = await signIn(staff.admin);
    await admin.put("/ranking-settings").send({ scope: "global", config: { visibleTo: { student: true } } }).expect(403);

    const owner = await signIn(staff.owner);
    const invalid = (await owner.put("/ranking-settings").send({ scope: "global", config: { periodDays: 12 } }).expect(400)).body;
    expect(invalid.issues).toEqual([{ field: "periodDays", code: "INVALID" }]);
    await owner.put("/ranking-settings").send({ scope: "global", config: { visibleTo: { student: true } } }).expect(200);
    // Students: only their class; classmates without names, breakdown only of their own line.
    expect((await student.get("/ranking/scopes").expect(200)).body.classes.map((item: { id: string }) => item.id)).toEqual([ids.classA]);
    let mine = (await student.get("/ranking").query({ scope: "class", id: ids.classA }).expect(200)).body;
    expect(board(mine)).toEqual([[1, null, 80], [2, "Aluno A1", 20], [3, null, 15], [4, null, 4], [5, null, 0]]);
    expect(mine.students[0].breakdown).toBeUndefined();
    expect(mine.students[1]).toMatchObject({ me: true, breakdown: { practice: 20 } });
    await student.get("/ranking").query({ scope: "class", id: ids.classB }).expect(404);
    await owner.put("/ranking-settings").send({ scope: "global", config: { visibleTo: { student: true }, studentNames: true } }).expect(200);
    mine = (await student.get("/ranking").query({ scope: "class", id: ids.classA }).expect(200)).body;
    expect(mine.students[0].name).toBe("Aluno A3");

    // This institution only: no practice points and a 7-day period (Z1's exam is older).
    const saved = (await owner.put("/ranking-settings").send({ scope: "institution", scopeId: ids.school, config: { periodDays: 7, weights: { practice: 0 } } }).expect(200)).body;
    expect(saved.effective).toMatchObject({ periodDays: 7, weights: { practice: 0, quiz: 5 }, visibleTo: { student: true }, studentNames: true });
    const institution = (await owner.get("/ranking").query({ scope: "institution", id: ids.school }).expect(200)).body;
    expect(institution.students.find((row: { name: string }) => row.name === "Aluno Z1").points).toBe(0);
    expect(institution.students.find((row: { name: string }) => row.name === "Aluno A1").points).toBe(0);
    expect(institution.viewer.canConfigure).toBe(true);
    await owner.post("/ranking-settings/clear").send({ scope: "institution", scopeId: ids.school }).expect(204);
    expect((await owner.get("/ranking").query({ scope: "institution", id: ids.school }).expect(200)).body.rules.periodDays).toBe(30);

    // Turned off for the institution in the release page: hidden, but the rules can still be changed.
    await owner.put("/features/rules").send({ feature: "ranking", scope: "institution", scopeId: ids.school, enabled: false }).expect(200);
    expect((await (await signIn(staff.professor)).get("/ranking/scopes").expect(403)).body.code).toBe("features.unavailable");
    await owner.get("/ranking-settings").query({ institutionId: ids.school }).expect(200);
  });
});
