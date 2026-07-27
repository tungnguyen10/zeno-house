-- Supabase Cron owns production scheduler wake-ups. Nitro retains the
-- secret-protected endpoints and all application worker logic.

create extension if not exists pg_net;
create extension if not exists pg_cron;

do $$
declare
  existing_job record;
begin
  for existing_job in
    select jobid
      from cron.job
     where jobname in (
       'invoice-email-dispatch-every-minute',
       'operations-report-auto-close',
       'ai-retention-cleanup'
     )
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;
end;
$$;

select cron.schedule(
  'invoice-email-dispatch-every-minute',
  '* * * * *',
  $job$
    select net.http_post(
      url := (
        select decrypted_secret
          from vault.decrypted_secrets
         where name = 'nitro_scheduler_base_url'
      ) || '/api/internal/invoice-email/dispatch',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-invoice-email-dispatch-secret', (
          select decrypted_secret
            from vault.decrypted_secrets
           where name = 'invoice_email_dispatch_secret'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $job$
);

select cron.schedule(
  'operations-report-auto-close',
  '55 16 * * *',
  $job$
    select net.http_post(
      url := (
        select decrypted_secret
          from vault.decrypted_secrets
         where name = 'nitro_scheduler_base_url'
      ) || '/api/internal/operations-report/auto-close',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-operations-report-cron-secret', (
          select decrypted_secret
            from vault.decrypted_secrets
           where name = 'operations_report_auto_close_secret'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $job$
);

select cron.schedule(
  'ai-retention-cleanup',
  '20 17 * * *',
  $job$
    select net.http_post(
      url := (
        select decrypted_secret
          from vault.decrypted_secrets
         where name = 'nitro_scheduler_base_url'
      ) || '/api/internal/ai/retention-cleanup',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-ai-retention-secret', (
          select decrypted_secret
            from vault.decrypted_secrets
           where name = 'ai_retention_cleanup_secret'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $job$
);
