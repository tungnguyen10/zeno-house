-- Migration: Create billing tables
-- billing_periods, billing_runs, billing_items, billing_contract_snapshots, billing_service_snapshots, billing_utility_snapshots

-- ============================================================
-- billing_periods
-- ============================================================
CREATE TABLE public.billing_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  period_year smallint NOT NULL CHECK (period_year BETWEEN 2020 AND 2100),
  period_month smallint NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized')),
  finalized_at timestamptz,
  finalized_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (building_id, period_year, period_month)
);

CREATE TRIGGER billing_periods_updated_at
  BEFORE UPDATE ON public.billing_periods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.billing_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_periods_select" ON public.billing_periods
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "billing_periods_insert" ON public.billing_periods
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "billing_periods_update" ON public.billing_periods
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "billing_periods_delete" ON public.billing_periods
  FOR DELETE TO authenticated USING (true);

-- ============================================================
-- billing_runs
-- ============================================================
CREATE TABLE public.billing_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_period_id uuid NOT NULL REFERENCES public.billing_periods(id) ON DELETE CASCADE,
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generated')),
  schema_version smallint NOT NULL DEFAULT 1,
  generated_at timestamptz,
  generated_by uuid REFERENCES auth.users(id),
  item_count int NOT NULL DEFAULT 0,
  total_amount numeric(15,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER billing_runs_updated_at
  BEFORE UPDATE ON public.billing_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.billing_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_runs_select" ON public.billing_runs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "billing_runs_insert" ON public.billing_runs
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "billing_runs_update" ON public.billing_runs
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "billing_runs_delete" ON public.billing_runs
  FOR DELETE TO authenticated USING (true);

-- ============================================================
-- billing_items
-- ============================================================
CREATE TABLE public.billing_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_run_id uuid NOT NULL REFERENCES public.billing_runs(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.rooms(id),
  contract_id uuid NOT NULL REFERENCES public.contracts(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),

  rent_amount numeric(15,2) NOT NULL DEFAULT 0,
  service_amount numeric(15,2) NOT NULL DEFAULT 0,
  electricity_amount numeric(15,2) NOT NULL DEFAULT 0,
  water_amount numeric(15,2) NOT NULL DEFAULT 0,
  utility_amount numeric(15,2) NOT NULL DEFAULT 0,
  total_amount numeric(15,2) NOT NULL DEFAULT 0,

  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid')),
  paid_at timestamptz,
  paid_by uuid REFERENCES auth.users(id),
  payment_method text CHECK (payment_method IN ('cash', 'bank_transfer', 'other')),
  payment_note text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER billing_items_updated_at
  BEFORE UPDATE ON public.billing_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.billing_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_items_select" ON public.billing_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "billing_items_insert" ON public.billing_items
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "billing_items_update" ON public.billing_items
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "billing_items_delete" ON public.billing_items
  FOR DELETE TO authenticated USING (true);

-- ============================================================
-- billing_contract_snapshots (1:1 with billing_items)
-- ============================================================
CREATE TABLE public.billing_contract_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_item_id uuid NOT NULL UNIQUE REFERENCES public.billing_items(id) ON DELETE CASCADE,
  monthly_rent numeric(15,2) NOT NULL,
  surcharge_amount numeric(15,2) NOT NULL DEFAULT 0,
  discount_amount numeric(15,2) NOT NULL DEFAULT 0,
  payment_day smallint,
  occupant_count smallint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_contract_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_contract_snapshots_select" ON public.billing_contract_snapshots
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "billing_contract_snapshots_insert" ON public.billing_contract_snapshots
  FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- billing_service_snapshots (1:many with billing_items)
-- ============================================================
CREATE TABLE public.billing_service_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_item_id uuid NOT NULL REFERENCES public.billing_items(id) ON DELETE CASCADE,
  catalog_id uuid REFERENCES public.service_catalog(id),
  service_name text NOT NULL,
  pricing_type text NOT NULL CHECK (pricing_type IN ('fixed', 'per_person')),
  amount numeric(15,2) NOT NULL,
  quantity smallint NOT NULL DEFAULT 1,
  total numeric(15,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_service_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_service_snapshots_select" ON public.billing_service_snapshots
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "billing_service_snapshots_insert" ON public.billing_service_snapshots
  FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- billing_utility_snapshots (1:many with billing_items)
-- ============================================================
CREATE TABLE public.billing_utility_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_item_id uuid NOT NULL REFERENCES public.billing_items(id) ON DELETE CASCADE,
  meter_type text NOT NULL CHECK (meter_type IN ('electricity', 'water')),
  old_reading numeric,
  new_reading numeric,
  consumption numeric,
  unit_price numeric(15,2),
  total numeric(15,2) NOT NULL DEFAULT 0,
  is_adjusted boolean NOT NULL DEFAULT false,
  adjustment_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_utility_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_utility_snapshots_select" ON public.billing_utility_snapshots
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "billing_utility_snapshots_insert" ON public.billing_utility_snapshots
  FOR INSERT TO authenticated WITH CHECK (true);
