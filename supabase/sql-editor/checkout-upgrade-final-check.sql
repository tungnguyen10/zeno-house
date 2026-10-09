-- One read-only result row after upgrading a database with legacy returns.
select
  to_regclass('public.contract_checkout_final_bills') is not null as final_bills_table_exists,
  to_regprocedure('public.contract_checkout_return(uuid,uuid,uuid,timestamptz)') is not null as old_return_rpc_exists,
  to_regprocedure('public.contract_checkout_return(uuid,uuid,uuid,timestamptz,text)') is not null as new_return_rpc_exists,
  to_regprocedure('public.contract_checkout_issue_final(uuid,uuid,uuid,text)') is not null as final_issue_rpc_exists,
  (select count(*) from public.contract_checkouts where status='returned' and financial_mode='legacy') as legacy_return_count,
  (select count(*) from public.contracts next where next.status='active' and next.room_id in (
    select c.room_id from public.contract_checkouts h join public.contracts c on c.id=h.contract_id
    where h.status='returned' and h.financial_mode='legacy'
  )) as active_contracts_in_legacy_room,
  (select count(*) from public.contract_checkouts h
    join public.contracts c on c.id=h.contract_id
    join public.rooms r on r.id=c.room_id
    where h.status='returned' and h.financial_mode='legacy' and r.status='occupied'
      and not exists(select 1 from public.contracts next where next.room_id=r.id and next.status='active')
  ) as occupied_legacy_rooms_without_active_contract;
