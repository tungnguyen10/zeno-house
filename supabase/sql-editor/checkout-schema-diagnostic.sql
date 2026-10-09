-- Read-only inspection after a checkout migration reports an existing table.
-- Run in the same Dashboard SQL Editor project that reported 42P07.
select
  to_regclass('public.contract_checkouts') is not null as checkout_table_exists,
  to_regclass('public.contract_checkout_sources') is not null as sources_table_exists,
  to_regclass('public.contract_checkout_statements') is not null as statements_table_exists,
  to_regclass('public.contract_checkout_refunds') is not null as refunds_table_exists,
  to_regclass('public.contract_checkout_final_bills') is not null as final_bills_table_exists,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'contract_checkouts'
      and column_name = 'pricing_snapshot'
  ) as has_pricing_snapshot,
  to_regprocedure('public.contract_checkout_return(uuid,uuid,uuid,timestamptz)') is not null as has_old_return_rpc,
  to_regprocedure('public.contract_checkout_return(uuid,uuid,uuid,timestamptz,text)') is not null as has_new_return_rpc,
  to_regprocedure('public.contract_checkout_issue_final(uuid,uuid,uuid,text)') is not null as has_final_issue_rpc,
  (select count(*) from public.contract_checkouts) as checkout_count,
  (select count(*) from public.contract_checkouts where status = 'returned') as returned_count;
