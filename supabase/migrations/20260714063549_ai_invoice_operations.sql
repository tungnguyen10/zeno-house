-- =============================================================================
-- AI invoice operations and production hardening
--
-- Part 1 hardens the existing invoice-issue transaction so the server-owned
-- operation UUID (passed as p_correlation_id) is also its idempotency key.
-- The per-period advisory lock serializes both replays and overlapping issue
-- attempts. A replay returns the invoice ids recorded by the first successful
-- invoices.issued audit event and performs no new writes.
--
-- Application access is service-role only. Nuxt services own capability and
-- building-scope authorization; SQL repeats financial invariants and locking.
-- =============================================================================

create or replace function public.issue_period_invoices(
  p_period_id              uuid,
  p_actor_id               uuid,
  p_due_date               date,
  p_issued_at              timestamptz,
  p_requested_contract_ids uuid[],
  p_drafts                 jsonb,
  p_correlation_id         uuid default null
)
returns setof public.invoices
language plpgsql
security invoker
as $$
declare
  v_period             public.billing_periods%rowtype;
  v_draft              jsonb;
  v_line_sum           numeric(12,0);
  v_declared_total     numeric(12,0);
  v_prefix             text;
  v_next_seq           integer;
  v_invoice_code       text;
  v_inserted_invoice   public.invoices%rowtype;
  v_inserted_ids       uuid[] := array[]::uuid[];
  v_replay_ids         uuid[];
  v_status_changed     boolean := false;
  v_status_before      text;
  v_correlation_id     uuid := coalesce(p_correlation_id, gen_random_uuid());
