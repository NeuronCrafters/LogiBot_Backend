// Integration check: actual one-minute schedule, no fake timers, isolated database only.
const { Pool } = require('pg');
const { randomUUID } = require('node:crypto');
const { startSessionScheduler, getSessionSweepState } = require('../dist/services/auth/sessionScheduler');
const { closeDatabasePool } = require('../dist/db/client');
if (!new URL(process.env.DATABASE_URL).pathname.includes('_usage_recovery_check_')) throw new Error('An isolated database is required');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
 const user=randomUUID(),analysis=randomUUID(),session=randomUUID(),auth=randomUUID();
 const task=startSessionScheduler();
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 try {
  const initialDeadline=Date.now()+10000;
  while(!getSessionSweepState().lastSweepAt && Date.now()<initialDeadline) await pause(100);
  if(!getSessionSweepState().lastSweepAt) throw new Error('Initial sweep failed');
  await pool.query("INSERT INTO accounts(id,name,email) VALUES($1,'Cron verification fixture',$2)",[user,`${user}@example.invalid`]);
  await pool.query(`INSERT INTO user_analyses(id,user_id,name,email,school_id,school_name,course_id,course_name,class_id,class_name)
    SELECT $1,$2,'Cron verification fixture',$3,school_id,school_name,course_id,course_name,class_id,class_name FROM user_analyses LIMIT 1`,[analysis,user,`${user}@example.invalid`]);
  await pool.query(`INSERT INTO analysis_sessions(id,analysis_id,session_start,last_activity_at,session_duration,duration_source)
    VALUES($1,$2,now()-interval '120 seconds',now()-interval '60 seconds',30,'observed')`,[session,analysis]);
  await pool.query(`INSERT INTO auth_sessions(id,account_id,analysis_session_id,started_at,last_activity_at,last_checkpoint_at,idle_expires_at,expires_at)
    VALUES($1,$2,$3,now()-interval '120 seconds',now()-interval '60 seconds',now()-interval '60 seconds',now()-interval '1 second',now()+interval '1 hour')`,[auth,user,session]);
  await pool.query(`INSERT INTO session_activity_intervals(auth_session_id,analysis_session_id,started_at,ended_at)
    VALUES($1,$2,now()-interval '90 seconds',now()-interval '60 seconds')`,[auth,session]);
  const began=Date.now();let row;
  while(Date.now()-began<65000) {
   row=(await pool.query(`SELECT h.ended_at,h.idle_expires_at,h.end_reason,s.session_end,s.session_duration,a.total_usage_time
      FROM auth_sessions h JOIN analysis_sessions s ON s.id=h.analysis_session_id JOIN user_analyses a ON a.id=s.analysis_id WHERE h.id=$1`,[auth])).rows[0];
   if(row.ended_at) break;
   await pause(250);
  }
  if(!row?.ended_at || row.session_duration!==30 || row.total_usage_time!==30 || row.end_reason!=='idle_timeout'
    || +row.ended_at!==+row.idle_expires_at || +row.session_end!==+row.ended_at || getSessionSweepState().expiredSessions<1)
    throw new Error('Scheduled expiration did not close and account exactly once');
  console.log(JSON.stringify({scheduledCronVerified:true,expression:'* * * * *',elapsedMs:Date.now()-began,
    durationSeconds:row.session_duration,accumulatedSeconds:row.total_usage_time,endReason:row.end_reason,scheduler:getSessionSweepState()},null,2));
 } finally {
  await task.stop();await task.destroy();
  await pool.query('DELETE FROM accounts WHERE id=$1',[user]);
  await pool.end();await closeDatabasePool();
 }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
