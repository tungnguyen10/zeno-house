-- Read-only shape check for legacy returned checkouts before a forward upgrade.
-- Counts and status only; no tenant identity, receipt detail, or meter values.
select
  h.status as checkout_status,
  c.status as contract_status,
  r.status as room_status,
  (select count(*) from public.contract_checkout_statements s where s.checkout_id = h.id) as statement_count,
  (select count(*) from public.contract_checkout_refunds f join public.contract_checkout_statements s on s.id = f.statement_id where s.checkout_id = h.id) as refund_count,
  (select count(*) from public.invoice_charges q join public.invoices i on i.id = q.invoice_id where i.contract_id = h.contract_id and q.metadata->>'checkout_id' = h.id::text) as checkout_invoice_charge_count,
  (select count(*) from public.invoice_payments p join public.contract_checkout_statements s on s.id = p.checkout_statement_id where s.checkout_id = h.id) as allocated_payment_count,
  (select count(*) from public.contract_occupants o where o.contract_id = h.contract_id and o.move_out_date is null) as active_occupant_count
from public.contract_checkouts h
join public.contracts c on c.id = h.contract_id
join public.rooms r on r.id = c.room_id
where h.status = 'returned';
