-- =============================================================================
-- Period-scoped incidental room charges
--
-- Additive source rows are editable only before an effective invoice exists.
-- All writes and billing audit events commit through service-role-only RPCs.
-- =============================================================================

create table public.billing_incidental_charges (
  id                uuid primary key default gen_random_uuid(),
  billing_period_id uuid not null references public.billing_periods(id) on delete cascade,
  contract_id       uuid not null references public.contracts(id) on delete restrict,
  room_id           uuid not null references public.rooms(id) on delete restrict,
  label             text not null check (length(btrim(label)) between 1 and 200),
  amount            numeric(12,0) not null check (amount > 0 and amount = trunc(amount)),
  note              text check (note is null or length(note) <= 500),
  operation_id      uuid not null unique,
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_billing_incidental_charges_period_contract
  on public.billing_incidental_charges (billing_period_id, contract_id, created_at, id);

create index idx_billing_incidental_charges_room
  on public.billing_incidental_charges (room_id, billing_period_id);

create trigger billing_incidental_charges_set_updated_at
  before update on public.billing_incidental_charges
  for each row execute function public.set_updated_at();

alter table public.billing_incidental_charges enable row level security;
revoke all on public.billing_incidental_charges from public;
revoke all on public.billing_incidental_charges from anon, authenticated;
grant select on public.billing_incidental_charges to service_role;

-- Preserve every historical charge type while adding the distinct incidental
-- snapshot type. The runtime migration created this check implicitly.
alter table public.invoice_charges
  drop constraint if exists invoice_charges_charge_type_check;
alter table public.invoice_charges
  add constraint invoice_charges_charge_type_check check (charge_type in (
    'rent','electricity','water','service','discount','surcharge','incidental','adjustment'
  ));

alter table public.billing_audit_events
  drop constraint if exists billing_audit_events_entity_type_check;
alter table public.billing_audit_events
  add constraint billing_audit_events_entity_type_check check (entity_type in (
    'billing_period','meter_reading','billing_utility_usage','billing_incidental_charge',
    'invoice','invoice_charge','invoice_payment'
  ));

create or replace function public.create_billing_incidental_charge_with_audit(
  p_billing_period_id uuid,
  p_contract_id uuid,
  p_actor_id uuid,
  p_label text,
  p_amount numeric,
  p_note text,
  p_operation_id uuid
)
returns setof public.billing_incidental_charges
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period public.billing_periods%rowtype;
  v_contract public.contracts%rowtype;
  v_replay public.billing_incidental_charges%rowtype;
  v_created public.billing_incidental_charges%rowtype;
  v_period_start date;
  v_period_end date;
begin
  if p_operation_id is null then
    raise exception 'INCIDENTAL_CHARGE_OPERATION_REQUIRED' using errcode = 'P0001';
  end if;

  select charge.* into v_replay
    from public.billing_incidental_charges charge
   where operation_id = p_operation_id;
  if found then
    if v_replay.billing_period_id is distinct from p_billing_period_id
       or v_replay.contract_id is distinct from p_contract_id
       or v_replay.created_by is distinct from p_actor_id
       or v_replay.label is distinct from pg_catalog.btrim(p_label)
       or v_replay.amount is distinct from p_amount
       or v_replay.note is distinct from nullif(pg_catalog.btrim(p_note), '') then
      raise exception 'INCIDENTAL_CHARGE_OPERATION_CONFLICT' using errcode = 'P0001';
    end if;
    return next v_replay;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_billing_period_id::text, 0));

  -- A concurrent retry may have committed while this transaction waited for
  -- the period lock. Re-read after locking so the unique operation key
  -- replays instead of surfacing a constraint error.
  select charge.* into v_replay
    from public.billing_incidental_charges charge
   where operation_id = p_operation_id;
  if found then
    if v_replay.billing_period_id is distinct from p_billing_period_id
       or v_replay.contract_id is distinct from p_contract_id
       or v_replay.created_by is distinct from p_actor_id
       or v_replay.label is distinct from pg_catalog.btrim(p_label)
       or v_replay.amount is distinct from p_amount
       or v_replay.note is distinct from nullif(pg_catalog.btrim(p_note), '') then
      raise exception 'INCIDENTAL_CHARGE_OPERATION_CONFLICT' using errcode = 'P0001';
    end if;
    return next v_replay;
    return;
  end if;

  select period.* into v_period
    from public.billing_periods period
   where period.id = p_billing_period_id
   for update;
  if not found then
    raise exception 'BILLING_PERIOD_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_period.status = 'closed' then
    raise exception 'BILLING_PERIOD_LOCKED' using errcode = 'P0001';
  end if;

  select contract.* into v_contract
    from public.contracts contract
   where contract.id = p_contract_id;
  if not found then
    raise exception 'INCIDENTAL_CHARGE_CONTRACT_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_period_start := pg_catalog.make_date(v_period.period_year, v_period.period_month, 1);
  v_period_end := (v_period_start + interval '1 month - 1 day')::date;
  if v_contract.building_id is distinct from v_period.building_id
     or v_contract.room_id is null
     or v_contract.start_date > v_period_end
     or v_contract.end_date < v_period_start
     or v_contract.status = 'terminated' then
    raise exception 'INCIDENTAL_CHARGE_SCOPE_MISMATCH' using errcode = 'P0001';
  end if;

  if exists (
    select 1
      from public.invoices invoice
     where invoice.billing_period_id = p_billing_period_id
       and invoice.contract_id = p_contract_id
       and invoice.status <> 'void'
  ) then
    raise exception 'BILLING_INVOICE_LOCKED' using errcode = 'P0001';
  end if;

  if pg_catalog.length(pg_catalog.btrim(coalesce(p_label, ''))) not between 1 and 200 then
    raise exception 'INCIDENTAL_CHARGE_LABEL_INVALID' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> pg_catalog.trunc(p_amount) or p_amount > 999999999999 then
    raise exception 'INCIDENTAL_CHARGE_AMOUNT_INVALID' using errcode = 'P0001';
  end if;
  if p_note is not null and pg_catalog.length(pg_catalog.btrim(p_note)) > 500 then
    raise exception 'INCIDENTAL_CHARGE_NOTE_INVALID' using errcode = 'P0001';
  end if;

  insert into public.billing_incidental_charges (
    billing_period_id, contract_id, room_id, label, amount, note,
    operation_id, created_by
  ) values (
    p_billing_period_id, p_contract_id, v_contract.room_id,
    pg_catalog.btrim(p_label), p_amount,
    nullif(pg_catalog.btrim(p_note), ''), p_operation_id, p_actor_id
  ) returning * into v_created;

  insert into public.billing_audit_events (
    billing_period_id, actor_id, action, entity_type, entity_id,
    correlation_id, after_data, metadata
  ) values (
    p_billing_period_id, p_actor_id, 'incidental_charge.created',
    'billing_incidental_charge', v_created.id, p_operation_id,
    pg_catalog.to_jsonb(v_created),
    pg_catalog.jsonb_build_object(
      'contract_id', v_created.contract_id,
      'room_id', v_created.room_id,
      'label', v_created.label,
      'amount', v_created.amount,
      'idempotency_key', p_operation_id
    )
  );

  return next v_created;
