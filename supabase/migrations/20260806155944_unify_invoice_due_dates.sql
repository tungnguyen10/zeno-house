-- Unify invoice due-date policy and persist the issued schedule as an immutable snapshot.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'contracts' and column_name = 'payment_day'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'contracts' and column_name = 'payment_due_day'
  ) then
    alter table public.contracts rename column payment_day to payment_due_day;
  end if;
end
$$;

alter table public.invoices
  add column if not exists grace_period_days integer not null default 0;

alter table public.invoices
  drop constraint if exists invoices_grace_period_days_check;
alter table public.invoices
  add constraint invoices_grace_period_days_check
  check (grace_period_days >= 0);

alter table public.invoices
  add column if not exists overdue_date date
  generated always as (due_date + grace_period_days) stored;

drop index if exists public.idx_invoices_browse_status_due_issued;
create index if not exists idx_invoices_browse_status_overdue_issued
  on public.invoices (status, overdue_date, balance_amount, issued_at desc, id desc);

-- Keep the previously hardened implementation as a private transaction primitive.
do $$
begin
  if to_regprocedure('public.issue_period_invoices(uuid,uuid,date,timestamptz,uuid[],jsonb,uuid)') is not null
     and to_regprocedure('public.issue_period_invoices_legacy(uuid,uuid,date,timestamptz,uuid[],jsonb,uuid)') is null then
    alter function public.issue_period_invoices(uuid, uuid, date, timestamptz, uuid[], jsonb, uuid)
      rename to issue_period_invoices_legacy;
  end if;
end
$$;

create or replace function public.issue_period_invoices(
  p_period_id uuid,
  p_actor_id uuid,
  p_issued_at timestamptz,
  p_requested_contract_ids uuid[],
  p_drafts jsonb,
  p_correlation_id uuid default null
)
returns setof public.invoices
language plpgsql
security invoker
as $$
declare
  v_invoice_ids uuid[];
begin
  if p_drafts is null or jsonb_typeof(p_drafts) <> 'array' or jsonb_array_length(p_drafts) = 0 then
    raise exception 'p_drafts must be a non-empty jsonb array' using errcode = 'P0001';
  end if;

  -- A replay must return the original immutable schedule without applying a new payload.
  if p_correlation_id is not null then
    select array_agg(item.invoice_id_text::uuid order by item.ordinality)
      into v_invoice_ids
      from public.billing_audit_events audit
      cross join lateral jsonb_array_elements_text(
        coalesce(audit.metadata->'invoice_ids', '[]'::jsonb)
      ) with ordinality as item(invoice_id_text, ordinality)
     where audit.billing_period_id = p_period_id
       and audit.action = 'invoices.issued'
       and audit.correlation_id = p_correlation_id;

    if coalesce(array_length(v_invoice_ids, 1), 0) > 0 then
      return query
        select invoice.*
          from unnest(v_invoice_ids) with ordinality replay(invoice_id, ordinality)
          join public.invoices invoice on invoice.id = replay.invoice_id
         order by replay.ordinality;
      return;
    end if;
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_drafts) draft
     where nullif(draft->>'due_date', '') is null
        or coalesce((draft->>'grace_period_days')::integer, -1) < 0
  ) then
    raise exception 'INVOICE_DRAFT_DUE_SCHEDULE_INVALID' using errcode = 'P0001';
  end if;

  select array_agg(invoice.id order by invoice.invoice_code)
    into v_invoice_ids
    from public.issue_period_invoices_legacy(
      p_period_id,
      p_actor_id,
      null,
      p_issued_at,
      p_requested_contract_ids,
      p_drafts,
      p_correlation_id
    ) invoice;

  update public.invoices invoice
     set due_date = (draft.value->>'due_date')::date,
         grace_period_days = coalesce((draft.value->>'grace_period_days')::integer, 0)
    from jsonb_array_elements(p_drafts) draft(value)
   where invoice.id = any(v_invoice_ids)
     and invoice.contract_id = (draft.value->>'contract_id')::uuid;

  update public.billing_audit_events audit
     set metadata = (audit.metadata - 'due_date') || jsonb_build_object(
       'due_schedules', (
         select jsonb_agg(jsonb_build_object(
           'contract_id', draft.value->>'contract_id',
           'due_date', draft.value->>'due_date',
           'grace_period_days', coalesce((draft.value->>'grace_period_days')::integer, 0)
         ) order by draft.value->>'contract_id')
         from jsonb_array_elements(p_drafts) draft(value)
       )
     )
   where audit.billing_period_id = p_period_id
     and audit.action = 'invoices.issued'
     and audit.correlation_id = p_correlation_id;

  return query
    select invoice.*
      from unnest(v_invoice_ids) with ordinality issued(invoice_id, ordinality)
      join public.invoices invoice on invoice.id = issued.invoice_id
     order by issued.ordinality;
end;
$$;

