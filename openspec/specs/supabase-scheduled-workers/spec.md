# supabase-scheduled-workers Specification

## Purpose
TBD - created by archiving change migrate-nitro-schedulers-to-supabase-cron. Update Purpose after archive.
## Requirements
### Requirement: Supabase-owned production scheduler wake-ups
The system SHALL use Supabase `pg_cron` and `pg_net` to invoke each production private Nitro worker without relying on Nitro or Vercel scheduled tasks.

#### Scenario: Invoice email dispatcher is due
- **WHEN** one minute elapses
- **THEN** Supabase Cron requests the existing invoice-email dispatch endpoint with its configured private header

#### Scenario: Operations report auto-close is due
- **WHEN** the schedule reaches 16:55 UTC
- **THEN** Supabase Cron requests the existing auto-close endpoint with its configured private header

#### Scenario: AI retention cleanup is due
- **WHEN** the schedule reaches 17:20 UTC
- **THEN** Supabase Cron requests the existing retention-cleanup endpoint with its configured private header

#### Scenario: Scheduler credentials are configured
- **WHEN** a production scheduler job runs
- **THEN** it reads the base URL and worker-specific secret from Supabase Vault and does not expose either value in migrations, public runtime configuration, or browser code

#### Scenario: A scheduler wake-up fails
- **WHEN** `pg_net` cannot complete an HTTP wake-up
- **THEN** worker state remains unchanged, the next scheduled wake-up can retry, and operators can inspect the job run history

