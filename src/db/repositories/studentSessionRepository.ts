import { sql } from "drizzle-orm";
import type { AnyDbClient } from "../client";

// Close and accumulate in one statement: concurrent login/logout calls cannot count a session twice.
export async function closeAnalysisSession(db: AnyDbClient, analysisId: string, end = new Date()) {
  await db.execute(sql`
    WITH closed AS (
      UPDATE analysis_sessions
      SET session_end = ${end},
          session_duration = GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (${end}::timestamptz - session_start))))::integer,
          last_activity_at = ${end}
      WHERE id = (
        SELECT id FROM analysis_sessions
        WHERE analysis_id = ${analysisId}::uuid AND session_end IS NULL
        ORDER BY session_start DESC LIMIT 1
      ) AND session_end IS NULL
      RETURNING session_duration
    )
    UPDATE user_analyses
    SET total_usage_time = total_usage_time + COALESCE((SELECT SUM(session_duration) FROM closed), 0)::integer
    WHERE id = ${analysisId}::uuid
  `);
}
