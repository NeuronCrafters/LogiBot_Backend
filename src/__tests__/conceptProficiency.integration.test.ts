import { randomUUID } from "crypto";
import { Pool } from "pg";
import { closeDatabasePool, getDb } from "../db/client";
import { conceptProficiency, proficiencyScopes } from "../services/concepts/conceptProficiencyService";

const url = process.env.CONCEPTS_TEST_DATABASE_URL;
const integration = url ? describe : describe.skip;

integration("proficiency per concept on PostgreSQL", () => {
  let pool: Pool;
  const ids = { school: randomUUID(), other: randomUUID(), course: randomUUID(), classA: randomUUID(), classB: randomUUID(), discipline: randomUUID(), otherCourse: randomUUID(), otherClass: randomUUID() };
  const people = { professor: randomUUID(), coordinator: randomUUID(), outsider: randomUUID(), admin: randomUUID(), lonely: randomUUID() };
  const students = Array.from({ length: 6 }, () => randomUUID());
  const user = (id: string, role: string[], school: string | null = ids.school) => ({ id, role, school, email: `${id}@example.invalid`, name: "x" }) as never;
  const errorOf = async (run: () => Promise<unknown>) => { try { await run(); } catch (error) { return error; } return undefined; };

  beforeAll(async () => {
    if (!url!.includes("_concepts_test") || process.env.DATABASE_URL !== url)
      throw new Error("Both database URLs must point to the same isolated concepts test database");
    pool = new Pool({ connectionString: url });
    const q = (text: string, values: unknown[] = []) => pool.query(text, values);
    await q("INSERT INTO universities(id,name) VALUES($1,'Instituição'),($2,'Outra')", [ids.school, ids.other]);
    await q("INSERT INTO courses(id,name,university_id) VALUES($1,'Computação',$2),($3,'Outro curso',$4)", [ids.course, ids.school, ids.otherCourse, ids.other]);
    await q("INSERT INTO classes(id,name,course_id,registration_code) VALUES($1,'A',$3,$4),($2,'B',$3,$5),($6,'Z',$7,$8)", [ids.classA, ids.classB, ids.course, `A-${ids.classA}`, `B-${ids.classB}`, ids.otherClass, ids.otherCourse, `Z-${ids.otherClass}`]);
    await q("INSERT INTO disciplines(id,name,course_id) VALUES($1,'Lógica',$2)", [ids.discipline, ids.course]);
    for (const [key, id] of Object.entries(people)) await q("INSERT INTO accounts(id,name,email) VALUES($1,$2,$3)", [id, key, `${id}@example.invalid`]);
    for (const [index, id] of students.entries()) await q("INSERT INTO accounts(id,name,email) VALUES($1,$2,$3)", [id, `Aluno ${index + 1}`, `${id}@example.invalid`]);
    for (const id of [...students, people.lonely]) await q("INSERT INTO account_roles(account_id,role) VALUES($1,'student')", [id]);
    for (const id of students) await q("INSERT INTO student_profiles(account_id,school_id,course_id,class_id) VALUES($1,$2,$3,$4)", [id, ids.school, ids.course, ids.classA]);
    await q("INSERT INTO student_profiles(account_id,school_id,course_id,class_id) VALUES($1,$2,$3,$4)", [people.lonely, ids.school, ids.course, ids.classB]);
    await q("INSERT INTO professor_classes(professor_id,class_id) VALUES($1,$2)", [people.professor, ids.classA]);

    // Practice: each student fills p → ¬q with a mistake only in the conditional column.
    const attempt = (student: string, concepts: string[], correct: boolean, errors: Record<string, number> | null, type = "truth_table") => q(
      `INSERT INTO exercise_attempts(student_id,mode,exercise_type,exercise_id,source,subject,concepts,attempt_number,is_correct,engine_version,submitted_state,result)
       VALUES($1,'practice',$2,'x','catalog','propositional_logic',$3,1,$4,'1','{}',$5)`,
      [student, type, JSON.stringify(concepts), correct, JSON.stringify(errors ? { errorsByConcept: errors } : {})]);
    for (const student of students) await attempt(student, ["negation", "conditional"], false, { conditional: 1 });
    await attempt(students[0], ["selection"], true, null, "parsons");
    await attempt(people.lonely, ["negation"], true, {});

    // Exams: a released one counts, a closed (not released) one does not.
    const exam = async (status: string) => (await q(
      `INSERT INTO exams(owner_id,discipline_id,class_id,title,status,released_at) VALUES($1,$2,$3,'Prova',$4,${status === "released" ? "now()" : "NULL"}) RETURNING id`,
      [people.professor, ids.discipline, ids.classA, status])).rows[0].id as string;
    for (const status of ["released", "closed"]) {
      const examId = await exam(status);
      const objective = (await q(`INSERT INTO exam_questions(exam_id,question_version,order_index,type,weight,snapshot) VALUES($1,1,0,'quiz',1,$2) RETURNING id`,
        [examId, JSON.stringify({ concepts: ["conjunction"] })])).rows[0].id;
      const essay = (await q(`INSERT INTO exam_questions(exam_id,question_version,order_index,type,weight,snapshot) VALUES($1,1,1,'essay',1,$2) RETURNING id`,
        [examId, JSON.stringify({ concepts: ["conjunction"] })])).rows[0].id;
      for (const [index, student] of students.entries()) {
        const submission = (await q(`INSERT INTO exam_submissions(exam_id,student_id,status,started_at,submitted_at,layout,objective_results) VALUES($1,$2,'submitted',now(),now(),'{}',$3) RETURNING id`,
          [examId, student, JSON.stringify({ [objective]: { correct: index % 2 === 0, details: {} } })])).rows[0].id;
        await q(`INSERT INTO blind_reviews(submission_id,exam_question_id,code,display_order,score) VALUES($1,$2,$3,$4,0.5)`, [submission, essay, `c${index}-${status}`, index]);
      }
    }
  });

  afterAll(async () => {
    await pool.query("DELETE FROM accounts WHERE id = ANY($1)", [[...Object.values(people), ...students]]);
    await pool.query("DELETE FROM universities WHERE id = ANY($1)", [[ids.school, ids.other]]);
    await pool.end();
    await closeDatabasePool();
  });

  const concept = (data: { concepts: Array<{ concept: string }> }, name: string) => data.concepts.find((item) => item.concept === name) as any;

  it("gives the professor each concept of the class and each student, counting released exams only", async () => {
    const data = await conceptProficiency(getDb(), user(people.professor, ["professor"]), { scope: "class", id: ids.classA, days: 30 });
    expect(data.aggregated).toBe(false);
    // In the truth table the negation column was right and the conditional one wrong.
    expect(concept(data, "negation")).toMatchObject({ total: 6, score: 1, students: 6 });
    expect(concept(data, "conditional")).toMatchObject({ total: 6, score: 0 });
    // 3 of 6 objective answers right + 6 essays at 0.5 = 6 / 12; the unreleased exam is ignored.
    expect(concept(data, "conjunction")).toMatchObject({ total: 12, score: 0.5, exam: { total: 12, score: 0.5 }, practice: { total: 0, score: null } });
    expect(data.students).toHaveLength(6);
    expect(data.students![0]).toMatchObject({ name: "Aluno 1", concepts: { selection: { total: 1, score: 1 } } });
  });

  it("aggregates for coordination and hides concepts seen by fewer than 5 students", async () => {
    const coordinator = user(people.coordinator, ["professor", "course-coordinator"]);
    const data = await conceptProficiency(getDb(), coordinator, { scope: "course", id: ids.course, days: 30 });
    expect(data.aggregated).toBe(true);
    expect(data.students).toBeUndefined();
    expect(concept(data, "negation")).toMatchObject({ total: 7, students: 7 });
    expect(concept(data, "selection")).toBeUndefined();
    expect(data.hidden).toBe(1);
    expect(JSON.stringify(data)).not.toContain("Aluno");
    const classView = await conceptProficiency(getDb(), coordinator, { scope: "class", id: ids.classA, days: 30 });
    expect(classView.students).toBeUndefined();
  });

  it("keeps each profile inside what it may see", async () => {
    const professor = user(people.professor, ["professor"]);
    expect(await errorOf(() => conceptProficiency(getDb(), professor, { scope: "class", id: ids.classB }))).toMatchObject({ statusCode: 403 });
    expect(await errorOf(() => conceptProficiency(getDb(), professor, { scope: "course", id: ids.course }))).toMatchObject({ statusCode: 403 });
    const coordinator = user(people.coordinator, ["professor", "course-coordinator"]);
    expect(await errorOf(() => conceptProficiency(getDb(), coordinator, { scope: "class", id: ids.otherClass }))).toMatchObject({ statusCode: 404 });
    expect(await errorOf(() => conceptProficiency(getDb(), coordinator, { scope: "institution", id: ids.other }))).toMatchObject({ statusCode: 403 });
    expect(await errorOf(() => conceptProficiency(getDb(), coordinator, { scope: "all" }))).toMatchObject({ statusCode: 403 });
    expect(await errorOf(() => conceptProficiency(getDb(), professor, { scope: "me" }))).toMatchObject({ statusCode: 403 });
    expect((await conceptProficiency(getDb(), user(people.admin, ["admin"], null), { scope: "all" })).aggregated).toBe(true);
  });

  it("shows students only their own data", async () => {
    const data = await conceptProficiency(getDb(), user(students[1], ["student"]), {});
    expect(data.scope).toBe("me");
    expect(concept(data, "conjunction")).toMatchObject({ total: 2, score: 0.25 });
    expect(concept(data, "negation")).toMatchObject({ total: 1, score: 1 });
  });

  it("offers each profile only the selections it may open", async () => {
    const professor = await proficiencyScopes(getDb(), user(people.professor, ["professor"]));
    expect(professor).toMatchObject({ me: false, all: false, institutions: [], courses: [] });
    expect(professor.classes).toEqual([expect.objectContaining({ id: ids.classA, teaches: true })]);
    const coordinator = await proficiencyScopes(getDb(), user(people.coordinator, ["professor", "course-coordinator"]));
    expect(coordinator.institutions).toEqual([{ id: ids.school, name: "Instituição" }]);
    expect(coordinator.classes.map((item) => item.id).sort()).toEqual([ids.classA, ids.classB].sort());
    const admin = await proficiencyScopes(getDb(), user(people.admin, ["admin"], null));
    expect(admin.all).toBe(true);
    expect(admin.classes.map((item) => item.id)).toEqual(expect.arrayContaining([ids.classA, ids.otherClass]));
  });

  it("leaves out the exercise types that are turned off in the release page", async () => {
    const professor = user(people.professor, ["professor"]);
    const before = await conceptProficiency(getDb(), professor, { scope: "class", id: ids.classA, days: 30 });
    expect(before.students![0].concepts.selection).toBeDefined();
    await pool.query("INSERT INTO feature_rules(feature, scope, scope_id, enabled) VALUES('practice_parsons', 'global', '', false)");
    try {
      const after = await conceptProficiency(getDb(), professor, { scope: "class", id: ids.classA, days: 30 });
      expect(after.students![0].concepts.selection).toBeUndefined();
      expect(after.concepts.find((item) => item.concept === "negation")).toBeDefined();
    } finally {
      await pool.query("DELETE FROM feature_rules WHERE feature = 'practice_parsons'");
    }
  });
});
