import { sql } from "drizzle-orm";
import type { AnyDbClient, DbClient } from "../../db/client";
import { authSessions, sessionActivityIntervals } from "../../db/schema";
import { startStudentSession, type AccountWithAuth } from "../../db/repositories/authRepository";
import { sessionPolicy } from "../../config/session";
import { AppError } from "../../exceptions/AppError";

type Session = {
  id: string; account_id: string; analysis_session_id: string | null;
  started_at: Date; last_activity_at: Date; last_checkpoint_at: Date;
  idle_expires_at: Date; expires_at: Date; ended_at: Date | null; end_reason: string | null;
};

function hydrate(row: any): Session | undefined {
  if (!row) return undefined;
  for (const key of ["started_at", "last_activity_at", "last_checkpoint_at", "idle_expires_at", "expires_at", "ended_at"])
    if (row[key] !== null && row[key] !== undefined) row[key] = new Date(row[key]);
  return row as Session;
}

async function serverTime(db: AnyDbClient, testTime?: Date): Promise<Date> {
  return testTime || new Date((await db.execute(sql`SELECT clock_timestamp() AS now`)).rows[0].now as string);
}

export function publicSession(session: Session, now: Date) {
  const policy = sessionPolicy();
  return {
    id: session.id, serverNow: now.toISOString(),
    idleExpiresAt: session.idle_expires_at.toISOString(),
    expiresAt: session.expires_at.toISOString(),
    heartbeatSeconds: policy.heartbeatSeconds, warningSeconds: policy.warningSeconds,
  };
}

async function endLockedSession(db: AnyDbClient, session: Session, now: Date, reason: string) {
  if (session.ended_at) return;
  const end = new Date(Math.max(+session.started_at, Math.min(+now, +session.idle_expires_at, +session.expires_at)));
  await db.execute(sql`UPDATE auth_sessions SET ended_at=${end},end_reason=${reason} WHERE id=${session.id}::uuid AND ended_at IS NULL`);
  if (session.analysis_session_id) {
    // Activity seconds were checkpointed during use. Closing never adds idle time.
    await db.execute(sql`
      WITH closed AS (
        UPDATE analysis_sessions SET session_end=GREATEST(session_start, ${end}::timestamptz)
        WHERE id=${session.analysis_session_id}::uuid AND session_end IS NULL
        RETURNING analysis_id,session_duration
      ) UPDATE user_analyses a SET total_usage_time=a.total_usage_time+c.session_duration
        FROM closed c WHERE a.id=c.analysis_id
    `);
  }
}

export async function withLiveSession<T>(db: DbClient, id: string, accountId: string,
  operation: (tx: AnyDbClient, session: Session, now: Date) => Promise<T>, testTime?: Date): Promise<T> {
  const outcome = await db.transaction(async tx => {
    const session = hydrate((await tx.execute(sql`SELECT * FROM auth_sessions WHERE id=${id}::uuid AND account_id=${accountId}::uuid FOR UPDATE`)).rows[0]);
    const now = await serverTime(tx, testTime);
    if (!session || session.ended_at) return { error: true as const };
    if (+now >= +session.expires_at || +now >= +session.idle_expires_at) {
      await endLockedSession(tx, session, now, +now >= +session.expires_at ? "absolute_timeout" : "idle_timeout");
      return { error: true as const };
    }
    return { value: await operation(tx, session, now) };
  });
  // Throw after commit so revocation/analytical closing survives a rejected request.
  if (outcome.error) throw new AppError("auth.sessionExpired", 401);
  return outcome.value as T;
}