begin
  if p_drafts is null or jsonb_typeof(p_drafts) <> 'array' or jsonb_array_length(p_drafts) = 0 then
    raise exception 'p_drafts must be a non-empty jsonb array' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_period_id::text, 0));

  if p_correlation_id is not null then
    select array_agg(item.invoice_id_text::uuid order by item.ordinality)
      into v_replay_ids
      from public.billing_audit_events audit
      cross join lateral jsonb_array_elements_text(
        coalesce(audit.metadata->'invoice_ids', '[]'::jsonb)
      ) with ordinality as item(invoice_id_text, ordinality)
     where audit.billing_period_id = p_period_id
       and audit.action = 'invoices.issued'
       and audit.correlation_id = p_correlation_id;

    if coalesce(array_length(v_replay_ids, 1), 0) > 0 then
      return query
        select invoice.*
          from unnest(v_replay_ids) with ordinality replay(invoice_id, ordinality)
          join public.invoices invoice on invoice.id = replay.invoice_id
         order by replay.ordinality;
      return;
    end if;
  end if;

  select * into v_period
    from public.billing_periods
   where id = p_period_id
   for update;
  if not found then
    raise exception 'billing period % not found', p_period_id using errcode = 'P0002';
  end if;
  if v_period.status = 'closed' then
    raise exception 'BILLING_PERIOD_LOCKED' using errcode = 'P0001';
  end if;

  v_prefix := format('inv-%s-%s', v_period.period_year, lpad(v_period.period_month::text, 2, '0'));

  select coalesce(max(
    nullif(regexp_replace(invoice_code, '^' || v_prefix || '-', ''), '')::integer
  ), 0) + 1
    into v_next_seq
    from public.invoices
   where invoice_code like v_prefix || '-%';

  for v_draft in select * from jsonb_array_elements(p_drafts)
  loop
    if exists (
      select 1
        from public.invoices invoice
       where invoice.billing_period_id = p_period_id
         and invoice.contract_id = (v_draft->>'contract_id')::uuid
         and invoice.status <> 'void'
    ) then
      raise exception 'INVOICE_ALREADY_ISSUED' using errcode = 'P0001';
    end if;

    v_declared_total := (v_draft->>'total')::numeric;

    select coalesce(sum((line->>'amount')::numeric), 0)
      into v_line_sum
      from jsonb_array_elements(coalesce(v_draft->'lines', '[]'::jsonb)) as line;

    if v_line_sum <> v_declared_total then
      raise exception 'INVOICE_LINE_TOTAL_MISMATCH' using errcode = 'P0001';
    end if;

    v_invoice_code := v_prefix || '-' || lpad(v_next_seq::text, 4, '0');
    v_next_seq := v_next_seq + 1;

    insert into public.invoices (
      invoice_code, billing_period_id, contract_id, room_id, tenant_id,
      status, due_date, issued_at, subtotal_amount, discount_amount,
      surcharge_amount, total_amount, balance_amount, notes
    )
    values (
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
      nullif(v_draft->>'notes', '')
    )
    returning * into v_inserted_invoice;

    insert into public.invoice_charges (
      invoice_id, charge_type, label, source_type, source_id, quantity,
      unit_price, amount, metadata, sort_order
    )
    select
      v_inserted_invoice.id,
      line->>'charge_type',
      line->>'label',
      nullif(line->>'source_type', ''),
      nullif(line->>'source_id', '')::uuid,
      coalesce((line->>'quantity')::numeric, 1),
      coalesce((line->>'unit_price')::numeric, 0),
      (line->>'amount')::numeric,
      coalesce(line->'metadata', '{}'::jsonb),
      coalesce((line->>'sort_order')::integer, idx - 1)
    from jsonb_array_elements(coalesce(v_draft->'lines', '[]'::jsonb))
      with ordinality as t(line, idx);

    v_inserted_ids := array_append(v_inserted_ids, v_inserted_invoice.id);
  end loop;

  if v_period.status not in ('issued', 'collecting') then
    v_status_before := v_period.status;
    update public.billing_periods
       set status = 'issued',
           issued_at = coalesce(issued_at, p_issued_at)
     where id = p_period_id;
    v_status_changed := true;
  end if;

  if v_status_changed then
    insert into public.billing_audit_events (
      billing_period_id, actor_id, action, entity_type, entity_id,
      correlation_id, before_data, after_data, metadata
    )
    values (
      p_period_id, p_actor_id, 'period.status_changed', 'billing_period', p_period_id,
      v_correlation_id,
      jsonb_build_object('status', v_status_before),
      jsonb_build_object('status', 'issued'),
      jsonb_build_object('trigger', 'auto_from_issue')
    );
  end if;

  insert into public.billing_audit_events (
    billing_period_id, actor_id, action, entity_type, entity_id,
    correlation_id, metadata
  )
  values (
    p_period_id, p_actor_id, 'invoices.issued', 'billing_period', p_period_id,
    v_correlation_id,
    jsonb_build_object(
      'issued_count', array_length(v_inserted_ids, 1),
      'invoice_ids', to_jsonb(v_inserted_ids),
      'requested_contract_ids', to_jsonb(p_requested_contract_ids),
      'due_date', p_due_date,
      'idempotency_key', v_correlation_id
    )
  );

  return query
    select invoice.*
      from unnest(v_inserted_ids) with ordinality inserted(invoice_id, ordinality)
      join public.invoices invoice on invoice.id = inserted.invoice_id
     order by inserted.ordinality;
end;
$$;

