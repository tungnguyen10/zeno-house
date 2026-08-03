-- Read-only verification after applying 20260803042715_add_ai_invoice_payments.sql.

-- Expect one row with prosecdef = false (SECURITY INVOKER).
select p.oid::regprocedure as function_signature, p.prosecdef
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'record_ai_invoice_payments_with_audit';

-- Expect service_role=true and both browser roles=false.
select
  has_function_privilege('service_role', p.oid, 'execute') as service_role_can_execute,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute,
  has_function_privilege('anon', p.oid, 'execute') as anon_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'record_ai_invoice_payments_with_audit';

-- Expect rowsecurity=true for every table involved in the transaction.
select c.relname, c.relrowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('billing_periods', 'invoices', 'invoice_payments', 'billing_audit_events')
order by c.relname;

-- Expect zero: no duplicate parent audit per AI correlation.
select correlation_id, count(*)
from public.billing_audit_events
where action = 'payments.ai_recorded'
group by correlation_id
having count(*) > 1;

-- Expect zero: parent metadata count differs from stored payment ids.
select id, correlation_id, metadata
from public.billing_audit_events
where action = 'payments.ai_recorded'
  and coalesce((metadata->>'count')::integer, 0)
    <> coalesce(jsonb_array_length(metadata->'payment_ids'), 0);
