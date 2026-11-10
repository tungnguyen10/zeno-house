-- Manual Dashboard deployment only. See docs/development/checkout-sql-verification.md.
-- Held deposit derives from contracts.deposit only; deposit payment receipts no longer create sources.
begin;

alter table public.contract_checkout_sources alter column payment_id drop not null;
alter table public.contract_checkout_sources add constraint contract_checkout_sources_payment_required
  check (payment_id is not null or source_type = 'deposit');
create unique index contract_checkout_sources_contract_deposit
  on public.contract_checkout_sources(contract_id) where source_type = 'deposit' and payment_id is null;

-- Deposit receipts stay protected when a legacy source already references them, but no longer create sources.
create or replace function public.contract_checkout_payment_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare source public.contract_checkout_sources%rowtype;
begin
 if tg_op='INSERT' then return new; end if;
 select * into source from public.contract_checkout_sources where payment_id=old.id for update;
 if source.id is not null then
 if exists(select 1 from public.invoice_payments where checkout_source_id=source.id) or exists(select 1 from public.contract_checkout_refunds where source_id=source.id) or exists(select 1 from public.contract_checkout_statements s join public.contract_checkouts h on h.id=s.checkout_id where h.contract_id = source.contract_id) then raise exception 'CHECKOUT_RECEIPT_ALLOCATED'; end if;
 if tg_op='DELETE' then
 delete from public.contract_checkout_sources where id=source.id;
 return old;
 end if;
 if new.contract_id<>old.contract_id or new.payment_type<>old.payment_type or (source.source_type='credit' and new.amount<source.approved_amount) then raise exception 'CHECKOUT_SOURCE_RECEIPT_PROTECTED'; end if;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;

create function public.contract_deposit_source_sync() returns trigger language plpgsql security invoker set search_path='' as $$
declare src public.contract_checkout_sources%rowtype; settled boolean;
begin
 if tg_op='INSERT' then
 -- A renewal successor receives its deposit source by transfer from the previous contract.
 if new.deposit>0 and new.previous_contract_id is null then
 insert into public.contract_checkout_sources(contract_id,source_type,approved_amount) values(new.id,'deposit',new.deposit);
 end if;
 return new;
 end if;
 if new.deposit is not distinct from old.deposit then return new; end if;
 select exists(select 1 from public.contract_checkout_statements s join public.contract_checkouts h on h.id=s.checkout_id where h.contract_id=new.id) into settled;
 select * into src from public.contract_checkout_sources where contract_id=new.id and source_type='deposit' and payment_id is null for update;
 if src.id is null then
 if new.deposit>0 and not settled then insert into public.contract_checkout_sources(contract_id,source_type,approved_amount) values(new.id,'deposit',new.deposit); end if;
 return new;
 end if;
 if settled or exists(select 1 from public.invoice_payments where checkout_source_id=src.id) or exists(select 1 from public.contract_checkout_refunds where source_id=src.id) then raise exception 'CHECKOUT_DEPOSIT_ALLOCATED'; end if;
 if new.deposit>0 then update public.contract_checkout_sources set approved_amount=new.deposit,updated_at=clock_timestamp() where id=src.id;
 else delete from public.contract_checkout_sources where id=src.id; end if;
 return new;
end $$;
create trigger contract_deposit_source_insert after insert on public.contracts for each row execute function public.contract_deposit_source_sync();
create trigger contract_deposit_source_update after update of deposit on public.contracts for each row execute function public.contract_deposit_source_sync();

-- Backfill: replace unallocated receipt-based deposit sources on unsettled contracts.
delete from public.contract_checkout_sources s
 where s.source_type='deposit' and s.payment_id is not null
   and not exists(select 1 from public.invoice_payments p where p.checkout_source_id=s.id)
   and not exists(select 1 from public.contract_checkout_refunds r where r.source_id=s.id)
   and not exists(select 1 from public.contract_checkout_statements st join public.contract_checkouts h on h.id=st.checkout_id where h.contract_id=s.contract_id);

insert into public.contract_checkout_sources(contract_id,source_type,approved_amount)
 select c.id,'deposit',c.deposit from public.contracts c
  where c.deposit>0 and c.status<>'renewed'
    and not exists(select 1 from public.contract_checkout_sources s where s.contract_id=c.id and s.source_type='deposit')
    and not exists(select 1 from public.contract_checkouts h where h.contract_id=c.id and h.financial_mode='legacy')
    and not exists(select 1 from public.contract_checkout_statements st join public.contract_checkouts h on h.id=st.checkout_id where h.contract_id=c.id);

commit;
