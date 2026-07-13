-- Final Phase 3 database delta: dashboard, billing draft/grid, and audit pagination.
-- Run this entire file in Supabase Dashboard > SQL Editor.

begin;

create or replace function public.dashboard_source_snapshot(
  p_building_ids uuid[],
  p_current_year integer,
  p_current_month integer,
  p_today date,
  p_expiring_soon date,
  p_expiring_urgent date
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with scoped_buildings as (
    select b.id, b.slug, b.name from public.buildings b
    where p_building_ids is null or b.id = any(p_building_ids)
  ), scoped_contracts as (
    select c.* from public.contracts c join scoped_buildings b on b.id = c.building_id
  ), periods as (
    select bp.* from public.billing_periods bp join scoped_buildings b on b.id = bp.building_id
    where bp.period_year = p_current_year
  ), invoice_rows as (
    select to_jsonb(i) || jsonb_build_object(
      'billing_periods', jsonb_build_object(
        'building_id', bp.building_id, 'period_year', bp.period_year, 'period_month', bp.period_month
      ),
      'invoice_charges', coalesce((select jsonb_agg(to_jsonb(c)) from public.invoice_charges c where c.invoice_id = i.id), '[]'::jsonb)
    ) as value
    from public.invoices i join periods bp on bp.id = i.billing_period_id
  ), tenant_ids as (
    select tenant_id as id from scoped_contracts
    union
    select co.tenant_id from public.contract_occupants co join scoped_contracts c on c.id = co.contract_id
  )
  select jsonb_build_object(
    'buildings', coalesce((select jsonb_agg(to_jsonb(b) order by b.name) from scoped_buildings b), '[]'::jsonb),
    'rooms', coalesce((select jsonb_agg(to_jsonb(r)) from public.rooms r join scoped_buildings b on b.id = r.building_id), '[]'::jsonb),
    'tenant_count', case when p_building_ids is null
      then (select count(*) from public.tenants)
      else (select count(*) from tenant_ids)
    end,
    'active_contract_count', (select count(*) from scoped_contracts where status = 'active'),
    'expiring_contract_count', (select count(*) from scoped_contracts where status = 'active' and end_date between p_today and p_expiring_soon),
    'urgent_contract_count', (select count(*) from scoped_contracts where status = 'active' and end_date between p_today and p_expiring_urgent),
    'periods', coalesce((select jsonb_agg(to_jsonb(p)) from periods p), '[]'::jsonb),
    'invoices', coalesce((select jsonb_agg(value) from invoice_rows), '[]'::jsonb)
  );
$$;

create or replace function public.billing_period_input_snapshot(p_period_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with period as (
    select bp.* from public.billing_periods bp where bp.id = p_period_id
  ), bounds as (
    select
      p.*,
      make_date(p.period_year, p.period_month, 1) as first_day,
      (make_date(p.period_year, p.period_month, 1) + interval '1 month - 1 day')::date as last_day,
      (make_date(p.period_year, p.period_month, 1) - interval '1 month')::date as previous_day
    from period p
  ), contracts as (
    select c.* from public.contracts c join bounds b on b.building_id = c.building_id
    where c.status <> 'terminated' and c.start_date <= b.last_day
      and (c.end_date is null or c.end_date >= b.first_day)
  ), room_ids as (select distinct room_id as id from contracts), contract_ids as (select id from contracts)
  select jsonb_build_object(
    'building', (select to_jsonb(bld) from public.buildings bld join bounds b on b.building_id = bld.id),
    'contracts', coalesce((select jsonb_agg(to_jsonb(c)) from contracts c), '[]'::jsonb),
    'services', coalesce((
      select jsonb_agg(to_jsonb(cs) || jsonb_build_object('service_catalog', to_jsonb(sc)))
      from public.contract_services cs
      left join public.service_catalog sc on sc.id = cs.catalog_id
      where cs.contract_id in (select id from contract_ids) and cs.is_enabled = true
    ), '[]'::jsonb),
    'occupants', coalesce((
      select jsonb_agg(to_jsonb(co)) from public.contract_occupants co
      where co.contract_id in (select id from contract_ids)
    ), '[]'::jsonb),
    'readings', coalesce((
      select jsonb_agg(to_jsonb(mr)) from public.meter_readings mr join bounds b on true
      where mr.room_id in (select id from room_ids) and (
        (mr.reading_type = 'monthly' and (
          (mr.period_year = b.period_year and mr.period_month = b.period_month)
          or (mr.period_year = extract(year from b.previous_day)::integer
              and mr.period_month = extract(month from b.previous_day)::integer)
        )) or mr.reading_type = 'handover_in'
      )
    ), '[]'::jsonb),
    'overrides', coalesce((
      select jsonb_agg(to_jsonb(u)) from public.billing_utility_usages u where u.billing_period_id = p_period_id
    ), '[]'::jsonb),
    'invoices', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.created_at) from public.invoices i where i.billing_period_id = p_period_id
    ), '[]'::jsonb),
    'rooms', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.room_number) from public.rooms r join bounds b on b.building_id = r.building_id
    ), '[]'::jsonb),
    'tenants', coalesce((
      select jsonb_agg(to_jsonb(t)) from public.tenants t where t.id in (select tenant_id from contracts)
    ), '[]'::jsonb)
  );
