-- =============================================================================
-- Tenant OCR usage quota (V2 PR5)
-- =============================================================================
-- Daily quota ledger for identity-document extraction. Stores counts, cost and
-- model name only; no document or identity content is ever written here.
-- Data impact: ADDITIVE ONLY (new table and three functions). Service-role only.
-- Rollback: drop the functions and table.
-- =============================================================================

begin;

create table if not exists public.tenant_ocr_usage (
  id uuid primary key default gen_random_uuid(),
  usage_date date not null default ((now() at time zone 'utc')::date),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('reserved', 'settled', 'released')),
  reserved_micro_usd bigint not null check (reserved_micro_usd >= 0),
  cost_micro_usd bigint check (cost_micro_usd is null or cost_micro_usd >= 0),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  model text check (model is null or char_length(model) <= 100),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create index if not exists tenant_ocr_usage_date_idx on public.tenant_ocr_usage (usage_date);
create index if not exists tenant_ocr_usage_date_user_idx on public.tenant_ocr_usage (usage_date, user_id);

alter table public.tenant_ocr_usage enable row level security;
revoke all on table public.tenant_ocr_usage from public, anon, authenticated;
grant select, insert, update on table public.tenant_ocr_usage to service_role;

-- Reserve one extraction slot. A reservation that never settles (crashed request)
-- stops counting after 10 minutes.
create or replace function public.reserve_tenant_ocr(
  p_user_id uuid,
  p_global_limit integer,
  p_user_limit integer,
  p_budget_micro_usd bigint,
  p_reserve_micro_usd bigint
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_global integer;
  v_user integer;
  v_spent bigint;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('tenant_ocr:' || v_today::text, 0));

  select count(*),
         count(*) filter (where user_id = p_user_id),
         coalesce(sum(coalesce(cost_micro_usd, reserved_micro_usd)), 0)
    into v_global, v_user, v_spent
  from public.tenant_ocr_usage
  where usage_date = v_today
    and status in ('reserved', 'settled')
    and not (status = 'reserved' and created_at < now() - interval '10 minutes');

  if v_global >= p_global_limit then
    raise exception 'TENANT_OCR_GLOBAL_LIMIT' using errcode = 'P0001';
  end if;
  if v_user >= p_user_limit then
    raise exception 'TENANT_OCR_USER_LIMIT' using errcode = 'P0001';
  end if;
  if v_spent + p_reserve_micro_usd > p_budget_micro_usd then
    raise exception 'TENANT_OCR_BUDGET' using errcode = 'P0001';
  end if;

  insert into public.tenant_ocr_usage (usage_date, user_id, status, reserved_micro_usd)
  values (v_today, p_user_id, 'reserved', p_reserve_micro_usd)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.reserve_tenant_ocr(uuid, integer, integer, bigint, bigint) from public, anon, authenticated;
grant execute on function public.reserve_tenant_ocr(uuid, integer, integer, bigint, bigint) to service_role;

create or replace function public.settle_tenant_ocr(
  p_id uuid,
  p_cost_micro_usd bigint,
  p_input_tokens integer,
  p_output_tokens integer,
  p_model text
) returns void
language sql
security invoker
set search_path = ''
as $$
  update public.tenant_ocr_usage
  set status = 'settled',
      cost_micro_usd = greatest(p_cost_micro_usd, 0),
      input_tokens = greatest(p_input_tokens, 0),
      output_tokens = greatest(p_output_tokens, 0),
      model = left(p_model, 100),
      settled_at = now()
  where id = p_id and status = 'reserved';
$$;
revoke all on function public.settle_tenant_ocr(uuid, bigint, integer, integer, text) from public, anon, authenticated;
grant execute on function public.settle_tenant_ocr(uuid, bigint, integer, integer, text) to service_role;

create or replace function public.release_tenant_ocr(p_id uuid) returns void
language sql
security invoker
set search_path = ''
as $$
  update public.tenant_ocr_usage
  set status = 'released', cost_micro_usd = 0, settled_at = now()
  where id = p_id and status = 'reserved';
$$;
revoke all on function public.release_tenant_ocr(uuid) from public, anon, authenticated;
grant execute on function public.release_tenant_ocr(uuid) to service_role;

commit;