export async function createLoginSession(db: DbClient, account: AccountWithAuth) {
  return db.transaction(async tx => {
    // Serializes simultaneous logins. New login invalidates the previous device as well as its JWT.
    await tx.execute(sql`SELECT id FROM accounts WHERE id=${account.id}::uuid FOR UPDATE`);
    const now = await serverTime(tx);
    const previous = (await tx.execute(sql`SELECT * FROM auth_sessions WHERE account_id=${account.id}::uuid AND ended_at IS NULL FOR UPDATE`)).rows.map(hydrate) as Session[];
    for (const session of previous) await endLockedSession(tx, session, now, "replaced_by_login");
    const analysisSessionId = account.roles.includes("student") ? await startStudentSession(tx, account, now) : null;
    const policy = sessionPolicy();
    const [created] = await tx.insert(authSessions).values({
      accountId: account.id, analysisSessionId,
      startedAt: now, lastActivityAt: now, lastCheckpointAt: now,
      idleExpiresAt: new Date(+now + policy.idleSeconds * 1000),
      expiresAt: new Date(+now + policy.absoluteSeconds * 1000),
    }).returning();
    const session = hydrate((await tx.execute(sql`SELECT * FROM auth_sessions WHERE id=${created.id}::uuid`)).rows[0])!;
    return publicSession(session, now);
  });
}

export function validateSession(db: DbClient, id: string, accountId: string, testTime?: Date) {
  return withLiveSession(db, id, accountId, async (_tx, session, now) => ({
    ...publicSession(session, now), analysisSessionId: session.analysis_session_id,
  }), testTime);
}

export function recordSessionActivity(db: DbClient, id: string, accountId: string, testTime?: Date) {
  return withLiveSession(db, id, accountId, async (tx, session, now) => {
    const policy = sessionPolicy();
    const gap = +now - +session.last_activity_at;
    // A new action after a long pause only starts a new observation window; it cannot fill the pause.
    if (session.analysis_session_id && gap > 0 && gap <= policy.activityWindowSeconds * 1000) {
      const start = new Date(Math.max(+session.last_checkpoint_at, +now - policy.activityWindowSeconds * 1000));
      if (+now > +start) await tx.insert(sessionActivityIntervals).values({
        authSessionId: id, analysisSessionId: session.analysis_session_id, startedAt: start, endedAt: now,
      });
      await tx.execute(sql`UPDATE analysis_sessions SET
        session_duration=(SELECT COALESCE(FLOOR(SUM(EXTRACT(EPOCH FROM (ended_at-started_at)))),0)::integer FROM session_activity_intervals WHERE analysis_session_id=${session.analysis_session_id}::uuid),
        last_activity_at=${now}
        WHERE id=${session.analysis_session_id}::uuid AND session_end IS NULL`);
    } else if (session.analysis_session_id) {
      await tx.execute(sql`UPDATE analysis_sessions SET last_activity_at=${now} WHERE id=${session.analysis_session_id}::uuid AND session_end IS NULL`);
    }
    session.last_activity_at = now;
    session.last_checkpoint_at = now;
    session.idle_expires_at = new Date(Math.min(+now + policy.idleSeconds * 1000, +session.expires_at));
    await tx.execute(sql`UPDATE auth_sessions SET last_activity_at=${now},last_checkpoint_at=${now},idle_expires_at=${session.idle_expires_at} WHERE id=${id}::uuid`);
    return publicSession(session, now);
  }, testTime);
}

export async function logoutSession(db: DbClient, id: string, accountId: string, reason = "logout") {
  await db.transaction(async tx => {
    const session = hydrate((await tx.execute(sql`SELECT * FROM auth_sessions WHERE id=${id}::uuid AND account_id=${accountId}::uuid FOR UPDATE`)).rows[0]);
    if (session && !session.ended_at) await endLockedSession(tx, session, await serverTime(tx), reason);
  });
}

export async function expireSessions(db: DbClient, testTime?: Date) {
  return db.transaction(async tx => {
    const now = await serverTime(tx, testTime);
    // Row locks coordinate multiple workers and requests; skipped rows are picked up on the next run.
    const sessions = (await tx.execute(sql`SELECT * FROM auth_sessions
      WHERE ended_at IS NULL AND (idle_expires_at<=${now} OR expires_at<=${now})
      ORDER BY idle_expires_at LIMIT 500 FOR UPDATE SKIP LOCKED`)).rows.map(hydrate) as Session[];
    for (const session of sessions) await endLockedSession(tx, session, now,
      +now >= +session.expires_at ? "absolute_timeout" : "idle_timeout");
    return sessions.length;
  });
}
