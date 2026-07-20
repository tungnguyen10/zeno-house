begin;

create or replace function public.invoice_profile_template_is_valid(p_template text)
returns boolean
language sql
immutable
as $$
  select p_template is not null
    and length(trim(p_template)) between 1 and 200
    and not exists (
      select 1
      from regexp_matches(p_template, '\{([^{}]+)\}', 'g') as match
      where match[1] <> all(array[
        'building_code', 'room_number', 'invoice_code', 'period'
      ]::text[])
    );
$$;

create table public.building_invoice_profiles (
  building_id uuid primary key references public.buildings(id) on delete cascade,
  bank_name text not null check (length(trim(bank_name)) between 1 and 120),
  account_holder text not null check (length(trim(account_holder)) between 1 and 120),
  account_number text not null check (length(trim(account_number)) between 1 and 50),
  transfer_content_template text not null
    check (public.invoice_profile_template_is_valid(transfer_content_template)),
  qr_image_path text not null check (length(trim(qr_image_path)) > 0),
  logo_image_path text,
  legacy_backfilled_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger building_invoice_profiles_set_updated_at
  before update on public.building_invoice_profiles
  for each row execute function public.set_updated_at();

alter table public.building_invoice_profiles enable row level security;
revoke all on table public.building_invoice_profiles from public, anon, authenticated;
grant select, insert, update, delete on table public.building_invoice_profiles to service_role;

alter table public.invoices
  add column invoice_profile_snapshot jsonb;

comment on column public.invoices.invoice_profile_snapshot is
  'Immutable schema-versioned building payment identity captured at invoice issuance.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'building-invoice-assets',
  'building-invoice-assets',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Browser clients have no policies for this bucket. The Nuxt service-role
-- boundary authorizes building scope before upload, signing, or cleanup.

create or replace function public.render_invoice_profile_snapshot(
  p_building_id uuid,
  p_room_id uuid,
  p_invoice_code text,
  p_period_id uuid,
  p_snapshotted_at timestamptz default now()
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_profile public.building_invoice_profiles%rowtype;
  v_building_code text;
  v_room_number text;
  v_period text;
  v_transfer_content text;
begin
  select * into v_profile
    from public.building_invoice_profiles
   where building_id = p_building_id;
  if not found then
    return null;
  end if;

  select building.code into v_building_code
    from public.buildings building
   where building.id = p_building_id;
  select room.room_number into v_room_number
    from public.rooms room
   where room.id = p_room_id;
  select lpad(period.period_month::text, 2, '0') || '/' || period.period_year::text
    into v_period
    from public.billing_periods period
   where period.id = p_period_id;

  v_transfer_content := v_profile.transfer_content_template;
  v_transfer_content := replace(v_transfer_content, '{building_code}', coalesce(v_building_code, ''));
  v_transfer_content := replace(v_transfer_content, '{room_number}', coalesce(v_room_number, ''));
  v_transfer_content := replace(v_transfer_content, '{invoice_code}', coalesce(p_invoice_code, ''));
  v_transfer_content := replace(v_transfer_content, '{period}', coalesce(v_period, ''));

  return jsonb_build_object(
    'schema_version', 1,
    'bank_name', v_profile.bank_name,
    'account_holder', v_profile.account_holder,
    'account_number', v_profile.account_number,
    'transfer_content', v_transfer_content,
    'qr_image_path', v_profile.qr_image_path,
    'logo_image_path', v_profile.logo_image_path,
    'snapshotted_at', p_snapshotted_at
  );
end;
$$;

create or replace function public.set_invoice_profile_snapshot_on_insert()
returns trigger
language plpgsql
security invoker
as $$
declare
  v_building_id uuid;
begin
  if new.invoice_profile_snapshot is not null then
    return new;
  end if;

  select period.building_id into v_building_id
    from public.billing_periods period
   where period.id = new.billing_period_id;

  new.invoice_profile_snapshot := public.render_invoice_profile_snapshot(
    v_building_id,
    new.room_id,
    new.invoice_code,
    new.billing_period_id,
    coalesce(new.issued_at, now())
  );
  return new;
end;
$$;

create trigger invoices_set_invoice_profile_snapshot
  before insert on public.invoices
  for each row execute function public.set_invoice_profile_snapshot_on_insert();

create or replace function public.upsert_building_invoice_profile(
  p_building_id uuid,
  p_actor_id uuid,
  p_bank_name text,
  p_account_holder text,
  p_account_number text,
  p_transfer_content_template text,
  p_qr_image_path text default null,
  p_logo_image_path text default null,
  p_remove_logo boolean default false
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_existing public.building_invoice_profiles%rowtype;
  v_saved public.building_invoice_profiles%rowtype;
  v_is_first boolean;
  v_backfilled_count integer := 0;
begin
  perform 1 from public.buildings where id = p_building_id for update;
  if not found then
    raise exception 'BUILDING_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_existing
    from public.building_invoice_profiles
   where building_id = p_building_id
   for update;
  v_is_first := not found;

  if v_is_first and nullif(trim(coalesce(p_qr_image_path, '')), '') is null then
    raise exception 'INVOICE_PROFILE_QR_REQUIRED' using errcode = 'P0001';
  end if;
  if not public.invoice_profile_template_is_valid(trim(p_transfer_content_template)) then
    raise exception 'INVOICE_PROFILE_TEMPLATE_INVALID' using errcode = 'P0001';
  end if;

  insert into public.building_invoice_profiles (
    building_id, bank_name, account_holder, account_number,
    transfer_content_template, qr_image_path, logo_image_path, updated_by
  ) values (
    p_building_id, trim(p_bank_name), trim(p_account_holder), trim(p_account_number),
    trim(p_transfer_content_template), trim(p_qr_image_path), p_logo_image_path, p_actor_id
  )
  on conflict (building_id) do update
  set bank_name = excluded.bank_name,
      account_holder = excluded.account_holder,
      account_number = excluded.account_number,
      transfer_content_template = excluded.transfer_content_template,
      qr_image_path = coalesce(nullif(excluded.qr_image_path, ''), building_invoice_profiles.qr_image_path),
      logo_image_path = case
        when p_remove_logo then null
        else coalesce(excluded.logo_image_path, building_invoice_profiles.logo_image_path)
      end,
      updated_by = excluded.updated_by
  returning * into v_saved;

  if v_is_first then
    update public.invoices invoice
       set invoice_profile_snapshot = public.render_invoice_profile_snapshot(
         p_building_id,
         invoice.room_id,
         invoice.invoice_code,
         invoice.billing_period_id,
         coalesce(invoice.issued_at, invoice.created_at, now())
       )
      from public.billing_periods period
     where invoice.billing_period_id = period.id
       and period.building_id = p_building_id
       and invoice.status <> 'void'
       and invoice.invoice_profile_snapshot is null;
    get diagnostics v_backfilled_count = row_count;

    update public.building_invoice_profiles
       set legacy_backfilled_at = now()
     where building_id = p_building_id
     returning * into v_saved;
  end if;

  return jsonb_build_object(
    'profile', to_jsonb(v_saved),
    'backfilled_count', v_backfilled_count
  );
end;
$$;

revoke all on function public.invoice_profile_template_is_valid(text)
  from public, anon, authenticated;
revoke all on function public.render_invoice_profile_snapshot(uuid, uuid, text, uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.set_invoice_profile_snapshot_on_insert()
  from public, anon, authenticated;
revoke all on function public.upsert_building_invoice_profile(uuid, uuid, text, text, text, text, text, text, boolean)
  from public, anon, authenticated;

grant execute on function public.invoice_profile_template_is_valid(text) to service_role;
grant execute on function public.render_invoice_profile_snapshot(uuid, uuid, text, uuid, timestamptz) to service_role;
grant execute on function public.set_invoice_profile_snapshot_on_insert() to service_role;
grant execute on function public.upsert_building_invoice_profile(uuid, uuid, text, text, text, text, text, text, boolean)
  to service_role;

commit;

-- Manual verification after applying in Supabase Dashboard SQL Editor:
-- select column_name, data_type
--   from information_schema.columns
--  where table_schema = 'public'
--    and table_name in ('building_invoice_profiles', 'invoices')
--    and column_name in ('building_id', 'invoice_profile_snapshot');
-- select id, public, file_size_limit, allowed_mime_types
--   from storage.buckets
--  where id = 'building-invoice-assets';
-- select tgname
--   from pg_trigger
--  where tgrelid = 'public.invoices'::regclass
--    and tgname = 'invoices_set_invoice_profile_snapshot';
-- select routine_name, security_type
--   from information_schema.routines
--  where routine_schema = 'public'
--    and routine_name in ('render_invoice_profile_snapshot', 'upsert_building_invoice_profile');

-- Rollback notes (run only after application code no longer reads these objects):
-- 1. Drop trigger public.invoices_set_invoice_profile_snapshot and its trigger function.
-- 2. Drop public.upsert_building_invoice_profile and public.render_invoice_profile_snapshot.
-- 3. Drop public.building_invoice_profiles and public.invoice_profile_template_is_valid.
-- 4. Drop public.invoices.invoice_profile_snapshot.
-- 5. Retain building-invoice-assets objects for recovery; delete the bucket only after
--    confirming no historical invoice snapshot references its paths.