revoke all on function public.issue_period_invoices_legacy(uuid, uuid, date, timestamptz, uuid[], jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.issue_period_invoices_legacy(uuid, uuid, date, timestamptz, uuid[], jsonb, uuid)
  to service_role;
revoke all on function public.issue_period_invoices(uuid, uuid, timestamptz, uuid[], jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.issue_period_invoices(uuid, uuid, timestamptz, uuid[], jsonb, uuid)
  to service_role;

-- Reissue accepts an explicit grace snapshot. The application preserves the replaced
-- invoice's due/grace values when the operator does not provide an override.
do $$
begin
  if to_regprocedure('public.reissue_invoice_with_audit(uuid,timestamptz,uuid,date,timestamptz,text,text,jsonb,uuid)') is not null
     and to_regprocedure('public.reissue_invoice_with_audit_legacy(uuid,timestamptz,uuid,date,timestamptz,text,text,jsonb,uuid)') is null then
    alter function public.reissue_invoice_with_audit(uuid, timestamptz, uuid, date, timestamptz, text, text, jsonb, uuid)
      rename to reissue_invoice_with_audit_legacy;
  end if;
end
$$;

create or replace function public.reissue_invoice_with_audit(
  p_voided_invoice_id uuid,
  p_expected_updated_at timestamptz,
  p_actor_id uuid,
  p_due_date date,
  p_grace_period_days integer,
  p_issued_at timestamptz,
  p_notes text,
  p_reason text,
  p_draft jsonb,
  p_correlation_id uuid
)
returns setof public.invoices
language plpgsql
security invoker
as $$
declare
  v_invoice public.invoices%rowtype;
begin
  if coalesce(p_grace_period_days, -1) < 0 then
    raise exception 'INVOICE_DRAFT_DUE_SCHEDULE_INVALID' using errcode = 'P0001';
  end if;

  select replacement.* into v_invoice
    from public.billing_audit_events audit
    join public.invoices replacement
      on replacement.id = (audit.metadata->>'replacement_invoice_id')::uuid
   where audit.action = 'invoice.reissued'
     and audit.correlation_id = p_correlation_id
     and audit.metadata->>'replacement_for_invoice_id' = p_voided_invoice_id::text
   order by audit.created_at desc
   limit 1;
  if found then
    return next v_invoice;
    return;
  end if;

  select * into v_invoice
    from public.reissue_invoice_with_audit_legacy(
      p_voided_invoice_id, p_expected_updated_at, p_actor_id, p_due_date,
      p_issued_at, p_notes, p_reason, p_draft, p_correlation_id
    )
   limit 1;

  update public.invoices
     set grace_period_days = coalesce(p_grace_period_days, 0)
   where id = v_invoice.id
   returning * into v_invoice;

  update public.billing_audit_events audit
     set after_data = to_jsonb(v_invoice),
         metadata = audit.metadata || jsonb_build_object(
           'due_date', v_invoice.due_date,
           'grace_period_days', v_invoice.grace_period_days,
           'overdue_date', v_invoice.overdue_date
         )
   where audit.action = 'invoice.reissued'
     and audit.correlation_id = p_correlation_id
     and audit.entity_id = v_invoice.id;

  return next v_invoice;
end;
$$;

revoke all on function public.reissue_invoice_with_audit_legacy(uuid, timestamptz, uuid, date, timestamptz, text, text, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.reissue_invoice_with_audit_legacy(uuid, timestamptz, uuid, date, timestamptz, text, text, jsonb, uuid)
  to service_role;
revoke all on function public.reissue_invoice_with_audit(uuid, timestamptz, uuid, date, integer, timestamptz, text, text, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.reissue_invoice_with_audit(uuid, timestamptz, uuid, date, integer, timestamptz, text, text, jsonb, uuid)
  to service_role;

-- Keep issue-and-pay a single-invoice transaction while adding the grace snapshot.
do $$
begin
  if to_regprocedure('public.issue_and_pay(uuid,uuid,uuid,date,timestamptz,date,text,text,jsonb,uuid)') is not null
     and to_regprocedure('public.issue_and_pay_legacy(uuid,uuid,uuid,date,timestamptz,date,text,text,jsonb,uuid)') is null then
    alter function public.issue_and_pay(uuid, uuid, uuid, date, timestamptz, date, text, text, jsonb, uuid)
      rename to issue_and_pay_legacy;
  end if;
end
$$;

create or replace function public.issue_and_pay(
  p_period_id uuid,
  p_contract_id uuid,
  p_actor_id uuid,
  p_due_date date,
  p_grace_period_days integer,
  p_issued_at timestamptz,
  p_payment_date date,
  p_payment_method text,
  p_note text,
  p_draft jsonb,
  p_correlation_id uuid default null
)
returns setof public.invoices
language plpgsql
security invoker
as $$
declare
  v_invoice public.invoices%rowtype;
begin
  if coalesce(p_grace_period_days, -1) < 0 then
    raise exception 'INVOICE_DRAFT_DUE_SCHEDULE_INVALID' using errcode = 'P0001';
  end if;

  select * into v_invoice
    from public.issue_and_pay_legacy(
      p_period_id, p_contract_id, p_actor_id, p_due_date, p_issued_at,
      p_payment_date, p_payment_method, p_note, p_draft, p_correlation_id
    )
   limit 1;

  update public.invoices
     set grace_period_days = coalesce(p_grace_period_days, 0)
   where id = v_invoice.id
   returning * into v_invoice;

  update public.billing_audit_events audit
     set metadata = audit.metadata || jsonb_build_object(
       'due_date', v_invoice.due_date,
       'grace_period_days', v_invoice.grace_period_days,
       'overdue_date', v_invoice.overdue_date
     )
   where audit.billing_period_id = p_period_id
     and audit.correlation_id = p_correlation_id
     and audit.action in ('invoices.issued', 'invoice.payment_recorded');

  return next v_invoice;
end;
$$;

revoke all on function public.issue_and_pay_legacy(uuid, uuid, uuid, date, timestamptz, date, text, text, jsonb, uuid)
  from public, anon;
grant execute on function public.issue_and_pay_legacy(uuid, uuid, uuid, date, timestamptz, date, text, text, jsonb, uuid)
  to authenticated;
revoke all on function public.issue_and_pay(uuid, uuid, uuid, date, integer, timestamptz, date, text, text, jsonb, uuid)
  from public, anon;
grant execute on function public.issue_and_pay(uuid, uuid, uuid, date, integer, timestamptz, date, text, text, jsonb, uuid)
  to authenticated;

-- Recreate the contract + handover RPC because its argument and target column were renamed.
drop function if exists public.create_contract_with_handover(
  uuid, uuid, uuid, date, date, numeric, numeric, smallint, integer,
  numeric, numeric, text, text, numeric, numeric, date, uuid
);

create function public.create_contract_with_handover(
  p_room_id uuid,
  p_tenant_id uuid,
  p_building_id uuid,
  p_start_date date,
  p_end_date date,
  p_monthly_rent numeric,
  p_deposit numeric,
  p_payment_due_day smallint,
  p_occupant_count integer,
  p_discount_amount numeric,
  p_surcharge_amount numeric,
  p_status text,
  p_notes text,
  p_handover_electricity_reading numeric,
  p_handover_water_reading numeric,
  p_handover_reading_date date,
  p_recorded_by uuid
)
returns setof public.contracts
language plpgsql
security invoker
as $$
declare
  v_building_code text;
  v_year integer;
  v_prefix text;
  v_next_seq integer;
  v_contract_code text;
  v_inserted_contract public.contracts%rowtype;
  v_period_year integer;
  v_period_month integer;
begin
  if p_end_date <= p_start_date then
    raise exception 'end_date must be after start_date' using errcode = 'P0001';
  end if;

  select code into v_building_code from public.buildings where id = p_building_id;
  if v_building_code is null then
    raise exception 'building % not found', p_building_id using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_building_id::text, 1));
  v_year := extract(year from p_start_date)::integer;
  v_prefix := format('hd-%s-%s', v_building_code, v_year);

  select coalesce(max(
    nullif(regexp_replace(contract_code, '^' || v_prefix || '-', ''), '')::integer
  ), 0) + 1
    into v_next_seq
    from public.contracts
   where contract_code like v_prefix || '-%';
  v_contract_code := v_prefix || '-' || lpad(v_next_seq::text, 4, '0');

  insert into public.contracts (
    contract_code, room_id, tenant_id, building_id, start_date, end_date,
    monthly_rent, deposit, payment_due_day, occupant_count, discount_amount,
    surcharge_amount, status, notes
  ) values (
    v_contract_code, p_room_id, p_tenant_id, p_building_id, p_start_date, p_end_date,
    p_monthly_rent, coalesce(p_deposit, 0), p_payment_due_day,
    coalesce(p_occupant_count, 1), coalesce(p_discount_amount, 0),
    coalesce(p_surcharge_amount, 0), coalesce(p_status, 'active'), nullif(p_notes, '')
  ) returning * into v_inserted_contract;

  v_period_year := extract(year from p_handover_reading_date)::integer;
  v_period_month := extract(month from p_handover_reading_date)::integer;
  insert into public.meter_readings (
    room_id, building_id, meter_type, reading_type, period_year, period_month,
    reading_date, reading_value, recorded_by
  ) values
    (p_room_id, p_building_id, 'electricity', 'handover_in', v_period_year,
     v_period_month, p_handover_reading_date, p_handover_electricity_reading, p_recorded_by),
    (p_room_id, p_building_id, 'water', 'handover_in', v_period_year,
     v_period_month, p_handover_reading_date, p_handover_water_reading, p_recorded_by);

  return next v_inserted_contract;
end;
$$;

grant execute on function public.create_contract_with_handover(
  uuid, uuid, uuid, date, date, numeric, numeric, smallint, integer,
  numeric, numeric, text, text, numeric, numeric, date, uuid
) to authenticated;
