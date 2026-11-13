-- Explicit historical repair. Run only after a verified database backup and a reviewed preview.
-- Required psql variables: course_id, expected_sessions, expected_seconds, backup_sha256.
-- Durations are elapsed-time estimates, never a measurement of active time.
\set ON_ERROR_STOP on
\if :{?course_id}
\else
  \echo 'Missing course_id'
  \quit 2
\endif
\if :{?expected_sessions}
\else
  \echo 'Missing expected_sessions'
  \quit 2
\endif
\if :{?expected_seconds}
\else
  \echo 'Missing expected_seconds'
  \quit 2
\endif
\if :{?backup_sha256}
\else
  \echo 'Missing verified backup_sha256'
  \quit 2
\endif

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE analysis_sessions, user_analyses IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE recovery_request ON COMMIT DROP AS
SELECT :'course_id'::uuid AS course_id, :expected_sessions::integer AS expected_sessions,
  :expected_seconds::integer AS expected_seconds, :'backup_sha256'::text AS backup_sha256,
  gen_random_uuid() AS run_id;

CREATE TEMP TABLE recovery_plan ON COMMIT DROP AS
WITH evidence AS (
  SELECT s.*, a.class_name, a.total_usage_time AS previous_total,
    q.last_answer, p.last_attempt,
    GREATEST(s.session_start, s.last_activity_at, q.last_answer, p.last_attempt) AS evidence_end,
    (SELECT min(n.session_start) FROM analysis_sessions n WHERE n.analysis_id=s.analysis_id AND n.session_start>s.session_start) AS next_start,
    to_jsonb(s) || jsonb_build_object('analysis_total_usage_time',a.total_usage_time) AS previous_state
  FROM analysis_sessions s JOIN user_analyses a ON a.id=s.analysis_id
  LEFT JOIN LATERAL (
    SELECT max(q.timestamp) AS last_answer FROM answer_attempts p
    JOIN answer_questions q ON q.attempt_id=p.id WHERE p.session_id=s.id
  ) q ON true
  LEFT JOIN LATERAL (SELECT max(p.created_at) AS last_attempt FROM answer_attempts p WHERE p.session_id=s.id) p ON true
  WHERE a.course_id=(SELECT course_id FROM recovery_request) AND s.session_end IS NULL
)
SELECT *, LEAST(evidence_end,COALESCE(next_start,evidence_end)) AS proposed_end,
  floor(extract(epoch FROM (LEAST(evidence_end,COALESCE(next_start,evidence_end))-session_start)))::integer AS seconds
FROM evidence;

DO $$ BEGIN
  IF (SELECT backup_sha256 !~ '^[0-9a-f]{64}$' FROM recovery_request) THEN RAISE EXCEPTION 'Invalid backup checksum'; END IF;
  IF (SELECT count(*) FROM recovery_plan) <> (SELECT expected_sessions FROM recovery_request) THEN
    RAISE EXCEPTION 'Session count changed or repair was already applied; preview again';
  END IF;
  IF (SELECT coalesce(sum(seconds),0) FROM recovery_plan) <> (SELECT expected_seconds FROM recovery_request) THEN
    RAISE EXCEPTION 'Estimated total differs from the reviewed preview';
  END IF;
  IF EXISTS(SELECT 1 FROM recovery_plan WHERE session_duration<>0 OR seconds<0
    OR evidence_end>session_start+interval '24 hours' OR evidence_end>now()-interval '24 hours') THEN
    RAISE EXCEPTION 'Recent, nonzero, or anomalous session requires individual review';
  END IF;
END $$;

INSERT INTO analysis_session_recoveries(run_id,session_id,previous_state,evidence,estimated_end,estimated_duration,backup_sha256)
SELECT r.run_id,p.id,p.previous_state,
  jsonb_build_object('method','session_start_to_last_recorded_activity','active_time_measured',false,
    'last_activity_at',p.last_activity_at,'last_answer_at',p.last_answer,'last_attempt_at',p.last_attempt,
    'next_session_start',p.next_start,'no_positive_duration_evidence',p.seconds=0),
  p.proposed_end,p.seconds,r.backup_sha256
FROM recovery_plan p CROSS JOIN recovery_request r;

UPDATE analysis_sessions s SET session_end=p.proposed_end,session_duration=p.seconds,
  duration_source=CASE WHEN p.seconds>0 THEN 'estimated' ELSE 'unavailable' END
FROM recovery_plan p WHERE s.id=p.id AND s.session_end IS NULL;

UPDATE user_analyses a SET total_usage_time=(
  SELECT coalesce(sum(greatest(s.session_duration,0)),0)::integer
  FROM analysis_sessions s WHERE s.analysis_id=a.id AND s.session_end IS NOT NULL
) WHERE a.id IN (SELECT analysis_id FROM recovery_plan);

SELECT r.run_id,p.class_name,count(*) AS recovered_sessions,sum(p.seconds) AS estimated_seconds,
  count(*) FILTER(WHERE p.seconds=0) AS unavailable_duration
FROM recovery_plan p CROSS JOIN recovery_request r GROUP BY r.run_id,p.class_name ORDER BY p.class_name;
COMMIT;
