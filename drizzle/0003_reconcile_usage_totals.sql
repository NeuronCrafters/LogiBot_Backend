-- Session durations are the common source for the total, daily chart and effort matrix.
-- Preserve the recorded sessions; do not infer or manufacture student activity.
UPDATE user_analyses AS analysis
SET total_usage_time = totals.seconds
FROM (
  SELECT a.id, COALESCE(SUM(GREATEST(s.session_duration, 0)) FILTER (WHERE s.session_end IS NOT NULL), 0)::integer AS seconds
  FROM user_analyses a LEFT JOIN analysis_sessions s ON s.analysis_id = a.id
  GROUP BY a.id
) AS totals
WHERE analysis.id = totals.id AND analysis.total_usage_time IS DISTINCT FROM totals.seconds;
