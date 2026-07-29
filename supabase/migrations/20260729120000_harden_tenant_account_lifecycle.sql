-- =============================================================================
-- Migration: Harden tenant account lifecycle
-- Run in: Supabase Dashboard -> SQL Editor after application compatibility deploy.
--
-- Data impact:
--   * Historical Auth actor references become nullable ON DELETE SET NULL.
--   * Manager direct reads of tenant/contract/occupant/invoice rows become
--     building-assignment scoped.
--   * Direct invoice writes are removed from browser roles.
--   * Tenant support-request inserts accept only current primary/roommate context.
--   * Existing Auth users and tenant links are NOT modified.
--
-- Verification:
--   Run supabase/verification/tenant_account_lifecycle.sql.
--
-- Rollback:
--   Restore the prior FK actions and policies from their source migrations.
--   Re-add manager invoice write grants/policies only if direct browser writes
--   are intentionally restored. No data backfill is required to roll back.
-- =============================================================================

begin;

-- Historical attribution must not prevent deprovisioning an Auth identity.
-- Ownership relationships (tenant links, access requests, assignments,
-- user-owned AI data, shared-expense owner) intentionally keep their cascades.
do $$
declare
  target record;
  existing_constraint text;
begin
  for target in
    select *
    from (values
      ('contract_renewals', 'created_by'),
      ('meter_readings', 'recorded_by'),
      ('billing_periods', 'opened_by'),
      ('invoices', 'voided_by'),
      ('invoice_payments', 'recorded_by'),
      ('billing_utility_usages', 'created_by'),
      ('billing_utility_usages', 'approved_by'),
      ('billing_audit_events', 'actor_id'),
      ('user_building_assignments', 'created_by'),
      ('audit_events', 'actor_id'),
      ('building_fixed_costs', 'created_by'),
      ('building_expenses', 'created_by'),
      ('building_expenses', 'voided_by'),
      ('recurring_expenses', 'created_by'),
      ('prepaid_expenses', 'created_by'),
      ('reserve_fund_transactions', 'created_by'),
      ('reserve_fund_transactions', 'voided_by'),
      ('operations_report_periods', 'closed_by'),
      ('operations_report_periods', 'reopened_by')
    ) as refs(table_name, column_name)
  loop
    if to_regclass(format('public.%I', target.table_name)) is null then
      continue;
    end if;

    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = target.table_name
        and column_name = target.column_name
    ) then
      continue;
    end if;

    existing_constraint := null;

    select constraint_row.conname
      into existing_constraint
    from pg_constraint constraint_row
    join pg_class table_row
      on table_row.oid = constraint_row.conrelid
    join pg_namespace schema_row
      on schema_row.oid = table_row.relnamespace
    join pg_class referenced_table
      on referenced_table.oid = constraint_row.confrelid
    join pg_namespace referenced_schema
      on referenced_schema.oid = referenced_table.relnamespace
    join pg_attribute column_row
      on column_row.attrelid = table_row.oid
     and column_row.attnum = any (constraint_row.conkey)
    where constraint_row.contype = 'f'
      and schema_row.nspname = 'public'
      and table_row.relname = target.table_name
      and column_row.attname = target.column_name
      and referenced_schema.nspname = 'auth'
      and referenced_table.relname = 'users'
    limit 1;

    if existing_constraint is null then
      continue;
    end if;

    execute format(
      'alter table public.%I alter column %I drop not null',
      target.table_name,
      target.column_name
    );

    execute format(
      'alter table public.%I drop constraint %I',
      target.table_name,
      existing_constraint
    );

    execute format(
      'alter table public.%I add constraint %I foreign key (%I) references auth.users(id) on delete set null',
      target.table_name,
      target.table_name || '_' || target.column_name || '_fkey',
      target.column_name
    );
  end loop;
end
$$;

-- Manager tenant reads require either a primary contract or roommate occupancy
-- in a building assigned to the current Auth user.
drop policy if exists tenants_manager_select on public.tenants;
create policy tenants_manager_select
  on public.tenants
  for select to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
    and exists (
      select 1
      from public.user_building_assignments assignment
      where assignment.user_id = (select auth.uid())
        and (
          exists (
            select 1
            from public.contracts contract
            where contract.tenant_id = tenants.id
              and contract.building_id = assignment.building_id
          )
          or exists (
            select 1
            from public.contract_occupants occupant
            join public.contracts contract
              on contract.id = occupant.contract_id
            where occupant.tenant_id = tenants.id
              and contract.building_id = assignment.building_id
          )
        )
    )
  );

