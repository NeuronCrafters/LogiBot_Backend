import { AsyncLocalStorage } from "async_hooks";

/**
 * Test environment ("sandbox"): test accounts and their data live in a separate database
 * (SANDBOX_DATABASE_URL), so production data is never touched by tests.
 */
export type DatabaseEnvironment = "production" | "sandbox";
const environmentContext = new AsyncLocalStorage<DatabaseEnvironment>();

export function getSandboxDatabaseUrl(): string | null {
  const url = process.env.SANDBOX_DATABASE_URL;
  // Refuse a sandbox URL that points at the main database.
  if (!url || url === process.env.DATABASE_URL) return null;
  return url;
}

export const isSandboxConfigured = () => getSandboxDatabaseUrl() !== null;

export function currentEnvironment(): DatabaseEnvironment {
  return environmentContext.getStore() ?? "production";
}

/** Runs the callback (and everything it awaits) against the database of that environment. */
export function runInEnvironment<T>(environment: DatabaseEnvironment, callback: () => T): T {
  return environmentContext.run(environment, callback);
}
