import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema";
import { closeAnalysisSession } from "../db/repositories/studentSessionRepository";

const url = process.env.SESSION_RECOVERY_TEST_DATABASE_URL;
const integration = url ? describe : describe.skip;

integration("session timing against an isolated restored database", () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let analysis: { id: string; total_usage_time: number };
  let ids: string[] = [];
  const end = new Date();
  beforeAll(() => {
    if (!new URL(url!).pathname.includes("_usage_recovery_check_")) throw new Error("An isolated usage_recovery_check database is required");
    pool = new Pool({ connectionString: url });
    db = drizzle(pool, { schema });
  });
  beforeEach(async () => {
    analysis = (await pool.query(`SELECT a.id,a.total_usage_time FROM user_analyses a WHERE NOT EXISTS(SELECT 1 FROM analysis_sessions s WHERE s.analysis_id=a.id AND s.session_end IS NULL) ORDER BY a.id LIMIT 1`)).rows[0];
    expect(analysis).toBeDefined();
    ids = [];
  });
  afterEach(async () => {
    await pool.query("DELETE FROM analysis_sessions WHERE id=ANY($1::uuid[])", [ids]);
    await pool.query("UPDATE user_analyses SET total_usage_time=$1 WHERE id=$2", [analysis.total_usage_time, analysis.id]);
  });
  afterAll(async () => { await pool?.end(); });
  const insert = async (start: Date, activity: Date) => {
    const id = (await pool.query("INSERT INTO analysis_sessions(analysis_id,session_start,last_activity_at) VALUES($1,$2,$3) RETURNING id", [analysis.id, start, activity])).rows[0].id;
    ids.push(id);
    return id;
  };
  const read = async (id: string) => (await pool.query("SELECT * FROM analysis_sessions WHERE id=$1", [id])).rows[0];

  it("caps an abandoned session at its last activity instead of counting days offline", async () => {
    const activity = new Date(+end - 48 * 3600000);
    const id = await insert(new Date(+activity - 1800000), activity);
    await closeAnalysisSession(db, analysis.id, end);
    const row = await read(id);
    expect(row.session_duration).toBe(1800);
    expect(row.duration_source).toBe("estimated");
    expect(+row.session_end).toBe(+activity);
    expect(+row.last_activity_at).toBe(+activity);
  });
  it("does not count concurrent logout calls twice", async () => {
    const id = await insert(new Date(+end - 600000), new Date(+end - 120000));
    await Promise.all([closeAnalysisSession(db, analysis.id, end), closeAnalysisSession(db, analysis.id, end)]);
    expect((await read(id)).session_duration).toBe(600);
    expect((await pool.query("SELECT total_usage_time FROM user_analyses WHERE id=$1", [analysis.id])).rows[0].total_usage_time).toBe(analysis.total_usage_time + 600);
  });
  it("preserves an ordinary recent logout as recorded time", async () => {
    const id = await insert(new Date(+end - 600000), new Date(+end - 120000));
    await closeAnalysisSession(db, analysis.id, end);
    expect((await read(id)).duration_source).toBe("recorded");
  });
  it("does not manufacture positive time without any activity evidence", async () => {
    const start = new Date(+end - 72 * 3600000);
    const id = await insert(start, start);
    await closeAnalysisSession(db, analysis.id, end);
    const row = await read(id);
    expect(row.session_duration).toBe(0);
    expect(row.duration_source).toBe("unavailable");
    expect(+row.session_end).toBe(+start);
  });
});
