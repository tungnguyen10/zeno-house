-- Read-only checks after checkout-upgrade-existing-schema.sql commits.
select
  to_regclass('public.contract_checkout_final_bills') is not null as final_bills_table_exists,
  to_regprocedure('public.contract_checkout_return(uuid,uuid,uuid,timestamptz)') is not null as old_return_rpc_exists,
  to_regprocedure('public.contract_checkout_return(uuid,uuid,uuid,timestamptz,text)') is not null as new_return_rpc_exists,
  to_regprocedure('public.contract_checkout_issue_final(uuid,uuid,uuid,text)') is not null as final_issue_rpc_exists,
  (select count(*) from public.contract_checkouts where status='returned' and financial_mode='legacy') as legacy_return_count,
  (select count(*) from public.contract_checkout_statements) as statement_count,
  (select count(*) from public.contract_checkout_refunds) as refund_count,
  (select count(*) from public.invoice_payments where checkout_statement_id is not null) as allocated_payment_count;

-- Compare each row with checkout-legacy-return-diagnostic.sql captured before upgrade.
select
  h.status as checkout_status,
  h.financial_mode,
  (select count(*) from public.contract_checkout_statements s where s.checkout_id=h.id) as statement_count,
  (select count(*) from public.contract_checkout_refunds f join public.contract_checkout_statements s on s.id=f.statement_id where s.checkout_id=h.id) as refund_count,
  (select count(*) from public.invoice_charges q join public.invoices i on i.id=q.invoice_id where i.contract_id=h.contract_id and q.metadata->>'checkout_id'=h.id::text) as checkout_invoice_charge_count,
  (select count(*) from public.invoice_payments p join public.contract_checkout_statements s on s.id=p.checkout_statement_id where s.checkout_id=h.id) as allocated_payment_count
from public.contract_checkouts h
where h.financial_mode='legacy';