$$;

-- Remove the timestamp-only cursor overload from earlier development builds.
drop function if exists public.billing_audit_search_page(uuid, uuid[], text[], timestamptz, timestamptz, uuid, timestamptz, text, integer);

create or replace function public.billing_audit_search_page(
  p_period_id uuid,
  p_actor_ids uuid[],
  p_actions text[],
  p_from timestamptz,
  p_to timestamptz,
  p_correlation_id uuid,
  p_cursor timestamptz,
  p_cursor_id uuid,
  p_query text,
  p_limit integer
)
returns setof public.billing_audit_events
language sql
stable
security invoker
set search_path = ''
as $$
  select a.*
  from public.billing_audit_events a
  left join public.invoices i on a.entity_type = 'invoice' and i.id = a.entity_id
  left join public.tenants t on t.id = case when a.entity_type = 'tenant' then a.entity_id else i.tenant_id end
  left join public.rooms r on r.id = case when a.entity_type = 'room' then a.entity_id else i.room_id end
  left join auth.users u on u.id = a.actor_id
  where a.billing_period_id = p_period_id
    and (p_actor_ids is null or a.actor_id = any(p_actor_ids))
    and (p_actions is null or a.action = any(p_actions))
    and (p_from is null or a.created_at >= p_from)
    and (p_to is null or a.created_at <= p_to)
    and (p_correlation_id is null or a.correlation_id = p_correlation_id)
    and (
      p_cursor is null
      or a.created_at < p_cursor
      or (p_cursor_id is not null and a.created_at = p_cursor and a.id < p_cursor_id)
    )
    and (
      p_query is null or p_query = ''
      or a.action ilike '%' || p_query || '%'
      or a.metadata::text ilike '%' || p_query || '%'
      or coalesce(i.invoice_code, '') ilike '%' || p_query || '%'
      or coalesce(t.full_name, '') ilike '%' || p_query || '%'
      or coalesce(r.room_number, '') ilike '%' || p_query || '%'
      or coalesce(u.email, '') ilike '%' || p_query || '%'
      or coalesce(u.raw_user_meta_data ->> 'full_name', '') ilike '%' || p_query || '%'
    )
  order by a.created_at desc, a.id desc
  limit least(greatest(p_limit, 1), 100) + 1;
$$;

revoke all on function public.billing_period_input_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.dashboard_source_snapshot(uuid[], integer, integer, date, date, date) from public, anon, authenticated;
revoke all on function public.billing_audit_search_page(uuid, uuid[], text[], timestamptz, timestamptz, uuid, timestamptz, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.billing_period_input_snapshot(uuid) to service_role;
grant execute on function public.dashboard_source_snapshot(uuid[], integer, integer, date, date, date) to service_role;
grant execute on function public.billing_audit_search_page(uuid, uuid[], text[], timestamptz, timestamptz, uuid, timestamptz, uuid, text, integer) to service_role;

commit;

select p.proname, case when p.prosecdef then 'DEFINER' else 'INVOKER' end as security_type
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('billing_period_input_snapshot', 'dashboard_source_snapshot', 'billing_audit_search_page');
