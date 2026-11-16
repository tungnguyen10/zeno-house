-- =============================================================================
-- Contract documents (V2 PR4b)
-- =============================================================================
-- Versioned DOCX issuance: private bucket + metadata table + snapshot, with an
-- immutable status machine, a handover-inventory lock, and RPCs for the
-- reserve → upload → finalize flow plus compensation/cleanup.
--
-- Data impact: ADDITIVE (new table, bucket, functions, triggers, cron). FK
-- contract_id/building_id use ON DELETE RESTRICT so legal documents are never
-- lost silently; the service layer pre-checks before hard deletes.
-- Apply manually in the SQL Editor, then regenerate database types.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contract-documents', 'contract-documents', false, 10485760,
        array['application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.contract_documents (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete restrict,
  building_id uuid not null references public.buildings(id) on delete restrict,
  type text not null check (type in ('contract', 'appendix')),
  amendment_id uuid references public.contract_amendments(id) on delete restrict,
  version_no integer not null check (version_no > 0),
  status text not null default 'pending' check (status in ('pending', 'failed', 'issued', 'signed', 'voided')),
  template_key text not null,
  template_version integer not null check (template_version > 0),
  storage_path text,
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  size_bytes integer check (size_bytes is null or size_bytes > 0),
  last_error_code text check (last_error_code is null or last_error_code ~ '^[A-Z_]{1,64}$'),
  snapshot jsonb not null,
  signed_date date not null,
  issued_by uuid references auth.users(id) on delete set null,
  issued_at timestamptz,
  signed_by uuid references auth.users(id) on delete set null,
  signed_at timestamptz,
  voided_by uuid references auth.users(id) on delete set null,
  voided_at timestamptz,
  void_reason text check (void_reason is null or length(trim(void_reason)) >= 10),
  replaces_document_id uuid references public.contract_documents(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint contract_documents_appendix_check check ((type = 'appendix') = (amendment_id is not null)),
  constraint contract_documents_issued_fields check (status in ('pending', 'failed') or (storage_path is not null and sha256 is not null and issued_at is not null)),
  constraint contract_documents_voided_fields check (status <> 'voided' or (voided_at is not null and void_reason is not null))
);

create unique index if not exists contract_documents_one_active
  on public.contract_documents (contract_id, type, coalesce(amendment_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status in ('pending', 'failed', 'issued', 'signed');
create unique index if not exists contract_documents_version_uq
  on public.contract_documents (contract_id, type, coalesce(amendment_id, '00000000-0000-0000-0000-000000000000'::uuid), version_no);
create index if not exists contract_documents_contract_idx on public.contract_documents (contract_id, created_at desc);

alter table public.contract_documents enable row level security;
revoke all on table public.contract_documents from public, anon, authenticated;
grant select, insert, update, delete on table public.contract_documents to service_role;

-- Immutability + status-machine guard --------------------------------------
create or replace function public.contract_documents_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'CONTRACT_DOCUMENT_IMMUTABLE' using errcode = '23514';
  end if;
  if new.contract_id is distinct from old.contract_id
     or new.building_id is distinct from old.building_id
     or new.type is distinct from old.type
     or new.amendment_id is distinct from old.amendment_id
     or new.version_no is distinct from old.version_no
     or new.template_key is distinct from old.template_key
     or new.template_version is distinct from old.template_version
     or new.snapshot is distinct from old.snapshot
     or new.signed_date is distinct from old.signed_date
     or new.replaces_document_id is distinct from old.replaces_document_id then
    raise exception 'CONTRACT_DOCUMENT_IMMUTABLE' using errcode = '23514';
  end if;
  if (new.storage_path is distinct from old.storage_path
      or new.sha256 is distinct from old.sha256
      or new.size_bytes is distinct from old.size_bytes)
     and old.status not in ('pending', 'failed') then
    raise exception 'CONTRACT_DOCUMENT_IMMUTABLE' using errcode = '23514';
  end if;
  if new.status is distinct from old.status
     and not (
       (old.status = 'pending' and new.status in ('issued', 'failed'))
       or (old.status = 'failed' and new.status in ('issued', 'voided'))
       or (old.status = 'issued' and new.status in ('signed', 'voided'))
       or (old.status = 'signed' and new.status = 'voided')
     ) then
    raise exception 'CONTRACT_DOCUMENT_IMMUTABLE' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists contract_documents_guard on public.contract_documents;
create trigger contract_documents_guard
  before update or delete on public.contract_documents
  for each row execute function public.contract_documents_guard();

-- Handover inventory lock when a contract document is issued/signed ---------
drop trigger if exists contract_inventory_items_no_update on public.contract_inventory_items;

create or replace function public.contract_inventory_items_lock() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if exists (
    select 1 from public.contract_documents d
    where d.contract_id = coalesce(new.contract_id, old.contract_id)
      and d.type = 'contract' and d.status in ('issued', 'signed')
  ) then
    raise exception 'CONTRACT_INVENTORY_LOCKED' using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists contract_inventory_items_lock on public.contract_inventory_items;
create trigger contract_inventory_items_lock
  before insert or update or delete on public.contract_inventory_items
  for each row execute function public.contract_inventory_items_lock();

-- RPCs ----------------------------------------------------------------------
create or replace function public.reserve_contract_document(
  p_contract_id uuid, p_type text, p_amendment_id uuid, p_template_key text, p_template_version integer,
  p_snapshot jsonb, p_signed_date date, p_actor_id uuid, p_replaces_document_id uuid, p_void_reason text
) returns public.contract_documents
language plpgsql security invoker set search_path = '' as $$
declare
  v_building uuid;
  v_active public.contract_documents%rowtype;
  v_next integer;
  v_row public.contract_documents%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('contract_documents:' || p_contract_id::text, 0));
  select building_id into v_building from public.contracts where id = p_contract_id;
  if v_building is null then raise exception 'CONTRACT_NOT_FOUND' using errcode = 'P0002'; end if;

  select * into v_active from public.contract_documents
  where contract_id = p_contract_id and type = p_type
    and coalesce(amendment_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p_amendment_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and status in ('pending', 'failed', 'issued', 'signed');
  if found then
    if p_replaces_document_id is distinct from v_active.id then
      raise exception 'CONTRACT_DOCUMENT_ACTIVE_EXISTS' using errcode = '23505';
    end if;
    update public.contract_documents
      set status = 'voided', voided_by = p_actor_id, voided_at = now(), void_reason = p_void_reason
      where id = v_active.id;
  end if;

  select coalesce(max(version_no), 0) + 1 into v_next from public.contract_documents
  where contract_id = p_contract_id and type = p_type
    and coalesce(amendment_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p_amendment_id, '00000000-0000-0000-0000-000000000000'::uuid);

  insert into public.contract_documents (contract_id, building_id, type, amendment_id, version_no, status,
    template_key, template_version, snapshot, signed_date, replaces_document_id)
  values (p_contract_id, v_building, p_type, p_amendment_id, v_next, 'pending',
    p_template_key, p_template_version, p_snapshot, p_signed_date, p_replaces_document_id)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.finalize_contract_document(
  p_document_id uuid, p_storage_path text, p_sha256 text, p_size_bytes integer, p_actor_id uuid
) returns public.contract_documents
language plpgsql security invoker set search_path = '' as $$
declare v_row public.contract_documents%rowtype;
begin
  update public.contract_documents
    set status = 'issued', storage_path = p_storage_path, sha256 = p_sha256, size_bytes = p_size_bytes,
        issued_by = p_actor_id, issued_at = now(), last_error_code = null
    where id = p_document_id and status in ('pending', 'failed')
    returning * into v_row;
  if not found then raise exception 'CONTRACT_DOCUMENT_STATE_INVALID' using errcode = '23514'; end if;
  return v_row;
end;
$$;

create or replace function public.fail_contract_document(p_document_id uuid, p_error_code text)
returns public.contract_documents
language plpgsql security invoker set search_path = '' as $$
declare v_row public.contract_documents%rowtype;
begin
  update public.contract_documents
    set status = 'failed', storage_path = null, sha256 = null, size_bytes = null, last_error_code = p_error_code
    where id = p_document_id and status = 'pending'
    returning * into v_row;
  if not found then raise exception 'CONTRACT_DOCUMENT_STATE_INVALID' using errcode = '23514'; end if;
  return v_row;
end;
$$;

create or replace function public.mark_contract_document_signed(p_document_id uuid, p_actor_id uuid)
returns public.contract_documents
language plpgsql security invoker set search_path = '' as $$
declare v_row public.contract_documents%rowtype;
begin
  update public.contract_documents set status = 'signed', signed_by = p_actor_id, signed_at = now()
    where id = p_document_id and status = 'issued' returning * into v_row;
  if not found then raise exception 'CONTRACT_DOCUMENT_STATE_INVALID' using errcode = '23514'; end if;
  return v_row;
end;
$$;

create or replace function public.void_contract_document(p_document_id uuid, p_reason text, p_actor_id uuid)
returns public.contract_documents
language plpgsql security invoker set search_path = '' as $$
declare v_row public.contract_documents%rowtype;
begin
  if length(trim(coalesce(p_reason, ''))) < 10 then raise exception 'CONTRACT_DOCUMENT_REASON_REQUIRED' using errcode = '22023'; end if;
  update public.contract_documents set status = 'voided', voided_by = p_actor_id, voided_at = now(), void_reason = p_reason
    where id = p_document_id and status in ('failed', 'issued', 'signed') returning * into v_row;
  if not found then raise exception 'CONTRACT_DOCUMENT_STATE_INVALID' using errcode = '23514'; end if;
  return v_row;
end;
$$;

create or replace function public.claim_stale_contract_documents(p_older_than interval)
returns setof public.contract_documents
language sql security invoker set search_path = '' as $$
  select * from public.contract_documents
  where status = 'pending' and created_at < now() - p_older_than
  for update skip locked;
$$;

revoke all on function public.reserve_contract_document(uuid, text, uuid, text, integer, jsonb, date, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.reserve_contract_document(uuid, text, uuid, text, integer, jsonb, date, uuid, uuid, text) to service_role;
revoke all on function public.finalize_contract_document(uuid, text, text, integer, uuid) from public, anon, authenticated;
grant execute on function public.finalize_contract_document(uuid, text, text, integer, uuid) to service_role;
revoke all on function public.fail_contract_document(uuid, text) from public, anon, authenticated;
grant execute on function public.fail_contract_document(uuid, text) to service_role;
revoke all on function public.mark_contract_document_signed(uuid, uuid) from public, anon, authenticated;
grant execute on function public.mark_contract_document_signed(uuid, uuid) to service_role;
revoke all on function public.void_contract_document(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.void_contract_document(uuid, text, uuid) to service_role;
revoke all on function public.claim_stale_contract_documents(interval) from public, anon, authenticated;
grant execute on function public.claim_stale_contract_documents(interval) to service_role;

-- Cleanup cron (every 15 minutes) ------------------------------------------
do $$ begin perform cron.unschedule('contract-documents-cleanup'); exception when others then null; end $$;
select cron.schedule(
  'contract-documents-cleanup',
  '*/15 * * * *',
  $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'nitro_scheduler_base_url')
        || '/api/internal/contract-documents/cleanup',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-contract-documents-cleanup-secret', (
          select decrypted_secret from vault.decrypted_secrets where name = 'contract_documents_cleanup_secret'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $job$
);
