import "dotenv/config";
import { closeDatabasePool, getDb, isSandboxConfigured, runInEnvironment } from "./client";
import { checkEnvironment, checkExternalServices, checkImageStorage, checkMainDatabase, checkSandboxDatabase, expectedMigrationCount, type CheckResult } from "../services/deploy/deployChecks";

/**
 * Pre-deploy check: run on the server with the production variables (node dist/db/checkDeploy.js).
 * Only reads. Exits with 1 when something must be fixed before going live.
 */
async function main() {
  const results: CheckResult[] = [...checkEnvironment(), checkImageStorage(), ...await checkExternalServices()];
  if (!results.some((check) => check.name === "DATABASE_URL" && check.status === "fail")) {
    const expected = expectedMigrationCount();
    results.push(...await checkMainDatabase(getDb(), expected));
    if (isSandboxConfigured()) results.push(...await runInEnvironment("sandbox", () => checkSandboxDatabase(getDb(), expected)));
  }
  const mark = { ok: "OK  ", warn: "WARN", fail: "FAIL" };
  for (const check of results) console.log(`${mark[check.status]}  ${check.name}: ${check.detail}`);
  const failed = results.filter((check) => check.status === "fail").length;
  console.log(failed ? `\n${failed} problem(s) to fix before the deploy.` : "\nReady for the deploy.");
  return failed ? 1 : 0;
}

main()
  .then(async (code) => { await closeDatabasePool(); process.exit(code); })
  .catch(async (error) => { console.error("Check failed:", error instanceof Error ? error.message : error); await closeDatabasePool(); process.exit(1); });
