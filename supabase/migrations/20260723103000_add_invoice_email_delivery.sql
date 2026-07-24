-- Durable invoice email delivery outbox.
-- Apply through Supabase Dashboard > SQL Editor.

begin;

do $$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.buildings') is null then
    v_missing := array_append(v_missing, 'public.buildings');
  end if;
  if to_regclass('public.invoices') is null then
    v_missing := array_append(v_missing, 'public.invoices');
  end if;
  if to_regclass('public.billing_periods') is null then
    v_missing := array_append(v_missing, 'public.billing_periods');
  end if;
  if to_regclass('public.tenants') is null then
    v_missing := array_append(v_missing, 'public.tenants');
  end if;
  if to_regclass('public.billing_audit_events') is null then
    v_missing := array_append(v_missing, 'public.billing_audit_events');
  end if;
  if to_regprocedure('public.set_updated_at()') is null then
    v_missing := array_append(v_missing, 'public.set_updated_at()');
  end if;

  if coalesce(array_length(v_missing, 1), 0) > 0 then
    raise exception
      'Missing prerequisites for 20260723103000_add_invoice_email_delivery: %',
      array_to_string(v_missing, ', ')
      using hint = 'Apply earlier migrations in order before running this script.';
  end if;
end;
$$;

create table public.building_invoice_email_settings (
  building_id uuid primary key references public.buildings(id) on delete cascade,
  auto_send_enabled boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger building_invoice_email_settings_set_updated_at
  before update on public.building_invoice_email_settings
  for each row execute function public.set_updated_at();

create table public.invoice_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  building_id uuid not null references public.buildings(id) on delete cascade,
  billing_period_id uuid not null references public.billing_periods(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  source text not null check (source in ('manual', 'automatic')),
  status text not null check (status in (
    'queued', 'processing', 'accepted', 'delivered',
    'failed', 'bounced', 'complained', 'skipped'
  )),
  recipient_email text,
  skip_reason text,
  provider_email_id text,
  idempotency_key text not null unique default gen_random_uuid()::text,
  provider_event_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count between 0 and 6),
  next_attempt_at timestamptz,
  lease_expires_at timestamptz,
  locked_by uuid,
  last_error_code text,
  last_error_message text,
  accepted_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  bounced_at timestamptz,
  complained_at timestamptz,
  skipped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoice_email_deliveries_recipient_shape check (
    (status = 'skipped' and recipient_email is null and skip_reason is not null)
    or
    (status <> 'skipped' and recipient_email is not null and skip_reason is null)
  ),
  constraint invoice_email_deliveries_processing_lease check (
    (status = 'processing' and lease_expires_at is not null and locked_by is not null)
    or status <> 'processing'
  )
);

create trigger invoice_email_deliveries_set_updated_at
  before update on public.invoice_email_deliveries
  for each row execute function public.set_updated_at();

create unique index uq_invoice_email_deliveries_active_recipient
  on public.invoice_email_deliveries (invoice_id, recipient_email)
  where status in ('queued', 'processing', 'accepted');

create unique index uq_invoice_email_deliveries_provider_email
  on public.invoice_email_deliveries (provider_email_id)
  where provider_email_id is not null;

create index idx_invoice_email_deliveries_due
  on public.invoice_email_deliveries (next_attempt_at, created_at)
  where status = 'queued';

create index idx_invoice_email_deliveries_invoice_created
  on public.invoice_email_deliveries (invoice_id, created_at desc);

create index idx_invoice_email_deliveries_building_created
  on public.invoice_email_deliveries (building_id, created_at desc);

create table public.invoice_email_webhook_events (
  id uuid primary key default gen_random_uuid(),
  svix_id text not null unique,
  provider_email_id text not null,
  event_type text not null check (event_type in (
    'email.sent', 'email.delivered', 'email.failed',
    'email.bounced', 'email.complained'
  )),
  event_created_at timestamptz not null,
  received_at timestamptz not null default now()
);

create index idx_invoice_email_webhook_events_provider_created
  on public.invoice_email_webhook_events (provider_email_id, event_created_at desc);

alter table public.building_invoice_email_settings enable row level security;
alter table public.invoice_email_deliveries enable row level security;
alter table public.invoice_email_webhook_events enable row level security;

