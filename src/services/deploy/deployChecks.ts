import { readFileSync } from "fs";
import path from "path";
import { and, eq, inArray, like, sql } from "drizzle-orm";
import type { AnyDbClient } from "../../db/client";
import { accountRoles, accounts, universities } from "../../db/schema";
import { ownerEmails, sandboxEmail, SANDBOX_EMAIL_DOMAIN } from "../sandbox/sandboxConfig";

/**
 * Checks before a deploy and the cleanup of old load-test data. Everything here only reads,
 * except `cleanupLegacyData` with `apply: true`, which runs in a single transaction.
 */
export type CheckStatus = "ok" | "warn" | "fail";
export interface CheckResult { status: CheckStatus; name: string; detail: string }

/** Accounts and institution left by the old load tests (k6) and the old fixed-password admin. */
export const LEGACY_EMAILS = [
  "k6-context@logibot.com",
  "k6-none@logibot.com",
  "k6-self@logibot.com",
  "professor.teste-carga@logibot.com",
  "admin@logibot.com",
];
export const LEGACY_INSTITUTION = { id: "00000000-0000-4000-a000-000000000001", name: "Escola de Testes de Carga" };

/** Host, port and database name: two different URL strings may still point at the same database. */
export function databaseIdentity(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase() === "127.0.0.1" ? "localhost" : parsed.hostname.toLowerCase();
    return `${host}:${parsed.port || "5432"}/${decodeURIComponent(parsed.pathname.replace(/^\//, ""))}`;
  } catch {
    return null;
  }
}

/** Configuration checks that need no database. */
export function checkEnvironment(env: NodeJS.ProcessEnv = process.env): CheckResult[] {
  const results: CheckResult[] = [];
  const add = (status: CheckStatus, name: string, detail: string) => results.push({ status, name, detail });

  if (!env.DATABASE_URL) add("fail", "DATABASE_URL", "Not set.");
  else if (!databaseIdentity(env.DATABASE_URL)) add("fail", "DATABASE_URL", "Not a valid URL.");
  else add("ok", "DATABASE_URL", databaseIdentity(env.DATABASE_URL)!);

  const secret = env.JWT_SECRET || "";
  if (!secret) add("fail", "JWT_SECRET", "Not set.");
  else if (secret.length < 32) add("warn", "JWT_SECRET", "Shorter than 32 characters.");
  else add("ok", "JWT_SECRET", "Set.");

  const sandboxUrl = env.SANDBOX_DATABASE_URL;
  if (!sandboxUrl) {
    add("warn", "SANDBOX_DATABASE_URL", "Not set: the test environment stays off.");
  } else {
    const main = env.DATABASE_URL ? databaseIdentity(env.DATABASE_URL) : null;
    const sandbox = databaseIdentity(sandboxUrl);
    if (!sandbox) add("fail", "SANDBOX_DATABASE_URL", "Not a valid URL.");
    else if (sandbox === main) add("fail", "SANDBOX_DATABASE_URL", "Points at the main database: test data would mix with real data.");
    else add("ok", "SANDBOX_DATABASE_URL", sandbox);

    const password = env.SANDBOX_PASSWORD || "";
    if (password.length < 12) add("fail", "SANDBOX_PASSWORD", "Needs at least 12 characters.");
    else add("ok", "SANDBOX_PASSWORD", "Set.");
  }

  if (!env.OWNER_EMAILS) add("warn", "OWNER_EMAILS", `Not set: the default ${ownerEmails()[0]} is used.`);
  else add("ok", "OWNER_EMAILS", `${ownerEmails().length} owner e-mail(s).`);

  return results;
}

/** Number of migrations in the journal shipped with the build. */
export function expectedMigrationCount(folder = path.resolve(process.cwd(), "drizzle")): number {
  const journal = JSON.parse(readFileSync(path.join(folder, "meta", "_journal.json"), "utf8")) as { entries: unknown[] };
  return journal.entries.length;
}

export async function appliedMigrationCount(db: AnyDbClient): Promise<number> {
  try {
    const result = await db.execute(sql`SELECT count(*)::int AS total FROM drizzle.__drizzle_migrations`);
    return Number((result.rows[0] as { total: number }).total);
  } catch {
    return 0;
  }
}

