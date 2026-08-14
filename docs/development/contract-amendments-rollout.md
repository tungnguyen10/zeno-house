# Contract Amendments Rollout

Contract amendments require a database migration, generated types, private runtime configuration,
and scheduler activation. Do not enable cron before the staging worker and audit transaction are
verified.

## 1. Apply the migration

Apply `supabase/migrations/20260814095628_contract_amendments.sql` through the Supabase Dashboard.
The migration creates the table, strict JSONB validator, audited draft/lifecycle/apply RPCs,
contract lifecycle guards, audit entity support, RLS/grants, and the five-minute cron definition.

Before the cron job wakes successfully, create these Vault secrets:

- `nitro_scheduler_base_url`: deployed application origin without a trailing slash
- `contract_amendments_apply_secret`: a high-entropy private value

Set the same worker value in the application as `NUXT_CONTRACT_AMENDMENTS_APPLY_SECRET`.

## 2. Regenerate database types

After the cloud migration is applied, regenerate `app/types/database.types.ts` with the repository's
normal Supabase type-generation command. Do not edit that generated file manually. Then replace the
isolated amendment table/RPC adapters in `server/repositories/contract-amendments/index.ts` with the
generated types where they are equivalent.

## 3. Verify staging

Run `supabase/verification/contract_amendments.sql` in the SQL editor and confirm every boolean/count
matches its alias. In staging, verify:

1. A future amendment publishes as `scheduled` and duplicate concurrent publish is rejected.
2. Calling the worker twice applies the row once, updates `contracts`, and produces one correlated
   amendment/contract audit pair.
3. A non-void invoice in the effective month blocks publication.
4. Billing draft calculation applies a due amendment before loading its input snapshot.
5. Primary tenant bootstrap includes scheduled/applied summaries; roommate bootstrap returns `[]`.
6. No portal response contains `contracts.notes`.

Run database security and performance advisors after verification. Review the amendment table and
RPC grants explicitly; browser roles must have no direct access.

## 4. Enable cron

Only after the staging worker returns success and audit verification passes, retain/enable the
`contract-amendments-apply-due` job. Monitor failed `pg_net` requests and amendment rows that remain
scheduled past `effective_date`. Billing remains a safety net, but it is not the primary scheduler.

Production rollback should disable/unschedule the cron first. Do not delete applied amendment rows
or rewrite issued invoices; deploy a corrective application change or a new legal amendment instead.
