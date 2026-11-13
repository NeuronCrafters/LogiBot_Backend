import cron from "node-cron";
import { getDb } from "../../db/client";
import { expireSessions } from "./sessionLifecycleService";
import { logger } from "../../logger";

const state = { lastSweepAt: null as string | null, expiredSessions: 0, lastError: null as string | null };
export const getSessionSweepState = () => ({ ...state });

export function startSessionScheduler() {
  const expression = process.env.SESSION_SWEEP_CRON || "* * * * *";
  if (!cron.validate(expression)) throw new Error("Invalid SESSION_SWEEP_CRON");
  const sweep = async () => {
    try {
      let count: number;
      do { count = await expireSessions(getDb()); state.expiredSessions += count; } while (count === 500);
      state.lastSweepAt = new Date().toISOString();
      state.lastError = null;
    } catch (error) {
      state.lastError = error instanceof Error ? error.message : String(error);
      logger.error("Sessions", "Session expiration sweep failed", error);
    }
  };
  const task = cron.schedule(expression, sweep, { noOverlap: true, timezone: "UTC" });
  void sweep(); // Catch sessions missed while the process was stopped.
  return task;
}
