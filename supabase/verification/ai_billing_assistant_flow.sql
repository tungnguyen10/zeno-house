-- Read-only verification for 20260802080015_harden_ai_billing_assistant_flow.sql.
-- Expected: every query marked "expect zero" returns no rows.

-- 1. Shared-control tables exist, enforce RLS, and expose no browser grants.
select expected.table_name
from (values ('ai_provider_circuits'), ('ai_global_daily_quotas')) expected(table_name)
where to_regclass('public.' || expected.table_name) is null
   or not row_security_active(('public.' || expected.table_name)::regclass);
-- expect zero

select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('ai_provider_circuits', 'ai_global_daily_quotas')
  and grantee in ('PUBLIC', 'anon', 'authenticated');
-- expect zero

-- 2. New RPCs are SECURITY INVOKER and executable only through service_role.
with expected(signature) as (
  values
    ('public.begin_ai_chat_turn(uuid,uuid,text,integer,timestamp with time zone)'),
    ('public.acquire_ai_provider_request(text,integer,integer,integer,timestamp with time zone)'),
    ('public.record_ai_provider_outcome(text,boolean,integer,timestamp with time zone)'),
    ('public.claim_ai_action_plan(uuid,uuid,integer)')
)
select expected.signature
from expected
left join pg_proc procedure on procedure.oid = to_regprocedure(expected.signature)
where procedure.oid is null
   or procedure.prosecdef
   or has_function_privilege('anon', procedure.oid, 'EXECUTE')
   or has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
   or not has_function_privilege('service_role', procedure.oid, 'EXECUTE');
-- expect zero

-- 3. Recovery state is present and executing plans always have a lease.
select 'missing execution_lease_until' as problem
where not exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'ai_action_plans'
    and column_name = 'execution_lease_until'
);
-- expect zero

select id, status, execution_lease_until
from public.ai_action_plans
where status = 'executing'
  and execution_lease_until is null;
-- expect zero

-- 4. Review only: durable action keys and audit correlation must not duplicate.
select idempotency_key, count(*)
from public.ai_action_plans
group by idempotency_key
having count(*) > 1;
-- expect zero

select correlation_id, action, entity_type, entity_id, count(*)
from public.billing_audit_events
where correlation_id is not null
group by correlation_id, action, entity_type, entity_id
having count(*) > 1;
-- expect zero
