-- Tenant optimization PR1: a tenant may hold at most one live tenancy.
-- A tenant must never be primary on two active contracts, nor primary on one while living on
-- another. Previously only open occupancies were unique (contract_occupants_active_tenant_unique);
-- primary tenants relied on a service pre-check that concurrent requests could both pass.
-- Each write takes a per-tenant transaction lock, then re-checks under that lock.

create or replace function public.guard_contract_tenant_availability()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status <> 'active' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'active' and old.tenant_id = new.tenant_id then return new; end if;

  perform pg_advisory_xact_lock(hashtextextended('tenant-availability:' || new.tenant_id::text, 0));
  if exists (
    select 1 from public.contracts c
    where c.tenant_id = new.tenant_id and c.status = 'active' and c.id <> new.id
  ) or exists (
    select 1 from public.contract_occupants o
    where o.tenant_id = new.tenant_id and o.move_out_date is null and o.contract_id <> new.id
  ) then
    raise exception 'TENANT_BUSY' using errcode = '23505';
  end if;
  return new;
end;
$$;

create or replace function public.guard_occupant_tenant_availability()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.move_out_date is not null then return new; end if;
  if tg_op = 'UPDATE' and old.move_out_date is null and old.tenant_id = new.tenant_id then return new; end if;

  perform pg_advisory_xact_lock(hashtextextended('tenant-availability:' || new.tenant_id::text, 0));
  -- Occupancy rows of the tenant's own contract (renewal copies the primary row) are allowed.
  if exists (
    select 1 from public.contracts c
    where c.tenant_id = new.tenant_id and c.status = 'active' and c.id <> new.contract_id
  ) or exists (
    select 1 from public.contract_occupants o
    where o.tenant_id = new.tenant_id and o.move_out_date is null and o.contract_id <> new.contract_id and o.id <> new.id
  ) then
    raise exception 'TENANT_BUSY' using errcode = '23505';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_contract_tenant_availability() from public, anon, authenticated;
revoke all on function public.guard_occupant_tenant_availability() from public, anon, authenticated;

drop trigger if exists contracts_tenant_availability on public.contracts;
create trigger contracts_tenant_availability
  before insert or update of tenant_id, status on public.contracts
  for each row execute function public.guard_contract_tenant_availability();

drop trigger if exists contract_occupants_tenant_availability on public.contract_occupants;
create trigger contract_occupants_tenant_availability
  before insert or update of tenant_id, move_out_date on public.contract_occupants
  for each row execute function public.guard_occupant_tenant_availability();
