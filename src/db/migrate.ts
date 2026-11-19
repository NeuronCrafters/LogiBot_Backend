import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { closeDatabasePool, getDb, isSandboxConfigured, runInEnvironment } from "./client";
import { logger } from "../logger";

async function runMigrations() {
  logger.info("Migration", "Running PostgreSQL migrations.");
  await migrate(getDb(), { migrationsFolder: "./drizzle" });
  logger.info("Migration", "PostgreSQL migrations completed.");
  // The test environment database follows the same schema.
  if (isSandboxConfigured()) {
    await runInEnvironment("sandbox", () => migrate(getDb(), { migrationsFolder: "./drizzle" }));
    logger.info("Migration", "Sandbox database migrations completed.");
  }
}

runMigrations()
  .then(async () => {
    await closeDatabasePool();
    process.exit(0);
  })
  .catch(async (error) => {
    logger.error("Migration", "Failed to run PostgreSQL migrations.", error);
    await closeDatabasePool();
    process.exit(1);
  });