revoke all on function public.issue_period_invoices(uuid, uuid, date, timestamptz, uuid[], jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.issue_period_invoices(uuid, uuid, date, timestamptz, uuid[], jsonb, uuid)
  to service_role;

-- Rollback after every application caller has reverted:
-- restore issue_period_invoices from 20260630130000_audit_correlation_rpcs.sql
-- and restore its prior grants if direct authenticated SQL execution is needed.


-- ----------------------------------------------------------------------------
-- Atomic unpaid invoice void + audit
-- ----------------------------------------------------------------------------
create or replace function public.void_invoice_with_audit(
  p_invoice_id         uuid,
  p_expected_updated_at timestamptz,
  p_actor_id           uuid,
  p_reason             text,
  p_correlation_id     uuid
)
returns setof public.invoices
language plpgsql
security invoker
as $$
declare
  v_lookup       public.invoices%rowtype;
  v_invoice      public.invoices%rowtype;
  v_period       public.billing_periods%rowtype;
  v_voided       public.invoices%rowtype;
begin
  if p_correlation_id is null then
    raise exception 'INVOICE_OPERATION_ID_REQUIRED' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.billing_audit_events audit
     where audit.action = 'invoice.voided'
       and audit.entity_id = p_invoice_id
       and audit.correlation_id = p_correlation_id
  ) then
    return query select * from public.invoices where id = p_invoice_id;
    return;
  end if;

  select * into v_lookup from public.invoices where id = p_invoice_id;
  if not found then
    raise exception 'INVOICE_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_lookup.billing_period_id::text, 0));
  select * into v_period
    from public.billing_periods
   where id = v_lookup.billing_period_id
   for update;
  select * into v_invoice
    from public.invoices
   where id = p_invoice_id
   for update;

  if v_invoice.updated_at is distinct from p_expected_updated_at then
    raise exception 'INVOICE_VERSION_CONFLICT' using errcode = 'P0001';
  end if;
  if v_period.status = 'closed' then
    raise exception 'BILLING_PERIOD_LOCKED' using errcode = 'P0001';
  end if;
  if v_invoice.status = 'void' then
    raise exception 'INVOICE_ALREADY_VOID' using errcode = 'P0001';
  end if;
  if v_invoice.paid_amount > 0 or exists (
    select 1 from public.invoice_payments payment
     where payment.invoice_id = v_invoice.id
       and payment.deleted_at is null
  ) then
    raise exception 'INVOICE_HAS_ACTIVE_PAYMENTS' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 10 then
    raise exception 'INVOICE_REASON_REQUIRED' using errcode = 'P0001';
  end if;

  update public.invoices
     set status = 'void',
         voided_at = clock_timestamp(),
         voided_by = p_actor_id,
         void_reason = trim(p_reason)
   where id = v_invoice.id
  returning * into v_voided;

  insert into public.billing_audit_events (
    billing_period_id, actor_id, action, entity_type, entity_id,
    correlation_id, before_data, after_data, metadata
  )
  values (
    v_invoice.billing_period_id, p_actor_id, 'invoice.voided', 'invoice', v_invoice.id,
    p_correlation_id, to_jsonb(v_invoice), to_jsonb(v_voided),
    jsonb_build_object(
      'reason', trim(p_reason),
      'total_amount', v_invoice.total_amount,
      'contract_id', v_invoice.contract_id,
      'idempotency_key', p_correlation_id
    )
  );

  return next v_voided;
end;
$$;

