import { randomUUID } from "crypto";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import request from "supertest";
import { app } from "../server";
import { closeDatabasePool, getDb } from "../db/client";
import { getAccountById } from "../db/repositories/authRepository";
import { createLoginSession, expireSessions, logoutSession, recordSessionActivity, validateSession } from "../services/auth/sessionLifecycleService";
import { getSummary } from "../services/analytics/analyticsService";
import { sessionPolicy } from "../config/session";

const url = process.env.SESSION_RECOVERY_TEST_DATABASE_URL;
const integration = url ? describe : describe.skip;

integration("persistent login, activity accounting and expiration on PostgreSQL", () => {
  let pool: Pool;
  let userId: string;
  let account: NonNullable<Awaited<ReturnType<typeof getAccountById>>>;
  const password = "SessionTest-NotARealAccount-2026";
  beforeAll(() => {
    if (!url!.includes("_usage_recovery_check_") || process.env.DATABASE_URL !== url)
      throw new Error("Both database URLs must point to the same isolated test database");
    pool = new Pool({ connectionString: url });
  });
  beforeEach(async () => {
    userId = randomUUID();
    await pool.query(`INSERT INTO accounts(id,name,email,password_hash) VALUES($1,'Session integration fixture',$2,$3)`, [userId, `${userId}@example.invalid`, await bcrypt.hash(password, 4)]);
    await pool.query(`INSERT INTO account_roles(account_id,role) VALUES($1,'student')`, [userId]);
    await pool.query(`INSERT INTO student_profiles(account_id,school_id,course_id,class_id,level)
      SELECT $1,school_id,course_id,class_id,'test' FROM student_profiles WHERE course_id='00000000-0000-4000-b000-000000000003' LIMIT 1`, [userId]);
    account = (await getAccountById(getDb(), userId))!;
  });
  afterEach(async () => { await pool.query("DELETE FROM accounts WHERE id=$1", [userId]); });
  afterAll(async () => { await pool.end(); await closeDatabasePool(); });
  const start = () => createLoginSession(getDb(), account);
  const read = async (sid: string) => (await pool.query(`SELECT h.*,s.session_duration,s.session_end,s.duration_source,a.total_usage_time
    FROM auth_sessions h LEFT JOIN analysis_sessions s ON s.id=h.analysis_session_id
    LEFT JOIN user_analyses a ON a.id=s.analysis_id WHERE h.id=$1`, [sid])).rows[0];
  const at = (session: Awaited<ReturnType<typeof start>>, seconds: number) => new Date(+new Date(session.serverNow) + seconds * 1000);
  const cookie = (sid: string) => `token=${jwt.sign({ id: userId, sid }, process.env.JWT_SECRET!, { subject: userId, expiresIn: 7200 })}`;

  it("creates an authenticated persistent session through the real login endpoint", async () => {
    const login = await request(app).post("/auth/session").send({ email: account.email, password });
    expect(login.status).toBe(200);
    expect(login.body.session.id).toMatch(/^[a-f0-9-]{36}$/);
    const me = await request(app).get("/auth/me").set("Cookie", login.headers["set-cookie"]);
    expect(me.status).toBe(200);
    expect(me.body.session.id).toBe(login.body.session.id);
  });

  it("shows checkpointed use in the dashboard before logout without increasing the closed-session accumulator", async () => {
    const session = await start();
    await recordSessionActivity(getDb(), session.id, userId, at(session, 30));
    const row = await read(session.id);
    expect(row.session_duration).toBe(30);
    expect(row.total_usage_time).toBe(0);
    expect(row.session_end).toBeNull();
    const summary = await getSummary({ universityId: account.schoolId!, studentId: userId });
    expect(summary.usageTimeInSeconds).toBe(30);
    expect(summary.observedUsageTimeInSeconds).toBe(30);
    expect(summary.ongoingSessionCount).toBe(1);
  });

  it("never fills a long inactive gap with active seconds", async () => {
    const session = await start();
    await recordSessionActivity(getDb(), session.id, userId, at(session, 30));
    await recordSessionActivity(getDb(), session.id, userId, at(session, 600));
    expect((await read(session.id)).session_duration).toBe(30);
    await recordSessionActivity(getDb(), session.id, userId, at(session, 630));
    expect((await read(session.id)).session_duration).toBe(60);
  });

  it("deduplicates parallel activity from multiple tabs and concurrent logout", async () => {
    const session = await start();
    await Promise.all(Array.from({ length: 8 }, () => recordSessionActivity(getDb(), session.id, userId, at(session, 30))));
    expect((await read(session.id)).session_duration).toBe(30);
    await Promise.all(Array.from({ length: 5 }, () => logoutSession(getDb(), session.id, userId)));
    expect((await read(session.id)).total_usage_time).toBe(30);
    expect((await read(session.id)).ended_at).not.toBeNull();
  });

  it("denies an expired session and commits closure even without a cron run", async () => {
    const session = await start();
    await recordSessionActivity(getDb(), session.id, userId, at(session, 30));
    await expect(validateSession(getDb(), session.id, userId, at(session, sessionPolicy().idleSeconds + 31))).rejects.toMatchObject({ statusCode: 401 });
    const row = await read(session.id);
    expect(row.end_reason).toBe("idle_timeout");
    expect(row.total_usage_time).toBe(30);
    await expect(recordSessionActivity(getDb(), session.id, userId)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("periodically closes abandoned sessions without double counting or adding idle tolerance", async () => {
    const session = await start();
    await recordSessionActivity(getDb(), session.id, userId, at(session, 30));
    const deadline = at(session, sessionPolicy().idleSeconds + 31);
    await Promise.all([expireSessions(getDb(), deadline), expireSessions(getDb(), deadline)]);
    await expireSessions(getDb(), deadline);
    const row = await read(session.id);
    expect(row.session_duration).toBe(30);
    expect(row.total_usage_time).toBe(30);
    expect(+row.ended_at).toBe(+at(session, sessionPolicy().idleSeconds + 30));
  });

  it("absolute expiration cannot be extended by activity", async () => {
    const session = await start();
    for (let seconds = 30; seconds < sessionPolicy().absoluteSeconds; seconds += 30)
      await recordSessionActivity(getDb(), session.id, userId, at(session, seconds));
    await expect(recordSessionActivity(getDb(), session.id, userId, at(session, sessionPolicy().absoluteSeconds))).rejects.toMatchObject({ statusCode: 401 });
    expect((await read(session.id)).end_reason).toBe("absolute_timeout");
  });

  it("serializes concurrent logins and revokes the old credential", async () => {
    const first = await start();
    const next = await Promise.all([start(), start(), start()]);
    expect((await pool.query("SELECT count(*)::int AS n FROM auth_sessions WHERE account_id=$1 AND ended_at IS NULL", [userId])).rows[0].n).toBe(1);
    expect((await request(app).get("/auth/me").set("Cookie", cookie(first.id))).status).toBe(401);
    const live = (await pool.query("SELECT id FROM auth_sessions WHERE account_id=$1 AND ended_at IS NULL", [userId])).rows[0].id;
    expect(next.some(row => row.id === live)).toBe(true);
    expect((await request(app).get("/auth/me").set("Cookie", cookie(live))).status).toBe(200);
  });

  it("requires a new login after idle expiry and rejects expired quiz submissions before any write", async () => {
    const session = await start();
    await pool.query("UPDATE auth_sessions SET idle_expires_at=now()-interval '1 second' WHERE id=$1", [session.id]);
    const before = (await pool.query("SELECT count(*)::int AS n FROM professor_quiz_attempts WHERE student_id=$1", [userId])).rows[0].n;
    const response = await request(app).post(`/quiz/student/${randomUUID()}/attempt`).set("Cookie", cookie(session.id)).send({ answers: {} });
    expect(response.status).toBe(401);
    expect((await pool.query("SELECT count(*)::int AS n FROM professor_quiz_attempts WHERE student_id=$1", [userId])).rows[0].n).toBe(before);
    expect((await read(session.id)).ended_at).not.toBeNull();
    const next = await start();
    expect((await request(app).get("/auth/me").set("Cookie", cookie(next.id))).status).toBe(200);
  });

  it("closes analytical time when a signed JWT has already expired", async () => {
    const session = await start();
    const expired = jwt.sign({ id: userId, sid: session.id }, process.env.JWT_SECRET!, { subject: userId, expiresIn: -1 });
    expect((await request(app).get("/auth/me").set("Cookie", `token=${expired}`)).status).toBe(401);
    expect((await read(session.id)).end_reason).toBe("absolute_timeout");
  });

  it("saves quiz answers and analytics atomically in the authenticated open session", async () => {
    const session = await start();
    const discipline = (await pool.query("SELECT discipline_id FROM class_disciplines WHERE class_id=$1 LIMIT 1", [account.classId])).rows[0].discipline_id;
    const quiz = (await pool.query("INSERT INTO professor_quizzes(professor_id,discipline_id,title,topic,status) VALUES($1,$2,'Session test','variaveis','published') RETURNING id", [userId, discipline])).rows[0].id;
    const question = (await pool.query(`INSERT INTO professor_quiz_questions(quiz_id,question,options,correct_option) VALUES($1,'Fixture question','["One","Two","Three","Four"]','A') RETURNING id`, [quiz])).rows[0].id;
    await pool.query("UPDATE accounts SET email=$2 WHERE id=$1", [userId, `changed-${userId}@example.invalid`]);
    const response = await request(app).post(`/quiz/student/${quiz}/attempt`).set("Cookie", cookie(session.id)).send({ answers: { [question]: "A" } });
    expect(response.status).toBe(200);
    const row = (await pool.query(`SELECT s.total_correct_answers,
      (SELECT count(*)::int FROM answer_attempts p JOIN answer_questions q ON q.attempt_id=p.id WHERE p.session_id=s.id) AS analytics_answers,
      (SELECT count(*)::int FROM professor_quiz_attempts p JOIN professor_quiz_answers q ON q.attempt_id=p.id WHERE p.student_id=$1) AS quiz_answers
      FROM analysis_sessions s JOIN auth_sessions h ON h.analysis_session_id=s.id WHERE h.id=$2`, [userId, session.id])).rows[0];
    expect(row).toMatchObject({ total_correct_answers: 1, analytics_answers: 1, quiz_answers: 1 });
  });

  it("rejects legacy tokens without a persistent session id", async () => {
    const token = jwt.sign({ id: userId }, process.env.JWT_SECRET!, { subject: userId, expiresIn: 7200 });
    expect((await request(app).get("/auth/me").set("Cookie", `token=${token}`)).status).toBe(401);
  });

  it("rejects negative durations and an end one microsecond before the start at database level", async () => {
    const session = await start();
    const id = (await read(session.id)).analysis_session_id;
    await expect(pool.query("UPDATE analysis_sessions SET session_end=session_start-interval '1 microsecond' WHERE id=$1", [id])).rejects.toMatchObject({ code: "23514" });
    await expect(pool.query("UPDATE analysis_sessions SET session_duration=-1 WHERE id=$1", [id])).rejects.toMatchObject({ code: "23514" });
  });
});
