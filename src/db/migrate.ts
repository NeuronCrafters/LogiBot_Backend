import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { closeDatabasePool, getDb } from "./client";

async function runMigrations() {
  console.log("executando migrations do PostgreSQL...");
  await migrate(getDb(), { migrationsFolder: "./drizzle" });
  console.log("migrations concluidas");
}

runMigrations()
  .then(async () => {
    await closeDatabasePool();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("erro ao executar migrations", error);
    await closeDatabasePool();
    process.exit(1);
  });