/** Checks of the main database: migrations, owner account, leftovers and test accounts that do not belong there. */
export async function checkMainDatabase(db: AnyDbClient, expectedMigrations: number): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const applied = await appliedMigrationCount(db);
  results.push(applied >= expectedMigrations
    ? { status: "ok", name: "Migrations (main)", detail: `${applied} applied.` }
    : { status: "fail", name: "Migrations (main)", detail: `${applied} of ${expectedMigrations} applied: run node dist/db/migrate.js.` });

  const owners = await db
    .select({ email: accounts.email, status: accounts.status })
    .from(accounts)
    .innerJoin(accountRoles, and(eq(accountRoles.accountId, accounts.id), eq(accountRoles.role, "admin")))
    .where(inArray(accounts.email, ownerEmails()));
  const active = owners.filter((owner) => owner.status === "active");
  results.push(active.length
    ? { status: "ok", name: "Owner account", detail: `${active.length} active owner admin(s).` }
    : { status: "fail", name: "Owner account", detail: "No active owner admin: run node dist/db/createOwner.js before the deploy." });

  const legacy = await legacyCounts(db);
  results.push(legacy.accounts + legacy.institution === 0
    ? { status: "ok", name: "Old load-test data", detail: "None found." }
    : { status: "warn", name: "Old load-test data", detail: `${legacy.accounts} account(s) and ${legacy.institution} institution: back up, then run node dist/db/cleanupLegacy.js.` });

  const [{ total: testAccounts }] = await db.select({ total: sql<number>`count(*)::int` }).from(accounts).where(like(accounts.email, `%@${SANDBOX_EMAIL_DOMAIN}`));
  results.push(Number(testAccounts) === 0
    ? { status: "ok", name: "Test accounts in main database", detail: "None." }
    : { status: "warn", name: "Test accounts in main database", detail: `${testAccounts} @${SANDBOX_EMAIL_DOMAIN} account(s) should live only in the test database.` });
  return results;
}

/** Checks of the test database: same migrations, accounts created. */
export async function checkSandboxDatabase(db: AnyDbClient, expectedMigrations: number): Promise<CheckResult[]> {
  const applied = await appliedMigrationCount(db);
  const [admin] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.email, sandboxEmail("adm"))).limit(1);
  return [
    applied >= expectedMigrations
      ? { status: "ok", name: "Migrations (test)", detail: `${applied} applied.` }
      : { status: "fail", name: "Migrations (test)", detail: `${applied} of ${expectedMigrations} applied: run node dist/db/migrate.js.` },
    admin
      ? { status: "ok", name: "Test accounts", detail: "Created." }
      : { status: "warn", name: "Test accounts", detail: "Missing: run node dist/db/seedSandbox.js." },
  ];
}

export async function legacyCounts(db: AnyDbClient) {
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(accounts).where(inArray(accounts.email, LEGACY_EMAILS));
  const [{ total: institution }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(universities)
    .where(and(eq(universities.id, LEGACY_INSTITUTION.id), eq(universities.name, LEGACY_INSTITUTION.name)));
  return { accounts: Number(total), institution: Number(institution) };
}

export interface CleanupReport { accounts: number; institution: number; recoveries: number; applied: boolean }

/**
 * Removes the old load-test accounts and institution. Dry run unless `apply` is true; refuses to run
 * when no active owner admin exists, so the platform never loses its administrative access.
 */
export async function cleanupLegacyData(db: AnyDbClient, { apply }: { apply: boolean }): Promise<CleanupReport> {
  const owners = await checkMainDatabase(db, 0);
  if (owners.find((check) => check.name === "Owner account")?.status !== "ok") {
    throw new Error("No active owner admin: create it (node dist/db/createOwner.js) before removing admin@logibot.com.");
  }
  const counts = await legacyCounts(db);
  const recoveries = await db.execute(sql`
    SELECT count(*)::int AS total FROM analysis_session_recoveries r
    JOIN analysis_sessions s ON s.id = r.session_id
    JOIN user_analyses u ON u.id = s.analysis_id
    JOIN accounts a ON a.id = u.user_id
    WHERE a.email IN (${sql.join(LEGACY_EMAILS.map((email) => sql`${email}`), sql`, `)})`);
  const report: CleanupReport = { ...counts, recoveries: Number((recoveries.rows[0] as { total: number }).total), applied: false };
  if (!apply) return report;

  await db.transaction(async (tx) => {
    await tx.execute(sql`
      DELETE FROM analysis_session_recoveries r USING analysis_sessions s, user_analyses u, accounts a
      WHERE s.id = r.session_id AND u.id = s.analysis_id AND a.id = u.user_id
      AND a.email IN (${sql.join(LEGACY_EMAILS.map((email) => sql`${email}`), sql`, `)})`);
    await tx.delete(accounts).where(inArray(accounts.email, LEGACY_EMAILS));
    await tx.delete(universities).where(and(eq(universities.id, LEGACY_INSTITUTION.id), eq(universities.name, LEGACY_INSTITUTION.name)));
  });
  return { ...report, applied: true };
}
