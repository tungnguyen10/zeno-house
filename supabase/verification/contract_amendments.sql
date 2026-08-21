-- Run after 20260814095628_contract_amendments.sql in the Supabase SQL editor.
-- Every query should return the expected value described in its alias.

select to_regclass('public.contract_amendments') is not null as table_exists_should_be_true;

select relrowsecurity as rls_should_be_true
from pg_class
where oid = 'public.contract_amendments'::regclass;

select count(*) = 0 as browser_table_grants_should_be_zero
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'contract_amendments'
  and grantee in ('PUBLIC', 'anon', 'authenticated');

select count(*) = 6 as lifecycle_rpcs_should_be_six
from pg_proc procedure
join pg_namespace namespace on namespace.oid = procedure.pronamespace
where namespace.nspname = 'public'
  and procedure.proname in (
    'create_contract_amendment_draft',
    'update_contract_amendment_draft',
    'delete_contract_amendment_draft',
    'publish_contract_amendment',
    'cancel_contract_amendment',
    'apply_due_contract_amendments'
  );

select count(*) = 0 as browser_rpc_grants_should_be_zero
from information_schema.role_routine_grants
where routine_schema = 'public'
  and routine_name in (
    'create_contract_amendment_draft',
    'update_contract_amendment_draft',
    'delete_contract_amendment_draft',
    'publish_contract_amendment',
    'cancel_contract_amendment',
    'apply_due_contract_amendments'
  )
  and grantee in ('PUBLIC', 'anon', 'authenticated');

select count(*) = 1 as scheduled_unique_index_should_be_one
from pg_indexes
where schemaname = 'public'
  and tablename = 'contract_amendments'
  and indexname = 'contract_amendments_one_scheduled_per_contract'
  and indexdef ilike '%where (status = ''scheduled''::text)%';

select count(*) = 1 as cron_job_should_be_one
from cron.job
where jobname = 'contract-amendments-apply-due';

select count(*) = 2 as vault_secrets_should_be_two
from vault.decrypted_secrets
where name in ('nitro_scheduler_base_url', 'contract_amendments_apply_secret')
  and nullif(decrypted_secret, '') is not null;