end;
$$;

create or replace function public.update_billing_incidental_charge_with_audit(
  p_billing_period_id uuid,
  p_charge_id uuid,
  p_expected_updated_at timestamptz,
  p_actor_id uuid,
  p_label text,
  p_amount numeric,
  p_note text
)
returns setof public.billing_incidental_charges
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period public.billing_periods%rowtype;
  v_before public.billing_incidental_charges%rowtype;
  v_updated public.billing_incidental_charges%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_billing_period_id::text, 0));

  select period.* into v_period
    from public.billing_periods period
   where period.id = p_billing_period_id
   for update;
  if not found then
    raise exception 'BILLING_PERIOD_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_period.status = 'closed' then
    raise exception 'BILLING_PERIOD_LOCKED' using errcode = 'P0001';
  end if;

  select charge.* into v_before
    from public.billing_incidental_charges charge
   where charge.id = p_charge_id
   for update;
  if not found then
    raise exception 'INCIDENTAL_CHARGE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_before.billing_period_id is distinct from p_billing_period_id then
    raise exception 'INCIDENTAL_CHARGE_SCOPE_MISMATCH' using errcode = 'P0001';
  end if;
  if v_before.updated_at is distinct from p_expected_updated_at then
    raise exception 'INCIDENTAL_CHARGE_VERSION_CONFLICT' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.invoices invoice
     where invoice.billing_period_id = p_billing_period_id
       and invoice.contract_id = v_before.contract_id
       and invoice.status <> 'void'
  ) then
    raise exception 'BILLING_INVOICE_LOCKED' using errcode = 'P0001';
  end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_label, ''))) not between 1 and 200 then
    raise exception 'INCIDENTAL_CHARGE_LABEL_INVALID' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> pg_catalog.trunc(p_amount) or p_amount > 999999999999 then
    raise exception 'INCIDENTAL_CHARGE_AMOUNT_INVALID' using errcode = 'P0001';
  end if;
  if p_note is not null and pg_catalog.length(pg_catalog.btrim(p_note)) > 500 then
    raise exception 'INCIDENTAL_CHARGE_NOTE_INVALID' using errcode = 'P0001';
  end if;

  update public.billing_incidental_charges
     set label = pg_catalog.btrim(p_label),
         amount = p_amount,
         note = nullif(pg_catalog.btrim(p_note), '')
   where id = p_charge_id
  returning * into v_updated;

  insert into public.billing_audit_events (
    billing_period_id, actor_id, action, entity_type, entity_id,
    correlation_id, before_data, after_data, metadata
  ) values (
    p_billing_period_id, p_actor_id, 'incidental_charge.updated',
    'billing_incidental_charge', v_updated.id, pg_catalog.gen_random_uuid(),
    pg_catalog.to_jsonb(v_before), pg_catalog.to_jsonb(v_updated),
    pg_catalog.jsonb_build_object(
      'contract_id', v_updated.contract_id,
      'room_id', v_updated.room_id,
      'label', v_updated.label,
      'amount', v_updated.amount
    )
  );

  return next v_updated;
