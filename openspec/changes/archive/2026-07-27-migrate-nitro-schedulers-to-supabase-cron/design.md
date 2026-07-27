## Context

Three private Nitro workers currently use `nitro.scheduledTasks`: invoice-email dispatch every minute, operations-report auto-close at 16:55 UTC, and AI retention cleanup at 17:20 UTC.

## Decisions

1. Supabase `pg_cron` owns production schedules and `pg_net` POSTs to the existing Nitro endpoints. Worker implementations and API contracts do not move.
2. One shared `nitro_scheduler_base_url` plus one secret per endpoint are read from `vault.decrypted_secrets` at job execution. The migration contains only Vault names, endpoint paths, header names, and schedules.
3. The migration removes an existing same-name job with `cron.unschedule`, then schedules exactly one job per worker. It never writes `cron.job` directly.
4. Nitro task wrappers and `nitro.scheduledTasks` are removed so deployment produces no Vercel Cron schedules. Local testing uses authenticated calls to existing internal endpoints.
5. `cron.job_run_details`, server logs, and existing worker state remain the first diagnostic surfaces. No alerting system is introduced.

## Failure Handling

`pg_net` failures do not mutate worker state; the next wake-up retries. Existing idempotency and locking prevent duplicate invoice processing, while auto-close and retention retain their server-side guards.

## Rollout

Apply the migration manually in Supabase SQL Editor, create the four Vault values in each environment, deploy the application with Nitro schedules removed, then manually invoke each endpoint and confirm scheduled runs in `cron.job_run_details`.
