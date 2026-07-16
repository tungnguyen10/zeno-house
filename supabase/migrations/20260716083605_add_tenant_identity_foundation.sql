-- =============================================================================
-- Migration: Tenant identity foundation
-- Run in: Supabase Dashboard -> SQL Editor
-- Data impact: additive table, trigger, grants, and SELECT policies only.
-- Rollback: drop the four tenant SELECT policies, then drop
-- public.tenant_user_links. Existing tenant/contract/invoice rows are unchanged.
-- Verification: run supabase/verification/tenant_identity_rls.sql.
-- =============================================================================

begin;

create table public.tenant_user_links (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (auth_user_id),
  unique (tenant_id)
);

create trigger tenant_user_links_set_updated_at
  before update on public.tenant_user_links
  for each row execute function public.set_updated_at();

alter table public.tenant_user_links enable row level security;
alter table public.tenants enable row level security;
alter table public.contracts enable row level security;
alter table public.invoices enable row level security;

revoke all on table public.tenant_user_links from anon, authenticated;
grant select on table public.tenant_user_links to authenticated;
grant all on table public.tenant_user_links to service_role;

grant select on table public.tenants, public.contracts, public.invoices to authenticated;

create policy tenant_user_links_tenant_select_own
  on public.tenant_user_links
  for select to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'tenant'
    and auth_user_id = (select auth.uid())
  );

create policy tenants_tenant_select_own
  on public.tenants
  for select to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'tenant'
    and exists (
      select 1
      from public.tenant_user_links as link
      where link.auth_user_id = (select auth.uid())
        and link.tenant_id = tenants.id
        and link.status = 'active'
    )
  );

create policy contracts_tenant_select_own
  on public.contracts
  for select to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'tenant'
    and exists (
      select 1
      from public.tenant_user_links as link
      where link.auth_user_id = (select auth.uid())
        and link.tenant_id = contracts.tenant_id
        and link.status = 'active'
    )
  );

create policy invoices_tenant_select_own
  on public.invoices
  for select to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'tenant'
    and exists (
      select 1
      from public.tenant_user_links as link
      where link.auth_user_id = (select auth.uid())
        and link.tenant_id = invoices.tenant_id
        and link.status = 'active'
    )
  );

commit;
