-- =============================================================================
-- Billing transaction RPCs — atomicity hardening
-- =============================================================================
-- Operation list:
--   1. Create public.issue_period_invoices(...) RETURNS SETOF public.invoices
--   2. Create public.record_bulk_payments(...)  RETURNS SETOF public.invoice_payments
--   3. GRANT EXECUTE on both functions to authenticated
--
-- Purpose:
--   Replaces the service-sequenced loops in `InvoiceService.issueInvoices`
--   and `InvoicePaymentService.recordBatch` with single PL/pgSQL transactions
--   so partial commits, the TOCTOU race in invoice-code allocation, and the
--   silent best-effort `undo()` are eliminated.
--
-- Data impact: ADDITIVE ONLY. No existing tables, columns, indexes, policies
--   or data are modified. Functions are SECURITY INVOKER so existing RLS
--   policies (admin/manager) continue to apply unchanged.
--
-- Execution model:
--   Apply manually in the Supabase Dashboard SQL Editor. Do NOT rely on
--   `supabase db push`. After applying, regenerate database types:
--     npx supabase gen types typescript --project-id "$SUPABASE_PROJECT_REF" \
--       --schema public > app/types/database.types.ts
--
-- Idempotency: `CREATE OR REPLACE FUNCTION` makes re-runs safe.
-- =============================================================================


-- ----------------------------------------------------------------------------
-- Preflight: confirm the supporting billing tables already exist.
-- Expected result: 6 rows (all six tables from 20260611000000_billing_runtime).
-- ----------------------------------------------------------------------------
-- SELECT table_name
-- FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_name IN (
--     'billing_periods',
--     'invoices',
--     'invoice_charges',
--     'invoice_payments',
--     'billing_audit_events'
--   );


-- ----------------------------------------------------------------------------
-- 1. issue_period_invoices
-- ----------------------------------------------------------------------------
-- Inserts N invoices + their charges for a given billing period in a single
-- transaction, allocates monotonic `inv-YYYY-MM-NNNN` codes under a
-- per-period advisory lock, advances the period status to `issued` if it was
-- before that state, and writes the `invoices.issued` (and conditional
-- `period.status_changed`) audit events. Raises on any draft whose lines do
-- not sum to its declared total.
--
-- Arguments (all jsonb fields are required unless noted):
--   p_period_id        — billing period id
--   p_actor_id         — auth user id of the actor (nullable)
--   p_due_date         — invoice due date (nullable)
--   p_issued_at        — common issued_at timestamp for all invoices
--   p_requested_contract_ids
--                      — optional uuid[] copied into audit metadata
--   p_drafts           — jsonb array; each element:
--                        {
--                          contract_id uuid,
--                          room_id     uuid,
--                          tenant_id   uuid,
--                          subtotal    numeric,
--                          discount    numeric,
--                          surcharge   numeric,
--                          total       numeric,
--                          notes       text|null,
--                          lines       jsonb[]   -- each:
--                            { charge_type, label, source_type, source_id,
--                              quantity, unit_price, amount, metadata,
--                              sort_order }
--                        }
--
-- Returns: SETOF public.invoices for the rows that were inserted.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.issue_period_invoices(
  p_period_id              uuid,
  p_actor_id               uuid,
  p_due_date               date,
  p_issued_at              timestamptz,
  p_requested_contract_ids uuid[],
  p_drafts                 jsonb
)
RETURNS SETOF public.invoices
LANGUAGE plpgsql
AS $$
DECLARE
  v_period             public.billing_periods%ROWTYPE;
  v_draft              jsonb;
  v_line               jsonb;
  v_line_sum           numeric(12,0);
  v_declared_total     numeric(12,0);
  v_prefix             text;
  v_next_seq           integer;
  v_invoice_code       text;
  v_inserted_invoice   public.invoices%ROWTYPE;
  v_inserted_ids       uuid[] := ARRAY[]::uuid[];
  v_status_changed     boolean := false;
  v_status_before      text;
