## 1. Planning and SQL foundation

- [x] 1.1 Create the scheduler migration OpenSpec artifacts and reconcile the active invoice-email scheduler decision.
- [x] 1.2 Add an additive SQL Editor migration that enables `pg_cron`/`pg_net`, schedules the three Vault-backed wake-ups, and avoids direct `cron.job` writes.
- [x] 1.3 Add static and SQL Editor verification for schedules, Vault references, endpoint headers, and cron run history.

## 2. Application scheduler removal

- [x] 2.1 Remove Nitro scheduled-task configuration and the three task wrappers without changing private worker endpoints or business behavior.
- [x] 2.2 Add regression coverage proving no Vercel/Nitro scheduler configuration remains.

## 3. Operations and verification

- [x] 3.1 Update setup, rollout, API, operations-report, and AI documentation with Vault setup, local authenticated invocation, and Cron diagnostics.
- [x] 3.2 Apply the migration in Supabase SQL Editor.
- [ ] 3.3 Create the four Vault values per environment and verify all three job runs in staging.
- [ ] 3.4 Deploy with Nitro schedules removed; manually invoke each endpoint, then confirm its first Supabase Cron wake-up and worker-specific outcome.
