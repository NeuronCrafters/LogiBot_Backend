import "dotenv/config";
import { closeDatabasePool, getDb } from "./client";
import { cleanupLegacyData, LEGACY_EMAILS, LEGACY_INSTITUTION } from "../services/deploy/deployChecks";

/**
 * Removes the old load-test accounts and institution from the main database.
 *   node dist/db/cleanupLegacy.js                                 -> only shows what would be removed
 *   node dist/db/cleanupLegacy.js --apply --backup-done           -> removes, in one transaction
 * Make a backup first (pg_dump). Refuses to run while no active owner admin exists.
 */
async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  if (apply && !args.includes("--backup-done")) {
    console.error("Back up the database first (pg_dump), then run again with --apply --backup-done.");
    return 1;
  }
  console.log(`Accounts: ${LEGACY_EMAILS.join(", ")}`);
  console.log(`Institution: ${LEGACY_INSTITUTION.name} (${LEGACY_INSTITUTION.id})`);
  const report = await cleanupLegacyData(getDb(), { apply });
  console.log(`Found: ${report.accounts} account(s), ${report.institution} institution, ${report.recoveries} recovered session row(s).`);
  console.log(report.applied ? "Removed." : "Dry run: nothing was removed. Use --apply --backup-done to remove.");
  return 0;
}

main()
  .then(async (code) => { await closeDatabasePool(); process.exit(code); })
  .catch(async (error) => { console.error("Cleanup failed:", error instanceof Error ? error.message : error); await closeDatabasePool(); process.exit(1); });
