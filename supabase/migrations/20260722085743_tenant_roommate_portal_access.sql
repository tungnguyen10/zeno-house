-- =============================================================================
-- Migration: Tenant roommate portal access
-- Run in: Supabase Dashboard -> SQL Editor
-- Data impact: SELECT grants and policies only; no row or schema-shape changes.
-- Rollback: revoke authenticated SELECT on contract_occupants, drop
-- contract_occupants_tenant_select_own, then restore the previous
-- contracts_tenant_select_own and invoices_tenant_select_own policies from
-- 20260716083605_add_tenant_identity_foundation.sql.
-- Verification: run supabase/verification/tenant_identity_rls.sql.
-- =============================================================================

begin;

alter table public.contract_occupants enable row level security;

grant select on table public.contract_occupants to authenticated;

drop policy if exists contract_occupants_tenant_select_own
  on public.contract_occupants;
create policy contract_occupants_tenant_select_own
  on public.contract_occupants
  for select to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'tenant'
    and exists (
      select 1
      from public.tenant_user_links as link
      where link.auth_user_id = (select auth.uid())
        and link.tenant_id = contract_occupants.tenant_id
        and link.status = 'active'
    )
  );

drop policy if exists contracts_tenant_select_own
  on public.contracts;
create policy contracts_tenant_select_own
  on public.contracts
  for select to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'tenant'
    and exists (
      select 1
      from public.tenant_user_links as link
      where link.auth_user_id = (select auth.uid())
        and link.status = 'active'
        and (
          link.tenant_id = contracts.tenant_id
          or (
            contracts.status = 'active'
            and contracts.start_date <= (now() at time zone 'Asia/Ho_Chi_Minh')::date
            and contracts.end_date >= (now() at time zone 'Asia/Ho_Chi_Minh')::date
            and exists (
              select 1
              from public.contract_occupants as occupant
              where occupant.contract_id = contracts.id
                and occupant.tenant_id = link.tenant_id
                and occupant.move_in_date <= (now() at time zone 'Asia/Ho_Chi_Minh')::date
                and occupant.move_out_date is null
            )
          )
        )
    )
  );

drop policy if exists invoices_tenant_select_own
  on public.invoices;
create policy invoices_tenant_select_own
  on public.invoices
  for select to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'tenant'
    and exists (
      select 1
      from public.tenant_user_links as link
      where link.auth_user_id = (select auth.uid())
        and link.status = 'active'
        and (
          link.tenant_id = invoices.tenant_id
          or exists (
            select 1
            from public.contract_occupants as occupant
            join public.contracts as shared_contract
              on shared_contract.id = occupant.contract_id
            where occupant.contract_id = invoices.contract_id
              and occupant.tenant_id = link.tenant_id
              and occupant.move_in_date <= (now() at time zone 'Asia/Ho_Chi_Minh')::date
              and occupant.move_out_date is null
              and shared_contract.status = 'active'
              and shared_contract.start_date <= (now() at time zone 'Asia/Ho_Chi_Minh')::date
              and shared_contract.end_date >= (now() at time zone 'Asia/Ho_Chi_Minh')::date
          )
        )
    )
  );

commit;
