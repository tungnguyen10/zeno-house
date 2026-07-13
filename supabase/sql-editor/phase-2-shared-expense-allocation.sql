-- Phase 2 performance: atomic shared-expense allocation.
-- Run this entire file in Supabase Dashboard > SQL Editor.

begin;

create or replace function public.allocate_shared_expense(
  p_shared_expense_id uuid,
  p_period_year integer,
  p_period_month integer,
  p_actor_id uuid
)
returns table (building_id uuid, expense_id uuid, amount numeric)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_shared public.shared_expenses%rowtype;
  v_building_ids uuid[];
  v_count integer;
  v_base numeric(12, 0);
  v_remainder numeric(12, 0);
  v_marker text;
begin
  if p_period_year not between 2000 and 2100 or p_period_month not between 1 and 12 then
    raise exception using errcode = '22023', message = 'Invalid allocation period';
  end if;

  select * into v_shared
  from public.shared_expenses
  where id = p_shared_expense_id and is_active = true
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Shared expense not found';
  end if;

  select array_agg(seb.building_id order by seb.created_at, seb.building_id)
  into v_building_ids
  from public.shared_expense_buildings seb
  where seb.shared_expense_id = p_shared_expense_id;

  v_count := coalesce(array_length(v_building_ids, 1), 0);
  if v_count = 0 then
    raise exception using errcode = '22023', message = 'Shared expense has no buildings';
  end if;

  if exists (
    select 1 from public.operations_report_periods p
    where p.building_id = any(v_building_ids)
      and p.period_year = p_period_year
      and p.period_month = p_period_month
      and p.status = 'closed'
  ) then
    raise exception using errcode = 'P0001', message = 'An operations report period is closed';
  end if;

  v_marker := format('[shared:%s:%s-%s]', p_shared_expense_id, p_period_year, lpad(p_period_month::text, 2, '0'));
  if exists (
    select 1 from public.building_expenses e
    where e.note like '%' || v_marker || '%'
  ) then
    raise exception using errcode = '23505', message = 'Shared expense period already allocated';
  end if;

  v_base := floor(v_shared.amount / v_count);
  v_remainder := v_shared.amount - (v_base * v_count);

  return query
  with allocations as (
    select
      item.building_id,
      item.ordinality,
      v_base + case when item.ordinality = v_count then v_remainder else 0 end as allocated_amount
    from unnest(v_building_ids) with ordinality as item(building_id, ordinality)
  ), inserted as (
    insert into public.building_expenses as expense (
      building_id, period_year, period_month, expense_date, category, amount,
      note, payee, payment_method, funded_by, created_by
    )
    select
      a.building_id, p_period_year, p_period_month, null, v_shared.category,
      a.allocated_amount, v_marker || ' ' || v_shared.name, null, null, 'direct', p_actor_id
    from allocations a
    returning expense.building_id, expense.id, expense.amount
  )
  select inserted.building_id, inserted.id, inserted.amount from inserted;
end;
$$;

revoke execute on function public.allocate_shared_expense(uuid, integer, integer, uuid) from public;
revoke execute on function public.allocate_shared_expense(uuid, integer, integer, uuid) from anon;
revoke execute on function public.allocate_shared_expense(uuid, integer, integer, uuid) from authenticated;
grant execute on function public.allocate_shared_expense(uuid, integer, integer, uuid) to service_role;

commit;

-- Verification:
-- select routine_name, security_type from information_schema.routines
-- where routine_schema = 'public' and routine_name = 'allocate_shared_expense';
