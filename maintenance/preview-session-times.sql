\set ON_ERROR_STOP on
-- Read-only preview; pass -v course_id=<uuid>.
BEGIN READ ONLY;
WITH evidence AS (
  SELECT s.id, a.class_name, s.session_start, s.last_activity_at,
    GREATEST(s.session_start, s.last_activity_at, q.last_answer, p.last_attempt) AS evidence_end,
    (SELECT min(n.session_start) FROM analysis_sessions n WHERE n.analysis_id=s.analysis_id AND n.session_start>s.session_start) AS next_start,
    q.answers
  FROM analysis_sessions s JOIN user_analyses a ON a.id=s.analysis_id
  LEFT JOIN LATERAL (SELECT max(q.timestamp) AS last_answer, count(*) AS answers FROM answer_attempts p JOIN answer_questions q ON q.attempt_id=p.id WHERE p.session_id=s.id) q ON true
  LEFT JOIN LATERAL (SELECT max(p.created_at) AS last_attempt FROM answer_attempts p WHERE p.session_id=s.id) p ON true
  WHERE a.course_id=:'course_id'::uuid AND s.session_end IS NULL
), planned AS (
  SELECT *, LEAST(evidence_end, COALESCE(next_start,evidence_end)) AS proposed_end,
    floor(extract(epoch FROM (LEAST(evidence_end,COALESCE(next_start,evidence_end))-session_start)))::integer AS seconds
  FROM evidence
)
SELECT class_name, count(*) AS sessions, sum(answers) AS answers, sum(seconds) AS estimated_seconds,
  count(*) FILTER(WHERE seconds=0) AS no_positive_duration,
  min(seconds) AS min_seconds,max(seconds) AS max_seconds,
  min(proposed_end) AS earliest_end,max(proposed_end) AS latest_end,
  count(*) FILTER(WHERE evidence_end>session_start+interval '24 hours' OR evidence_end>now()-interval '24 hours') AS needs_review
FROM planned GROUP BY class_name ORDER BY class_name;
COMMIT;
