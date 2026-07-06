-- =============================================================================
-- Utility Override Approval Workflow
-- =============================================================================
-- Operation list:
--   1. Add `approved_by` and `approved_at` columns to billing_utility_usages
--   2. Update RLS policies to allow approval
--
-- Purpose:
--   Blocks issuance of invoices when utility overrides exist in pending approval
--   state. Overrides must be explicitly approved before period can transition
--   to issued status.
--
-- Data impact: ADDITIVE ONLY. Adds 2 new columns, updates RLS policies.
--   Existing overrides default to approved_by=created_by, approved_at=now()
--   on apply to avoid blocking current billings.
--
-- Idempotency: Uses `IF NOT EXISTS` and `DROP POLICY IF EXISTS` patterns.
-- =============================================================================

-- Add approval columns to billing_utility_usages
ALTER TABLE IF EXISTS public.billing_utility_usages
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Update all existing rows (without approval) to auto-approve by creator
UPDATE public.billing_utility_usages
SET
  approved_by = created_by,
  approved_at = created_at
WHERE approved_by IS NULL;

-- Create partial index on approval status for efficient querying unapproved overrides
CREATE INDEX IF NOT EXISTS idx_billing_utility_usages_approval_status
  ON public.billing_utility_usages (billing_period_id)
  WHERE approved_by IS NULL;

-- Update RLS policies: managers can update approved_by/approved_at
DROP POLICY IF EXISTS billing_utility_usages_manager_update ON public.billing_utility_usages;
CREATE POLICY billing_utility_usages_manager_update
  ON public.billing_utility_usages
  FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager'))
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'manager'));

-- Existing admin/manager/select policies remain unchanged (enforced by Postgres)
