begin;

-- Tenant identity conflict limit: reuses the AI bucket table with a dedicated scope.
alter table public.ai_rate_limit_buckets
  drop constraint if exists ai_rate_limit_buckets_scope_check;
alter table public.ai_rate_limit_buckets
  add constraint ai_rate_limit_buckets_scope_check
  check (scope in ('chat', 'action', 'tenant_identity_conflict'));

create or replace function public.peek_tenant_identity_conflict_limit(
  p_subject_hash   text,
  p_limit          integer,
  p_window_seconds integer,
  p_now            timestamptz default clock_timestamp()
)
returns table(allowed boolean, retry_after_seconds integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_window_started timestamptz;
  v_window_ends    timestamptz;
  v_count          integer;
begin
  if length(coalesce(p_subject_hash, '')) <> 64 or p_limit is null or p_limit < 1
     or p_window_seconds is null or p_window_seconds < 1 or p_now is null then
    raise exception 'TENANT_CONFLICT_LIMIT_INPUT_INVALID' using errcode = 'P0001';
  end if;
  v_window_started := pg_catalog.to_timestamp(
    pg_catalog.floor(extract(epoch from p_now) / p_window_seconds) * p_window_seconds
  );
  v_window_ends := v_window_started + pg_catalog.make_interval(secs => p_window_seconds);
  select bucket.request_count into v_count
  from public.ai_rate_limit_buckets bucket
  where bucket.subject_hash = p_subject_hash
    and bucket.scope = 'tenant_identity_conflict'
    and bucket.window_started = v_window_started;
  return query select
    coalesce(v_count, 0) < p_limit,
    greatest(pg_catalog.ceil(extract(epoch from (v_window_ends - p_now)))::integer, 1);
end;
$$;

create or replace function public.record_tenant_identity_conflicts(
  p_subject_hash   text,
  p_units          integer,
  p_window_seconds integer,
  p_now            timestamptz default clock_timestamp()
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_window_started timestamptz;
  v_window_ends    timestamptz;
begin
  if length(coalesce(p_subject_hash, '')) <> 64 or p_units is null or p_units < 1
     or p_window_seconds is null or p_window_seconds < 1 or p_now is null then
    raise exception 'TENANT_CONFLICT_LIMIT_INPUT_INVALID' using errcode = 'P0001';
  end if;
  v_window_started := pg_catalog.to_timestamp(
    pg_catalog.floor(extract(epoch from p_now) / p_window_seconds) * p_window_seconds
  );
  v_window_ends := v_window_started + pg_catalog.make_interval(secs => p_window_seconds);
  insert into public.ai_rate_limit_buckets (subject_hash, scope, window_started, request_count, expires_at)
  values (p_subject_hash, 'tenant_identity_conflict', v_window_started, p_units, v_window_ends + interval '1 day')
  on conflict (subject_hash, scope, window_started) do update
    set request_count = public.ai_rate_limit_buckets.request_count + p_units,
        expires_at = excluded.expires_at;
end;
$$;

revoke all on function public.peek_tenant_identity_conflict_limit(text, integer, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.peek_tenant_identity_conflict_limit(text, integer, integer, timestamptz)
  to service_role;
revoke all on function public.record_tenant_identity_conflicts(text, integer, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.record_tenant_identity_conflicts(text, integer, integer, timestamptz)
  to service_role;

commit;

-- Rollback:
-- drop function if exists public.record_tenant_identity_conflicts(text, integer, integer, timestamptz);
-- drop function if exists public.peek_tenant_identity_conflict_limit(text, integer, integer, timestamptz);
-- delete from public.ai_rate_limit_buckets where scope = 'tenant_identity_conflict';
-- alter table public.ai_rate_limit_buckets drop constraint ai_rate_limit_buckets_scope_check;
-- alter table public.ai_rate_limit_buckets add constraint ai_rate_limit_buckets_scope_check check (scope in ('chat', 'action'));
