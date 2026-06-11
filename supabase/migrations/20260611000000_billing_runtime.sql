-- =============================================================================
-- Billing runtime schema — monthly operations workspace
-- =============================================================================
-- Operation list:
--   1. Create public.billing_periods
--   2. Create public.invoices
--   3. Create public.invoice_charges
--   4. Create public.invoice_payments
--   5. Create public.billing_utility_usages
--   6. Create public.billing_audit_events
--   7. Add updated_at triggers and enable RLS with role policies
--
-- Data impact: ADDITIVE ONLY. No existing tables, columns, or rows are modified
-- or dropped.
--
-- Execution model:
--   This script is intended for **manual** execution in the Supabase Dashboard
--   SQL Editor. Do NOT rely on `supabase db push`. After applying successfully,
--   regenerate database types:
--     npx supabase gen types typescript --project-id "$SUPABASE_PROJECT_REF" \
--       --schema public > app/types/database.types.ts
--
-- Idempotency: this script uses `IF NOT EXISTS` guards on tables/indexes/
-- triggers/policies so re-running it is safe.
-- =============================================================================


-- ----------------------------------------------------------------------------
-- Preflight: confirm the 6 billing tables do not already exist
-- ----------------------------------------------------------------------------
-- Run this block first to verify a clean slate. Expected result: 0 rows.
--
-- SELECT table_name
-- FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_name IN (
--     'billing_periods',
--     'invoices',
--     'invoice_charges',
--     'invoice_payments',
--     'billing_utility_usages',
--     'billing_audit_events'
--   );


