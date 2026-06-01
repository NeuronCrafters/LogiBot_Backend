import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type DbClient = ReturnType<typeof drizzle<typeof schema>>;
export type NeonDbClient = ReturnType<typeof drizzleNeon<typeof schema>>;
export type AnyDbClient = DbClient | NeonDbClient;

let expressPool: Pool | undefined;
let workerClients = new Map<string, NeonDbClient>();

function createPool(connectionString: string) {
  return new Pool({ connectionString, max: 5 });
}

export function getDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL nao configurado");
  return url;
}

export function getExpressDb(): DbClient {
  if (!expressPool) {
    expressPool = createPool(getDatabaseUrl());
  }
  return drizzle(expressPool, { schema });
}

export function getWorkerDb(env: { DATABASE_URL?: string }): NeonDbClient {
  const connectionString = env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL nao configurado");
  }

  let client = workerClients.get(connectionString);
  if (!client) {
    client = drizzleNeon(neon(connectionString), { schema });
    workerClients.set(connectionString, client);
  }

  return client;
}

export async function checkDatabase(db: DbClient | NeonDbClient) {
  await db.execute("select 1");
}
