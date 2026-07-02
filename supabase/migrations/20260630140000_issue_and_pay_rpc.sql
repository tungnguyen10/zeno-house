-- =============================================================================
-- Billing transaction RPC — issue_and_pay (auto-issue on payment)
-- =============================================================================
-- Adds `public.issue_and_pay(...)`: a single PL/pgSQL transaction that issues
-- ONE invoice for a ready draft and records a full-balance payment against it,
-- emitting `invoices.issued` + `invoice.payment_recorded` audit events that
-- share a correlation id. Powers the one-click "Đã thu" action on a draft row.
--
-- The caller (TS service) recomputes the contract's draft server-side and
-- passes it as `p_draft` (same element shape used by `issue_period_invoices`),
-- so pricing/blocker logic stays in one place. This function only enforces the
-- DB invariants and atomicity.
--
-- Data impact: ADDITIVE ONLY. No existing tables, columns, indexes, policies
--   or data are modified. SECURITY INVOKER so existing RLS applies unchanged.
--
-- Execution model: apply manually in the Supabase Dashboard SQL Editor. Do NOT
--   rely on `supabase db push`. After applying, regenerate types:
--     npx supabase gen types typescript --project-id "$SUPABASE_PROJECT_REF" \
--       --schema public > app/types/database.types.ts
--
-- Idempotency: `CREATE OR REPLACE FUNCTION` makes re-runs safe.
--
-- Error codes (mapped by the service to API error envelopes):
--   P0002  → period not found            (NOT_FOUND)
--   P0001 + DETAIL.error_code = ...:
--     'PERIOD_LOCKED'    period is closed
--     'ALREADY_ISSUED'   contract already has a non-void invoice in the period
--     'DRAFT_NOT_READY'  line sum does not match the declared total
-- =============================================================================


CREATE OR REPLACE FUNCTION public.issue_and_pay(
  p_period_id      uuid,
  p_contract_id    uuid,
  p_actor_id       uuid,
  p_due_date       date,
  p_issued_at      timestamptz,
  p_payment_date   date,
  p_payment_method text,
  p_note           text,
  p_draft          jsonb,
  p_correlation_id uuid DEFAULT NULL
)
RETURNS SETOF public.invoices
LANGUAGE plpgsql
AS $$
DECLARE
  v_period           public.billing_periods%ROWTYPE;
  v_line_sum         numeric(12,0);
  v_declared_total   numeric(12,0);
  v_prefix           text;
  v_next_seq         integer;
  v_invoice_code     text;
  v_inserted_invoice public.invoices%ROWTYPE;
  v_payment_id       uuid;
  v_payment_method   text;
  v_paid_at_ts       timestamptz;
  v_status_before    text;
  v_correlation_id   uuid := COALESCE(p_correlation_id, gen_random_uuid());
