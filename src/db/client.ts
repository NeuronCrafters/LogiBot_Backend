import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type DbClient = ReturnType<typeof drizzle<typeof schema>>;
export type TransactionClient = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
export type AnyDbClient = DbClient | TransactionClient;

let expressPool: Pool | undefined;

function createPool(connectionString: string) {
  return new Pool({
    connectionString,
    max: Number(process.env.DB_POOL_MAX || 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

export function getDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured.");
  return url;
}

export function getExpressDb(): DbClient {
  if (!expressPool) {
    expressPool = createPool(getDatabaseUrl());
  }
  return drizzle(expressPool, { schema });
}

export function getDb(): DbClient {
  return getExpressDb();
}

export async function checkDatabase(db: DbClient = getDb()) {
  await db.execute("select 1");
}

export async function closeDatabasePool() {
  if (expressPool) {
    await expressPool.end();
    expressPool = undefined;
  }
}
