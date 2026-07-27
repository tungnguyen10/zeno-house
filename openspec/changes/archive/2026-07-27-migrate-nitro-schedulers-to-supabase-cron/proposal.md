## Why

Production scheduler wake-ups currently depend on Nitro scheduled tasks, which deploy as Vercel Cron jobs. Moving scheduling to Supabase Postgres removes that dependency while retaining the tested Nitro workers.

## What Changes

- Replace Nitro/Vercel schedules with Supabase `pg_cron` jobs that use `pg_net` to call existing protected Nitro endpoints.
- Store the scheduler base URL and per-worker shared secrets in Supabase Vault.
- Preserve all three workers, endpoint contracts, feature gates, and schedules.
- Remove Nitro task wrappers and `nitro.scheduledTasks`; local operations invoke protected endpoints manually.

## Capabilities

### New Capabilities

- `supabase-scheduled-workers`: Vault-backed Supabase Cron wake-ups for private Nitro workers.

### Modified Capabilities

- `invoice-email-delivery`: Production dispatch scheduling moves from Nitro/Vercel Cron to Supabase Cron without changing outbox behavior.

## Impact

- An additive SQL Editor migration and verification query.
- Nitro configuration and task-wrapper removal; existing internal APIs remain unchanged.
- Scheduler setup and rollout documentation for Supabase Vault and Cron monitoring.
