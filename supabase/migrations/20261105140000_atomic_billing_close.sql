-- ZH-BIL-01 PR3: atomic billing period close and reopen.
--
-- Apply manually through the Supabase Dashboard workflow after the PR3a reconciliation
-- report (supabase/verification/billing_close_integrity.sql) has been reviewed, then verify
-- with supabase/verification/atomic_billing_close.sql and regenerate database types.
--
-- Lock order for every billing RPC: billing_periods -> invoices -> invoice_payments.
-- Closed periods are immutable for payments and money columns (billing_period_closed_guard).

begin;

create or replace function public.close_billing_period_atomic(
  p_period_id uuid,
  p_actor_id uuid,
  p_correlation_id uuid,
  p_expected_issued_revenue numeric,
  p_issued_profit numeric,
  p_reserve_rate_percent numeric,
  p_accrual_amount numeric
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_period public.billing_periods%rowtype;
  v_after public.billing_periods%rowtype;
  v_report_status text;
  v_outstanding integer;
  v_revenue numeric;
  v_fund_id uuid;
  v_accrual_status text;
  v_accrual_before jsonb;
  v_accrual public.reserve_fund_transactions%rowtype;
  v_accrual_after jsonb;
begin
  select * into v_period
  from public.billing_periods
  where id = p_period_id
  for update;
  if not found then
    raise exception 'PERIOD_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_period.status = 'closed' then
    -- Rows written by the previous TypeScript flow carry camelCase keys.
    if v_period.closed_at is not null and exists (
      select 1
      from public.billing_audit_events audit
      where audit.billing_period_id = p_period_id
        and audit.action = 'period.closed'
        and coalesce(audit.after_data->>'closed_at', audit.after_data->>'closedAt')::timestamptz
          = v_period.closed_at
    ) then
      return jsonb_build_object(
        'period', to_jsonb(v_period),
        'accrual_status', null::text,
        'accrual', null::jsonb,
        'replayed', true
      );
    end if;
    raise exception 'PERIOD_CLOSED_INCONSISTENT' using errcode = '23514';
  end if;

  if v_period.status not in ('issued', 'collecting') then
    raise exception 'PERIOD_STATUS_INVALID' using errcode = '23514';
  end if;

  select count(*) into v_outstanding
  from public.invoices invoice
  where invoice.billing_period_id = p_period_id
    and invoice.status <> 'void'
    and invoice.balance_amount > 0;
  if v_outstanding > 0 then
    raise exception 'PERIOD_HAS_OUTSTANDING' using errcode = '23514',
      detail = jsonb_build_object('outstanding_count', v_outstanding)::text;
  end if;

  select coalesce(sum(invoice.total_amount), 0) into v_revenue
  from public.invoices invoice
  where invoice.billing_period_id = p_period_id
    and invoice.status <> 'void';
  if v_revenue <> p_expected_issued_revenue then
    raise exception 'PERIOD_SNAPSHOT_STALE' using errcode = '40001';
  end if;

  update public.billing_periods
  set status = 'closed', closed_at = now()
  where id = p_period_id
  returning * into v_after;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    format('operations-report:%s:%s:%s', v_period.building_id, v_period.period_year, v_period.period_month), 0
  ));
  select report.status into v_report_status
  from public.operations_report_periods report
  where report.building_id = v_period.building_id
    and report.period_year = v_period.period_year
    and report.period_month = v_period.period_month;

  if v_report_status is not null and v_report_status = 'closed' then
    v_accrual_status := 'skipped_report_closed';
  else
    insert into public.reserve_funds (building_id)
    values (v_period.building_id)
    on conflict (building_id) do update set building_id = excluded.building_id
    returning id into v_fund_id;

    select to_jsonb(transaction) into v_accrual_before
    from public.reserve_fund_transactions transaction
    where transaction.fund_id = v_fund_id
      and transaction.source = 'monthly_accrual'
      and transaction.period_year = v_period.period_year
      and transaction.period_month = v_period.period_month
    for update;

    insert into public.reserve_fund_transactions as transaction (
      fund_id, type, source, amount, date, period_year, period_month,
      billing_period_id, reserve_rate_percent, issued_revenue, linked_expense_id,
      note, created_by, voided_at, voided_by, void_reason
    ) values (
      v_fund_id, 'deposit', 'monthly_accrual', p_accrual_amount,
      make_date(v_period.period_year, v_period.period_month, 1), v_period.period_year, v_period.period_month,
      p_period_id, p_reserve_rate_percent, p_expected_issued_revenue, null,
      format('Reserve accrual %s-%s', v_period.period_year, lpad(v_period.period_month::text, 2, '0')),
      p_actor_id, null, null, null
    )
    on conflict (fund_id, period_year, period_month) where source = 'monthly_accrual'
    do update set
      amount = excluded.amount,
      billing_period_id = excluded.billing_period_id,
      reserve_rate_percent = excluded.reserve_rate_percent,
      issued_revenue = excluded.issued_revenue,
      created_by = excluded.created_by,
      voided_at = null,
      voided_by = null,
      void_reason = null
    returning transaction.* into v_accrual;

    v_accrual_status := 'recorded';
    v_accrual_after := to_jsonb(v_accrual);
  end if;

  insert into public.billing_audit_events (
    billing_period_id, building_id, period_year, period_month, actor_id, action,
    entity_type, entity_id, correlation_id, before_data, after_data, metadata
  ) values (
    p_period_id, v_period.building_id, v_period.period_year, v_period.period_month, p_actor_id,
    'period.closed', 'billing_period', p_period_id, p_correlation_id,
    to_jsonb(v_period), to_jsonb(v_after),
    jsonb_build_object(
      'accrual_status', v_accrual_status,
      'accrual_before', v_accrual_before,
      'accrual_after', v_accrual_after,
      'issued_revenue', p_expected_issued_revenue,
      'issued_profit', p_issued_profit,
      'reserve_rate_percent', p_reserve_rate_percent
    )
  );

  return jsonb_build_object(
    'period', to_jsonb(v_after),
    'accrual_status', v_accrual_status,
    'accrual', v_accrual_after,
    'replayed', false
  );