end;
$$;

create or replace function public.delete_billing_incidental_charge_with_audit(
  p_billing_period_id uuid,
  p_charge_id uuid,
  p_expected_updated_at timestamptz,
  p_actor_id uuid
)
returns setof public.billing_incidental_charges
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period public.billing_periods%rowtype;
  v_before public.billing_incidental_charges%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_billing_period_id::text, 0));

  select period.* into v_period
    from public.billing_periods period
   where period.id = p_billing_period_id
   for update;
  if not found then
    raise exception 'BILLING_PERIOD_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_period.status = 'closed' then
    raise exception 'BILLING_PERIOD_LOCKED' using errcode = 'P0001';
  end if;

  select charge.* into v_before
    from public.billing_incidental_charges charge
   where charge.id = p_charge_id
   for update;
  if not found then
    raise exception 'INCIDENTAL_CHARGE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_before.billing_period_id is distinct from p_billing_period_id then
    raise exception 'INCIDENTAL_CHARGE_SCOPE_MISMATCH' using errcode = 'P0001';
  end if;
  if v_before.updated_at is distinct from p_expected_updated_at then
    raise exception 'INCIDENTAL_CHARGE_VERSION_CONFLICT' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.invoices invoice
     where invoice.billing_period_id = p_billing_period_id
       and invoice.contract_id = v_before.contract_id
       and invoice.status <> 'void'
  ) then
    raise exception 'BILLING_INVOICE_LOCKED' using errcode = 'P0001';
  end if;

  delete from public.billing_incidental_charges where id = p_charge_id;

  insert into public.billing_audit_events (
    billing_period_id, actor_id, action, entity_type, entity_id,
    correlation_id, before_data, metadata
  ) values (
    p_billing_period_id, p_actor_id, 'incidental_charge.deleted',
    'billing_incidental_charge', v_before.id, pg_catalog.gen_random_uuid(),
    pg_catalog.to_jsonb(v_before),
    pg_catalog.jsonb_build_object(
      'contract_id', v_before.contract_id,
      'room_id', v_before.room_id,
      'label', v_before.label,
      'amount', v_before.amount
    )
  );

  return next v_before;
end;
$$;

revoke all on function public.create_billing_incidental_charge_with_audit(uuid, uuid, uuid, text, numeric, text, uuid)
  from public, anon, authenticated;
revoke all on function public.update_billing_incidental_charge_with_audit(uuid, uuid, timestamptz, uuid, text, numeric, text)
  from public, anon, authenticated;
revoke all on function public.delete_billing_incidental_charge_with_audit(uuid, uuid, timestamptz, uuid)
  from public, anon, authenticated;

grant execute on function public.create_billing_incidental_charge_with_audit(uuid, uuid, uuid, text, numeric, text, uuid)
  to service_role;
grant execute on function public.update_billing_incidental_charge_with_audit(uuid, uuid, timestamptz, uuid, text, numeric, text)
  to service_role;
grant execute on function public.delete_billing_incidental_charge_with_audit(uuid, uuid, timestamptz, uuid)
  to service_role;

comment on table public.billing_incidental_charges is
  'Positive one-off room charges scoped to one contract and billing period; snapshotted at invoice issue.';

