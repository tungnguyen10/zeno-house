-- =============================================================================
-- Migration: Tenant support requests
-- Run in: Supabase Dashboard -> SQL Editor
-- Data impact: additive support_requests table, RLS policies, grants, and indexes.
-- Rollback: drop public.support_requests. Existing tenant, building, contract,
-- storage, and audit data are unchanged.
-- Verification:
--   1. Confirm public.support_requests has RLS enabled.
--   2. As a tenant JWT, SELECT/INSERT only rows linked through the active
--      tenant_user_links row and matching contract context.
--   3. As owner/manager JWTs, SELECT only assigned-building rows; admin sees all.
-- =============================================================================

begin;

create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  building_id uuid not null references public.buildings(id) on delete restrict,
  contract_id uuid not null references public.contracts(id) on delete restrict,
  title text not null,
  description text not null,
  status text not null default 'new'
    check (status in ('new', 'in_progress', 'resolved')),
  attachment_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger support_requests_set_updated_at
  before update on public.support_requests
  for each row execute function public.set_updated_at();

create index idx_support_requests_tenant_id
  on public.support_requests (tenant_id);

create index idx_support_requests_building_id
  on public.support_requests (building_id);

create index idx_support_requests_status
  on public.support_requests (status);

alter table public.support_requests enable row level security;

revoke all on table public.support_requests from anon, authenticated;
grant select, insert on table public.support_requests to authenticated;
grant all on table public.support_requests to service_role;

create policy support_requests_tenant_select_own
  on public.support_requests
  for select
  to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'tenant'
    and exists (
      select 1
      from public.tenant_user_links as link
      where link.auth_user_id = (select auth.uid())
        and link.status = 'active'
        and link.tenant_id = support_requests.tenant_id
    )
  );

create policy support_requests_tenant_insert_own
  on public.support_requests
  for insert
  to authenticated
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'tenant'
    and status = 'new'
    and exists (
      select 1
      from public.tenant_user_links as link
      where link.auth_user_id = (select auth.uid())
        and link.status = 'active'
        and link.tenant_id = support_requests.tenant_id
    )
    and exists (
      select 1
      from public.contracts as contract
      where contract.id = support_requests.contract_id
        and contract.tenant_id = support_requests.tenant_id
        and contract.building_id = support_requests.building_id
        and contract.status = 'active'
    )
  );

create policy support_requests_admin_select_all
  on public.support_requests
  for select
  to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create policy support_requests_operator_select_assigned
  on public.support_requests
  for select
  to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('owner', 'manager')
    and exists (
      select 1
      from public.user_building_assignments as assignment
      where assignment.user_id = (select auth.uid())
        and assignment.building_id = support_requests.building_id
    )
  );

commit;
