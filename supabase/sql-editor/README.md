# Supabase SQL Editor scripts

These files are intentionally separate from migration history because this project applies database changes through Supabase Dashboard SQL Editor.

## Phase 2

1. Open Supabase Dashboard → SQL Editor.
2. Copy and run `phase-2-shared-expense-allocation.sql` as one script.
3. Confirm the transaction commits without errors.
4. Run the verification query at the bottom of the file; `security_type` must be `INVOKER`.
5. Exercise `POST /api/shared-expenses/:id/allocate` once on a test period, then repeat it and verify the second call returns conflict without inserting duplicates.

Run `phase-2-report-and-bulk-rpcs.sql` after the shared-expense script. It adds the Operations Report snapshot, set-based master-data actions, and evidence-backed hot-path indexes.

## Final Phase 3 database delta

Run `phase-3-final-dashboard-billing-rpcs.sql` before deploying the matching server code. It adds the scope-parameterized Dashboard snapshot, shared Billing Draft/Grid input snapshot, and stable SQL-backed audit pagination.

## Phase 3 verification

After applying both RPC scripts, run `phase-3-performance-verification.sql`. Save the three `EXPLAIN (ANALYZE, BUFFERS)` plans with the deployment benchmark. Every listed function must report `INVOKER`, browser roles must report `false`, and `service_role` must report `true`.

Do not deploy the matching server code before this SQL function exists. The function is callable only by `service_role`; browser roles are explicitly revoked.
