-- Run in Supabase SQL Editor after applying
-- 20260727103000_migrate_nitro_schedulers_to_supabase_cron.sql.
-- Vault secret values are intentionally never selected or displayed here.

select extname
  from pg_extension
 where extname in ('pg_cron', 'pg_net')
 order by extname;

select jobid, jobname, schedule, active
  from cron.job
 where jobname in (
   'invoice-email-dispatch-every-minute',
   'operations-report-auto-close',
   'ai-retention-cleanup'
 )
 order by jobname;

select jobid, status, start_time, end_time, return_message
  from cron.job_run_details
 where jobid in (
   select jobid
     from cron.job
    where jobname in (
      'invoice-email-dispatch-every-minute',
      'operations-report-auto-close',
      'ai-retention-cleanup'
    )
 )
 order by start_time desc
 limit 30;
