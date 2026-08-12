begin;

-- Audit scope is historical evidence, not ownership of a live row. Removing
-- the FK prevents a building hard-delete from erasing its own history.
alter table public.audit_events
  drop constraint if exists audit_events_building_id_fkey;
alter table public.audit_events
  add column if not exists building_name_snapshot text,
  add column if not exists building_code_snapshot text,
  add column if not exists operation_id uuid;

update public.audit_events audit
set building_name_snapshot = coalesce(audit.building_name_snapshot, building.name),
    building_code_snapshot = coalesce(audit.building_code_snapshot, building.code)
from public.buildings building
where building.id = audit.building_id;

create unique index if not exists idx_audit_events_operation
  on public.audit_events (operation_id)
  where operation_id is not null;

-- Billing history receives immutable scope before its live period reference
-- is relaxed. This keeps deleted-period history queryable by building/month.
alter table public.billing_audit_events
  add column if not exists building_id uuid,
  add column if not exists period_year integer,
  add column if not exists period_month integer,
  add column if not exists operation_id uuid;

update public.billing_audit_events audit
set building_id = period.building_id,
    period_year = period.period_year,
    period_month = period.period_month
from public.billing_periods period
where period.id = audit.billing_period_id
  and (audit.building_id is null or audit.period_year is null or audit.period_month is null);

alter table public.billing_audit_events
  drop constraint if exists billing_audit_events_billing_period_id_fkey;
alter table public.billing_audit_events
  alter column billing_period_id drop not null;
alter table public.billing_audit_events
  add constraint billing_audit_events_billing_period_id_fkey
  foreign key (billing_period_id) references public.billing_periods(id) on delete set null;

create index if not exists idx_billing_audit_events_building_created
  on public.billing_audit_events (building_id, created_at desc);
create unique index if not exists idx_billing_audit_events_operation
  on public.billing_audit_events (operation_id)
  where operation_id is not null;

-- Durable intent for mutations that cross the database boundary.
create table if not exists public.audit_operations (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  actor_id uuid references auth.users(id) on delete set null,
  building_id uuid,
  action text not null check (length(action) > 0),
  entity_type text not null check (length(entity_type) > 0),
  entity_id uuid,
  intent_data jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'executing', 'completed', 'unresolved')),
  lease_owner uuid,
  lease_until timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  outcome_data jsonb,
  audit_event_id uuid references public.audit_events(id) on delete set null,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.audit_operations enable row level security;
create index if not exists idx_audit_operations_reconcile
  on public.audit_operations (status, lease_until, created_at)
  where status in ('pending', 'executing');