revoke all on function public.void_invoice_with_audit(uuid, timestamptz, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.void_invoice_with_audit(uuid, timestamptz, uuid, text, uuid)
  to service_role;


-- ----------------------------------------------------------------------------
-- Atomic replacement issue + charge snapshots + supersession link + audit
-- ----------------------------------------------------------------------------
create or replace function public.reissue_invoice_with_audit(
  p_voided_invoice_id   uuid,
  p_expected_updated_at timestamptz,
  p_actor_id            uuid,
  p_due_date            date,
  p_issued_at            timestamptz,
  p_notes                text,
  p_reason               text,
  p_draft                jsonb,
  p_correlation_id       uuid
)
returns setof public.invoices
language plpgsql
security invoker
as $$
declare
  v_lookup        public.invoices%rowtype;
  v_voided        public.invoices%rowtype;
  v_period        public.billing_periods%rowtype;
  v_replacement   public.invoices%rowtype;
  v_before        public.invoices%rowtype;
  v_replay_id     uuid;
  v_line_sum      numeric(12,0);
  v_total         numeric(12,0);
  v_prefix        text;
  v_next_seq      integer;
begin
  if p_correlation_id is null then
    raise exception 'INVOICE_OPERATION_ID_REQUIRED' using errcode = 'P0001';
  end if;

  select (audit.metadata->>'replacement_invoice_id')::uuid
    into v_replay_id
    from public.billing_audit_events audit
   where audit.action = 'invoice.reissued'
     and audit.correlation_id = p_correlation_id
     and audit.metadata->>'replacement_for_invoice_id' = p_voided_invoice_id::text
   order by audit.created_at desc
   limit 1;
  if v_replay_id is not null then
    return query select * from public.invoices where id = v_replay_id;
    return;
  end if;

  select * into v_lookup from public.invoices where id = p_voided_invoice_id;
  if not found then
    raise exception 'INVOICE_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_lookup.billing_period_id::text, 0));
  select * into v_period
    from public.billing_periods
   where id = v_lookup.billing_period_id
   for update;
  select * into v_voided
    from public.invoices
   where id = p_voided_invoice_id
   for update;
  v_before := v_voided;

  if v_voided.updated_at is distinct from p_expected_updated_at then
    raise exception 'INVOICE_VERSION_CONFLICT' using errcode = 'P0001';
  end if;
  if v_period.status = 'closed' then
    raise exception 'BILLING_PERIOD_LOCKED' using errcode = 'P0001';
  end if;
  if v_voided.status <> 'void' then
    raise exception 'INVOICE_NOT_VOID' using errcode = 'P0001';
  end if;
  if v_voided.superseded_by_invoice_id is not null or exists (
    select 1 from public.invoices invoice
     where invoice.billing_period_id = v_voided.billing_period_id
       and invoice.contract_id = v_voided.contract_id
       and invoice.status <> 'void'
  ) then
    raise exception 'INVOICE_ACTIVE_REPLACEMENT_EXISTS' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 10 then
    raise exception 'INVOICE_REASON_REQUIRED' using errcode = 'P0001';
  end if;
  if p_draft is null or jsonb_typeof(p_draft) <> 'object' then
    raise exception 'INVOICE_DRAFT_INVALID' using errcode = 'P0001';
  end if;
  if (p_draft->>'contract_id')::uuid <> v_voided.contract_id
     or (p_draft->>'room_id')::uuid <> v_voided.room_id
     or (p_draft->>'tenant_id')::uuid <> v_voided.tenant_id then
    raise exception 'INVOICE_DRAFT_TARGET_MISMATCH' using errcode = 'P0001';
  end if;

  v_total := (p_draft->>'total')::numeric;
  select coalesce(sum((line->>'amount')::numeric), 0)
    into v_line_sum
    from jsonb_array_elements(coalesce(p_draft->'lines', '[]'::jsonb)) line;
  if v_line_sum <> v_total then
    raise exception 'INVOICE_LINE_TOTAL_MISMATCH' using errcode = 'P0001';
  end if;

  v_prefix := format('inv-%s-%s', v_period.period_year, lpad(v_period.period_month::text, 2, '0'));
  select coalesce(max(
    nullif(regexp_replace(invoice_code, '^' || v_prefix || '-', ''), '')::integer
  ), 0) + 1
    into v_next_seq
    from public.invoices
   where invoice_code like v_prefix || '-%';

  insert into public.invoices (
    invoice_code, billing_period_id, contract_id, room_id, tenant_id,
    status, due_date, issued_at, subtotal_amount, discount_amount,
    surcharge_amount, total_amount, balance_amount, notes, supersedes_invoice_id
  )
  values (
    v_prefix || '-' || lpad(v_next_seq::text, 4, '0'),
    v_period.id,
    v_voided.contract_id,
    v_voided.room_id,
    v_voided.tenant_id,
    'issued',
    p_due_date,
    p_issued_at,
    (p_draft->>'subtotal')::numeric,
    (p_draft->>'discount')::numeric,
    (p_draft->>'surcharge')::numeric,
    v_total,
    v_total,
    nullif(p_notes, ''),
    v_voided.id
  )
  returning * into v_replacement;

  insert into public.invoice_charges (
    invoice_id, charge_type, label, source_type, source_id, quantity,
    unit_price, amount, metadata, sort_order
  )
  select
    v_replacement.id,
    line->>'charge_type',
    line->>'label',
    nullif(line->>'source_type', ''),
    nullif(line->>'source_id', '')::uuid,
    coalesce((line->>'quantity')::numeric, 1),
    coalesce((line->>'unit_price')::numeric, 0),
    (line->>'amount')::numeric,
    coalesce(line->'metadata', '{}'::jsonb),
    coalesce((line->>'sort_order')::integer, idx - 1)
  from jsonb_array_elements(coalesce(p_draft->'lines', '[]'::jsonb))
    with ordinality as t(line, idx);

  update public.invoices
     set superseded_by_invoice_id = v_replacement.id
   where id = v_voided.id;

  insert into public.billing_audit_events (
    billing_period_id, actor_id, action, entity_type, entity_id,
    correlation_id, before_data, after_data, metadata
  )
  values (
    v_period.id, p_actor_id, 'invoice.reissued', 'invoice', v_replacement.id,
    p_correlation_id, to_jsonb(v_before), to_jsonb(v_replacement),
    jsonb_build_object(
      'reason', trim(p_reason),
      'replacement_for_invoice_id', v_voided.id,
      'replacement_invoice_id', v_replacement.id,
      'contract_id', v_voided.contract_id,
      'old_total_amount', v_voided.total_amount,
      'new_total_amount', v_replacement.total_amount,
      'void_reason', v_voided.void_reason,
      'idempotency_key', p_correlation_id
    )
  );

  return next v_replacement;
end;
$$;

revoke all on function public.reissue_invoice_with_audit(uuid, timestamptz, uuid, date, timestamptz, text, text, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.reissue_invoice_with_audit(uuid, timestamptz, uuid, date, timestamptz, text, text, jsonb, uuid)
  to service_role;


-- ----------------------------------------------------------------------------
-- Atomic paid/partial invoice adjustment + totals/status update + audit
-- ----------------------------------------------------------------------------
create or replace function public.add_invoice_adjustment_with_audit(
  p_invoice_id          uuid,
  p_expected_updated_at timestamptz,
  p_actor_id            uuid,
  p_label               text,
  p_amount              numeric,
  p_reason              text,
  p_reference_invoice_id uuid,
  p_correlation_id      uuid
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_lookup       public.invoices%rowtype;
  v_invoice      public.invoices%rowtype;
  v_period       public.billing_periods%rowtype;
  v_updated      public.invoices%rowtype;
  v_charge       public.invoice_charges%rowtype;
  v_replay_charge public.invoice_charges%rowtype;
  v_next_sort    integer;
  v_new_subtotal numeric(12,0);
  v_new_total    numeric(12,0);
  v_new_balance  numeric(12,0);
  v_new_status   text;
begin
  if p_correlation_id is null then
    raise exception 'INVOICE_OPERATION_ID_REQUIRED' using errcode = 'P0001';
  end if;

  select charge.* into v_replay_charge
    from public.billing_audit_events audit
    join public.invoice_charges charge on charge.id = audit.entity_id
   where audit.action = 'invoice.adjustment_created'
     and audit.correlation_id = p_correlation_id
     and charge.invoice_id = p_invoice_id
   order by audit.created_at desc
   limit 1;
  if found then
    select * into v_updated from public.invoices where id = p_invoice_id;
    return jsonb_build_object('invoice', to_jsonb(v_updated), 'charge', to_jsonb(v_replay_charge));
  end if;

  select * into v_lookup from public.invoices where id = p_invoice_id;
  if not found then
    raise exception 'INVOICE_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_lookup.billing_period_id::text, 0));
  select * into v_period
    from public.billing_periods
   where id = v_lookup.billing_period_id
   for update;
  select * into v_invoice
    from public.invoices
   where id = p_invoice_id
   for update;

  if v_invoice.updated_at is distinct from p_expected_updated_at then
    raise exception 'INVOICE_VERSION_CONFLICT' using errcode = 'P0001';
  end if;
  if v_period.status = 'closed' then
    raise exception 'BILLING_PERIOD_LOCKED' using errcode = 'P0001';
  end if;
  if v_invoice.status = 'void' then
    raise exception 'INVOICE_ALREADY_VOID' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount <> trunc(p_amount) or p_amount = 0 then
    raise exception 'INVOICE_ADJUSTMENT_AMOUNT_INVALID' using errcode = 'P0001';
  end if;
  if p_amount < 0 and abs(p_amount) > v_invoice.paid_amount then
    raise exception 'INVOICE_ADJUSTMENT_EXCEEDS_PAID' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_label, ''))) = 0 or length(trim(p_label)) > 200 then
    raise exception 'INVOICE_ADJUSTMENT_LABEL_INVALID' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0
     or (p_amount <= -100000 and length(trim(p_reason)) < 10) then
    raise exception 'INVOICE_REASON_REQUIRED' using errcode = 'P0001';
  end if;
  if p_reference_invoice_id is not null and not exists (
    select 1 from public.invoices referenced where referenced.id = p_reference_invoice_id
  ) then
    raise exception 'INVOICE_REFERENCE_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_new_subtotal := v_invoice.subtotal_amount + case when p_amount > 0 then p_amount else 0 end;
  v_new_total := v_invoice.total_amount + p_amount;
  v_new_balance := v_new_total - v_invoice.paid_amount;
  if v_new_total < 0 then
    raise exception 'INVOICE_ADJUSTMENT_TOTAL_NEGATIVE' using errcode = 'P0001';
  end if;
  v_new_status := case
    when v_new_balance <= 0 then 'paid'
    when v_invoice.paid_amount > 0 then 'partial'
    else v_invoice.status
  end;

  select coalesce(max(charge.sort_order), 99) + 1
    into v_next_sort
    from public.invoice_charges charge
   where charge.invoice_id = v_invoice.id;

  insert into public.invoice_charges (
    invoice_id, charge_type, label, source_type, source_id, quantity,
    unit_price, amount, metadata, sort_order
  )
  values (
    v_invoice.id, 'adjustment', trim(p_label), 'adjustment', p_reference_invoice_id,
    1, p_amount, p_amount,
    jsonb_build_object(
      'reason', trim(p_reason),
      'reference_invoice_id', p_reference_invoice_id,
      'target_invoice_id', v_invoice.id
    ),
    v_next_sort
  )
  returning * into v_charge;

  update public.invoices
     set subtotal_amount = v_new_subtotal,
         total_amount = v_new_total,
         balance_amount = v_new_balance,
         status = v_new_status
   where id = v_invoice.id
  returning * into v_updated;

  insert into public.billing_audit_events (
    billing_period_id, actor_id, action, entity_type, entity_id,
    correlation_id, before_data, after_data, metadata
  )
  values (
    v_invoice.billing_period_id, p_actor_id, 'invoice.adjustment_created',
    'invoice_charge', v_charge.id, p_correlation_id,
    to_jsonb(v_invoice), to_jsonb(v_updated),
    jsonb_build_object(
      'target_invoice_id', v_invoice.id,
      'reference_invoice_id', p_reference_invoice_id,
      'label', trim(p_label),
      'amount', p_amount,
      'reason', trim(p_reason),
      'idempotency_key', p_correlation_id
    )
  );

  return jsonb_build_object('invoice', to_jsonb(v_updated), 'charge', to_jsonb(v_charge));
