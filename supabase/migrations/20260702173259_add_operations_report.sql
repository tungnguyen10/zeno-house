-- =============================================================================
-- Operations report schema — building expenses + fixed costs
-- =============================================================================
-- Adds the operating-cost layer for the operations report. Revenue is read from
-- existing billing tables; this migration only adds cost inputs:
--   1. public.building_fixed_costs   — recurring costs with effective ranges (MVP: rent)
--   2. public.building_expenses      — monthly one-off operating expenses (soft-void)
--
-- Data impact: ADDITIVE ONLY. No existing tables, columns, or rows are modified
-- or dropped.
--
-- Execution model:
--   Apply manually in the Supabase Dashboard SQL Editor. Do NOT rely on
--   `supabase db push`. After applying successfully, regenerate database types:
--     npx supabase gen types typescript --project-id "$SUPABASE_PROJECT_REF" \
--       --schema public > app/types/database.types.ts
--
-- Idempotency: `IF NOT EXISTS` guards on tables/indexes/triggers/policies make
--   re-running this script safe.
-- =============================================================================


-- ----------------------------------------------------------------------------
-- 1. building_fixed_costs
-- ----------------------------------------------------------------------------
-- Recurring building costs (starting with rent) with a period-based effective
-- range so historical reports keep the correct cost after a rent change.
-- effective_to_* NULL means "still active".
CREATE TABLE IF NOT EXISTS public.building_fixed_costs (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id                 uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  category                    text NOT NULL DEFAULT 'rent'
                              CHECK (category IN ('rent')),
  amount                      numeric(12,0) NOT NULL CHECK (amount >= 0),
  effective_from_period_year  integer NOT NULL CHECK (effective_from_period_year BETWEEN 2000 AND 2100),
  effective_from_period_month integer NOT NULL CHECK (effective_from_period_month BETWEEN 1 AND 12),
  effective_to_period_year    integer CHECK (effective_to_period_year IS NULL OR effective_to_period_year BETWEEN 2000 AND 2100),
  effective_to_period_month   integer CHECK (effective_to_period_month IS NULL OR effective_to_period_month BETWEEN 1 AND 12),
  note                        text,
  created_by                  uuid REFERENCES auth.users(id),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT building_fixed_costs_effective_to_pair
    CHECK (
      (effective_to_period_year IS NULL AND effective_to_period_month IS NULL)
      OR (effective_to_period_year IS NOT NULL AND effective_to_period_month IS NOT NULL)
    ),
  CONSTRAINT building_fixed_costs_effective_order
    CHECK (
      effective_to_period_year IS NULL
      OR (effective_to_period_year * 12 + effective_to_period_month)
         >= (effective_from_period_year * 12 + effective_from_period_month)
    )
);

CREATE INDEX IF NOT EXISTS idx_building_fixed_costs_building_effective
  ON public.building_fixed_costs (building_id, category, effective_from_period_year, effective_from_period_month);


-- ----------------------------------------------------------------------------
-- 2. building_expenses
-- ----------------------------------------------------------------------------
-- Monthly one-off operating expenses. Financial records are soft-voided (never
-- hard-deleted): void stamps voided_at/voided_by and requires a void_reason.
CREATE TABLE IF NOT EXISTS public.building_expenses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id     uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  period_year     integer NOT NULL CHECK (period_year BETWEEN 2000 AND 2100),
  period_month    integer NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  expense_date    date,
  category        text NOT NULL CHECK (category IN (
                    'electricity_input','water_input','internet','cleaning','repair',
                    'admin_fee','supplies','staff','rent_adjustment','other'
                  )),
  amount          numeric(12,0) NOT NULL CHECK (amount >= 0),
  payee           text,
  payment_method  text,
  note            text,
  created_by      uuid REFERENCES auth.users(id),
  voided_at       timestamptz,
  voided_by       uuid REFERENCES auth.users(id),
  void_reason     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT building_expenses_void_reason_required
    CHECK (voided_at IS NULL OR (void_reason IS NOT NULL AND length(void_reason) > 0))
);

CREATE INDEX IF NOT EXISTS idx_building_expenses_building_period
  ON public.building_expenses (building_id, period_year DESC, period_month DESC);

CREATE INDEX IF NOT EXISTS idx_building_expenses_building_period_category
  ON public.building_expenses (building_id, period_year, period_month, category);

-- Active expenses (voided_at IS NULL) are the common read path; index them.
CREATE INDEX IF NOT EXISTS idx_building_expenses_active
  ON public.building_expenses (building_id, period_year, period_month)
  WHERE voided_at IS NULL;


-- ----------------------------------------------------------------------------
-- 3. updated_at triggers (uses existing public.set_updated_at())
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS building_fixed_costs_set_updated_at ON public.building_fixed_costs;
CREATE TRIGGER building_fixed_costs_set_updated_at
  BEFORE UPDATE ON public.building_fixed_costs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS building_expenses_set_updated_at ON public.building_expenses;
CREATE TRIGGER building_expenses_set_updated_at
  BEFORE UPDATE ON public.building_expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ----------------------------------------------------------------------------
-- 4. Row Level Security
-- ----------------------------------------------------------------------------
-- The server uses the service-role client for business reads/writes (bypasses
-- RLS). These policies are a deny-by-default safety net for any direct
-- authenticated access. Building scope is enforced in the service layer.
--
-- Role check uses auth.jwt() -> 'app_metadata' ->> 'role'. All three roles are
-- represented: admin (full), owner (full), manager (read + expense write).
-- ----------------------------------------------------------------------------

ALTER TABLE public.building_fixed_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.building_expenses    ENABLE ROW LEVEL SECURITY;

-- building_fixed_costs ---------------------------------------------------------
-- admin + owner: full access. manager: read-only. (fixed-cost config is
-- admin/owner only.)
DROP POLICY IF EXISTS building_fixed_costs_admin_owner_all ON public.building_fixed_costs;
CREATE POLICY building_fixed_costs_admin_owner_all
  ON public.building_fixed_costs
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'owner'))
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'owner'));

DROP POLICY IF EXISTS building_fixed_costs_manager_select ON public.building_fixed_costs;
CREATE POLICY building_fixed_costs_manager_select
  ON public.building_fixed_costs
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');

-- building_expenses ------------------------------------------------------------
-- admin + owner: full access (including void/delete).
DROP POLICY IF EXISTS building_expenses_admin_owner_all ON public.building_expenses;
CREATE POLICY building_expenses_admin_owner_all
  ON public.building_expenses
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'owner'))
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'owner'));

-- manager: read + create + update (no void/delete; delete stays admin/owner).
DROP POLICY IF EXISTS building_expenses_manager_select ON public.building_expenses;
CREATE POLICY building_expenses_manager_select
  ON public.building_expenses
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');

DROP POLICY IF EXISTS building_expenses_manager_insert ON public.building_expenses;
CREATE POLICY building_expenses_manager_insert
  ON public.building_expenses
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');

DROP POLICY IF EXISTS building_expenses_manager_update ON public.building_expenses;
CREATE POLICY building_expenses_manager_update
  ON public.building_expenses
  FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');


-- ----------------------------------------------------------------------------
-- Rollback (manual)
-- ----------------------------------------------------------------------------
-- DROP TABLE IF EXISTS public.building_expenses;
-- DROP TABLE IF EXISTS public.building_fixed_costs;