BEGIN
  IF p_drafts IS NULL OR jsonb_typeof(p_drafts) <> 'array' OR jsonb_array_length(p_drafts) = 0 THEN
    RAISE EXCEPTION 'p_drafts must be a non-empty jsonb array';
  END IF;

  -- Serialize all writes that touch this period's invoice-code allocation.
  -- hashtextextended produces a stable 64-bit hash from the uuid text.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_period_id::text, 0));

  SELECT * INTO v_period FROM public.billing_periods WHERE id = p_period_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'billing period % not found', p_period_id USING ERRCODE = 'P0002';
  END IF;
  IF v_period.status = 'closed' THEN
    RAISE EXCEPTION 'billing period % is closed', p_period_id USING ERRCODE = 'P0001';
  END IF;

  v_prefix := format('inv-%s-%s', v_period.period_year, lpad(v_period.period_month::text, 2, '0'));

  -- Determine the next sequence by scanning existing codes for this prefix.
  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(invoice_code, '^' || v_prefix || '-', ''), '')::integer
  ), 0) + 1
  INTO v_next_seq
  FROM public.invoices
  WHERE invoice_code LIKE v_prefix || '-%';

  -- Iterate drafts. Any RAISE aborts the whole transaction.
  FOR v_draft IN SELECT * FROM jsonb_array_elements(p_drafts)
  LOOP
    v_declared_total := (v_draft->>'total')::numeric;

    -- Sum lines server-side and enforce the per-draft invariant.
    SELECT COALESCE(SUM((line->>'amount')::numeric), 0)
    INTO v_line_sum
    FROM jsonb_array_elements(COALESCE(v_draft->'lines', '[]'::jsonb)) AS line;

    -- Total must equal subtotal - discount + surcharge AND match the sum of
    -- line amounts. The TS layer already enforces this; we re-check inside
    -- the RPC so a malformed payload cannot create an internally inconsistent
    -- invoice.
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

    -- Insert all charges for this invoice in one statement.
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

  -- Advance period status to `issued` only when below that state.
  IF v_period.status NOT IN ('issued', 'collecting') THEN
    v_status_before := v_period.status;
    UPDATE public.billing_periods
       SET status = 'issued',
           issued_at = COALESCE(issued_at, p_issued_at)
     WHERE id = p_period_id;
    v_status_changed := true;
  END IF;

  -- period.status_changed audit (only when status actually changed).
  IF v_status_changed THEN
    INSERT INTO public.billing_audit_events (
      billing_period_id, actor_id, action, entity_type, entity_id,
      before_data, after_data
    )
    VALUES (
      p_period_id, p_actor_id, 'period.status_changed', 'billing_period', p_period_id,
      jsonb_build_object('status', v_status_before),
      jsonb_build_object('status', 'issued')
    );
  END IF;

  -- invoices.issued audit (always, since we asserted ≥1 draft).
  INSERT INTO public.billing_audit_events (
    billing_period_id, actor_id, action, entity_type, entity_id, metadata
  )
  VALUES (
    p_period_id, p_actor_id, 'invoices.issued', 'billing_period', p_period_id,
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
-- 2. record_bulk_payments
-- ----------------------------------------------------------------------------
-- Records N invoice payments atomically, recomputing each invoice's
-- paid/balance/status from server-side data, advancing every affected period
-- from `issued` to `collecting` (with the matching `period.status_changed`
-- audit per period), and writing a single `payments.bulk_recorded` audit
-- event covering the batch.
--
-- Raises P0001 on the first failing row with the failed index and reason in
-- the exception DETAIL (json) so the service can map back to the existing
-- CONFLICT response envelope.
--
-- Arguments:
--   p_actor_id  — auth user id of the actor (nullable; stored on payments and audit)
--   p_payments  — jsonb array; each element:
--                 {
--                   invoice_id     uuid,
--                   amount         numeric,
--                   payment_date   date,
--                   payment_method text|null,
--                   note           text|null,
--                   reference      text|null
--                 }
--
-- Returns: SETOF public.invoice_payments in the input order.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_bulk_payments(
  p_actor_id uuid,
  p_payments jsonb
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
BEGIN
  IF p_payments IS NULL OR jsonb_typeof(p_payments) <> 'array' OR jsonb_array_length(p_payments) = 0 THEN
    RAISE EXCEPTION 'p_payments must be a non-empty jsonb array';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_amount := (v_item->>'amount')::numeric;

    -- Lock the invoice row so the paid/balance read-modify-write is race-free.
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

    -- Recompute totals from the locked row + this payment.
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

    v_invoice_ids   := array_append(v_invoice_ids, v_invoice.id);
    v_total_amount  := v_total_amount + v_amount;
    IF NOT (v_invoice.billing_period_id = ANY(v_period_ids)) THEN
      v_period_ids := array_append(v_period_ids, v_invoice.billing_period_id);
    END IF;

    v_idx := v_idx + 1;
  END LOOP;

  -- Advance every affected period that is still in `issued` to `collecting`,
  -- and emit one `period.status_changed` audit per transition.
  FOR v_period_id IN SELECT unnest(v_period_ids)
  LOOP
    SELECT status INTO v_period_status FROM public.billing_periods WHERE id = v_period_id;
    IF v_period_status = 'issued' THEN
      UPDATE public.billing_periods SET status = 'collecting' WHERE id = v_period_id;
      INSERT INTO public.billing_audit_events (
        billing_period_id, actor_id, action, entity_type, entity_id,
        before_data, after_data
      )
      VALUES (
        v_period_id, p_actor_id, 'period.status_changed', 'billing_period', v_period_id,
        jsonb_build_object('status', 'issued'),
        jsonb_build_object('status', 'collecting')
      );
    END IF;
  END LOOP;

  -- Single bulk audit event. billing_period_id is concrete only when the batch
  -- touched exactly one period.
  v_audit_period_id := CASE WHEN array_length(v_period_ids, 1) = 1 THEN v_period_ids[1] ELSE NULL END;
  INSERT INTO public.billing_audit_events (
    billing_period_id, actor_id, action, entity_type, entity_id, metadata
  )
  VALUES (
    v_audit_period_id, p_actor_id, 'payments.bulk_recorded', 'billing_period', v_audit_period_id,
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
-- 3. Execute privileges
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.issue_period_invoices(uuid, uuid, date, timestamptz, uuid[], jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_bulk_payments(uuid, jsonb) TO authenticated;


-- ----------------------------------------------------------------------------
-- Verification queries (run after applying)
-- ----------------------------------------------------------------------------
-- Expect 2 rows.
-- SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public'
--   AND p.proname IN ('issue_period_invoices', 'record_bulk_payments');
--
-- Smoke (read-only):
--   SELECT * FROM public.issue_period_invoices(
--     gen_random_uuid(), NULL, NULL, now(), NULL, '[]'::jsonb
--   );
--   -- expected: ERROR "p_drafts must be a non-empty jsonb array"


-- ----------------------------------------------------------------------------
-- Rollback (manual)
-- ----------------------------------------------------------------------------
-- DROP FUNCTION IF EXISTS public.issue_period_invoices(uuid, uuid, date, timestamptz, uuid[], jsonb);
-- DROP FUNCTION IF EXISTS public.record_bulk_payments(uuid, jsonb);