drop policy if exists contracts_manager_select on public.contracts;
create policy contracts_manager_select
  on public.contracts
  for select to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
    and exists (
      select 1
      from public.user_building_assignments assignment
      where assignment.user_id = (select auth.uid())
        and assignment.building_id = contracts.building_id
    )
  );

drop policy if exists contract_occupants_manager_select on public.contract_occupants;
create policy contract_occupants_manager_select
  on public.contract_occupants
  for select to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
    and exists (
      select 1
      from public.contracts contract
      join public.user_building_assignments assignment
        on assignment.building_id = contract.building_id
      where contract.id = contract_occupants.contract_id
        and assignment.user_id = (select auth.uid())
    )
  );

drop policy if exists invoices_manager_select on public.invoices;
create policy invoices_manager_select
  on public.invoices
  for select to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
    and exists (
      select 1
      from public.billing_periods period
      join public.user_building_assignments assignment
        on assignment.building_id = period.building_id
      where period.id = invoices.billing_period_id
        and assignment.user_id = (select auth.uid())
    )
  );

-- All business writes go through Nuxt server services. Keep tenant self-read
-- safety policies, but remove unused browser-role mutation privileges.
drop policy if exists invoices_manager_insert on public.invoices;
drop policy if exists invoices_manager_update on public.invoices;
revoke all on table public.tenants from anon;
revoke all on table public.contracts from anon;
revoke all on table public.contract_occupants from anon;
revoke all on table public.invoices from anon;
revoke insert, update, delete on table public.tenants from authenticated;
revoke insert, update, delete on table public.contracts from authenticated;
revoke insert, update, delete on table public.contract_occupants from authenticated;
revoke insert, update, delete on table public.invoices from authenticated;
grant select on table public.tenants to authenticated;
grant select on table public.contracts to authenticated;
grant select on table public.contract_occupants to authenticated;
grant select on table public.invoices to authenticated;
grant all on table public.tenants to service_role;
grant all on table public.contracts to service_role;
grant all on table public.contract_occupants to service_role;
grant all on table public.invoices to service_role;

-- Align direct support-request inserts with the same current housing context
-- resolved by the server: current primary tenant or current roommate.
drop policy if exists support_requests_tenant_insert_own on public.support_requests;
create policy support_requests_tenant_insert_own
  on public.support_requests
  for insert to authenticated
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'tenant'
    and status = 'new'
    and char_length(btrim(title)) between 1 and 200
    and char_length(btrim(description)) between 1 and 5000
    and exists (
      select 1
      from public.tenant_user_links link
      where link.auth_user_id = (select auth.uid())
        and link.status = 'active'
        and link.tenant_id = support_requests.tenant_id
        and exists (
          select 1
          from public.contracts contract
          where contract.id = support_requests.contract_id
            and contract.building_id = support_requests.building_id
            and contract.status = 'active'
            and contract.start_date <= (now() at time zone 'Asia/Ho_Chi_Minh')::date
            and contract.end_date >= (now() at time zone 'Asia/Ho_Chi_Minh')::date
            and (
              contract.tenant_id = link.tenant_id
              or exists (
                select 1
                from public.contract_occupants occupant
                where occupant.contract_id = contract.id
                  and occupant.tenant_id = link.tenant_id
                  and occupant.move_in_date <= (now() at time zone 'Asia/Ho_Chi_Minh')::date
                  and occupant.move_out_date is null
              )
            )
        )
    )
  );

alter table public.support_requests
  drop constraint if exists support_requests_title_length_check,
  drop constraint if exists support_requests_description_length_check,
  add constraint support_requests_title_length_check
    check (char_length(btrim(title)) between 1 and 200),
  add constraint support_requests_description_length_check
    check (char_length(btrim(description)) between 1 and 5000);

notify pgrst, 'reload schema';

commit;
