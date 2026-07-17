-- =============================================================================
-- Migration: Harden support request attachment scope
-- Run in: Supabase Dashboard -> SQL Editor
-- Data impact: replaces one INSERT policy; existing rows are unchanged.
-- Rollback: restore the prior support_requests_tenant_insert_own policy.
-- =============================================================================

begin;

-- Defense in depth for direct Data API inserts: an attachment reference must stay
-- under the request owner's tenant-prefixed area in the private documents bucket.
drop policy if exists support_requests_tenant_insert_own
  on public.support_requests;

create policy support_requests_tenant_insert_own
  on public.support_requests
  for insert
  to authenticated
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'tenant'
    and status = 'new'
    and (
      attachment_path is null
      or (
        split_part(attachment_path, '/', 1) = support_requests.tenant_id::text
        and split_part(attachment_path, '/', 2) = 'requests'
        and split_part(attachment_path, '/', 3) <> ''
      )
    )
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

commit;

-- Verify after commit: the policy definition must include all three path checks.
select policyname, cmd, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'support_requests'
  and policyname = 'support_requests_tenant_insert_own';