revoke all on table public.building_invoice_email_settings from public, anon, authenticated;
revoke all on table public.invoice_email_deliveries from public, anon, authenticated;
revoke all on table public.invoice_email_webhook_events from public, anon, authenticated;

grant select, insert, update, delete on table public.building_invoice_email_settings to service_role;
grant select, insert, update, delete on table public.invoice_email_deliveries to service_role;
grant select, insert, update, delete on table public.invoice_email_webhook_events to service_role;

create or replace function public.invoice_email_normalize_recipient(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_email is null then null
    when lower(trim(p_email)) ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      then lower(trim(p_email))
    else null
  end;
$$;

create or replace function public.audit_invoice_email_queued()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'queued' then
    insert into public.billing_audit_events (
      billing_period_id,
      actor_id,
      action,
      entity_type,
      entity_id,
      after_data,
      metadata
    ) values (
      new.billing_period_id,
      new.created_by,
      'invoice.email_queued',
      'invoice',
      new.invoice_id,
      jsonb_build_object('delivery_id', new.id, 'source', new.source),
      jsonb_build_object('delivery_id', new.id)
    );
  end if;
  return new;
end;
$$;

create trigger invoice_email_deliveries_audit_queued
  after insert on public.invoice_email_deliveries
  for each row execute function public.audit_invoice_email_queued();

create or replace function public.audit_invoice_email_outcome()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_action text;
begin
  if old.status = new.status then
    return new;
  end if;
  v_action := case
    when new.status = 'delivered' then 'invoice.email_delivered'
    when new.status in ('failed', 'bounced', 'complained') then 'invoice.email_failed'
    else null
  end;
  if v_action is null then
    return new;
  end if;

  insert into public.billing_audit_events (
    billing_period_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    after_data,
    metadata
  ) values (
    new.billing_period_id,
    null,
    v_action,
    'invoice',
    new.invoice_id,
    jsonb_build_object('delivery_id', new.id, 'status', new.status),
    jsonb_build_object('delivery_id', new.id)
  );
  return new;
end;
$$;

create trigger invoice_email_deliveries_audit_outcome
  after update of status on public.invoice_email_deliveries
  for each row execute function public.audit_invoice_email_outcome();

create or replace function public.enqueue_automatic_invoice_email_delivery()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_building_id uuid;
  v_auto_send_enabled boolean;
  v_raw_email text;
  v_recipient_email text;
  v_skip_reason text;
begin
  if new.status = 'void' then
    return new;
  end if;

  select period.building_id, coalesce(setting.auto_send_enabled, false)
    into v_building_id, v_auto_send_enabled
    from public.billing_periods period
    left join public.building_invoice_email_settings setting
      on setting.building_id = period.building_id
   where period.id = new.billing_period_id;

  if not coalesce(v_auto_send_enabled, false) then
    return new;
  end if;

  select tenant.email
    into v_raw_email
    from public.tenants tenant
   where tenant.id = new.tenant_id;

  v_recipient_email := public.invoice_email_normalize_recipient(v_raw_email);
  v_skip_reason := case
    when nullif(trim(coalesce(v_raw_email, '')), '') is null then 'recipient_missing'
    when v_recipient_email is null then 'recipient_invalid'
    else null
  end;

  insert into public.invoice_email_deliveries (
    invoice_id,
    building_id,
    billing_period_id,
    source,
    status,
    recipient_email,
    skip_reason,
    skipped_at,
    next_attempt_at
  ) values (
    new.id,
    v_building_id,
    new.billing_period_id,
    'automatic',
    case when v_recipient_email is null then 'skipped' else 'queued' end,
    v_recipient_email,
    v_skip_reason,
    case when v_recipient_email is null then now() else null end,
    case when v_recipient_email is null then null else now() end
  )
  on conflict (invoice_id, recipient_email)
    where status in ('queued', 'processing', 'accepted')
    do nothing;

  return new;
end;
$$;

create trigger invoices_enqueue_email_delivery
  after insert on public.invoices
  for each row execute function public.enqueue_automatic_invoice_email_delivery();

create or replace function public.enqueue_invoice_email_delivery(
  p_invoice_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices%rowtype;
  v_building_id uuid;
  v_raw_email text;
  v_recipient_email text;
  v_skip_reason text;
  v_delivery public.invoice_email_deliveries%rowtype;
begin
  select invoice.*
    into v_invoice
    from public.invoices invoice
   where invoice.id = p_invoice_id
   for update;

  if not found then
    raise exception 'INVOICE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_invoice.status = 'void' then
    raise exception 'INVOICE_VOID' using errcode = 'P0001';
  end if;

  select period.building_id
    into v_building_id
    from public.billing_periods period
   where period.id = v_invoice.billing_period_id;

  select tenant.email
    into v_raw_email
    from public.tenants tenant
   where tenant.id = v_invoice.tenant_id;

  v_recipient_email := public.invoice_email_normalize_recipient(v_raw_email);
  v_skip_reason := case
    when nullif(trim(coalesce(v_raw_email, '')), '') is null then 'recipient_missing'
    when v_recipient_email is null then 'recipient_invalid'
    else null
  end;

  if v_recipient_email is not null then
    select delivery.*
      into v_delivery
      from public.invoice_email_deliveries delivery
     where delivery.invoice_id = p_invoice_id
       and delivery.recipient_email = v_recipient_email
       and delivery.status in ('queued', 'processing', 'accepted')
     order by delivery.created_at desc
     limit 1;
    if found then
      return jsonb_build_object('delivery', to_jsonb(v_delivery), 'reused', true);
    end if;
  end if;

  insert into public.invoice_email_deliveries (
    invoice_id,
    building_id,
    billing_period_id,
    created_by,
    source,
    status,
    recipient_email,
    skip_reason,
    skipped_at,
    next_attempt_at
  ) values (
    p_invoice_id,
    v_building_id,
    v_invoice.billing_period_id,
    p_actor_id,
    'manual',
    case when v_recipient_email is null then 'skipped' else 'queued' end,
    v_recipient_email,
    v_skip_reason,
    case when v_recipient_email is null then now() else null end,
    case when v_recipient_email is null then null else now() end
  )
  returning * into v_delivery;

  return jsonb_build_object('delivery', to_jsonb(v_delivery), 'reused', false);
exception
  when unique_violation then
    select delivery.*
      into v_delivery
      from public.invoice_email_deliveries delivery
     where delivery.invoice_id = p_invoice_id
       and delivery.recipient_email = v_recipient_email
       and delivery.status in ('queued', 'processing', 'accepted')
     order by delivery.created_at desc
     limit 1;
    return jsonb_build_object('delivery', to_jsonb(v_delivery), 'reused', true);
end;
$$;

create or replace function public.claim_invoice_email_deliveries(
  p_worker_id uuid,
  p_limit integer default 20
)
returns setof public.invoice_email_deliveries
language sql
security definer
set search_path = ''
as $$
  with candidates as (
    select delivery.id
      from public.invoice_email_deliveries delivery
     where (
       delivery.status = 'queued'
       and coalesce(delivery.next_attempt_at, delivery.created_at) <= now()
     ) or (
       delivery.status = 'processing'
       and delivery.lease_expires_at < now()
     )
     order by coalesce(delivery.next_attempt_at, delivery.created_at), delivery.created_at
     for update skip locked
     limit least(greatest(p_limit, 1), 20)
  )
  update public.invoice_email_deliveries delivery
     set status = 'processing',
         lease_expires_at = now() + interval '10 minutes',
         locked_by = p_worker_id,
         attempt_count = delivery.attempt_count + 1,
         updated_at = now()
    from candidates
   where delivery.id = candidates.id
     and delivery.attempt_count < 6
  returning delivery.*;
$$;

create or replace function public.apply_invoice_email_webhook_event(
  p_svix_id text,
  p_provider_email_id text,
  p_event_type text,
  p_event_created_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer;
  v_delivery public.invoice_email_deliveries%rowtype;
  v_incoming_status text;
  v_incoming_rank integer;
  v_current_rank integer;
begin
  insert into public.invoice_email_webhook_events (
    svix_id,
    provider_email_id,
    event_type,
    event_created_at
  ) values (
    p_svix_id,
    p_provider_email_id,
    p_event_type,
    p_event_created_at
  )
  on conflict (svix_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return jsonb_build_object('duplicate', true, 'matched', false, 'updated', false);
  end if;

  select delivery.*
    into v_delivery
    from public.invoice_email_deliveries delivery
   where delivery.provider_email_id = p_provider_email_id
   for update;

  if not found then
    return jsonb_build_object('duplicate', false, 'matched', false, 'updated', false);
  end if;

  v_incoming_status := case p_event_type
    when 'email.sent' then 'accepted'
    when 'email.delivered' then 'delivered'
    when 'email.failed' then 'failed'
    when 'email.bounced' then 'bounced'
    when 'email.complained' then 'complained'
  end;
  v_incoming_rank := case v_incoming_status
    when 'queued' then 0
    when 'processing' then 1
    when 'accepted' then 2
    when 'delivered' then 3
    when 'failed' then 4
    when 'bounced' then 5
    when 'complained' then 6
    when 'skipped' then 7
  end;
  v_current_rank := case v_delivery.status
    when 'queued' then 0
    when 'processing' then 1
    when 'accepted' then 2
    when 'delivered' then 3
    when 'failed' then 4
    when 'bounced' then 5
    when 'complained' then 6
    when 'skipped' then 7
  end;

  if v_incoming_status is null
    or p_event_created_at < coalesce(v_delivery.provider_event_at, '-infinity'::timestamptz)
    or (
      p_event_created_at = v_delivery.provider_event_at
      and v_incoming_rank <= v_current_rank
    )
    or (p_event_type = 'email.sent' and v_current_rank > 2)
    or (p_event_type = 'email.delivered' and v_current_rank > 3)
    or (
      v_delivery.status in ('bounced', 'complained')
      and v_incoming_rank <= v_current_rank
    )
  then
    return jsonb_build_object('duplicate', false, 'matched', true, 'updated', false);
  end if;

  update public.invoice_email_deliveries
     set status = v_incoming_status,
         provider_event_at = p_event_created_at,
         accepted_at = case
           when p_event_type = 'email.sent'
             then coalesce(accepted_at, p_event_created_at)
           else accepted_at
         end,
         delivered_at = case
           when p_event_type = 'email.delivered' then p_event_created_at
           else delivered_at
         end,
         failed_at = case
           when p_event_type in ('email.failed', 'email.bounced', 'email.complained')
             then p_event_created_at
           else failed_at
         end,
         bounced_at = case
           when p_event_type = 'email.bounced' then p_event_created_at
           else bounced_at
         end,
         complained_at = case
           when p_event_type = 'email.complained' then p_event_created_at
           else complained_at
         end
   where id = v_delivery.id;

  return jsonb_build_object('duplicate', false, 'matched', true, 'updated', true);
end;
$$;

revoke all on function public.invoice_email_normalize_recipient(text)
  from public, anon, authenticated;
revoke all on function public.audit_invoice_email_queued()
  from public, anon, authenticated;
revoke all on function public.audit_invoice_email_outcome()
  from public, anon, authenticated;
revoke all on function public.enqueue_automatic_invoice_email_delivery()
  from public, anon, authenticated;
revoke all on function public.enqueue_invoice_email_delivery(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.claim_invoice_email_deliveries(uuid, integer)
  from public, anon, authenticated;
revoke all on function public.apply_invoice_email_webhook_event(text, text, text, timestamptz)
  from public, anon, authenticated;

grant execute on function public.invoice_email_normalize_recipient(text) to service_role;
grant execute on function public.audit_invoice_email_queued() to service_role;
grant execute on function public.audit_invoice_email_outcome() to service_role;
grant execute on function public.enqueue_automatic_invoice_email_delivery() to service_role;
grant execute on function public.enqueue_invoice_email_delivery(uuid, uuid) to service_role;
grant execute on function public.claim_invoice_email_deliveries(uuid, integer) to service_role;
grant execute on function public.apply_invoice_email_webhook_event(text, text, text, timestamptz)
  to service_role;

commit;

-- SQL Editor verification lives at:
-- supabase/verification/invoice_email_delivery.sql
