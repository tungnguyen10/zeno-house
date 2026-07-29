-- Read-only verification for 20260729120000_harden_tenant_account_lifecycle.sql.
-- Expected: every query marked "expect zero" returns no rows.

-- 1. Historical Auth references must be nullable and SET NULL.
with expected(table_name, column_name) as (
  values
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
),
actual as (
  select
    tc.table_name,
    kcu.column_name,
    rc.delete_rule,
    cols.is_nullable
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on kcu.constraint_schema = tc.constraint_schema
   and kcu.constraint_name = tc.constraint_name
  join information_schema.referential_constraints rc
    on rc.constraint_schema = tc.constraint_schema
   and rc.constraint_name = tc.constraint_name
  join information_schema.columns cols
    on cols.table_schema = tc.table_schema
   and cols.table_name = tc.table_name
   and cols.column_name = kcu.column_name
  where tc.constraint_schema = 'public'
    and tc.constraint_type = 'FOREIGN KEY'
)
select expected.*
from expected
left join actual using (table_name, column_name)
where actual.delete_rule is distinct from 'SET NULL'
   or actual.is_nullable is distinct from 'YES';
-- expect zero

-- 2. Manager policies must mention building assignments and manager invoice
--    write policies must be absent.
select schemaname, tablename, policyname, qual, with_check
from pg_policies
where schemaname = 'public'
  and policyname in (
    'tenants_manager_select',
    'contracts_manager_select',
    'contract_occupants_manager_select',
    'invoices_manager_select'
  )
order by tablename, policyname;

select policyname
from pg_policies
where schemaname = 'public'
  and tablename = 'invoices'
  and policyname in ('invoices_manager_insert', 'invoices_manager_update');
-- expect zero

-- 3. Browser grants must not include tenant-domain writes.
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('tenants', 'contracts', 'contract_occupants', 'invoices')
  and grantee in ('anon', 'authenticated')
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE');
-- expect zero

-- 4. Support request RLS and length constraints must exist.
select policyname, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'support_requests'
  and policyname = 'support_requests_tenant_insert_own';

select constraint_name
from information_schema.table_constraints
where constraint_schema = 'public'
  and table_name = 'support_requests'
  and constraint_name in (
    'support_requests_title_length_check',
    'support_requests_description_length_check'
  )
order by constraint_name;

-- 5. Review only: orphan identities. Do not delete from SQL.
select
  user_row.id as auth_user_id,
  user_row.email,
  user_row.created_at,
  user_row.last_sign_in_at,
  user_row.banned_until
from auth.users user_row
left join public.tenant_user_links link
  on link.auth_user_id = user_row.id
where user_row.raw_app_meta_data ->> 'role' = 'tenant'
  and link.id is null
order by user_row.created_at;
