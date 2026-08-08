-- =============================================================================
-- Defer pending access-request creation until Supabase Auth has applied custom
-- app_metadata, then reconcile untouched requests created by the old trigger.
-- =============================================================================

begin;

create or replace function private.create_pending_access_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_email text;
  current_app_meta_data jsonb;
  current_user_meta_data jsonb;
begin
  -- A deferred trigger receives the INSERT tuple captured before Supabase Auth
  -- applies custom app metadata. Read the current row so provisioned roles and
  -- finalized OAuth identity metadata are evaluated at transaction end.
  select
    auth_user.email,
    auth_user.raw_app_meta_data,
    auth_user.raw_user_meta_data
  into
    current_email,
    current_app_meta_data,
    current_user_meta_data
  from auth.users auth_user
  where auth_user.id = new.id;

  if not found then
    return new;
  end if;

  if nullif(current_app_meta_data ->> 'role', '') is not null then
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
    coalesce(current_email, ''),
    nullif(trim(coalesce(
      current_user_meta_data ->> 'full_name',
      current_user_meta_data ->> 'name',
      ''
    )), ''),
    coalesce(nullif(current_app_meta_data ->> 'provider', ''), 'email')
  )
  on conflict (auth_user_id) do nothing;

  return new;
end;
$$;

revoke all on function private.create_pending_access_request() from public, anon, authenticated;

drop trigger if exists auth_user_create_pending_access_request on auth.users;

create constraint trigger auth_user_create_pending_access_request
  after insert on auth.users
  deferrable initially deferred
  for each row execute function private.create_pending_access_request();

-- The old immediate trigger could create a request before Supabase applied the
-- provisioned role. Reconcile only pristine pending rows; every decision state
-- and every row with review/scope/claim data remains untouched.
create temporary table stale_provisioned_access_requests
on commit drop
as
select
  target.id as request_id,
  target.auth_user_id,
  nullif(auth_user.raw_app_meta_data ->> 'role', '') as app_role
from public.access_requests target
join auth.users auth_user on auth_user.id = target.auth_user_id
where target.status = 'pending'
  and target.approval_claim_token is null
  and target.reviewed_by is null
  and target.reviewed_at is null
  and target.decision_role is null
  and cardinality(target.decision_building_ids) = 0
  and target.decision_tenant_id is null
  and target.rejection_reason is null
  and nullif(auth_user.raw_app_meta_data ->> 'role', '') in ('admin', 'owner', 'manager', 'tenant');

insert into public.audit_events (
  building_id,
  actor_id,
  action,
  entity_type,
  entity_id,
  metadata
)
select
  null,
  null,
  'user.access_request.reconciled',
  'user',
  stale.auth_user_id,
  jsonb_build_object(
    'reason', 'provisioned_role_present',
    'role', stale.app_role,
    'access_request_id', stale.request_id
  )
from stale_provisioned_access_requests stale;

delete from public.access_requests target
using stale_provisioned_access_requests stale
where target.id = stale.request_id;

commit;
