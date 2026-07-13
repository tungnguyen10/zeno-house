-- Phase 3 verification only: run after all RPC scripts, including the final delta.
-- This script does not mutate business data.

explain (analyze, buffers, verbose)
select public.dashboard_source_snapshot(
  null,
  extract(year from current_date)::integer,
  extract(month from current_date)::integer,
  current_date,
  current_date + 30,
  current_date + 7
);

explain (analyze, buffers, verbose)
select public.billing_period_input_snapshot(
  (select id from public.billing_periods order by created_at desc limit 1)
);

explain (analyze, buffers, verbose)
select public.operations_report_snapshot(
  (select id from public.buildings order by created_at desc limit 1),
  extract(year from current_date)::integer,
  extract(month from current_date)::integer
);

select schemaname, tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'idx_contracts_building_status_end_date',
    'idx_meter_readings_room_period_type',
    'idx_invoices_period_status_due_date',
    'idx_billing_audit_period_created_id'
  )
order by indexname;

select n.nspname as schema_name, p.proname,
  case when p.prosecdef then 'DEFINER' else 'INVOKER' end as security_type,
  has_function_privilege('anon', p.oid, 'execute') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute,
  has_function_privilege('service_role', p.oid, 'execute') as service_role_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'dashboard_source_snapshot',
    'billing_period_input_snapshot',
    'billing_audit_search_page',
    'operations_report_snapshot',
    'bulk_master_data_action',
    'allocate_shared_expense'
  )
order by p.proname;
