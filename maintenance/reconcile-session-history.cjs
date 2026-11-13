// Manual, audited historical repair. Never run by the periodic session scheduler.
// First run without flags and rehearse on a restored database. --apply requires a verified backup SHA-256.
const { Pool } = require('pg');
const crypto = require('node:crypto');
const apply = process.argv[2] === '--apply';
const backup = process.argv[3];
if (apply && !/^[a-f0-9]{64}$/.test(backup || '')) throw new Error('A verified backup checksum is required');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
 const db = await pool.connect();
 try {
  await db.query(apply ? 'BEGIN' : 'BEGIN READ ONLY');
  await db.query("SET LOCAL statement_timeout='60s'");
  if (apply) await db.query('LOCK TABLE analysis_sessions,user_analyses IN SHARE ROW EXCLUSIVE MODE');
  const before = (await db.query(`SELECT (SELECT count(*) FROM answer_questions)::int AS answers,(SELECT count(*) FROM professor_quiz_answers)::int AS professor_answers`)).rows[0];
  const rows = (await db.query(`WITH candidates AS (
   SELECT s.*,a.user_id,a.course_name,a.class_name,a.school_name,
    to_jsonb(s) || jsonb_build_object('analysis_total_usage_time',a.total_usage_time) AS original_state,
    s.session_end::text AS original_end_exact,
    (SELECT min(n.session_start) FROM analysis_sessions n WHERE n.analysis_id=s.analysis_id AND n.session_start>s.session_start) AS next_start
   FROM analysis_sessions s JOIN user_analyses a ON a.id=s.analysis_id
   WHERE s.duration_source='recorded' AND s.session_start<now()-interval '24 hours'
    AND s.last_activity_at<now()-interval '24 hours'
    AND (s.session_end IS NULL OR s.session_duration>7200)
    AND NOT EXISTS(SELECT 1 FROM analysis_session_recoveries r WHERE r.session_id=s.id)
    AND NOT EXISTS(SELECT 1 FROM auth_sessions h WHERE h.analysis_session_id=s.id)
  ), evidence AS (
   SELECT s.*,q.last_answer,p.last_attempt,c.last_chat,
    LEAST(COALESCE(s.session_end,now()),COALESCE(s.next_start,now())) AS boundary
   FROM candidates s
   LEFT JOIN LATERAL(SELECT max(q.timestamp) AS last_answer FROM answer_attempts p JOIN answer_questions q ON q.attempt_id=p.id WHERE p.session_id=s.id) q ON true
   LEFT JOIN LATERAL(SELECT max(created_at) AS last_attempt FROM answer_attempts p WHERE p.session_id=s.id) p ON true
   LEFT JOIN LATERAL(SELECT max(m.timestamp) AS last_chat FROM chat_messages m JOIN chat_sessions c ON c.id=m.chat_session_id
    WHERE c.user_id=s.user_id AND m.role='user' AND m.timestamp>=s.session_start
     AND m.timestamp<=LEAST(COALESCE(s.session_end,now()),COALESCE(s.next_start,now()))) c ON true
  ), resolved AS (SELECT *,GREATEST(session_start,LEAST(boundary,GREATEST(session_start,last_answer,last_attempt,last_chat,
     CASE WHEN session_end IS NULL THEN last_activity_at ELSE NULL END))) AS proposed_end FROM evidence)
   SELECT *,proposed_end::text AS proposed_end_exact,FLOOR(EXTRACT(EPOCH FROM(proposed_end-session_start)))::integer AS seconds_exact
   FROM resolved ORDER BY school_name,course_name,class_name,session_start,id`)).rows;
  const plan = rows.map(row => ({...row, seconds: row.seconds_exact}));
  if (plan.some(row => row.seconds<0 || +row.proposed_end>Date.now()-86400000)) throw new Error('Unexpected or recent evidence requires review');
  const summary = {};
  for (const row of plan) {
   const key = row.school_name+' / '+row.course_name;
   const group = summary[key] ||= { sessions:0,previousSeconds:0,estimatedSeconds:0,unavailable:0,originallyOpen:0,remainingOver2h:0 };
   group.sessions++;group.previousSeconds+=row.session_duration;group.estimatedSeconds+=row.seconds;
   group.unavailable+=row.seconds===0?1:0;group.originallyOpen+=row.session_end===null?1:0;group.remainingOver2h+=row.seconds>7200?1:0;
  }
  const signature=crypto.createHash('sha256').update(JSON.stringify(plan.map(row=>[row.id,row.original_end_exact,row.session_duration,row.proposed_end_exact,row.seconds]))).digest('hex');
  if (apply && process.argv[4] !== signature) throw new Error("Repair plan changed; preview and rehearse again");
  const runId=crypto.randomUUID();
  if(apply) {
   for(const row of plan) {
    await db.query(`INSERT INTO analysis_session_recoveries(run_id,session_id,previous_state,evidence,estimated_end,estimated_duration,backup_sha256)
      VALUES($1,$2,$3,$4,$5,$6,$7)`,[runId,row.id,JSON.stringify(row.original_state),
      JSON.stringify({method:'last_direct_activity_within_original_session_bounds',active_time_measured:false,plan_sha256:signature,last_answer:row.last_answer,last_attempt:row.last_attempt,last_user_chat:row.last_chat,next_start:row.next_start,original_last_activity_discarded:row.session_end!==null}),row.proposed_end_exact,row.seconds,backup]);
    await db.query(`UPDATE analysis_sessions SET session_end=$2,session_duration=$3,duration_source=$4,last_activity_at=$2 WHERE id=$1`,[row.id,row.proposed_end_exact,row.seconds,row.seconds>0?'estimated':'unavailable']);
   }
   const affected=[...new Set(plan.map(row=>row.analysis_id))];
   await db.query(`UPDATE user_analyses a SET total_usage_time=(SELECT COALESCE(sum(s.session_duration),0)::integer FROM analysis_sessions s WHERE s.analysis_id=a.id AND s.session_end IS NOT NULL) WHERE a.id=ANY($1::uuid[])`,[affected]);
  }
  const integrity = apply ? (await db.query(`SELECT count(*)::int AS invalid_repaired_intervals
    FROM analysis_sessions s JOIN analysis_session_recoveries r ON r.session_id=s.id WHERE r.run_id=$1
     AND (s.session_end<s.session_start OR s.session_duration<>floor(extract(epoch FROM(s.session_end-s.session_start))))`,[runId])).rows[0] : null;
  if(integrity?.invalid_repaired_intervals) throw new Error('Native timestamp integrity check failed');
  const after = (await db.query(`SELECT (SELECT count(*) FROM answer_questions)::int AS answers,(SELECT count(*) FROM professor_quiz_answers)::int AS professor_answers`)).rows[0];
  if(JSON.stringify(before)!==JSON.stringify(after)) throw new Error('Answer count changed: refusing repair');
  await db.query('COMMIT');
  console.log(JSON.stringify({applied:apply,runId:apply?runId:null,planSha256:signature,sessions:plan.length,summary,answerCountsBefore:before,answerCountsAfter:after,backupSha256:apply?backup:null,integrity,...(process.argv.includes('--export-plan')?{plan}: {})},null,2));
 } catch(error) {await db.query('ROLLBACK');throw error;}
 finally {db.release();await pool.end();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
