-- AI invoice payment batch: full-balance, atomic, and correlation-idempotent.
--
-- Apply manually through the Supabase Dashboard workflow, verify with
-- supabase/verification/ai_invoice_payments.sql, then regenerate database
-- types from the configured cloud project. This migration is additive.

create or replace function public.record_ai_invoice_payments_with_audit(
  p_period_id uuid,
  p_actor_id uuid,
  p_payments jsonb,
  p_payment_date date,
  p_payment_method text,
  p_note text,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_period public.billing_periods%rowtype;
  v_invoice public.invoices%rowtype;
  v_item jsonb;
  v_expected_count integer;
  v_locked_count integer := 0;
  v_payment_id uuid;
  v_payment_ids uuid[] := array[]::uuid[];
  v_invoice_ids uuid[] := array[]::uuid[];
  v_total_amount numeric(12,0) := 0;
  v_replay_metadata jsonb;
  v_payments_json jsonb;
  v_invoices_json jsonb;
begin
  if p_correlation_id is null then
    raise exception 'AI_PAYMENT_CORRELATION_REQUIRED' using errcode = 'P0001';
  end if;
  if p_payments is null or jsonb_typeof(p_payments) <> 'array' then
    raise exception 'AI_PAYMENT_INVALID_PAYLOAD' using errcode = 'P0001';
  end if;
  v_expected_count := jsonb_array_length(p_payments);
  if v_expected_count < 1 or v_expected_count > 200 then
    raise exception 'AI_PAYMENT_INVALID_PAYLOAD' using errcode = 'P0001';
  end if;
  if nullif(trim(p_payment_method), '') is null then
    raise exception 'AI_PAYMENT_METHOD_REQUIRED' using errcode = 'P0001';
  end if;
  if (
    select count(distinct item->>'invoice_id')
    from jsonb_array_elements(p_payments) item
  ) <> v_expected_count then
    raise exception 'AI_PAYMENT_DUPLICATE_INVOICE' using errcode = 'P0001';
  end if;

  -- The period lock serializes replay detection and period transition.
  select * into v_period
  from public.billing_periods
  where id = p_period_id
  for update;
  if not found then
    raise exception 'AI_PAYMENT_PERIOD_NOT_FOUND' using errcode = 'P0002';
  end if;

  select audit.metadata into v_replay_metadata
  from public.billing_audit_events audit
  where audit.action = 'payments.ai_recorded'
    and audit.correlation_id = p_correlation_id
    and audit.billing_period_id = p_period_id
  order by audit.created_at asc
  limit 1;

  if v_replay_metadata is not null then
    select coalesce(jsonb_agg(to_jsonb(payment) order by payment.created_at, payment.id), '[]'::jsonb)
      into v_payments_json
    from public.invoice_payments payment
    where payment.id in (
      select value::uuid from jsonb_array_elements_text(v_replay_metadata->'payment_ids') value
    );
    select coalesce(jsonb_agg(to_jsonb(invoice) order by invoice.invoice_code, invoice.id), '[]'::jsonb)
      into v_invoices_json
    from public.invoices invoice
    where invoice.id in (
      select value::uuid from jsonb_array_elements_text(v_replay_metadata->'invoice_ids') value
    );
    return jsonb_build_object(
      'count', coalesce((v_replay_metadata->>'count')::integer, 0),
      'total_amount', coalesce((v_replay_metadata->>'total_amount')::numeric, 0),
      'payments', v_payments_json,
      'invoices', v_invoices_json,
      'replayed', true
    );
  end if;

  if v_period.status = 'closed' then
    raise exception 'AI_PAYMENT_PERIOD_CLOSED' using errcode = 'P0001';
  end if;

  -- Lock every target in a deterministic order and validate the full batch
  -- before the first payment insert.
  for v_invoice in
    select invoice.*
    from public.invoices invoice
    where invoice.id in (
      select (item->>'invoice_id')::uuid from jsonb_array_elements(p_payments) item
    )
    order by invoice.id
    for update
  loop
    v_locked_count := v_locked_count + 1;
    select item into v_item
    from jsonb_array_elements(p_payments) item
    where (item->>'invoice_id')::uuid = v_invoice.id;

    if v_invoice.billing_period_id <> p_period_id then
      raise exception 'AI_PAYMENT_INVOICE_PERIOD_MISMATCH' using errcode = 'P0001';
    end if;
    if v_invoice.room_id <> (v_item->>'room_id')::uuid then
      raise exception 'AI_PAYMENT_INVOICE_ROOM_CONFLICT' using errcode = 'P0001';
    end if;
    if v_invoice.updated_at <> (v_item->>'expected_updated_at')::timestamptz then
      raise exception 'AI_PAYMENT_INVOICE_VERSION_CONFLICT' using errcode = 'P0001';
    end if;
    if v_invoice.balance_amount <> (v_item->>'expected_balance_amount')::numeric then
      raise exception 'AI_PAYMENT_BALANCE_CONFLICT' using errcode = 'P0001';
    end if;
    if v_invoice.status = 'paid' or v_invoice.balance_amount <= 0 then
      raise exception 'AI_PAYMENT_ALREADY_PAID' using errcode = 'P0001';
    end if;
    if v_invoice.status not in ('issued', 'partial', 'overdue') or v_invoice.voided_at is not null then
      raise exception 'AI_PAYMENT_INVOICE_NOT_COLLECTIBLE' using errcode = 'P0001';
    end if;
  end loop;

  if v_locked_count <> v_expected_count then
    raise exception 'AI_PAYMENT_INVOICE_NOT_FOUND' using errcode = 'P0002';
  end if;

  for v_item in select item from jsonb_array_elements(p_payments) item
  loop
    select * into v_invoice
    from public.invoices
    where id = (v_item->>'invoice_id')::uuid;

    insert into public.invoice_payments (
      invoice_id, amount, paid_at, payment_method, note, recorded_by
    ) values (
      v_invoice.id,
      v_invoice.balance_amount,
      p_payment_date,
      trim(p_payment_method),
      nullif(trim(p_note), ''),
      p_actor_id
    ) returning id into v_payment_id;

    v_payment_ids := array_append(v_payment_ids, v_payment_id);
    v_invoice_ids := array_append(v_invoice_ids, v_invoice.id);
    v_total_amount := v_total_amount + v_invoice.balance_amount;

    update public.invoices
    set paid_amount = total_amount,
        balance_amount = 0,
        status = 'paid',
        paid_at = p_payment_date::timestamp at time zone 'Asia/Ho_Chi_Minh'
    where id = v_invoice.id;

    insert into public.billing_audit_events (
      billing_period_id, actor_id, action, entity_type, entity_id,
      correlation_id, before_data, after_data, metadata
    ) values (
      p_period_id, p_actor_id, 'invoice.payment_recorded', 'invoice', v_invoice.id,
      p_correlation_id,
      jsonb_build_object(
        'status', v_invoice.status,
        'paid_amount', v_invoice.paid_amount,
        'balance_amount', v_invoice.balance_amount
      ),
      jsonb_build_object(
        'status', 'paid',
        'paid_amount', v_invoice.total_amount,
        'balance_amount', 0
      ),
      jsonb_build_object(
        'payment_id', v_payment_id,
        'amount', v_invoice.balance_amount,
        'payment_method', trim(p_payment_method),
        'paid_at', p_payment_date,
        'via', 'payments.ai_recorded'
      )
    );
  end loop;

  if v_period.status = 'issued' then
    update public.billing_periods
    set status = 'collecting'
    where id = p_period_id;

    insert into public.billing_audit_events (
      billing_period_id, actor_id, action, entity_type, entity_id,
      correlation_id, before_data, after_data, metadata
    ) values (
      p_period_id, p_actor_id, 'period.status_changed', 'billing_period', p_period_id,
      p_correlation_id,
      jsonb_build_object('status', 'issued'),
      jsonb_build_object('status', 'collecting'),
      jsonb_build_object('trigger', 'auto_from_ai_payment')
    );
  end if;

  insert into public.billing_audit_events (
    billing_period_id, actor_id, action, entity_type, entity_id,
    correlation_id, metadata
  ) values (
    p_period_id, p_actor_id, 'payments.ai_recorded', 'billing_period', p_period_id,
    p_correlation_id,
    jsonb_build_object(
      'count', array_length(v_payment_ids, 1),
      'total_amount', v_total_amount,
      'payment_ids', to_jsonb(v_payment_ids),
      'invoice_ids', to_jsonb(v_invoice_ids),
      'payment_method', trim(p_payment_method),
      'paid_at', p_payment_date
    )
  );

  select coalesce(jsonb_agg(to_jsonb(payment) order by payment.created_at, payment.id), '[]'::jsonb)
    into v_payments_json
  from public.invoice_payments payment
  where payment.id = any(v_payment_ids);
  select coalesce(jsonb_agg(to_jsonb(invoice) order by invoice.invoice_code, invoice.id), '[]'::jsonb)
    into v_invoices_json
  from public.invoices invoice
  where invoice.id = any(v_invoice_ids);

  return jsonb_build_object(
    'count', array_length(v_payment_ids, 1),
    'total_amount', v_total_amount,
    'payments', v_payments_json,
    'invoices', v_invoices_json,
    'replayed', false
  );
end;
$$;

revoke all on function public.record_ai_invoice_payments_with_audit(
  uuid, uuid, jsonb, date, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.record_ai_invoice_payments_with_audit(
  uuid, uuid, jsonb, date, text, text, uuid
) to service_role;

-- Rollback:
-- drop function if exists public.record_ai_invoice_payments_with_audit(uuid, uuid, jsonb, date, text, text, uuid);
