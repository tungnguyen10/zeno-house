-- Manual Dashboard deployment only. See docs/development/checkout-sql-verification.md.
-- Final checkout invoices get the regular inv-YYYY-MM-NNNN code instead of a random UUID suffix.
begin;

create or replace function public.checkout_invoice_code_normalize() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.billing_periods%rowtype; v_prefix text; v_next integer;
begin
 if new.invoice_code is null or new.invoice_code !~ '^inv-(checkout|return)-' then return new; end if;
 select * into p from public.billing_periods where id=new.billing_period_id;
 if not found then return new; end if;
 -- Same lock key space as the period; serializes sequence allocation per period.
 perform pg_advisory_xact_lock(hashtextextended('invoice_code:'||p.id::text,0));
 v_prefix := format('inv-%s-%s', p.period_year, lpad(p.period_month::text,2,'0'));
 select coalesce(max(nullif(regexp_replace(invoice_code,'^'||v_prefix||'-',''),'')::integer),0)+1 into v_next
  from public.invoices where invoice_code ~ ('^'||v_prefix||'-[0-9]+$');
 new.invoice_code := v_prefix||'-'||lpad(v_next::text,4,'0');
 return new;
end $$;

create trigger a_checkout_invoice_code before insert on public.invoices
 for each row execute function public.checkout_invoice_code_normalize();

commit;
