-- =============================================================================
-- Billing transaction RPCs — correlation_id threading + bulk-payment children
-- =============================================================================
-- Extends `issue_period_invoices` and `record_bulk_payments` so that the audit
-- events they emit can be grouped by the audit drawer:
--
--   1. Both functions accept a new trailing `p_correlation_id uuid` argument.
--      The application generates a UUID v7 (time-ordered) and passes it so all
--      events from one atomic operation share an id. When NULL, the function
--      falls back to gen_random_uuid() so direct SQL calls still group.
--
--   2. `record_bulk_payments` now emits one child `invoice.payment_recorded`
--      audit event per payment (entity = the invoice) in ADDITION to the
--      parent `payments.bulk_recorded` event, all sharing the correlation id.
--      This satisfies the "Bulk payment audited with children" requirement.
--
-- Data impact: ADDITIVE. Re-creates two functions (new signatures). The old
--   6-arg / 2-arg signatures are dropped so no ambiguous overload remains.
--   No tables, columns, or data are modified. SECURITY INVOKER unchanged.
--
-- Execution model: apply manually in the Supabase Dashboard SQL Editor, then
--   regenerate types:
--     npx supabase gen types typescript --project-id "$SUPABASE_PROJECT_REF" \
--       --schema public > app/types/database.types.ts
--
-- Idempotency: DROP IF EXISTS + CREATE makes re-runs safe.
-- =============================================================================


-- Drop prior signatures so the new ones are unambiguous.
DROP FUNCTION IF EXISTS public.issue_period_invoices(uuid, uuid, date, timestamptz, uuid[], jsonb);
DROP FUNCTION IF EXISTS public.record_bulk_payments(uuid, jsonb);


-- ----------------------------------------------------------------------------
-- 1. issue_period_invoices (+ p_correlation_id)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.issue_period_invoices(
  p_period_id              uuid,
  p_actor_id               uuid,
  p_due_date               date,
  p_issued_at              timestamptz,
  p_requested_contract_ids uuid[],
  p_drafts                 jsonb,
  p_correlation_id         uuid DEFAULT NULL
)
RETURNS SETOF public.invoices
LANGUAGE plpgsql
AS $$
DECLARE
  v_period             public.billing_periods%ROWTYPE;
  v_draft              jsonb;
  v_line_sum           numeric(12,0);
  v_declared_total     numeric(12,0);
  v_prefix             text;
  v_next_seq           integer;
  v_invoice_code       text;
  v_inserted_invoice   public.invoices%ROWTYPE;
  v_inserted_ids       uuid[] := ARRAY[]::uuid[];
  v_status_changed     boolean := false;
  v_status_before      text;
  v_correlation_id     uuid := COALESCE(p_correlation_id, gen_random_uuid());
BEGIN
  IF p_drafts IS NULL OR jsonb_typeof(p_drafts) <> 'array' OR jsonb_array_length(p_drafts) = 0 THEN
    RAISE EXCEPTION 'p_drafts must be a non-empty jsonb array';
  END IF;

  -- Serialize all writes that touch this period's invoice-code allocation.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_period_id::text, 0));

  SELECT * INTO v_period FROM public.billing_periods WHERE id = p_period_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'billing period % not found', p_period_id USING ERRCODE = 'P0002';
  END IF;
  IF v_period.status = 'closed' THEN
    RAISE EXCEPTION 'billing period % is closed', p_period_id USING ERRCODE = 'P0001';
  END IF;

  v_prefix := format('inv-%s-%s', v_period.period_year, lpad(v_period.period_month::text, 2, '0'));

  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(invoice_code, '^' || v_prefix || '-', ''), '')::integer
  ), 0) + 1
  INTO v_next_seq
  FROM public.invoices
  WHERE invoice_code LIKE v_prefix || '-%';

  FOR v_draft IN SELECT * FROM jsonb_array_elements(p_drafts)
  LOOP
    v_declared_total := (v_draft->>'total')::numeric;

    SELECT COALESCE(SUM((line->>'amount')::numeric), 0)
    INTO v_line_sum
    FROM jsonb_array_elements(COALESCE(v_draft->'lines', '[]'::jsonb)) AS line;

    IF v_line_sum <> v_declared_total THEN
      RAISE EXCEPTION
        'invoice line sum (%) does not match declared total (%) for contract %',
        v_line_sum, v_declared_total, v_draft->>'contract_id'
        USING ERRCODE = 'P0001';
    END IF;

    v_invoice_code := v_prefix || '-' || lpad(v_next_seq::text, 4, '0');
    v_next_seq := v_next_seq + 1;

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
      balance_amount,
      notes
    )
    VALUES (
      v_invoice_code,
      p_period_id,
      (v_draft->>'contract_id')::uuid,
      (v_draft->>'room_id')::uuid,
      (v_draft->>'tenant_id')::uuid,
      'issued',
      p_due_date,
      p_issued_at,
      (v_draft->>'subtotal')::numeric,
      (v_draft->>'discount')::numeric,
      (v_draft->>'surcharge')::numeric,
      v_declared_total,
      v_declared_total,
      NULLIF(v_draft->>'notes', '')
    )
    RETURNING * INTO v_inserted_invoice;

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
    FROM jsonb_array_elements(COALESCE(v_draft->'lines', '[]'::jsonb)) WITH ORDINALITY AS t(line, idx);

    v_inserted_ids := array_append(v_inserted_ids, v_inserted_invoice.id);
  END LOOP;

  IF v_period.status NOT IN ('issued', 'collecting') THEN
    v_status_before := v_period.status;
    UPDATE public.billing_periods
       SET status = 'issued',
           issued_at = COALESCE(issued_at, p_issued_at)
     WHERE id = p_period_id;
    v_status_changed := true;
  END IF;

  IF v_status_changed THEN
    INSERT INTO public.billing_audit_events (
      billing_period_id, actor_id, action, entity_type, entity_id,
      correlation_id, before_data, after_data, metadata
    )
    VALUES (
      p_period_id, p_actor_id, 'period.status_changed', 'billing_period', p_period_id,
      v_correlation_id,
      jsonb_build_object('status', v_status_before),
      jsonb_build_object('status', 'issued'),
      jsonb_build_object('trigger', 'auto_from_issue')
    );
  END IF;

  INSERT INTO public.billing_audit_events (
    billing_period_id, actor_id, action, entity_type, entity_id,
    correlation_id, metadata
  )
  VALUES (
    p_period_id, p_actor_id, 'invoices.issued', 'billing_period', p_period_id,
    v_correlation_id,
    jsonb_build_object(
      'issued_count', array_length(v_inserted_ids, 1),
      'invoice_ids', to_jsonb(v_inserted_ids),
      'requested_contract_ids', to_jsonb(p_requested_contract_ids),
      'due_date', p_due_date
    )
  );

  RETURN QUERY
    SELECT * FROM public.invoices WHERE id = ANY(v_inserted_ids)
    ORDER BY invoice_code;
