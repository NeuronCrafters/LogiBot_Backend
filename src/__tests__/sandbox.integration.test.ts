import { Pool } from "pg";
import jwt from "jsonwebtoken";
import request from "supertest";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const url = process.env.SANDBOX_ENV_TEST_DATABASE_URL;
const integration = url ? describe : describe.skip;

integration("test environment in a separate database", () => {
  const sandboxUrl = url ? url.replace(/\/([^/]+)$/, "/$1_sandbox") : "";
  let main: Pool;
  let sandbox: Pool;
  // Loaded after the environment variables are set.
  let app: import("express").Express;
  let client: typeof import("../db/client");
  let seed: typeof import("../services/sandbox/sandboxSeed");
  let mail: typeof import("../services/email/mailService");

  beforeAll(async () => {
    if (!url!.includes("_sandbox_env_test") || process.env.DATABASE_URL !== url)
      throw new Error("Both database URLs must point to the same isolated sandbox test database");
    main = new Pool({ connectionString: url });
    await main.query(`DROP DATABASE IF EXISTS "${sandboxUrl.split("/").pop()}"`);
    await main.query(`CREATE DATABASE "${sandboxUrl.split("/").pop()}"`);
    process.env.SANDBOX_DATABASE_URL = sandboxUrl;
    process.env.SANDBOX_PASSWORD = "senha-de-teste-123";
    process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-secret";
    delete process.env.API_KEY;
    client = await import("../db/client");
    seed = await import("../services/sandbox/sandboxSeed");
    mail = await import("../services/email/mailService");
    app = (await import("../server")).app;
    await client.runInEnvironment("sandbox", () => migrate(client.getDb(), { migrationsFolder: "./drizzle" }));
    sandbox = new Pool({ connectionString: sandboxUrl });
  });

  afterAll(async () => {
    await sandbox.end();
    await client.closeDatabasePool();
    await main.query(`DROP DATABASE IF EXISTS "${sandboxUrl.split("/").pop()}" WITH (FORCE)`);
    await main.end();
  });

  const count = async (pool: Pool, sql: string) => Number((await pool.query(sql)).rows[0].n);

  it("creates the test structure only in the test database", async () => {
    const before = await count(main, "SELECT count(*) AS n FROM accounts");
    expect(await client.runInEnvironment("sandbox", () => seed.seedSandbox(client.getDb(), "senha-de-teste-123"))).toBe(true);
    expect(await count(sandbox, "SELECT count(*) AS n FROM accounts WHERE email LIKE '%@dev.sael.com'")).toBe(35);
    expect(await count(sandbox, "SELECT count(*) AS n FROM universities")).toBe(2);
    expect(await count(sandbox, "SELECT count(*) AS n FROM classes")).toBe(8);
    expect(await count(sandbox, "SELECT count(*) AS n FROM student_profiles")).toBe(30);
    expect(await count(main, "SELECT count(*) AS n FROM accounts")).toBe(before);
    expect(await client.runInEnvironment("sandbox", () => seed.seedSandbox(client.getDb(), "x"))).toBe(false);
  });

  it("signs test accounts in to the test database and keeps the environment in the session", async () => {
    const agent = request.agent(app);
    const login = await agent.post("/auth/session").send({ email: "aluno0@dev.sael.com", password: "senha-de-teste-123" }).expect(200);
    const token = /token=([^;]+)/.exec(String(login.headers["set-cookie"]))![1];
    expect((jwt.decode(token) as jwt.JwtPayload).env).toBe("sandbox");
    const me = await agent.get("/auth/me").expect(200);
    expect(me.body).toMatchObject({ email: "aluno0@dev.sael.com", environment: "sandbox", isOwner: false });
    expect(await count(sandbox, "SELECT count(*) AS n FROM auth_sessions")).toBeGreaterThan(0);
    expect(await count(main, "SELECT count(*) AS n FROM auth_sessions s JOIN accounts a ON a.id = s.account_id WHERE a.email LIKE '%@dev.sael.com'")).toBe(0);
  });

  it("refuses test e-mails on sign-up and in the main database", async () => {
    await request(app).post("/auth/register").send({ name: "Teste", email: "novo@dev.sael.com", password: "senha-de-teste-123", confirmPassword: "senha-de-teste-123", code: "X" }).expect(403);
    await request(app).post("/auth/session").send({ email: "naoexiste@example.invalid", password: "senha-de-teste-123" }).expect(401);
  });

  it("never sends e-mails from the test environment", async () => {
    await client.runInEnvironment("sandbox", () => mail.sendMail({ to: "aluno1@dev.sael.com", subject: "Teste", text: "x", html: "x" }));
    expect(mail.suppressedMails[0]).toMatchObject({ to: "aluno1@dev.sael.com", subject: "Teste" });
  });

  it("fills the test database with activity of the chosen period, and nothing for zero", async () => {
    const empty = await seed.resetSandbox(0);
    expect(empty).toMatchObject({ sessions: 0, answers: 0, quizzes: 0 });
    expect(await count(sandbox, "SELECT count(*) AS n FROM analysis_sessions")).toBe(0);
    const week = await seed.resetSandbox(7);
    expect(week.sessions).toBeGreaterThan(0);
    expect(await count(sandbox, "SELECT count(*) AS n FROM analysis_sessions WHERE session_start < now() - interval '8 days'")).toBe(0);
    const started = Date.now();
    const year = await seed.resetSandbox(365);
    // eslint-disable-next-line no-console
    console.log("one year of test data generated in", Date.now() - started, "ms", year);
    expect(year.sessions).toBeGreaterThan(week.sessions * 10);
    expect(await count(sandbox, "SELECT count(*) AS n FROM analysis_sessions WHERE session_start < now() - interval '200 days'")).toBeGreaterThan(0);
    expect(year.quizAttempts).toBeGreaterThan(0);
    // Same period, same data: problems can be reproduced.
    const again = await seed.resetSandbox(365);
    expect(again).toEqual(year);
    await expect(seed.resetSandbox(10)).rejects.toMatchObject({ statusCode: 400 });
    // The dashboard reads it: one institution, its topics and a learning journey.
    const dashboard = await import("../services/dashboard/dashboardService");
    const [institution] = (await sandbox.query("SELECT id FROM universities ORDER BY name LIMIT 1")).rows;
    const topics = await client.runInEnvironment("sandbox", () => dashboard.getTopicPerformance({ universityId: institution.id }));
    expect(topics.length).toBeGreaterThan(2);
    expect(await count(main, "SELECT count(*) AS n FROM analysis_sessions s JOIN user_analyses u ON u.id = s.analysis_id WHERE u.email LIKE '%@dev.sael.com'")).toBe(0);
  }, 120000);

  it("fills every part of the platform: chat ratings, feedback, bank, workbench, exams, notifications", async () => {
    const result = await seed.resetSandbox(30);
    expect(result).toMatchObject({ questions: 12, exams: 4 });
    expect(result.flashcardReviews).toBeGreaterThan(0);
    expect(result.hints).toBeGreaterThan(0);
    const ratings = (await sandbox.query("SELECT rating, count(*)::int AS n, count(comment)::int AS comments, count(reason)::int AS reasons FROM chat_message_feedback GROUP BY rating")).rows;
    expect(ratings.map((row) => row.rating).sort()).toEqual(["down", "partial", "up"]);
    expect(ratings.filter((row) => row.rating !== "up").every((row) => row.comments > 0 && row.reasons > 0)).toBe(true);
    expect(await count(sandbox, "SELECT count(*) AS n FROM chat_messages WHERE role='assistant'")).toBeGreaterThan(30);
    expect(await count(sandbox, "SELECT count(DISTINCT type) AS n FROM feedbacks")).toBe(4);
    expect(await count(sandbox, "SELECT count(*) AS n FROM assessment_questions WHERE practice_enabled")).toBe(8);
    // A large truth table (6 propositions) asked with the final column only.
    expect(await count(sandbox, "SELECT count(*) AS n FROM assessment_questions WHERE type='truth_table' AND content->>'columns' = 'final'")).toBe(2);
    // Hints on wrong answers only, each one tied to its attempt.
    expect(await count(sandbox, "SELECT count(*) AS n FROM exercise_hints h JOIN exercise_attempts a ON a.id = h.attempt_id WHERE a.is_correct")).toBe(0);
    expect(await count(sandbox, "SELECT count(DISTINCT level) AS n FROM exercise_hints")).toBe(2);
    expect(await count(sandbox, "SELECT count(DISTINCT exercise_type) AS n FROM exercise_attempts WHERE mode='practice'")).toBe(3);
    expect(await count(sandbox, "SELECT count(DISTINCT is_correct::text) AS n FROM exercise_attempts WHERE mode='practice'")).toBe(2);
    expect(await count(sandbox, "SELECT count(*) AS n FROM exams WHERE status='released'")).toBe(2);
    // Both institutions: their own bank and exams, flash card decks with progress, and a full profile.
    expect(await count(sandbox, "SELECT count(DISTINCT q.owner_id) AS n FROM assessment_questions q")).toBe(2);
    expect(await count(sandbox, "SELECT count(*) AS n FROM flashcard_decks WHERE published")).toBe(8);
    expect(await count(sandbox, "SELECT count(*) AS n FROM flashcard_decks WHERE NOT published")).toBe(1);
    expect(await count(sandbox, "SELECT count(DISTINCT box) AS n FROM flashcard_reviews")).toBe(5);
    expect(await count(sandbox, "SELECT count(*) AS n FROM institution_profiles WHERE latitude IS NOT NULL AND address IS NOT NULL AND jsonb_array_length(links) > 0")).toBe(2);
    expect(await count(sandbox, "SELECT count(*) AS n FROM exam_submissions WHERE grade IS NOT NULL")).toBeGreaterThan(5);
    expect(await count(sandbox, "SELECT count(*) AS n FROM blind_reviews WHERE score IS NULL")).toBe(0);
    expect(await count(sandbox, "SELECT count(*) AS n FROM notifications")).toBeGreaterThan(30);
    // None of it reaches the main database.
    expect(await count(main, "SELECT count(*) AS n FROM chat_message_feedback f JOIN accounts a ON a.id = f.account_id WHERE a.email LIKE '%@dev.sael.com'")).toBe(0);
  }, 120000);

  it("applies the owner's platform-wide switches in the test environment too, for every profile", async () => {
    await main.query("INSERT INTO feature_rules(feature, scope, scope_id, enabled) VALUES('practice_parsons', 'global', '', false)");
    try {
      for (const email of ["adm@dev.sael.com", "professor@dev.sael.com"]) {
        const agent = request.agent(app);
        await agent.post("/auth/session").send({ email, password: "senha-de-teste-123" }).expect(200);
        expect((await agent.get("/features/me").expect(200)).body.features.practice_parsons).toBe(false);
        // The bank of the test environment has algorithm questions, but none is listed or can be created.
        const listed = (await agent.get("/questions").expect(200)).body as Array<{ type: string }>;
        expect(listed.length).toBeGreaterThan(0);
        expect(listed.filter((item) => item.type === "parsons")).toEqual([]);
        await agent.post("/questions").send({ type: "parsons" }).expect(403);
      }
      const parsons = await count(sandbox, "SELECT count(*) AS n FROM assessment_questions WHERE type = 'parsons'");
      expect(parsons).toBeGreaterThan(0);
    } finally {
      await main.query("DELETE FROM feature_rules WHERE feature = 'practice_parsons'");
    }
  });

  it("resets only the test database", async () => {
    await sandbox.query("UPDATE accounts SET name='Alterado' WHERE email='aluno0@dev.sael.com'");
    const before = await count(main, "SELECT count(*) AS n FROM accounts");
    expect(await seed.resetSandbox()).toMatchObject({ accounts: 35, institutions: 2, sessions: 0 });
    expect((await sandbox.query("SELECT name FROM accounts WHERE email='aluno0@dev.sael.com'")).rows[0].name).toBe("Aluno 0 (teste)");
    expect(await count(main, "SELECT count(*) AS n FROM accounts")).toBe(before);
  });
});