end;
$$;

create or replace function public.reopen_billing_period_atomic(
  p_period_id uuid,
  p_actor_id uuid,
  p_reason text,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_period public.billing_periods%rowtype;
  v_after public.billing_periods%rowtype;
begin
  select * into v_period
  from public.billing_periods
  where id = p_period_id
  for update;
  if not found then
    raise exception 'PERIOD_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_period.status <> 'closed' then
    raise exception 'PERIOD_NOT_CLOSED' using errcode = '23514';
  end if;
  if p_reason is null or length(btrim(p_reason)) < 10 then
    raise exception 'PERIOD_REOPEN_REASON_INVALID' using errcode = '22023';
  end if;

  update public.billing_periods
  set status = 'collecting', closed_at = null
  where id = p_period_id
  returning * into v_after;

  insert into public.billing_audit_events (
    billing_period_id, building_id, period_year, period_month, actor_id, action,
    entity_type, entity_id, correlation_id, before_data, after_data, metadata
  ) values (
    p_period_id, v_period.building_id, v_period.period_year, v_period.period_month, p_actor_id,
    'period.reopened', 'billing_period', p_period_id, p_correlation_id,
    to_jsonb(v_period), to_jsonb(v_after),
    jsonb_build_object('reason', btrim(p_reason), 'prior_status', 'closed', 'trigger', 'manual')
  );

  return jsonb_build_object('period', to_jsonb(v_after));
end;
$$;

-- record_bulk_payments: same body as 20260630130000 plus a period lock taken before any
-- invoice lock. NO KEY UPDATE (not SHARE) is used because the function later moves
-- issued -> collecting; two SHARE holders upgrading the same row would deadlock.
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

  -- Closed-period lock: periods first (ordered by id), invoices second.
  PERFORM 1
    FROM public.billing_periods
   WHERE id IN (
     SELECT invoice.billing_period_id
       FROM public.invoices invoice
      WHERE invoice.id IN (
        SELECT (payment->>'invoice_id')::uuid FROM jsonb_array_elements(p_payments) payment
      )
   )
   ORDER BY id
     FOR NO KEY UPDATE;

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

create or replace function public.billing_period_closed_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status text;
begin
  if tg_table_name = 'invoice_payments' then
    select period.status into v_status
    from public.invoices invoice
    join public.billing_periods period on period.id = invoice.billing_period_id
    where invoice.id = case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end
    for share of period;
  else
    if new.status is not distinct from old.status
      and new.subtotal_amount is not distinct from old.subtotal_amount
      and new.discount_amount is not distinct from old.discount_amount
      and new.surcharge_amount is not distinct from old.surcharge_amount
      and new.total_amount is not distinct from old.total_amount
      and new.paid_amount is not distinct from old.paid_amount
      and new.balance_amount is not distinct from old.balance_amount then
      return new;
    end if;
    select period.status into v_status
    from public.billing_periods period
    where period.id = new.billing_period_id
    for share;
  end if;

  if v_status = 'closed' then
    raise exception 'PERIOD_CLOSED_LOCKED' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists billing_period_closed_guard on public.invoice_payments;
create trigger billing_period_closed_guard
  before insert or update or delete on public.invoice_payments
  for each row execute function public.billing_period_closed_guard();

drop trigger if exists billing_period_closed_guard on public.invoices;
create trigger billing_period_closed_guard
  before update on public.invoices
  for each row execute function public.billing_period_closed_guard();

revoke all on function public.close_billing_period_atomic(uuid, uuid, uuid, numeric, numeric, numeric, numeric)
  from public, anon, authenticated;
grant execute on function public.close_billing_period_atomic(uuid, uuid, uuid, numeric, numeric, numeric, numeric)
  to service_role;

revoke all on function public.reopen_billing_period_atomic(uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.reopen_billing_period_atomic(uuid, uuid, text, uuid)
  to service_role;

revoke all on function public.issue_period_invoices(uuid, uuid, timestamptz, uuid[], jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.issue_period_invoices(uuid, uuid, timestamptz, uuid[], jsonb, uuid)
  to service_role;

revoke all on function public.record_bulk_payments(uuid, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.record_bulk_payments(uuid, jsonb, uuid)
  to service_role;

revoke all on function public.issue_and_pay(uuid, uuid, uuid, date, integer, timestamptz, date, text, text, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.issue_and_pay(uuid, uuid, uuid, date, integer, timestamptz, date, text, text, jsonb, uuid)
  to service_role;

commit;
