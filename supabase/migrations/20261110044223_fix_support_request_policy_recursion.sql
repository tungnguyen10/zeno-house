-- contracts_tenant_select_own reads contract_occupants; the legacy manager
-- occupancy policy reads contracts again. PostgreSQL expands every RLS policy
-- before evaluating JWT-role predicates, so the cycle affects tenant requests too.
-- Staff occupancy/profile reads already use scoped server services (service_role).
-- Remove only that unused direct-manager SELECT edge; add no privilege/definer bypass.
begin;
drop policy if exists contract_occupants_manager_select on public.contract_occupants;
commit;
