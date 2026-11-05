-- ZH-BIL-01 PR3a: billing close integrity report.
-- Strictly read-only (select statements only); safe to run before the PR3 migration is deployed.
-- Run in the Supabase Dashboard SQL editor and review every result before approving a repair script.
-- Expected state: every *_count is 0 except where a comment says otherwise.

-- 1. Closed periods that have no `period.closed` audit event.
select count(*) as closed_periods_without_close_audit
from public.billing_periods bp
where bp.status = 'closed'
  and not exists (
    select 1 from public.billing_audit_events audit
    where audit.billing_period_id = bp.id and audit.action = 'period.closed'
  );

select bp.id as billing_period_id, bp.building_id, bp.period_year, bp.period_month, bp.closed_at
from public.billing_periods bp
where bp.status = 'closed'
  and not exists (
    select 1 from public.billing_audit_events audit
    where audit.billing_period_id = bp.id and audit.action = 'period.closed'
  )
order by bp.closed_at desc
limit 50;

-- 2. Closed periods without an active monthly accrual, split by the effective reserve rate.
-- Rate > 0: a missing accrual is a defect. Rate = 0: a missing accrual is expected.
with closed_without_accrual as (
  select bp.id, bp.building_id, bp.period_year, bp.period_month
  from public.billing_periods bp
  where bp.status = 'closed'
    and not exists (
      select 1
      from public.reserve_funds fund
      join public.reserve_fund_transactions tx on tx.fund_id = fund.id
      where fund.building_id = bp.building_id
        and tx.source = 'monthly_accrual'
        and tx.period_year = bp.period_year
        and tx.period_month = bp.period_month
        and tx.voided_at is null
    )
), with_rate as (
  select c.*,
    coalesce((
      select r.reserve_rate_percent
      from public.building_reserve_fund_rates r
      where r.building_id = c.building_id
        and (r.effective_from_period_year * 12 + r.effective_from_period_month) <= (c.period_year * 12 + c.period_month)
        and (
          r.effective_to_period_year is null
          or (r.effective_to_period_year * 12 + r.effective_to_period_month) >= (c.period_year * 12 + c.period_month)
        )
      order by r.effective_from_period_year desc, r.effective_from_period_month desc
      limit 1
    ), 0) as rate
  from closed_without_accrual c
)
select
  count(*) filter (where rate > 0) as closed_periods_without_accrual_rate_positive,
  count(*) filter (where rate = 0) as closed_periods_without_accrual_rate_zero
from with_rate;

-- 3. Monthly accruals whose billing_period_id points to a period that is not closed (reopened periods).
select count(*) as accruals_linked_to_non_closed_period
from public.reserve_fund_transactions tx
join public.billing_periods bp on bp.id = tx.billing_period_id
where tx.source = 'monthly_accrual'
  and tx.voided_at is null
  and bp.status <> 'closed';

-- 4. Payments and invoices written after the period closed (periods currently closed).
select count(*) as payments_written_after_close
from public.invoice_payments payment
join public.invoices invoice on invoice.id = payment.invoice_id
join public.billing_periods bp on bp.id = invoice.billing_period_id
where bp.status = 'closed'
  and bp.closed_at is not null
  and payment.created_at > bp.closed_at;

select payment.id as payment_id, invoice.id as invoice_id, bp.id as billing_period_id,
  bp.closed_at, payment.created_at as payment_created_at, payment.amount
from public.invoice_payments payment
join public.invoices invoice on invoice.id = payment.invoice_id
join public.billing_periods bp on bp.id = invoice.billing_period_id
where bp.status = 'closed'
  and bp.closed_at is not null
  and payment.created_at > bp.closed_at
order by payment.created_at desc
limit 50;

select count(*) as invoices_written_after_close
from public.invoices invoice
join public.billing_periods bp on bp.id = invoice.billing_period_id
where bp.status = 'closed'
  and bp.closed_at is not null
  and (invoice.created_at > bp.closed_at or invoice.updated_at > bp.closed_at);

select invoice.id as invoice_id, bp.id as billing_period_id, bp.closed_at,
  invoice.created_at as invoice_created_at, invoice.updated_at as invoice_updated_at
from public.invoices invoice
join public.billing_periods bp on bp.id = invoice.billing_period_id
where bp.status = 'closed'
  and bp.closed_at is not null
  and (invoice.created_at > bp.closed_at or invoice.updated_at > bp.closed_at)
order by invoice.updated_at desc
limit 50;

-- 5. Current EXECUTE grants of the billing RPCs.
-- NULL privileges mean the function is not deployed yet (the two atomic RPCs before PR3).
-- Before PR3, anon/authenticated may still execute the first three; after PR3 only service_role may.
with rpc(name, oid) as (
  values
    ('issue_period_invoices', to_regprocedure('public.issue_period_invoices(uuid,uuid,timestamptz,uuid[],jsonb,uuid)')),
    ('record_bulk_payments', to_regprocedure('public.record_bulk_payments(uuid,jsonb,uuid)')),
    ('issue_and_pay', to_regprocedure('public.issue_and_pay(uuid,uuid,uuid,date,integer,timestamptz,date,text,text,jsonb,uuid)')),
    ('close_billing_period_atomic', to_regprocedure('public.close_billing_period_atomic(uuid,uuid,uuid,numeric,numeric,numeric,numeric)')),
    ('reopen_billing_period_atomic', to_regprocedure('public.reopen_billing_period_atomic(uuid,uuid,text,uuid)'))
)
select name as billing_rpc_grants,
  oid is not null as deployed,
  has_function_privilege('anon', oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('service_role', oid, 'EXECUTE') as service_role_can_execute
from rpc
order by name;
