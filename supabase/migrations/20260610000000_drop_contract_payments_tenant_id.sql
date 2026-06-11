-- ============================================================================
-- Drop unused column: contract_payments.tenant_id
-- ----------------------------------------------------------------------------
-- Context:
--   `contract_payments` was designed contract-level (deposit / prepaid rent /
--   legacy rent / other). The optional `tenant_id` FK was reserved for
--   per-tenant attribution but was never set by any UI form and never read by
--   any composable / page. The plumbing through validator / mapper / repo
--   exists but is dead-end. Remove the column and its dependencies.
--
-- Apply manually in Supabase Dashboard → SQL Editor (per change
-- `cleanup-billing-readiness` decision D0).
-- DO NOT rely on `supabase db push`.
--
-- Operations:
--   1. DROP FK constraint  contract_payments_tenant_id_fkey
--   2. DROP COLUMN         contract_payments.tenant_id
--
-- Data-loss risk:
--   Any rows currently storing a non-null `tenant_id` lose that value. As of
--   change implementation no code writes this column, so production rows
--   should already have `tenant_id IS NULL`. Run the verification query below
--   BEFORE executing the drop and abort if it returns > 0 rows.
--
-- Verification BEFORE:
--   SELECT count(*) FROM contract_payments WHERE tenant_id IS NOT NULL;
--   -- Expected: 0
--
-- Verification AFTER:
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name = 'contract_payments' AND column_name = 'tenant_id';
--   -- Expected: empty result
--
-- Rollback:
--   ALTER TABLE contract_payments
--     ADD COLUMN tenant_id uuid NULL
--     REFERENCES tenants(id) ON DELETE RESTRICT;
-- ============================================================================

ALTER TABLE contract_payments
  DROP CONSTRAINT IF EXISTS contract_payments_tenant_id_fkey;

ALTER TABLE contract_payments
  DROP COLUMN IF EXISTS tenant_id;
