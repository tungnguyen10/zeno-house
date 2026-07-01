-- =============================================================================
-- invoice_payments — soft-delete columns (undo payment support)
-- =============================================================================
-- Adds soft-delete bookkeeping so a recorded payment can be undone without
-- losing history: `deleted_at`, `deleted_by`, `delete_reason`. The undo service
-- stamps these columns, then recomputes the invoice paid/balance/status from
-- the remaining (non-deleted) payments and emits a `payment.undone` audit.
--
-- Data impact: ADDITIVE ONLY. Three nullable columns + one partial index for
--   the "active payments" filter. No existing data is modified; all current
--   rows have NULL deleted_at and are therefore active.
--
-- Execution model: apply manually in the Supabase Dashboard SQL Editor. After
--   applying, regenerate types:
--     npx supabase gen types typescript --project-id "$SUPABASE_PROJECT_REF" \
--       --schema public > app/types/database.types.ts
--
-- Idempotency: IF NOT EXISTS guards make re-runs safe.
-- =============================================================================

ALTER TABLE public.invoice_payments
  ADD COLUMN IF NOT EXISTS deleted_at    timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by    uuid REFERENCES auth.users (id),
  ADD COLUMN IF NOT EXISTS delete_reason text;

-- Active payments (deleted_at IS NULL) are the common read path; index them.
CREATE INDEX IF NOT EXISTS idx_invoice_payments_active
  ON public.invoice_payments (invoice_id)
  WHERE deleted_at IS NULL;


-- ----------------------------------------------------------------------------
-- Rollback (manual)
-- ----------------------------------------------------------------------------
-- DROP INDEX IF EXISTS public.idx_invoice_payments_active;
-- ALTER TABLE public.invoice_payments
--   DROP COLUMN IF EXISTS delete_reason,
--   DROP COLUMN IF EXISTS deleted_by,
--   DROP COLUMN IF EXISTS deleted_at;
