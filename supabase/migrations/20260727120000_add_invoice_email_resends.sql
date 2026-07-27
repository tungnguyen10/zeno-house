-- Explicit single-invoice resend support. Prior provider outcomes remain intact.

begin;

alter table public.invoice_email_deliveries
  add column supersedes_delivery_id uuid
    references public.invoice_email_deliveries(id) on delete set null,
  add column resend_released_at timestamptz;

create index idx_invoice_email_deliveries_supersedes
  on public.invoice_email_deliveries (supersedes_delivery_id)
  where supersedes_delivery_id is not null;

drop index public.uq_invoice_email_deliveries_active_recipient;

create unique index uq_invoice_email_deliveries_active_recipient
  on public.invoice_email_deliveries (invoice_id, recipient_email)
  where status in ('queued', 'processing', 'accepted')
    and resend_released_at is null;

create or replace function public.resend_invoice_email_delivery(
  p_invoice_id uuid,
  p_actor_id uuid,
  p_confirm_duplicate boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices%rowtype;
  v_building_id uuid;
  v_raw_email text;
  v_recipient_email text;
  v_previous public.invoice_email_deliveries%rowtype;
  v_delivery public.invoice_email_deliveries%rowtype;
begin
  select invoice.*
    into v_invoice
    from public.invoices invoice
   where invoice.id = p_invoice_id
   for update;

  if not found then
    raise exception 'INVOICE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_invoice.status in ('void', 'draft') then
    raise exception 'INVOICE_EMAIL_NOT_SENDABLE' using errcode = 'P0001';
  end if;

  select period.building_id
    into v_building_id
    from public.billing_periods period
   where period.id = v_invoice.billing_period_id;

  select tenant.email
    into v_raw_email
    from public.tenants tenant
   where tenant.id = v_invoice.tenant_id;

  v_recipient_email := public.invoice_email_normalize_recipient(v_raw_email);
  if v_recipient_email is null then
    raise exception 'INVOICE_EMAIL_RECIPIENT_INVALID' using errcode = 'P0001';
  end if;

  select delivery.*
    into v_previous
    from public.invoice_email_deliveries delivery
   where delivery.invoice_id = p_invoice_id
     and delivery.recipient_email = v_recipient_email
   order by delivery.created_at desc
   limit 1
   for update;

  if not found then
    raise exception 'INVOICE_EMAIL_NO_PREVIOUS_DELIVERY' using errcode = 'P0001';
  end if;
  if v_previous.status in ('queued', 'processing') then
    raise exception 'INVOICE_EMAIL_DELIVERY_ACTIVE' using errcode = 'P0001';
  end if;
  if v_previous.status in ('bounced', 'complained') then
    raise exception 'INVOICE_EMAIL_RECIPIENT_BLOCKED' using errcode = 'P0001';
  end if;
  if v_previous.status not in ('failed', 'accepted', 'delivered') then
    raise exception 'INVOICE_EMAIL_RESEND_NOT_ALLOWED' using errcode = 'P0001';
  end if;
  if v_previous.status in ('accepted', 'delivered') and not p_confirm_duplicate then
    raise exception 'INVOICE_EMAIL_DUPLICATE_CONFIRMATION_REQUIRED' using errcode = 'P0001';
  end if;

  if v_previous.status = 'accepted' and v_previous.resend_released_at is null then
    update public.invoice_email_deliveries
       set resend_released_at = now()
     where id = v_previous.id;
  end if;

  insert into public.invoice_email_deliveries (
    invoice_id,
    building_id,
    billing_period_id,
    created_by,
    source,
    status,
    recipient_email,
    next_attempt_at,
    supersedes_delivery_id
  ) values (
    p_invoice_id,
    v_building_id,
    v_invoice.billing_period_id,
    p_actor_id,
    'manual',
    'queued',
    v_recipient_email,
    now(),
    v_previous.id
  )
  returning * into v_delivery;

  return jsonb_build_object('delivery', to_jsonb(v_delivery));
end;
$$;

revoke all on function public.resend_invoice_email_delivery(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.resend_invoice_email_delivery(uuid, uuid, boolean)
  to service_role;

commit;