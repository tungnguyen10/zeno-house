begin;

alter table public.contracts
  add column if not exists contract_code text;

with ranked as (
  select
    id,
    'hd-' || extract(year from start_date)::int || '-' || lpad(
      row_number() over (
        partition by extract(year from start_date)::int
        order by start_date, created_at, id
      )::text,
      4,
      '0'
    ) as generated_code
  from public.contracts
  where contract_code is null or contract_code = ''
)
update public.contracts c
set contract_code = ranked.generated_code
from ranked
where c.id = ranked.id;

alter table public.contracts
  alter column contract_code set not null;

create unique index if not exists contracts_contract_code_uq
  on public.contracts (contract_code);

alter table public.invoices
  add column if not exists invoice_code text;

with ranked as (
  select
    i.id,
    'inv-' || p.period_year || '-' || lpad(p.period_month::text, 2, '0') || '-' || lpad(
      row_number() over (
        partition by p.period_year, p.period_month
        order by i.issued_at nulls last, i.created_at, i.id
      )::text,
      4,
      '0'
    ) as generated_code
  from public.invoices i
  join public.billing_periods p on p.id = i.billing_period_id
  where i.invoice_code is null or i.invoice_code = ''
)
update public.invoices i
set invoice_code = ranked.generated_code
from ranked
where i.id = ranked.id;

alter table public.invoices
  alter column invoice_code set not null;

create unique index if not exists invoices_invoice_code_uq
  on public.invoices (invoice_code);

commit;