-- ----------------------------------------------------------------------------
-- 1. billing_periods
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_periods (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id   uuid NOT NULL REFERENCES public.buildings(id) ON DELETE RESTRICT,
  period_year   integer NOT NULL CHECK (period_year BETWEEN 2000 AND 2100),
  period_month  integer NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  status        text NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','readings','review','issued','collecting','closed')),
  opened_by     uuid REFERENCES auth.users(id),
  issued_at     timestamptz,
  closed_at     timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_periods_building_year_month_uq
    UNIQUE (building_id, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_billing_periods_building_period
  ON public.billing_periods (building_id, period_year DESC, period_month DESC);

CREATE INDEX IF NOT EXISTS idx_billing_periods_status
  ON public.billing_periods (status);


-- ----------------------------------------------------------------------------
-- 2. invoices
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_period_id           uuid NOT NULL REFERENCES public.billing_periods(id) ON DELETE CASCADE,
  contract_id                 uuid NOT NULL REFERENCES public.contracts(id) ON DELETE RESTRICT,
  room_id                     uuid NOT NULL REFERENCES public.rooms(id) ON DELETE RESTRICT,
  tenant_id                   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  status                      text NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft','issued','partial','paid','overdue','void')),
  due_date                    date,
  issued_at                   timestamptz,
  paid_at                     timestamptz,
  voided_at                   timestamptz,
  voided_by                   uuid REFERENCES auth.users(id),
  void_reason                 text,
  superseded_by_invoice_id    uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  supersedes_invoice_id       uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  subtotal_amount             numeric(12,0) NOT NULL DEFAULT 0,
  discount_amount             numeric(12,0) NOT NULL DEFAULT 0,
  surcharge_amount            numeric(12,0) NOT NULL DEFAULT 0,
  total_amount                numeric(12,0) NOT NULL DEFAULT 0,
  paid_amount                 numeric(12,0) NOT NULL DEFAULT 0,
  balance_amount              numeric(12,0) NOT NULL DEFAULT 0,
  notes                       text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoices_void_reason_required
    CHECK (status <> 'void' OR (void_reason IS NOT NULL AND length(void_reason) > 0)),
  CONSTRAINT invoices_amounts_nonneg
    CHECK (
      subtotal_amount >= 0
      AND discount_amount >= 0
      AND surcharge_amount >= 0
      AND total_amount >= 0
      AND paid_amount >= 0
    )
);

-- One non-void invoice per (period, contract). Voided invoices may be replaced.
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_period_contract_active
  ON public.invoices (billing_period_id, contract_id)
  WHERE status <> 'void';

CREATE INDEX IF NOT EXISTS idx_invoices_period_status
  ON public.invoices (billing_period_id, status);

CREATE INDEX IF NOT EXISTS idx_invoices_contract
  ON public.invoices (contract_id);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant
  ON public.invoices (tenant_id);

-- Outstanding-debt lookup
CREATE INDEX IF NOT EXISTS idx_invoices_outstanding_balance
  ON public.invoices (balance_amount)
  WHERE balance_amount > 0;

CREATE INDEX IF NOT EXISTS idx_invoices_supersedes
  ON public.invoices (supersedes_invoice_id);


-- ----------------------------------------------------------------------------
-- 3. invoice_charges
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_charges (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  charge_type   text NOT NULL CHECK (charge_type IN (
                  'rent','electricity','water','service','discount','surcharge','adjustment'
                )),
  label         text NOT NULL,
  source_type   text,
  source_id     uuid,
  quantity      numeric(12,3) NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  unit_price    numeric(12,0) NOT NULL DEFAULT 0,
  amount        numeric(12,0) NOT NULL DEFAULT 0,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_charges_invoice_sort
  ON public.invoice_charges (invoice_id, sort_order);


-- ----------------------------------------------------------------------------
-- 4. invoice_payments
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount          numeric(12,0) NOT NULL CHECK (amount > 0),
  paid_at         date NOT NULL,
  payment_method  text,
  note            text,
  recorded_by     uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_paid_at
  ON public.invoice_payments (invoice_id, paid_at DESC);


-- ----------------------------------------------------------------------------
-- 5. billing_utility_usages
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_utility_usages (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_period_id       uuid NOT NULL REFERENCES public.billing_periods(id) ON DELETE CASCADE,
  room_id                 uuid NOT NULL REFERENCES public.rooms(id) ON DELETE RESTRICT,
  meter_type              text NOT NULL CHECK (meter_type IN ('electricity','water')),
  previous_reading_id     uuid REFERENCES public.meter_readings(id) ON DELETE SET NULL,
  previous_reading_value  numeric(12,3) NOT NULL CHECK (previous_reading_value >= 0),
  current_reading_id      uuid REFERENCES public.meter_readings(id) ON DELETE SET NULL,
  current_reading_value   numeric(12,3) NOT NULL CHECK (current_reading_value >= 0),
  old_meter_final_value   numeric(12,3) CHECK (old_meter_final_value IS NULL OR old_meter_final_value >= 0),
  new_meter_start_value   numeric(12,3) CHECK (new_meter_start_value IS NULL OR new_meter_start_value >= 0),
  billable_usage          numeric(12,3) NOT NULL CHECK (billable_usage >= 0),
  reason                  text NOT NULL DEFAULT 'normal'
                          CHECK (reason IN ('normal','replacement','reset','correction','manual_adjustment')),
  note                    text,
  created_by              uuid REFERENCES auth.users(id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_utility_usages_period_room_meter_uq
    UNIQUE (billing_period_id, room_id, meter_type)
);

CREATE INDEX IF NOT EXISTS idx_billing_utility_usages_room_meter
  ON public.billing_utility_usages (room_id, meter_type);

CREATE INDEX IF NOT EXISTS idx_billing_utility_usages_period
  ON public.billing_utility_usages (billing_period_id);


-- ----------------------------------------------------------------------------
-- 6. billing_audit_events
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_audit_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_period_id   uuid REFERENCES public.billing_periods(id) ON DELETE CASCADE,
  actor_id            uuid REFERENCES auth.users(id),
  action              text NOT NULL CHECK (length(action) > 0),
  entity_type         text NOT NULL CHECK (entity_type IN (
                        'billing_period','meter_reading','billing_utility_usage',
                        'invoice','invoice_charge','invoice_payment'
                      )),
  entity_id           uuid,
  before_data         jsonb,
  after_data          jsonb,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_audit_events_period_created
  ON public.billing_audit_events (billing_period_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_audit_events_entity_created
  ON public.billing_audit_events (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_audit_events_actor_created
  ON public.billing_audit_events (actor_id, created_at DESC);


-- ----------------------------------------------------------------------------
-- 7. updated_at triggers (uses existing public.set_updated_at())
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS billing_periods_set_updated_at ON public.billing_periods;
CREATE TRIGGER billing_periods_set_updated_at
  BEFORE UPDATE ON public.billing_periods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS invoices_set_updated_at ON public.invoices;
CREATE TRIGGER invoices_set_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS invoice_payments_set_updated_at ON public.invoice_payments;
CREATE TRIGGER invoice_payments_set_updated_at
  BEFORE UPDATE ON public.invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS billing_utility_usages_set_updated_at ON public.billing_utility_usages;
CREATE TRIGGER billing_utility_usages_set_updated_at
  BEFORE UPDATE ON public.billing_utility_usages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ----------------------------------------------------------------------------
-- 8. Row Level Security
-- ----------------------------------------------------------------------------
-- The server uses service-role for business reads/writes (bypasses RLS).
-- These policies are a safety net for any direct authenticated access.
--
-- Role check uses auth.jwt() -> 'app_metadata' ->> 'role' (avoiding the
-- deprecated auth.role()).
-- ----------------------------------------------------------------------------

ALTER TABLE public.billing_periods         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_charges         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_payments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_utility_usages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_audit_events    ENABLE ROW LEVEL SECURITY;

-- billing_periods --------------------------------------------------------------
DROP POLICY IF EXISTS billing_periods_admin_all ON public.billing_periods;
CREATE POLICY billing_periods_admin_all
  ON public.billing_periods
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS billing_periods_manager_select ON public.billing_periods;
CREATE POLICY billing_periods_manager_select
  ON public.billing_periods
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');

DROP POLICY IF EXISTS billing_periods_manager_insert ON public.billing_periods;
CREATE POLICY billing_periods_manager_insert
  ON public.billing_periods
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');

DROP POLICY IF EXISTS billing_periods_manager_update ON public.billing_periods;
CREATE POLICY billing_periods_manager_update
  ON public.billing_periods
  FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');

-- invoices ---------------------------------------------------------------------
DROP POLICY IF EXISTS invoices_admin_all ON public.invoices;
CREATE POLICY invoices_admin_all
  ON public.invoices
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS invoices_manager_select ON public.invoices;
CREATE POLICY invoices_manager_select
  ON public.invoices
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');

DROP POLICY IF EXISTS invoices_manager_insert ON public.invoices;
CREATE POLICY invoices_manager_insert
  ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');

DROP POLICY IF EXISTS invoices_manager_update ON public.invoices;
CREATE POLICY invoices_manager_update
  ON public.invoices
  FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');

-- invoice_charges --------------------------------------------------------------
DROP POLICY IF EXISTS invoice_charges_admin_all ON public.invoice_charges;
CREATE POLICY invoice_charges_admin_all
  ON public.invoice_charges
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS invoice_charges_manager_select ON public.invoice_charges;
CREATE POLICY invoice_charges_manager_select
  ON public.invoice_charges
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');

DROP POLICY IF EXISTS invoice_charges_manager_insert ON public.invoice_charges;
CREATE POLICY invoice_charges_manager_insert
  ON public.invoice_charges
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');

DROP POLICY IF EXISTS invoice_charges_manager_update ON public.invoice_charges;
CREATE POLICY invoice_charges_manager_update
  ON public.invoice_charges
  FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');

-- invoice_payments -------------------------------------------------------------
DROP POLICY IF EXISTS invoice_payments_admin_all ON public.invoice_payments;
CREATE POLICY invoice_payments_admin_all
  ON public.invoice_payments
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS invoice_payments_manager_select ON public.invoice_payments;
CREATE POLICY invoice_payments_manager_select
  ON public.invoice_payments
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');

DROP POLICY IF EXISTS invoice_payments_manager_insert ON public.invoice_payments;
CREATE POLICY invoice_payments_manager_insert
  ON public.invoice_payments
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');

DROP POLICY IF EXISTS invoice_payments_manager_update ON public.invoice_payments;
CREATE POLICY invoice_payments_manager_update
  ON public.invoice_payments
  FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');

-- billing_utility_usages -------------------------------------------------------
DROP POLICY IF EXISTS billing_utility_usages_admin_all ON public.billing_utility_usages;
CREATE POLICY billing_utility_usages_admin_all
  ON public.billing_utility_usages
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS billing_utility_usages_manager_select ON public.billing_utility_usages;
CREATE POLICY billing_utility_usages_manager_select
  ON public.billing_utility_usages
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');

DROP POLICY IF EXISTS billing_utility_usages_manager_insert ON public.billing_utility_usages;
CREATE POLICY billing_utility_usages_manager_insert
  ON public.billing_utility_usages
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');

DROP POLICY IF EXISTS billing_utility_usages_manager_update ON public.billing_utility_usages;
CREATE POLICY billing_utility_usages_manager_update
  ON public.billing_utility_usages
  FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');

-- billing_audit_events (append-only for managers) ------------------------------
DROP POLICY IF EXISTS billing_audit_events_admin_all ON public.billing_audit_events;
CREATE POLICY billing_audit_events_admin_all
  ON public.billing_audit_events
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS billing_audit_events_manager_select ON public.billing_audit_events;
CREATE POLICY billing_audit_events_manager_select
  ON public.billing_audit_events
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');

DROP POLICY IF EXISTS billing_audit_events_manager_insert ON public.billing_audit_events;
CREATE POLICY billing_audit_events_manager_insert
  ON public.billing_audit_events
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');


-- =============================================================================
-- Post-apply verification queries
-- =============================================================================
-- Run each block in the SQL Editor and confirm expected counts/rows.
-- =============================================================================

-- Tables exist
-- SELECT table_name
-- FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_name IN (
--     'billing_periods','invoices','invoice_charges',
--     'invoice_payments','billing_utility_usages','billing_audit_events'
--   )
-- ORDER BY table_name;

-- Columns
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name IN (
--     'billing_periods','invoices','invoice_charges',
--     'invoice_payments','billing_utility_usages','billing_audit_events'
--   )
-- ORDER BY table_name, ordinal_position;

-- Constraints
-- SELECT table_name, constraint_name, constraint_type
-- FROM information_schema.table_constraints
-- WHERE table_schema = 'public'
--   AND table_name IN (
--     'billing_periods','invoices','invoice_charges',
--     'invoice_payments','billing_utility_usages','billing_audit_events'
--   )
-- ORDER BY table_name, constraint_type, constraint_name;

-- Indexes
-- SELECT tablename, indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'billing_periods','invoices','invoice_charges',
--     'invoice_payments','billing_utility_usages','billing_audit_events'
--   )
-- ORDER BY tablename, indexname;

-- Triggers
-- SELECT event_object_table AS table_name, trigger_name
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'public'
--   AND event_object_table IN (
--     'billing_periods','invoices','invoice_payments','billing_utility_usages'
--   )
-- ORDER BY table_name, trigger_name;

-- RLS enabled + policy count
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'billing_periods','invoices','invoice_charges',
--     'invoice_payments','billing_utility_usages','billing_audit_events'
--   );
--
-- SELECT tablename, COUNT(*) AS policy_count
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'billing_periods','invoices','invoice_charges',
--     'invoice_payments','billing_utility_usages','billing_audit_events'
--   )
-- GROUP BY tablename
-- ORDER BY tablename;


-- =============================================================================
-- Rollback (run in this exact order — dependencies cascade)
-- =============================================================================
-- Note: dropping invoices cascades to invoice_charges and invoice_payments.
-- Dropping billing_periods cascades to invoices, billing_utility_usages,
-- and billing_audit_events.
--
-- DROP TABLE IF EXISTS public.billing_audit_events    CASCADE;
-- DROP TABLE IF EXISTS public.billing_utility_usages  CASCADE;
-- DROP TABLE IF EXISTS public.invoice_payments        CASCADE;
-- DROP TABLE IF EXISTS public.invoice_charges         CASCADE;
-- DROP TABLE IF EXISTS public.invoices                CASCADE;
-- DROP TABLE IF EXISTS public.billing_periods         CASCADE;
-- =============================================================================