END;
$$;


-- ----------------------------------------------------------------------------
-- 2. record_bulk_payments (+ p_correlation_id, + child events)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_bulk_payments(
  p_actor_id       uuid,
  p_payments       jsonb,
  p_correlation_id uuid DEFAULT NULL
)
RETURNS SETOF public.invoice_payments
LANGUAGE plpgsql
AS $$
DECLARE
  v_item            jsonb;
  v_idx             integer := 0;
  v_invoice         public.invoices%ROWTYPE;
  v_period_status   text;
  v_amount          numeric(12,0);
  v_new_paid        numeric(12,0);
  v_new_balance     numeric(12,0);
  v_new_status      text;
  v_paid_at_ts      timestamptz;
  v_composed_note   text;
  v_payment_method  text;
  v_payment_id      uuid;
  v_inserted_ids    uuid[] := ARRAY[]::uuid[];
  v_period_ids      uuid[] := ARRAY[]::uuid[];
  v_invoice_ids     uuid[] := ARRAY[]::uuid[];
  v_total_amount    numeric(12,0) := 0;
  v_period_id       uuid;
  v_audit_period_id uuid;
  v_correlation_id  uuid := COALESCE(p_correlation_id, gen_random_uuid());
BEGIN
  IF p_payments IS NULL OR jsonb_typeof(p_payments) <> 'array' OR jsonb_array_length(p_payments) = 0 THEN
    RAISE EXCEPTION 'p_payments must be a non-empty jsonb array';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_amount := (v_item->>'amount')::numeric;

    SELECT * INTO v_invoice
      FROM public.invoices
     WHERE id = (v_item->>'invoice_id')::uuid
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'invoice % not found', v_item->>'invoice_id'
        USING ERRCODE = 'P0001',
              DETAIL  = json_build_object('failed_index', v_idx, 'failed_reason', 'Không tìm thấy hoá đơn')::text;
    END IF;
    IF v_invoice.status = 'void' THEN
      RAISE EXCEPTION 'invoice % is void', v_invoice.id
        USING ERRCODE = 'P0001',
              DETAIL  = json_build_object('failed_index', v_idx, 'failed_reason', 'Hoá đơn đã huỷ — không thể ghi nhận thanh toán')::text;
    END IF;
    IF v_amount > v_invoice.balance_amount THEN
      RAISE EXCEPTION 'amount % exceeds balance %', v_amount, v_invoice.balance_amount
        USING ERRCODE = 'P0001',
              DETAIL  = json_build_object(
                'failed_index', v_idx,
                'failed_reason', 'Số tiền vượt quá công nợ còn lại của hoá đơn'
              )::text;
    END IF;

    SELECT status INTO v_period_status
      FROM public.billing_periods
     WHERE id = v_invoice.billing_period_id;
    IF v_period_status = 'closed' THEN
      RAISE EXCEPTION 'period of invoice % is closed', v_invoice.id
        USING ERRCODE = 'P0001',
              DETAIL  = json_build_object(
                'failed_index', v_idx,
                'failed_reason', 'Kỳ đã chốt — không thể ghi nhận thanh toán mới'
              )::text;
    END IF;

    v_new_paid    := v_invoice.paid_amount + v_amount;
    v_new_balance := v_invoice.total_amount - v_new_paid;
    IF v_new_balance <= 0 THEN
      v_new_status := 'paid';
      v_paid_at_ts := (v_item->>'payment_date')::timestamptz;
    ELSIF v_new_paid > 0 THEN
      v_new_status := 'partial';
      v_paid_at_ts := NULL;
    ELSE
      v_new_status := v_invoice.status;
      v_paid_at_ts := NULL;
    END IF;

    v_payment_method := NULLIF(v_item->>'payment_method', '');
    v_composed_note := CASE
      WHEN COALESCE(NULLIF(trim(v_item->>'reference'), ''), '') <> '' THEN
        trim(format('[%s] %s', trim(v_item->>'reference'), COALESCE(NULLIF(trim(v_item->>'note'), ''), '')))
      ELSE
        NULLIF(trim(v_item->>'note'), '')
    END;

    INSERT INTO public.invoice_payments (
      invoice_id, amount, paid_at, payment_method, note, recorded_by
    )
    VALUES (
      v_invoice.id,
      v_amount,
      (v_item->>'payment_date')::date,
      v_payment_method,
      v_composed_note,
      p_actor_id
    )
    RETURNING id INTO v_payment_id;
    v_inserted_ids := array_append(v_inserted_ids, v_payment_id);

    UPDATE public.invoices
       SET paid_amount    = v_new_paid,
           balance_amount = v_new_balance,
           status         = v_new_status,
           paid_at        = v_paid_at_ts
     WHERE id = v_invoice.id;

    -- Child audit event for this individual payment, sharing the batch
    -- correlation id so the drawer can expand the parent into its children.
    INSERT INTO public.billing_audit_events (
      billing_period_id, actor_id, action, entity_type, entity_id,
      correlation_id, metadata
    )
    VALUES (
      v_invoice.billing_period_id, p_actor_id, 'invoice.payment_recorded', 'invoice', v_invoice.id,
      v_correlation_id,
      jsonb_build_object(
        'payment_id', v_payment_id,
        'amount', v_amount,
        'payment_method', v_payment_method,
        'new_status', v_new_status,
        'balance_after', v_new_balance,
        'via', 'payments.bulk_recorded'
      )
    );

    v_invoice_ids   := array_append(v_invoice_ids, v_invoice.id);
    v_total_amount  := v_total_amount + v_amount;
    IF NOT (v_invoice.billing_period_id = ANY(v_period_ids)) THEN
      v_period_ids := array_append(v_period_ids, v_invoice.billing_period_id);
    END IF;

    v_idx := v_idx + 1;
  END LOOP;

  FOR v_period_id IN SELECT unnest(v_period_ids)
  LOOP
    SELECT status INTO v_period_status FROM public.billing_periods WHERE id = v_period_id;
    IF v_period_status = 'issued' THEN
      UPDATE public.billing_periods SET status = 'collecting' WHERE id = v_period_id;
      INSERT INTO public.billing_audit_events (
        billing_period_id, actor_id, action, entity_type, entity_id,
        correlation_id, before_data, after_data, metadata
      )
      VALUES (
        v_period_id, p_actor_id, 'period.status_changed', 'billing_period', v_period_id,
        v_correlation_id,
        jsonb_build_object('status', 'issued'),
        jsonb_build_object('status', 'collecting'),
        jsonb_build_object('trigger', 'auto_from_payment')
      );
    END IF;
  END LOOP;

  v_audit_period_id := CASE WHEN array_length(v_period_ids, 1) = 1 THEN v_period_ids[1] ELSE NULL END;
  INSERT INTO public.billing_audit_events (
    billing_period_id, actor_id, action, entity_type, entity_id,
    correlation_id, metadata
  )
  VALUES (
    v_audit_period_id, p_actor_id, 'payments.bulk_recorded', 'billing_period', v_audit_period_id,
    v_correlation_id,
    jsonb_build_object(
      'count', array_length(v_inserted_ids, 1),
      'total_amount', v_total_amount,
      'invoice_ids', to_jsonb(v_invoice_ids)
    )
  );

  RETURN QUERY
    SELECT * FROM public.invoice_payments
     WHERE id = ANY(v_inserted_ids)
     ORDER BY array_position(v_inserted_ids, id);
END;
$$;


-- ----------------------------------------------------------------------------
-- 3. Execute privileges (new signatures)
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.issue_period_invoices(uuid, uuid, date, timestamptz, uuid[], jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_bulk_payments(uuid, jsonb, uuid) TO authenticated;


-- ----------------------------------------------------------------------------
-- Rollback (manual)
-- ----------------------------------------------------------------------------
-- DROP FUNCTION IF EXISTS public.issue_period_invoices(uuid, uuid, date, timestamptz, uuid[], jsonb, uuid);
-- DROP FUNCTION IF EXISTS public.record_bulk_payments(uuid, jsonb, uuid);
-- Then re-apply 20260626000000_billing_transaction_rpcs.sql to restore the
-- prior signatures.
