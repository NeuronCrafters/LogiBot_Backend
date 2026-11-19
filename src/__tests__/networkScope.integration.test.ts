import { randomUUID } from "crypto";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import request from "supertest";
import { app } from "../server";
import { closeDatabasePool } from "../db/client";

const url = process.env.NETWORK_TEST_DATABASE_URL;
const integration = url ? describe : describe.skip;

integration("each profile only lists its own institution", () => {
  let pool: Pool;
  const ids = { a: randomUUID(), b: randomUUID(), courseA: randomUUID(), courseB: randomUUID(), classA: randomUUID(), classB: randomUUID(), discA: randomUUID(), discB: randomUUID() };
  const people = { professor: randomUUID(), coordinator: randomUUID(), admin: randomUUID(), studentA: randomUUID(), studentB: randomUUID() };
  const password = "senha-de-teste-123";
  const email = (id: string) => `${id}@example.invalid`;

  beforeAll(async () => {
    if (!url!.includes("_network_test") || process.env.DATABASE_URL !== url)
      throw new Error("Both database URLs must point to the same isolated network test database");
    process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-secret";
    delete process.env.API_KEY;
    pool = new Pool({ connectionString: url });
    const q = (text: string, values: unknown[]) => pool.query(text, values);
    await q("INSERT INTO universities(id,name) VALUES($1,'Instituição A'),($2,'Instituição B')", [ids.a, ids.b]);
    await q("INSERT INTO courses(id,name,university_id) VALUES($1,'Curso A',$3),($2,'Curso B',$4)", [ids.courseA, ids.courseB, ids.a, ids.b]);
    await q("INSERT INTO classes(id,name,course_id,registration_code) VALUES($1,'Turma A',$3,$5),($2,'Turma B',$4,$6)", [ids.classA, ids.classB, ids.courseA, ids.courseB, `A-${ids.classA}`, `B-${ids.classB}`]);
    await q("INSERT INTO disciplines(id,name,course_id) VALUES($1,'Lógica A',$3),($2,'Lógica B',$4)", [ids.discA, ids.discB, ids.courseA, ids.courseB]);
    const hash = await bcrypt.hash(password, 4);
    for (const [key, id] of Object.entries(people)) {
      await q("INSERT INTO accounts(id,name,email,password_hash,status) VALUES($1,$2,$3,$4,'active')", [id, key, email(id), hash]);
    }
    await q("INSERT INTO account_roles(account_id,role) VALUES($1,'professor'),($2,'professor'),($2,'course-coordinator'),($3,'admin'),($4,'student'),($5,'student')", [people.professor, people.coordinator, people.admin, people.studentA, people.studentB]);
    await q("INSERT INTO professor_profiles(account_id,school_id) VALUES($1,$3),($2,$3)", [people.professor, people.coordinator, ids.a]);
    await q("INSERT INTO professor_courses(professor_id,course_id) VALUES($1,$2)", [people.coordinator, ids.courseA]);
    await q("INSERT INTO student_profiles(account_id,school_id,course_id,class_id) VALUES($1,$3,$4,$5),($2,$6,$7,$8)", [people.studentA, people.studentB, ids.a, ids.courseA, ids.classA, ids.b, ids.courseB, ids.classB]);
  });

  afterAll(async () => {
    await pool.query("DELETE FROM accounts WHERE id = ANY($1)", [Object.values(people)]);
    await pool.query("DELETE FROM universities WHERE id = ANY($1)", [[ids.a, ids.b]]);
    await pool.end();
    await closeDatabasePool();
  });

  const signIn = async (id: string) => {
    const agent = request.agent(app);
    await agent.post("/auth/session").send({ email: email(id), password }).expect(200);
    return agent;
  };

  it("lists only the students of the professor's institution", async () => {
    const professor = await signIn(people.professor);
    const students = (await professor.get("/admin/students").expect(200)).body.map((row: { id: string }) => row.id);
    expect(students).toContain(people.studentA);
    expect(students).not.toContain(people.studentB);
    await professor.get(`/admin/classes/${ids.classA}/students`).expect(200);
    await professor.get(`/admin/classes/${ids.classB}/students`).expect(404);
  });

  it("keeps coordinators inside their institution, also when deleting", async () => {
    const coordinator = await signIn(people.coordinator);
    const disciplines = (await coordinator.get("/academic/disciplines").expect(200)).body.map((row: { id: string }) => row.id);
    expect(disciplines).toEqual([ids.discA]);
    await coordinator.get(`/academic/courses/${ids.courseB}/classes`).expect(404);
    await coordinator.get(`/admin/courses/${ids.courseB}/professors`).expect(404);
    await coordinator.delete(`/academic/disciplines/${ids.discB}`).expect(404);
    expect((await pool.query("SELECT count(*)::int AS n FROM disciplines WHERE id=$1", [ids.discB])).rows[0].n).toBe(1);
  });

  it("lets admins see every institution of their database", async () => {
    const admin = await signIn(people.admin);
    const students = (await admin.get("/admin/students").expect(200)).body.map((row: { id: string }) => row.id);
    expect(students).toEqual(expect.arrayContaining([people.studentA, people.studentB]));
  });

  it("shows the admin where each feedback author belongs", async () => {
    await pool.query("INSERT INTO feedbacks(account_id,type,message) VALUES($1,'BUG','Erro A'),($2,'GERAL','Ideia do professor')", [people.studentA, people.professor]);
    const admin = await signIn(people.admin);
    const rows = (await admin.get("/feedback").expect(200)).body as Array<Record<string, unknown>>;
    expect(rows.find((row) => row.message === "Erro A")).toMatchObject({
      schoolId: ids.a, schoolName: "Instituição A", courseId: ids.courseA, courseName: "Curso A", classId: ids.classA, className: "Turma A",
    });
    expect(rows.find((row) => row.message === "Ideia do professor")).toMatchObject({ schoolId: ids.a, schoolName: "Instituição A", courseId: null, classId: null });
    await (await signIn(people.professor)).get("/feedback").expect(403);
  });
});
