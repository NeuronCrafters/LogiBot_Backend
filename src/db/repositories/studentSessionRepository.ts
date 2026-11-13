import { sql } from "drizzle-orm";
import type { AnyDbClient } from "../client";

// Close and accumulate in one statement: concurrent login/logout calls cannot count a session twice.
export async function closeAnalysisSession(db: AnyDbClient, analysisId: string, end = new Date()) {
  await db.execute(sql`
    WITH candidate AS (
        SELECT id, session_start, last_activity_at FROM analysis_sessions
        WHERE analysis_id = ${analysisId}::uuid AND session_end IS NULL
        ORDER BY session_start DESC LIMIT 1 FOR UPDATE
    ), ending AS (
      SELECT *, GREATEST(session_start, CASE
        WHEN ${end}::timestamptz - last_activity_at > interval '2 hours'
        THEN LEAST(last_activity_at, ${end}::timestamptz)
        ELSE ${end}::timestamptz END) AS resolved_end,
        (${end}::timestamptz - last_activity_at > interval '2 hours') AS stale
      FROM candidate
    ), closed AS (
      UPDATE analysis_sessions s
      SET session_end = e.resolved_end,
          session_duration = GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (e.resolved_end - e.session_start))))::integer,
          duration_source = CASE WHEN NOT e.stale THEN 'recorded'
            WHEN e.resolved_end > e.session_start THEN 'estimated' ELSE 'unavailable' END,
          last_activity_at = CASE WHEN e.stale THEN e.last_activity_at ELSE e.resolved_end END
      FROM ending e WHERE s.id = e.id AND s.session_end IS NULL
      RETURNING s.session_duration
    )
    UPDATE user_analyses
    SET total_usage_time = total_usage_time + COALESCE((SELECT SUM(session_duration) FROM closed), 0)::integer
    WHERE id = ${analysisId}::uuid
  `);
}
