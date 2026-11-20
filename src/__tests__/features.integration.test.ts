import { randomUUID } from "crypto";
import { Pool } from "pg";
import { closeDatabasePool, getDb } from "../db/client";
import { clearRule, featureEnabledForAccount, featuresFor, platformFeatures, setRule } from "../services/features/featureService";

const url = process.env.FEATURES_TEST_DATABASE_URL;
const integration = url ? describe : describe.skip;
type FeatureUser = Parameters<typeof featuresFor>[1];

integration("feature release on PostgreSQL", () => {
  let pool: Pool;
  const ids = { uni: randomUUID(), other: randomUUID(), course: randomUUID(), course2: randomUUID(), classA: randomUUID(), classB: randomUUID(), admin: randomUUID() };
  const user = (patch: Partial<FeatureUser>): FeatureUser => ({ id: randomUUID(), name: "x", email: "x@example.invalid", role: ["student"], school: ids.uni, courses: ids.course, classes: ids.classA, disciplines: [], ...patch });
  const errorOf = async (run: () => Promise<unknown>) => { try { await run(); } catch (error) { return error; } return undefined; };

  beforeAll(async () => {
    if (!url!.includes("_features_test") || process.env.DATABASE_URL !== url)
      throw new Error("Both database URLs must point to the same isolated features test database");
    pool = new Pool({ connectionString: url });
    const q = (text: string, values: unknown[]) => pool.query(text, values);
    await q("INSERT INTO universities(id,name) VALUES($1,'U'),($2,'Outra')", [ids.uni, ids.other]);
    await q("INSERT INTO courses(id,name,university_id) VALUES($1,'C',$3),($2,'C2',$3)", [ids.course, ids.course2, ids.uni]);
    await q("INSERT INTO classes(id,name,course_id,registration_code) VALUES($1,'A',$3,$4),($2,'B',$3,$5)", [ids.classA, ids.classB, ids.course, `A-${ids.classA}`, `B-${ids.classB}`]);
    await q("INSERT INTO accounts(id,name,email) VALUES($1,'Admin',$2)", [ids.admin, `${ids.admin}@example.invalid`]);
  });

  afterAll(async () => {
    await pool.query("DELETE FROM feature_rules");
    await pool.query("DELETE FROM universities WHERE id = ANY($1)", [[ids.uni, ids.other]]);
    await pool.query("DELETE FROM accounts WHERE id=$1", [ids.admin]);
    await pool.end();
    await closeDatabasePool();
  });

  it("releases everything without rules", async () => {
    expect(Object.values(await featuresFor(getDb(), user({})))).toEqual(expect.not.arrayContaining([false]));
  });

  it("applies institution, course and class rules from the most specific", async () => {
    await setRule(getDb(), ids.admin, { feature: "exams", scope: "institution", scopeId: ids.uni, enabled: false });
    expect((await featuresFor(getDb(), user({}))).exams).toBe(false);
    expect((await featuresFor(getDb(), user({ school: ids.other, courses: null, classes: null }))).exams).toBe(true);
    await setRule(getDb(), ids.admin, { feature: "exams", scope: "class", scopeId: ids.classA, enabled: true });
    expect((await featuresFor(getDb(), user({}))).exams).toBe(true);
    expect((await featuresFor(getDb(), user({ classes: ids.classB }))).exams).toBe(false);
    await clearRule(getDb(), { feature: "exams", scope: "class", scopeId: ids.classA });
    expect((await featuresFor(getDb(), user({}))).exams).toBe(false);
  });

  it("releases for professors when any of their classes or courses has it; admins follow the rules too", async () => {
    await setRule(getDb(), ids.admin, { feature: "chat", scope: "global", enabled: false });
    await setRule(getDb(), ids.admin, { feature: "chat", scope: "course", scopeId: ids.course2, enabled: true });
    const professor = user({ role: ["professor"], courses: [ids.course, ids.course2], classes: [ids.classA] });
    expect((await featuresFor(getDb(), professor)).chat).toBe(true);
    expect((await featuresFor(getDb(), user({}))).chat).toBe(false);
    expect((await featuresFor(getDb(), user({ role: ["admin"] }))).chat).toBe(false);
  });

  it("tells the public pages only what is turned off for the whole platform", async () => {
    await setRule(getDb(), ids.admin, { feature: "practice_translation", scope: "global", enabled: false });
    await setRule(getDb(), ids.admin, { feature: "quiz", scope: "institution", scopeId: ids.uni, enabled: false });
    const platform = await platformFeatures(getDb());
    expect(platform.practice_translation).toBe(false);
    expect(platform.quiz).toBe(true); // an institution's own rule is not revealed
    await clearRule(getDb(), { feature: "practice_translation", scope: "global" });
    await clearRule(getDb(), { feature: "quiz", scope: "institution", scopeId: ids.uni });
  });

  it("validates the rule target", async () => {
    expect(await errorOf(() => setRule(getDb(), ids.admin, { feature: "nope", scope: "global", enabled: true }))).toMatchObject({ statusCode: 400 });
    expect(await errorOf(() => setRule(getDb(), ids.admin, { feature: "chat", scope: "class", scopeId: randomUUID(), enabled: true }))).toMatchObject({ statusCode: 404 });
    expect(await errorOf(() => setRule(getDb(), ids.admin, { feature: "chat", scope: "global", enabled: "yes" }))).toMatchObject({ statusCode: 400 });
    const updated = await setRule(getDb(), ids.admin, { feature: "chat", scope: "global", enabled: true });
    expect(updated).toMatchObject({ enabled: true, scopeId: "" });
    expect((await pool.query("SELECT count(*)::int AS n FROM feature_rules WHERE feature='chat' AND scope='global'")).rows[0].n).toBe(1);
  });

  it("resolves the features of another account (notification e-mails)", async () => {
    const student = randomUUID();
    await pool.query("INSERT INTO accounts(id,name,email) VALUES($1,'Aluno',$2)", [student, `${student}@example.invalid`]);
    await pool.query("INSERT INTO account_roles(account_id,role) VALUES($1,'student')", [student]);
    await pool.query("INSERT INTO student_profiles(account_id,school_id,course_id,class_id) VALUES($1,$2,$3,$4)", [student, ids.uni, ids.course, ids.classB]);
    expect(await featureEnabledForAccount(getDb(), student, "notifications_email")).toBe(true);
    await setRule(getDb(), ids.admin, { feature: "notifications_email", scope: "course", scopeId: ids.course, enabled: false });
    expect(await featureEnabledForAccount(getDb(), student, "notifications_email")).toBe(false);
    expect((await featuresFor(getDb(), user({}))).notifications).toBe(true);
    await pool.query("DELETE FROM accounts WHERE id=$1", [student]);
  });
});