end;
$$;

revoke all on function public.add_invoice_adjustment_with_audit(uuid, timestamptz, uuid, text, numeric, text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.add_invoice_adjustment_with_audit(uuid, timestamptz, uuid, text, numeric, text, uuid, uuid)
  to service_role;

-- Correction rollback after application callers have reverted:
-- drop function if exists public.void_invoice_with_audit(uuid, timestamptz, uuid, text, uuid);
-- drop function if exists public.reissue_invoice_with_audit(uuid, timestamptz, uuid, date, timestamptz, text, text, jsonb, uuid);
-- drop function if exists public.add_invoice_adjustment_with_audit(uuid, timestamptz, uuid, text, numeric, text, uuid, uuid);


-- ----------------------------------------------------------------------------
-- Distributed AI request/action rate-limit buckets
-- ----------------------------------------------------------------------------
create table if not exists public.ai_rate_limit_buckets (
  subject_hash   text not null check (length(subject_hash) = 64),
  scope          text not null check (scope in ('chat', 'action')),
  window_started timestamptz not null,
  request_count  integer not null default 0 check (request_count >= 0),
  expires_at     timestamptz not null,
  primary key (subject_hash, scope, window_started)
);

create index if not exists idx_ai_rate_limit_buckets_expiry
  on public.ai_rate_limit_buckets (expires_at);

alter table public.ai_rate_limit_buckets enable row level security;
revoke all on table public.ai_rate_limit_buckets from public, anon, authenticated;
grant select, insert, update, delete on table public.ai_rate_limit_buckets to service_role;

create or replace function public.consume_ai_rate_limit(
  p_subject_hash   text,
  p_scope          text,
  p_limit          integer,
  p_window_seconds integer,
  p_now            timestamptz default clock_timestamp()
)
returns table(allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security invoker
as $$
declare
  v_window_started timestamptz;
  v_window_ends    timestamptz;
  v_count          integer;
begin
  if length(coalesce(p_subject_hash, '')) <> 64
     or p_scope not in ('chat', 'action')
     or p_limit < 1
     or p_window_seconds < 1 then
    raise exception 'AI_RATE_LIMIT_INPUT_INVALID' using errcode = 'P0001';
  end if;

  v_window_started := to_timestamp(
    floor(extract(epoch from p_now) / p_window_seconds) * p_window_seconds
  );
  v_window_ends := v_window_started + make_interval(secs => p_window_seconds);

  insert into public.ai_rate_limit_buckets (
    subject_hash, scope, window_started, request_count, expires_at
  )
  values (p_subject_hash, p_scope, v_window_started, 1, v_window_ends + interval '1 day')
  on conflict (subject_hash, scope, window_started) do update
    set request_count = public.ai_rate_limit_buckets.request_count + 1,
        expires_at = excluded.expires_at
  returning request_count into v_count;

  return query select
    v_count <= p_limit,
    greatest(p_limit - v_count, 0),
    greatest(ceil(extract(epoch from (v_window_ends - p_now)))::integer, 1);
end;
$$;

revoke all on function public.consume_ai_rate_limit(text, text, integer, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.consume_ai_rate_limit(text, text, integer, integer, timestamptz)
  to service_role;

create or replace function public.cleanup_expired_ai_rate_limits(p_limit integer default 5000)
returns integer
language plpgsql
security invoker
as $$
declare
  v_deleted integer;
begin
  if p_limit < 1 or p_limit > 50000 then
    raise exception 'AI_RATE_LIMIT_CLEANUP_LIMIT_INVALID' using errcode = 'P0001';
  end if;
  with expired as (
    select subject_hash, scope, window_started
      from public.ai_rate_limit_buckets
     where expires_at <= clock_timestamp()
     order by expires_at
     limit p_limit
     for update skip locked
  ), deleted as (
    delete from public.ai_rate_limit_buckets bucket
     using expired
     where bucket.subject_hash = expired.subject_hash
       and bucket.scope = expired.scope
       and bucket.window_started = expired.window_started
    returning 1
  )
  select count(*)::integer into v_deleted from deleted;
  return v_deleted;
end;
$$;

revoke all on function public.cleanup_expired_ai_rate_limits(integer)
  from public, anon, authenticated;
grant execute on function public.cleanup_expired_ai_rate_limits(integer) to service_role;

-- Rate-limit rollback after server enforcement is reverted:
-- drop function if exists public.cleanup_expired_ai_rate_limits(integer);
-- drop function if exists public.consume_ai_rate_limit(text, text, integer, integer, timestamptz);
-- drop table if exists public.ai_rate_limit_buckets;