BEGIN
  IF p_draft IS NULL OR jsonb_typeof(p_draft) <> 'object' THEN
    RAISE EXCEPTION 'p_draft must be a jsonb object';
  END IF;

  -- Serialize all writes that touch this period's invoice-code allocation.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_period_id::text, 0));

  SELECT * INTO v_period FROM public.billing_periods WHERE id = p_period_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'billing period % not found', p_period_id USING ERRCODE = 'P0002';
  END IF;
  IF v_period.status = 'closed' THEN
    RAISE EXCEPTION 'billing period % is closed', p_period_id
      USING ERRCODE = 'P0001',
            DETAIL  = json_build_object('error_code', 'PERIOD_LOCKED')::text;
  END IF;

  -- Re-check: contract must not already have a non-void invoice in this period.
  IF EXISTS (
    SELECT 1 FROM public.invoices
     WHERE billing_period_id = p_period_id
       AND contract_id = p_contract_id
       AND status <> 'void'
  ) THEN
    RAISE EXCEPTION 'contract % already issued in period %', p_contract_id, p_period_id
      USING ERRCODE = 'P0001',
            DETAIL  = json_build_object('error_code', 'ALREADY_ISSUED')::text;
  END IF;

  v_declared_total := (p_draft->>'total')::numeric;

  SELECT COALESCE(SUM((line->>'amount')::numeric), 0)
  INTO v_line_sum
  FROM jsonb_array_elements(COALESCE(p_draft->'lines', '[]'::jsonb)) AS line;

  IF v_line_sum <> v_declared_total THEN
    RAISE EXCEPTION
      'invoice line sum (%) does not match declared total (%) for contract %',
      v_line_sum, v_declared_total, p_contract_id
      USING ERRCODE = 'P0001',
            DETAIL  = json_build_object('error_code', 'DRAFT_NOT_READY')::text;
  END IF;

  -- Allocate the next monotonic invoice code under the advisory lock.
  v_prefix := format('inv-%s-%s', v_period.period_year, lpad(v_period.period_month::text, 2, '0'));
  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(invoice_code, '^' || v_prefix || '-', ''), '')::integer
  ), 0) + 1
  INTO v_next_seq
  FROM public.invoices
  WHERE invoice_code LIKE v_prefix || '-%';
  v_invoice_code := v_prefix || '-' || lpad(v_next_seq::text, 4, '0');

  -- Insert the invoice already marked paid (full-balance payment follows).
  v_paid_at_ts := p_payment_date::timestamptz;
  INSERT INTO public.invoices (
    invoice_code,
    billing_period_id,
    contract_id,
    room_id,
    tenant_id,
    status,
    due_date,
    issued_at,
    subtotal_amount,
    discount_amount,
    surcharge_amount,
    total_amount,
    paid_amount,
    balance_amount,
    paid_at,
    notes
  )
  VALUES (
    v_invoice_code,
    p_period_id,
    p_contract_id,
    (p_draft->>'room_id')::uuid,
    (p_draft->>'tenant_id')::uuid,
    'paid',
    p_due_date,
    p_issued_at,
    (p_draft->>'subtotal')::numeric,
    (p_draft->>'discount')::numeric,
    (p_draft->>'surcharge')::numeric,
    v_declared_total,
    v_declared_total,
    0,
    v_paid_at_ts,
    NULLIF(p_draft->>'notes', '')
  )
  RETURNING * INTO v_inserted_invoice;

  -- Insert all charges for this invoice.
  INSERT INTO public.invoice_charges (
    invoice_id,
    charge_type,
    label,
    source_type,
    source_id,
    quantity,
    unit_price,
    amount,
    metadata,
    sort_order
  )
  SELECT
    v_inserted_invoice.id,
    line->>'charge_type',
    line->>'label',
    NULLIF(line->>'source_type', ''),
    NULLIF(line->>'source_id', '')::uuid,
    COALESCE((line->>'quantity')::numeric, 1),
    COALESCE((line->>'unit_price')::numeric, 0),
    (line->>'amount')::numeric,
    COALESCE(line->'metadata', '{}'::jsonb),
    COALESCE((line->>'sort_order')::integer, idx - 1)
  FROM jsonb_array_elements(COALESCE(p_draft->'lines', '[]'::jsonb)) WITH ORDINALITY AS t(line, idx);

  -- Record the full-balance payment.
  v_payment_method := NULLIF(p_payment_method, '');
  INSERT INTO public.invoice_payments (
    invoice_id, amount, paid_at, payment_method, note, recorded_by
  )
  VALUES (
    v_inserted_invoice.id,
    v_declared_total,
    p_payment_date,
    v_payment_method,
    NULLIF(trim(p_note), ''),
    p_actor_id
  )
  RETURNING id INTO v_payment_id;

  -- Advance the period to `collecting` when below it (a payment was recorded).
  IF v_period.status <> 'collecting' THEN
    v_status_before := v_period.status;
    UPDATE public.billing_periods
       SET status    = 'collecting',
           issued_at = COALESCE(issued_at, p_issued_at)
     WHERE id = p_period_id;

    INSERT INTO public.billing_audit_events (
      billing_period_id, actor_id, action, entity_type, entity_id,
      correlation_id, before_data, after_data, metadata
    )
    VALUES (
      p_period_id, p_actor_id, 'period.status_changed', 'billing_period', p_period_id,
      v_correlation_id,
      jsonb_build_object('status', v_status_before),
      jsonb_build_object('status', 'collecting'),
      jsonb_build_object('trigger', 'auto_from_payment')
    );
  END IF;

  -- invoices.issued audit (single invoice).
  INSERT INTO public.billing_audit_events (
    billing_period_id, actor_id, action, entity_type, entity_id,
    correlation_id, metadata
  )
  VALUES (
    p_period_id, p_actor_id, 'invoices.issued', 'billing_period', p_period_id,
    v_correlation_id,
    jsonb_build_object(
      'issued_count', 1,
      'invoice_ids', to_jsonb(ARRAY[v_inserted_invoice.id]),
      'requested_contract_ids', to_jsonb(ARRAY[p_contract_id]),
      'due_date', p_due_date,
      'via', 'issue_and_pay'
    )
  );

  -- invoice.payment_recorded child audit (the invoice).
  INSERT INTO public.billing_audit_events (
    billing_period_id, actor_id, action, entity_type, entity_id,
    correlation_id, metadata
  )
  VALUES (
    p_period_id, p_actor_id, 'invoice.payment_recorded', 'invoice', v_inserted_invoice.id,
    v_correlation_id,
    jsonb_build_object(
      'payment_id', v_payment_id,
      'amount', v_declared_total,
      'payment_method', v_payment_method,
      'new_status', 'paid',
      'balance_after', 0,
      'via', 'issue_and_pay'
    )
  );

  RETURN QUERY SELECT * FROM public.invoices WHERE id = v_inserted_invoice.id;
END;
$$;


-- ----------------------------------------------------------------------------
-- Execute privileges
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.issue_and_pay(
  uuid, uuid, uuid, date, timestamptz, date, text, text, jsonb, uuid
) TO authenticated;


-- ----------------------------------------------------------------------------
-- Rollback (manual)
-- ----------------------------------------------------------------------------
-- DROP FUNCTION IF EXISTS public.issue_and_pay(
--   uuid, uuid, uuid, date, timestamptz, date, text, text, jsonb, uuid
-- );