create or replace function public.complete_audit_operation(
  p_operation_id uuid,
  p_outcome_data jsonb default '{}'::jsonb,
  p_before_data jsonb default null,
  p_after_data jsonb default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.audit_operations
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_operation public.audit_operations%rowtype;
  v_event_id uuid;
begin
  select * into v_operation
  from public.audit_operations
  where id = p_operation_id
  for update;
  if not found then
    raise exception 'AUDIT_OPERATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_operation.status = 'completed' then
    return v_operation;
  end if;

  insert into public.audit_events (
    building_id, actor_id, action, entity_type, entity_id, operation_id,
    before_data, after_data, metadata
  ) values (
    v_operation.building_id, v_operation.actor_id, v_operation.action,
    v_operation.entity_type, v_operation.entity_id, v_operation.id,
    p_before_data, p_after_data, coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (operation_id) where operation_id is not null
  do update set operation_id = excluded.operation_id
  returning id into v_event_id;

  update public.audit_operations
  set status = 'completed', outcome_data = coalesce(p_outcome_data, '{}'::jsonb),
      audit_event_id = v_event_id, lease_owner = null, lease_until = null,
      completed_at = now(), updated_at = now(), last_error_code = null
  where id = v_operation.id
  returning * into v_operation;
  return v_operation;
end;
$$;

create or replace function public.claim_stale_audit_operations(
  p_worker_id uuid,
  p_limit integer default 20,
  p_lease_seconds integer default 60
)
returns setof public.audit_operations
language sql
security invoker
set search_path = ''
as $$
  with candidates as (
    select operation.id
    from public.audit_operations operation
    where operation.status in ('pending', 'executing')
      and (operation.lease_until is null or operation.lease_until < now())
    order by operation.created_at
    limit greatest(1, least(p_limit, 100))
    for update skip locked
  )
  update public.audit_operations operation
  set status = 'executing', lease_owner = p_worker_id,
      lease_until = now() + make_interval(secs => greatest(5, p_lease_seconds)),
      attempt_count = operation.attempt_count + 1, updated_at = now()
  from candidates
  where operation.id = candidates.id
  returning operation.*;
$$;

create or replace function public.update_invoice_email_settings_with_audit(
  p_building_id uuid,
  p_auto_send_enabled boolean,
  p_actor_id uuid,
  p_operation_id uuid default null
)
returns public.building_invoice_email_settings
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_before public.building_invoice_email_settings%rowtype;
  v_after public.building_invoice_email_settings%rowtype;
begin
  select * into v_before from public.building_invoice_email_settings
  where building_id = p_building_id for update;

  insert into public.building_invoice_email_settings (
    building_id, auto_send_enabled, updated_by
  ) values (p_building_id, p_auto_send_enabled, p_actor_id)
  on conflict (building_id) do update
  set auto_send_enabled = excluded.auto_send_enabled,
      updated_by = excluded.updated_by
  returning * into v_after;

  insert into public.audit_events (
    building_id, actor_id, action, entity_type, entity_id, operation_id,
    before_data, after_data
  ) values (
    p_building_id, p_actor_id, 'building.invoice_email_settings.updated',
    'building', p_building_id, p_operation_id,
    case when v_before.building_id is null then null else
      jsonb_build_object('auto_send_enabled', v_before.auto_send_enabled) end,
    jsonb_build_object('auto_send_enabled', v_after.auto_send_enabled)
  );
  return v_after;
end;
$$;

create or replace function public.refresh_invoice_profile_snapshot_with_audit(
  p_invoice_id uuid,
  p_actor_id uuid,
  p_operation_id uuid default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_invoice public.invoices%rowtype;
  v_period public.billing_periods%rowtype;
  v_before jsonb;
  v_after jsonb;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found then return false; end if;
  select * into v_period from public.billing_periods where id = v_invoice.billing_period_id;
  if not found then return false; end if;

  v_before := v_invoice.invoice_profile_snapshot;
  v_after := public.render_invoice_profile_snapshot(
    v_period.building_id, v_invoice.room_id, v_invoice.invoice_code,
    v_invoice.billing_period_id, now()
  );
  if v_after is null then return false; end if;

  update public.invoices set invoice_profile_snapshot = v_after where id = p_invoice_id;
  insert into public.billing_audit_events (
    billing_period_id, building_id, period_year, period_month, actor_id,
    action, entity_type, entity_id, operation_id, before_data, after_data
  ) values (
    v_invoice.billing_period_id, v_period.building_id, v_period.period_year,
    v_period.period_month, p_actor_id, 'invoice.profile_snapshot.refreshed',
    'invoice', v_invoice.id, p_operation_id,
    v_before - 'qr_image_path' - 'logo_image_path',
    v_after - 'qr_image_path' - 'logo_image_path'
  );
  return true;
end;
$$;

create or replace function public.delete_building_with_audit(
  p_building_id uuid,
  p_actor_id uuid,
  p_operation_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_building public.buildings%rowtype;
begin
  select * into v_building
  from public.buildings
  where id = p_building_id
  for update;
  if not found then return false; end if;

  delete from public.buildings where id = p_building_id;
  insert into public.audit_events (
    building_id, building_name_snapshot, building_code_snapshot, actor_id,
    action, entity_type, entity_id, operation_id, before_data
  ) values (
    v_building.id, v_building.name, v_building.code, p_actor_id,
    'building.removed', 'building', v_building.id, p_operation_id,
    to_jsonb(v_building)
  );
  return true;
end;
$$;

revoke all on table public.audit_events from public, anon, authenticated;
revoke all on table public.billing_audit_events from public, anon, authenticated;
revoke all on table public.audit_operations from public, anon, authenticated;
grant select, insert, update on table public.audit_operations to service_role;
grant select, insert on table public.audit_events to service_role;
grant select, insert on table public.billing_audit_events to service_role;

revoke all on function public.complete_audit_operation(uuid, jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function public.claim_stale_audit_operations(uuid, integer, integer)
  from public, anon, authenticated;
revoke all on function public.update_invoice_email_settings_with_audit(uuid, boolean, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.refresh_invoice_profile_snapshot_with_audit(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.delete_building_with_audit(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.complete_audit_operation(uuid, jsonb, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.claim_stale_audit_operations(uuid, integer, integer) to service_role;
grant execute on function public.update_invoice_email_settings_with_audit(uuid, boolean, uuid, uuid) to service_role;
grant execute on function public.refresh_invoice_profile_snapshot_with_audit(uuid, uuid, uuid) to service_role;
grant execute on function public.delete_building_with_audit(uuid, uuid, uuid) to service_role;

commit;

do $$
declare
  existing_job record;
begin
  for existing_job in select jobid from cron.job where jobname = 'audit-operation-reconcile'
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;
end;
$$;

select cron.schedule(
  'audit-operation-reconcile',
  '*/5 * * * *',
  $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'nitro_scheduler_base_url')
        || '/api/internal/audit/reconcile',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-audit-reconcile-secret', (
          select decrypted_secret from vault.decrypted_secrets where name = 'invoice_email_dispatch_secret'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $job$
);
