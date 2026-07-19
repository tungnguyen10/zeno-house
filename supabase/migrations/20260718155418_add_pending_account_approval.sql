-- =============================================================================
-- Pending account approval
-- New Supabase Auth users without app_metadata.role enter a private review
-- queue. Provisioning paths that set a role are intentionally skipped.
-- =============================================================================

begin;

create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  provider text not null default 'email',
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'approved', 'rejected')),
  decision_role text
    check (decision_role is null or decision_role in ('owner', 'manager', 'tenant')),
  decision_building_ids uuid[] not null default '{}',
  decision_tenant_id uuid references public.tenants(id) on delete set null,
  rejection_reason text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_audited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(decision_building_ids) >= 0),
  check (rejection_reason is null or char_length(trim(rejection_reason)) between 3 and 500)
);

create index idx_access_requests_status_created_at
  on public.access_requests(status, created_at desc);

create trigger access_requests_set_updated_at
  before update on public.access_requests
  for each row execute function public.set_updated_at();

alter table public.access_requests enable row level security;
revoke all on table public.access_requests from anon, authenticated;
grant all on table public.access_requests to service_role;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.create_pending_access_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if nullif(new.raw_app_meta_data ->> 'role', '') is not null then
    return new;
  end if;

  insert into public.access_requests (
    auth_user_id,
    email,
    full_name,
    provider
  )
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(trim(coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''
    )), ''),
    coalesce(nullif(new.raw_app_meta_data ->> 'provider', ''), 'email')
  )
  on conflict (auth_user_id) do nothing;

  return new;
end;
$$;

revoke all on function private.create_pending_access_request() from public, anon, authenticated;

create trigger auth_user_create_pending_access_request
  after insert on auth.users
  for each row execute function private.create_pending_access_request();

create or replace function public.append_access_request_created_audit(
  p_request_id uuid,
  p_actor_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.access_requests%rowtype;
begin
  select * into target
  from public.access_requests
  where id = p_request_id
  for update;

  if not found or target.created_audited_at is not null then
    return false;
  end if;

  insert into public.audit_events (
    building_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    null,
    p_actor_id,
    'user.access_request.created',
    'user',
    target.auth_user_id,
    jsonb_build_object('provider', target.provider)
  );

  update public.access_requests
  set created_audited_at = now()
  where id = p_request_id;

  return true;
end;
$$;

revoke all on function public.append_access_request_created_audit(uuid, uuid) from public, anon, authenticated;
grant execute on function public.append_access_request_created_audit(uuid, uuid) to service_role;

commit;