-- Keep draft generation on one consistent input snapshot. This replaces the
-- production RPC installed through the Phase 3 SQL editor script and adds the
-- new source rows without changing its existing keys.
create or replace function public.billing_period_input_snapshot(p_period_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with period as (
    select bp.* from public.billing_periods bp where bp.id = p_period_id
  ), bounds as (
    select
      p.*,
      make_date(p.period_year, p.period_month, 1) as first_day,
      (make_date(p.period_year, p.period_month, 1) + interval '1 month - 1 day')::date as last_day,
      (make_date(p.period_year, p.period_month, 1) - interval '1 month')::date as previous_day
    from period p
  ), contracts as (
    select c.* from public.contracts c join bounds b on b.building_id = c.building_id
    where c.status <> 'terminated' and c.start_date <= b.last_day
      and (c.end_date is null or c.end_date >= b.first_day)
  ), room_ids as (select distinct room_id as id from contracts), contract_ids as (select id from contracts)
  select jsonb_build_object(
    'building', (select to_jsonb(bld) from public.buildings bld join bounds b on b.building_id = bld.id),
    'contracts', coalesce((select jsonb_agg(to_jsonb(c)) from contracts c), '[]'::jsonb),
    'services', coalesce((
      select jsonb_agg(to_jsonb(cs) || jsonb_build_object('service_catalog', to_jsonb(sc)))
      from public.contract_services cs
      left join public.service_catalog sc on sc.id = cs.catalog_id
      where cs.contract_id in (select id from contract_ids) and cs.is_enabled = true
    ), '[]'::jsonb),
    'occupants', coalesce((
      select jsonb_agg(to_jsonb(co)) from public.contract_occupants co
      where co.contract_id in (select id from contract_ids)
    ), '[]'::jsonb),
    'readings', coalesce((
      select jsonb_agg(to_jsonb(mr)) from public.meter_readings mr join bounds b on true
      where mr.room_id in (select id from room_ids) and (
        (mr.reading_type = 'monthly' and (
          (mr.period_year = b.period_year and mr.period_month = b.period_month)
          or (mr.period_year = extract(year from b.previous_day)::integer
              and mr.period_month = extract(month from b.previous_day)::integer)
        )) or mr.reading_type = 'handover_in'
      )
    ), '[]'::jsonb),
    'overrides', coalesce((
      select jsonb_agg(to_jsonb(u)) from public.billing_utility_usages u where u.billing_period_id = p_period_id
    ), '[]'::jsonb),
    'incidental_charges', coalesce((
      select jsonb_agg(to_jsonb(ic) order by ic.created_at, ic.id)
      from public.billing_incidental_charges ic
      where ic.billing_period_id = p_period_id
        and ic.contract_id in (select id from contract_ids)
    ), '[]'::jsonb),
    'invoices', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.created_at) from public.invoices i where i.billing_period_id = p_period_id
    ), '[]'::jsonb),
    'rooms', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.room_number) from public.rooms r join bounds b on b.building_id = r.building_id
    ), '[]'::jsonb),
    'tenants', coalesce((
      select jsonb_agg(to_jsonb(t)) from public.tenants t where t.id in (select tenant_id from contracts)
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.billing_period_input_snapshot(uuid) from public, anon, authenticated;
grant execute on function public.billing_period_input_snapshot(uuid) to service_role;

-- Verification after applying:
-- 1. Create one charge twice with the same operation UUID and verify one row/audit event.
-- 2. Try stale update/delete timestamps and expect INCIDENTAL_CHARGE_VERSION_CONFLICT.
-- 3. Create a non-void invoice or close the period and expect the matching lock error.
-- 4. Void the invoice and verify source writes are allowed again before reissue.
-- 5. SET LOCAL ROLE authenticated and verify table/RPC writes are denied.
-- 6. Run Supabase database advisors, then regenerate types with:
--    npx supabase gen types typescript --project-id "$SUPABASE_PROJECT_REF" --schema public > app/types/database.types.ts

-- Rollback after application callers have reverted and no issued invoice charge
-- uses charge_type='incidental':
-- drop function if exists public.delete_billing_incidental_charge_with_audit(uuid, uuid, timestamptz, uuid);
-- drop function if exists public.update_billing_incidental_charge_with_audit(uuid, uuid, timestamptz, uuid, text, numeric, text);
-- drop function if exists public.create_billing_incidental_charge_with_audit(uuid, uuid, uuid, text, numeric, text, uuid);
-- drop table if exists public.billing_incidental_charges;
-- restore invoice_charges_charge_type_check and billing_audit_events_entity_type_check without the new values.
