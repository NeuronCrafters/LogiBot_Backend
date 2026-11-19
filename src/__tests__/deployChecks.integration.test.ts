import { randomUUID } from "crypto";
import { Pool } from "pg";
import { closeDatabasePool, getDb } from "../db/client";
import { checkMainDatabase, cleanupLegacyData, LEGACY_INSTITUTION } from "../services/deploy/deployChecks";

const url = process.env.DEPLOY_TEST_DATABASE_URL;
const integration = url ? describe : describe.skip;

integration("pre-deploy checks and old data cleanup on PostgreSQL", () => {
  let pool: Pool;
  const owner = randomUUID(), real = randomUUID(), k6 = randomUUID(), oldAdmin = randomUUID(), realSchool = randomUUID();
  const statusOf = async (name: string) => (await checkMainDatabase(getDb(), 0)).find((check) => check.name === name)?.status;

  beforeAll(async () => {
    if (!url!.includes("_deploy_test") || process.env.DATABASE_URL !== url)
      throw new Error("Both database URLs must point to the same isolated deploy test database");
    pool = new Pool({ connectionString: url });
    const q = (text: string, values: unknown[]) => pool.query(text, values);
    await q("INSERT INTO accounts(id,name,email,status) VALUES($1,'Real','real@example.invalid','active'),($2,'k6','k6-self@logibot.com','active'),($3,'Old','admin@logibot.com','active')", [real, k6, oldAdmin]);
    await q("INSERT INTO account_roles(account_id,role) VALUES($1,'student'),($2,'student'),($3,'admin')", [real, k6, oldAdmin]);
    await q("INSERT INTO universities(id,name) VALUES($1,$2),($3,'Instituição real')", [LEGACY_INSTITUTION.id, LEGACY_INSTITUTION.name, realSchool]);
  });

  afterAll(async () => {
    await pool.query("DELETE FROM accounts WHERE id = ANY($1)", [[owner, real, k6, oldAdmin]]);
    await pool.query("DELETE FROM universities WHERE id = ANY($1)", [[LEGACY_INSTITUTION.id, realSchool]]);
    await pool.end();
    await closeDatabasePool();
  });

  it("refuses to clean while there is no owner, so admin access is never lost", async () => {
    expect(await statusOf("Owner account")).toBe("fail");
    await expect(cleanupLegacyData(getDb(), { apply: true })).rejects.toThrow(/owner/);
    expect((await pool.query("SELECT count(*)::int AS n FROM accounts WHERE email='admin@logibot.com'")).rows[0].n).toBe(1);
  });

  it("shows the leftovers in a dry run and removes only them when applied", async () => {
    await pool.query("INSERT INTO accounts(id,name,email,status) VALUES($1,'Owner','owner@logibots.com','active')", [owner]);
    await pool.query("INSERT INTO account_roles(account_id,role) VALUES($1,'admin')", [owner]);
    expect(await statusOf("Owner account")).toBe("ok");
    expect(await statusOf("Old load-test data")).toBe("warn");

    expect(await cleanupLegacyData(getDb(), { apply: false })).toEqual({ accounts: 2, institution: 1, recoveries: 0, applied: false });
    expect((await pool.query("SELECT count(*)::int AS n FROM accounts WHERE id = ANY($1)", [[k6, oldAdmin]])).rows[0].n).toBe(2);

    expect(await cleanupLegacyData(getDb(), { apply: true })).toMatchObject({ applied: true });
    expect((await pool.query("SELECT count(*)::int AS n FROM accounts WHERE id = ANY($1)", [[k6, oldAdmin]])).rows[0].n).toBe(0);
    expect((await pool.query("SELECT count(*)::int AS n FROM accounts WHERE id = ANY($1)", [[real, owner]])).rows[0].n).toBe(2);
    expect((await pool.query("SELECT name FROM universities WHERE id = ANY($1)", [[LEGACY_INSTITUTION.id, realSchool]])).rows).toEqual([{ name: "Instituição real" }]);
    expect(await statusOf("Old load-test data")).toBe("ok");
  });
});
