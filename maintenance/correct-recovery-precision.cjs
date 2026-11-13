// One-time correction of the initial 2026-11-12 repair, retaining native PostgreSQL microseconds.
// The plan must come from a fresh restoration of the verified pre-repair backup.
const { Pool } = require('pg');
const fs = require('node:fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const [planFile,runId,backup] = process.argv.slice(2);
if (!/^[a-f0-9-]{36}$/.test(runId||'') || !/^[a-f0-9]{64}$/.test(backup||'')) throw new Error('Run ID and verified backup SHA-256 required');
const plan = JSON.parse(fs.readFileSync(planFile,'utf8'));
if (plan.sessions!==2845 || plan.plan.length!==2845) throw new Error('Unexpected restored repair plan');
(async()=>{
 const db=await pool.connect();
 try {
  await db.query('BEGIN');
  await db.query("SET LOCAL statement_timeout='60s'");
  await db.query('LOCK TABLE analysis_sessions,user_analyses IN SHARE ROW EXCLUSIVE MODE');
  const old=(await db.query(`SELECT s.id,s.session_end::text AS end_exact,s.session_duration,r.previous_state,r.evidence,r.backup_sha256
    FROM analysis_sessions s JOIN analysis_session_recoveries r ON r.session_id=s.id WHERE r.run_id=$1 FOR UPDATE OF s,r`,[runId])).rows;
  if(old.length!==plan.plan.length || old.some(row=>row.backup_sha256!==backup)) throw new Error('Recovery run does not match the restored backup plan');
  const byId=new Map(old.map(row=>[row.id,row]));
  const before=(await db.query(`SELECT (SELECT count(*) FROM answer_questions)::int AS answers,(SELECT count(*) FROM professor_quiz_answers)::int AS professor_answers`)).rows[0];
  for(const item of plan.plan) {
   const prior=byId.get(item.id);
   if(!prior || Math.abs(prior.session_duration-item.seconds)>1 || Math.abs(+new Date(prior.end_exact)-+new Date(item.proposed_end_exact))>1)
     throw new Error('Session changed beyond timestamp precision; refusing correction');
   if(prior.evidence.precisionCorrection) throw new Error('Precision correction already applied');
   const correction={previousRecoveredEnd:prior.end_exact,previousRecoveredDuration:prior.session_duration,
     previousAuditState:prior.previous_state,previousPlanSha256:prior.evidence.plan_sha256,
     correctedPlanSha256:plan.planSha256,method:'native_postgresql_timestamptz_and_epoch_floor'};
   await db.query(`UPDATE analysis_sessions SET session_end=$2::timestamptz,session_duration=$3,last_activity_at=$2::timestamptz WHERE id=$1`,[item.id,item.proposed_end_exact,item.seconds]);
   await db.query(`UPDATE analysis_session_recoveries SET previous_state=$2,estimated_end=$3::timestamptz,estimated_duration=$4,
      evidence=evidence || jsonb_build_object('precisionCorrection',$5::jsonb,'precisionCorrectedAt',clock_timestamp()) WHERE session_id=$1 AND run_id=$6`,
     [item.id,JSON.stringify(item.original_state),item.proposed_end_exact,item.seconds,JSON.stringify(correction),runId]);
  }
  await db.query(`UPDATE user_analyses a SET total_usage_time=(SELECT COALESCE(sum(s.session_duration),0)::integer FROM analysis_sessions s WHERE s.analysis_id=a.id AND s.session_end IS NOT NULL)
    WHERE a.id=ANY($1::uuid[])`,[[...new Set(plan.plan.map(row=>row.analysis_id))]]);
  const checks=(await db.query(`SELECT
    (SELECT count(*)::int FROM analysis_sessions WHERE session_end<session_start OR session_duration<0) AS invalid_intervals,
    (SELECT count(*)::int FROM analysis_sessions s JOIN analysis_session_recoveries r ON r.session_id=s.id WHERE r.run_id=$1 AND s.session_duration<>floor(extract(epoch FROM(s.session_end-s.session_start)))) AS repaired_duration_mismatches,
    (SELECT count(*)::int FROM user_analyses a WHERE total_usage_time<>COALESCE((SELECT sum(session_duration) FROM analysis_sessions s WHERE s.analysis_id=a.id AND s.session_end IS NOT NULL),0)) AS accumulated_total_mismatches`,[runId])).rows[0];
  if(Object.values(checks).some(value=>value!==0)) throw new Error('Post-correction integrity check failed');
  const after=(await db.query(`SELECT (SELECT count(*) FROM answer_questions)::int AS answers,(SELECT count(*) FROM professor_quiz_answers)::int AS professor_answers`)).rows[0];
  if(JSON.stringify(before)!==JSON.stringify(after)) throw new Error('Answer counts changed');
  await db.query('COMMIT');
  console.log(JSON.stringify({corrected:true,sessions:plan.sessions,runId,planSha256:plan.planSha256,checks,answerCountsBefore:before,answerCountsAfter:after},null,2));
 } catch(error){await db.query('ROLLBACK');throw error;}
 finally{db.release();await pool.end();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
