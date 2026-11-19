import "dotenv/config";
import { closeDatabasePool, getDb, getSandboxDatabaseUrl, runInEnvironment } from "./client";
import { logger } from "../logger";
import { sandboxPassword, seedSandbox } from "../services/sandbox/sandboxSeed";

/** Creates the test accounts in the test database (never in the main one). Safe to run again. */
async function main() {
  if (!getSandboxDatabaseUrl()) throw new Error("SANDBOX_DATABASE_URL must be set and differ from DATABASE_URL.");
  const created = await runInEnvironment("sandbox", () => seedSandbox(getDb(), sandboxPassword()));
  logger.info("SandboxSeed", created ? "Test environment created." : "Test environment already existed.");
}

main()
  .then(async () => { await closeDatabasePool(); process.exit(0); })
  .catch(async (error) => { logger.error("SandboxSeed", "Failed to seed the test environment.", error); await closeDatabasePool(); process.exit(1); });
