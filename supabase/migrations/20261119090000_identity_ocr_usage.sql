-- =============================================================================
-- Identity OCR usage quota: rename from tenant_ocr_usage
-- =============================================================================
-- Identity-document extraction now serves tenant and lessor forms, so the quota
-- ledger and its functions drop the tenant prefix. Rows, RLS and grants carry over.
-- Data impact: RENAME ONLY (table, indexes); functions are replaced with new names.
-- Rollback: rename back and restore the functions from 20261116110000.
-- =============================================================================

begin;

alter table public.tenant_ocr_usage rename to identity_ocr_usage;
alter index public.tenant_ocr_usage_date_idx rename to identity_ocr_usage_date_idx;
alter index public.tenant_ocr_usage_date_user_idx rename to identity_ocr_usage_date_user_idx;

alter table public.identity_ocr_usage enable row level security;
revoke all on table public.identity_ocr_usage from public, anon, authenticated;
grant select, insert, update on table public.identity_ocr_usage to service_role;

drop function if exists public.reserve_tenant_ocr(uuid, integer, integer, bigint, bigint);
drop function if exists public.settle_tenant_ocr(uuid, bigint, integer, integer, text);
drop function if exists public.release_tenant_ocr(uuid);

-- Reserve one extraction slot. A reservation that never settles (crashed request)
-- stops counting after 10 minutes.
create or replace function public.reserve_identity_ocr(
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
  perform pg_advisory_xact_lock(hashtextextended('identity_ocr:' || v_today::text, 0));

  select count(*),
         count(*) filter (where user_id = p_user_id),
         coalesce(sum(coalesce(cost_micro_usd, reserved_micro_usd)), 0)
    into v_global, v_user, v_spent
  from public.identity_ocr_usage
  where usage_date = v_today
    and status in ('reserved', 'settled')
    and not (status = 'reserved' and created_at < now() - interval '10 minutes');

  if v_global >= p_global_limit then
    raise exception 'IDENTITY_OCR_GLOBAL_LIMIT' using errcode = 'P0001';
  end if;
  if v_user >= p_user_limit then
    raise exception 'IDENTITY_OCR_USER_LIMIT' using errcode = 'P0001';
  end if;
  if v_spent + p_reserve_micro_usd > p_budget_micro_usd then
    raise exception 'IDENTITY_OCR_BUDGET' using errcode = 'P0001';
  end if;

  insert into public.identity_ocr_usage (usage_date, user_id, status, reserved_micro_usd)
  values (v_today, p_user_id, 'reserved', p_reserve_micro_usd)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.reserve_identity_ocr(uuid, integer, integer, bigint, bigint) from public, anon, authenticated;
grant execute on function public.reserve_identity_ocr(uuid, integer, integer, bigint, bigint) to service_role;

create or replace function public.settle_identity_ocr(
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
  update public.identity_ocr_usage
  set status = 'settled',
      cost_micro_usd = greatest(p_cost_micro_usd, 0),
      input_tokens = greatest(p_input_tokens, 0),
      output_tokens = greatest(p_output_tokens, 0),
      model = left(p_model, 100),
      settled_at = now()
  where id = p_id and status = 'reserved';
$$;
revoke all on function public.settle_identity_ocr(uuid, bigint, integer, integer, text) from public, anon, authenticated;
grant execute on function public.settle_identity_ocr(uuid, bigint, integer, integer, text) to service_role;

create or replace function public.release_identity_ocr(p_id uuid) returns void
language sql
security invoker
set search_path = ''
as $$
  update public.identity_ocr_usage
  set status = 'released', cost_micro_usd = 0, settled_at = now()
  where id = p_id and status = 'reserved';
$$;
revoke all on function public.release_identity_ocr(uuid) from public, anon, authenticated;
grant execute on function public.release_identity_ocr(uuid) to service_role;

commit;
