-- =============================================================================
-- Atomic create_contract_with_handover RPC
-- =============================================================================
-- Inserts one contract and its two handover_in meter readings (electricity +
-- water) in a single PL/pgSQL transaction. Contract code allocation runs
-- under a per-building advisory lock to avoid a TOCTOU race when two creates
-- target the same building at the same time.
--
-- Data impact: ADDITIVE ONLY. No tables, columns, indexes, policies or data
-- are modified. The function is SECURITY INVOKER so existing RLS policies
-- (admin/manager) continue to apply.
--
-- Execution model: apply manually in the Supabase Dashboard SQL Editor; do
-- NOT rely on `supabase db push`. After applying, regenerate database types:
--   npx supabase gen types typescript --project-id "$SUPABASE_PROJECT_REF" \
--     --schema public > app/types/database.types.ts
--
-- Idempotency: CREATE OR REPLACE FUNCTION makes re-runs safe.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_contract_with_handover(
  p_room_id                       uuid,
  p_tenant_id                     uuid,
  p_building_id                   uuid,
  p_start_date                    date,
  p_end_date                      date,
  p_monthly_rent                  numeric,
  p_deposit                       numeric,
  p_payment_day                   smallint,
  p_occupant_count                integer,
  p_discount_amount               numeric,
  p_surcharge_amount              numeric,
  p_status                        text,
  p_notes                         text,
  p_handover_electricity_reading  numeric,
  p_handover_water_reading        numeric,
  p_handover_reading_date         date,
  p_recorded_by                   uuid
)
RETURNS SETOF public.contracts
LANGUAGE plpgsql
AS $$
DECLARE
  v_building_code     text;
  v_year              integer;
  v_prefix            text;
  v_next_seq          integer;
  v_contract_code     text;
  v_inserted_contract public.contracts%ROWTYPE;
  v_period_year       integer;
  v_period_month      integer;
BEGIN
  IF p_end_date <= p_start_date THEN
    RAISE EXCEPTION 'end_date must be after start_date'
      USING ERRCODE = 'P0001';
  END IF;

  -- Resolve building code for the contract_code prefix.
  SELECT code INTO v_building_code FROM public.buildings WHERE id = p_building_id;
  IF v_building_code IS NULL THEN
    RAISE EXCEPTION 'building % not found', p_building_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Serialize contract_code allocation per building so two concurrent creates
  -- cannot pick the same sequence number.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_building_id::text, 1));

  v_year := EXTRACT(YEAR FROM p_start_date)::integer;
  v_prefix := format('hd-%s-%s', v_building_code, v_year);

  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(contract_code, '^' || v_prefix || '-', ''), '')::integer
  ), 0) + 1
  INTO v_next_seq
  FROM public.contracts
  WHERE contract_code LIKE v_prefix || '-%';

  v_contract_code := v_prefix || '-' || lpad(v_next_seq::text, 4, '0');

  INSERT INTO public.contracts (
    contract_code,
    room_id,
    tenant_id,
    building_id,
    start_date,
    end_date,
    monthly_rent,
    deposit,
    payment_day,
    occupant_count,
    discount_amount,
    surcharge_amount,
    status,
    notes
  )
  VALUES (
    v_contract_code,
    p_room_id,
    p_tenant_id,
    p_building_id,
    p_start_date,
    p_end_date,
    p_monthly_rent,
    COALESCE(p_deposit, 0),
    p_payment_day,
    COALESCE(p_occupant_count, 1),
    COALESCE(p_discount_amount, 0),
    COALESCE(p_surcharge_amount, 0),
    COALESCE(p_status, 'active'),
    NULLIF(p_notes, '')
  )
  RETURNING * INTO v_inserted_contract;

  -- Derive billing period from the handover reading date.
  v_period_year := EXTRACT(YEAR FROM p_handover_reading_date)::integer;
  v_period_month := EXTRACT(MONTH FROM p_handover_reading_date)::integer;

  -- Insert both handover_in readings. Any unique violation on
  -- (room_id, meter_type, period_year, period_month, reading_type) rolls back
  -- the whole transaction including the contract insert.
  INSERT INTO public.meter_readings (
    room_id, building_id, meter_type, reading_type,
    period_year, period_month, reading_date, reading_value, recorded_by
  )
  VALUES
    (p_room_id, p_building_id, 'electricity', 'handover_in',
     v_period_year, v_period_month, p_handover_reading_date,
     p_handover_electricity_reading, p_recorded_by),
    (p_room_id, p_building_id, 'water', 'handover_in',
     v_period_year, v_period_month, p_handover_reading_date,
     p_handover_water_reading, p_recorded_by);

  RETURN QUERY SELECT * FROM public.contracts WHERE id = v_inserted_contract.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_contract_with_handover(
  uuid, uuid, uuid, date, date, numeric, numeric, smallint, integer,
  numeric, numeric, text, text, numeric, numeric, date, uuid
) TO authenticated;
