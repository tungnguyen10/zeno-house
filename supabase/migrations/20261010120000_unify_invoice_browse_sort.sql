-- The browse view flattens invoice sort fields so PostgREST orders the parent
-- invoices before applying range pagination. The ICU collation matches the
-- room-number behavior used by the billing workspace (2 before 10).
create collation if not exists public.billing_natural_vi (
  provider = icu,
  locale = 'vi-u-kn-true-ks-level1',
  deterministic = false
);

create view public.invoice_browse_rows with (security_invoker = true) as
select
  i.id,
  i.invoice_code,
  i.billing_period_id,
  i.contract_id,
  i.room_id,
  i.tenant_id,
  i.status,
  i.total_amount,
  i.paid_amount,
  i.balance_amount,
  i.due_date,
  i.grace_period_days,
  i.overdue_date,
  i.issued_at,
  i.voided_at,
  i.void_reason,
  i.notes,
  bp.period_year,
  bp.period_month,
  bp.building_id,
  b.name as building_name,
  b.slug as building_slug,
  r.room_number,
  r.floor as room_floor,
  c.contract_code,
  t.full_name as tenant_name,
  t.phone as tenant_phone,
  b.name collate public.billing_natural_vi as building_sort_name,
  r.room_number collate public.billing_natural_vi as room_sort_number,
  c.contract_code collate public.billing_natural_vi as contract_sort_code,
  i.invoice_code collate public.billing_natural_vi as invoice_sort_code
from public.invoices i
join public.billing_periods bp on bp.id = i.billing_period_id
left join public.buildings b on b.id = bp.building_id
left join public.rooms r on r.id = i.room_id
left join public.contracts c on c.id = i.contract_id
join public.tenants t on t.id = i.tenant_id;

revoke all on public.invoice_browse_rows from public, anon, authenticated;
grant select on public.invoice_browse_rows to service_role;
