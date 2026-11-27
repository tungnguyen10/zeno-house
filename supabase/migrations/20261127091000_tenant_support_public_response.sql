-- Public staff replies use the existing support request lifecycle. No financial
-- or identity mutation is performed when replying or resolving a request.
begin;

alter table public.support_requests
  add column if not exists public_response text,
  add column if not exists responded_at timestamptz;

alter table public.support_requests
  add constraint support_requests_public_response_length_check
    check (public_response is null or char_length(btrim(public_response)) between 1 and 4000),
  add constraint support_requests_response_timestamp_check
    check ((public_response is null) = (responded_at is null));

-- The legacy direct INSERT safety policy must never let a tenant impersonate a
-- staff response. It remains combined with the current-housing ownership policy.
create policy support_requests_tenant_no_public_response
  on public.support_requests as restrictive
  for insert to authenticated
  with check (public_response is null and responded_at is null);

-- A reply-only edit needs a new version even within one transaction. The shared
-- now()-based trigger keeps the transaction timestamp, so use a monotonic value
-- for this table's optimistic concurrency token.
create function public.set_support_request_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end;
$$;
revoke all on function public.set_support_request_updated_at() from public, anon, authenticated;
grant execute on function public.set_support_request_updated_at() to service_role;
drop trigger support_requests_set_updated_at on public.support_requests;
create trigger support_requests_set_updated_at before update on public.support_requests
  for each row execute function public.set_support_request_updated_at();

-- Add the versioned overload while retaining the service-role-only four-argument
-- status RPC for server instances from the preceding release. That legacy RPC
-- changes status only; it cannot overwrite a public response. Remove its old
-- signature in a later migration after the application rollout is complete.
create function public.update_tenant_support_request_status_with_audit(
  p_request_id uuid,
  p_expected_status text,
  p_status text,
  p_actor_id uuid,
  p_expected_updated_at timestamptz,
  p_public_response text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_before public.support_requests%rowtype;
  v_after public.support_requests%rowtype;
  v_response text;
  v_response_changed boolean;
begin
  if p_request_id is null or p_actor_id is null or p_expected_updated_at is null
     or p_expected_status is null or p_expected_status not in ('new', 'in_progress', 'resolved')
     or p_status is null or p_status not in ('in_progress', 'resolved') then
    raise exception 'SUPPORT_REQUEST_STATUS_INPUT_INVALID' using errcode = '22023';
  end if;
  if p_public_response is not null and char_length(btrim(p_public_response)) not between 1 and 4000 then
    raise exception 'SUPPORT_REQUEST_RESPONSE_INVALID' using errcode = '22023';
  end if;

  select * into v_before from public.support_requests where id = p_request_id for update;
  if not found then
    raise exception 'SUPPORT_REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  v_response := case when p_public_response is null then v_before.public_response else btrim(p_public_response) end;
  v_response_changed := v_response is distinct from v_before.public_response;

  -- Replaying the same completed operation is safe; it must not emit another
  -- audit event or reset timestamps. A conflicting reply is never a no-op.
  if v_before.status = p_status and not v_response_changed then
    return pg_catalog.to_jsonb(v_before);
  end if;
  if v_before.status <> p_expected_status or v_before.updated_at is distinct from p_expected_updated_at then
    raise exception 'SUPPORT_REQUEST_STATUS_STALE' using errcode = 'P0001';
  end if;
  if v_before.status <> p_status
     and not ((v_before.status in ('new', 'resolved') and p_status = 'in_progress')
       or (v_before.status = 'in_progress' and p_status = 'resolved')) then
    raise exception 'SUPPORT_REQUEST_STATUS_TRANSITION_INVALID' using errcode = '22023';
  end if;

  update public.support_requests
  set status = p_status,
      public_response = v_response,
      responded_at = case when v_response_changed then clock_timestamp() else responded_at end
  where id = p_request_id returning * into v_after;

  insert into public.audit_events (
    building_id, building_name_snapshot, building_code_snapshot,
    actor_id, action, entity_type, entity_id, before_data, after_data, metadata
  ) values (
    v_before.building_id,
    (select name from public.buildings where id = v_before.building_id),
    (select code from public.buildings where id = v_before.building_id),
    p_actor_id, 'support_request.status_updated', 'support_request', v_before.id,
    pg_catalog.jsonb_build_object('status', v_before.status, 'has_response', v_before.public_response is not null),
    pg_catalog.jsonb_build_object('status', v_after.status, 'has_response', v_after.public_response is not null),
    pg_catalog.jsonb_build_object('tenant_id', v_before.tenant_id, 'contract_id', v_before.contract_id, 'response_changed', v_response_changed)
  );
  return pg_catalog.to_jsonb(v_after);
end;
$$;

revoke all on function public.update_tenant_support_request_status_with_audit(uuid,text,text,uuid,timestamptz,text)
  from public, anon, authenticated;
grant execute on function public.update_tenant_support_request_status_with_audit(uuid,text,text,uuid,timestamptz,text)
  to service_role;

notify pgrst, 'reload schema';
commit;

-- Deploy before the application and regenerate database.types.ts from cloud.
-- The previous application can run during rollout/rollback using its retained
-- status-only overload. Preserve public replies; never grant browser roles
-- direct access as a fallback. Remove the old overload only after rollout.
