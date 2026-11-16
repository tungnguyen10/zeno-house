-- Restrict portal edits and close direct read/canonical-image bypasses.
-- Apply only after catalog preflight; server-role reads and unrelated document writes remain.
begin;

revoke select on public.tenants from public, anon, authenticated;
revoke select on public.support_requests from public, anon, authenticated;

-- A table-level REVOKE does not remove previous column-level SELECT grants.
do $$
declare
  v_table text;
  v_columns text;
begin
  foreach v_table in array array['tenants', 'support_requests'] loop
    select pg_catalog.string_agg(pg_catalog.format('%I', attname), ', ' order by attnum)
      into v_columns
    from pg_catalog.pg_attribute
    where attrelid = pg_catalog.to_regclass('public.' || v_table)
      and attnum > 0 and not attisdropped;
    execute pg_catalog.format('revoke select (%s) on public.%I from public, anon, authenticated', v_columns, v_table);
  end loop;
end;
$$;
grant select on public.tenants to service_role;
grant select on public.support_requests to service_role;

drop policy if exists tenant_id_images_self_insert on storage.objects;
drop policy if exists tenant_id_images_self_delete on storage.objects;

-- Preserve primary/roommate ownership/date checks and bounded text while restoring
-- the request attachment-prefix guard to the latest policy definition.
drop policy if exists support_requests_tenant_insert_own on public.support_requests;
create policy support_requests_tenant_insert_own
  on public.support_requests
  for insert to authenticated
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'tenant'
    and status = 'new'
    and (attachment_path is null or (
      split_part(attachment_path, '/', 1) = support_requests.tenant_id::text
      and split_part(attachment_path, '/', 2) = 'requests'
      and split_part(attachment_path, '/', 3) <> ''
      and split_part(attachment_path, '/', 4) = ''
    ))
    and char_length(btrim(title)) between 1 and 200
    and char_length(btrim(description)) between 1 and 5000
    and exists (
      select 1
      from public.tenant_user_links link
      where link.auth_user_id = (select auth.uid())
        and link.status = 'active'
        and link.tenant_id = support_requests.tenant_id
        and exists (
          select 1
          from public.contracts contract
          where contract.id = support_requests.contract_id
            and contract.building_id = support_requests.building_id
            and contract.status = 'active'
            and contract.start_date <= (now() at time zone 'Asia/Ho_Chi_Minh')::date
            and contract.end_date >= (now() at time zone 'Asia/Ho_Chi_Minh')::date
            and (
              contract.tenant_id = link.tenant_id
              or exists (
                select 1
                from public.contract_occupants occupant
                where occupant.contract_id = contract.id
                  and occupant.tenant_id = link.tenant_id
                  and occupant.move_in_date <= (now() at time zone 'Asia/Ho_Chi_Minh')::date
                  and occupant.move_out_date is null
              )
            )
        )
    )
  );


create or replace function public.update_tenant_support_request_status_with_audit(
  p_request_id uuid,
  p_expected_status text,
  p_status text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_before public.support_requests%rowtype;
  v_after public.support_requests%rowtype;
begin
  if p_request_id is null or p_actor_id is null
     or p_expected_status is null or p_expected_status not in ('new', 'in_progress', 'resolved')
     or p_status is null or p_status not in ('in_progress', 'resolved') then
    raise exception 'SUPPORT_REQUEST_STATUS_INPUT_INVALID' using errcode = '22023';
  end if;
  select * into v_before from public.support_requests where id = p_request_id for update;
  if not found then
    raise exception 'SUPPORT_REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  -- Duplicate delivery is idempotent, even if its original expected status is old.
  if v_before.status = p_status then
    return pg_catalog.to_jsonb(v_before);
  end if;
  if v_before.status <> p_expected_status then
    raise exception 'SUPPORT_REQUEST_STATUS_STALE' using errcode = 'P0001';
  end if;
  if not ((v_before.status in ('new', 'resolved') and p_status = 'in_progress')
       or (v_before.status = 'in_progress' and p_status = 'resolved')) then
    raise exception 'SUPPORT_REQUEST_STATUS_TRANSITION_INVALID' using errcode = '22023';
  end if;

  update public.support_requests set status = p_status where id = p_request_id returning * into v_after;
  insert into public.audit_events (
    building_id, building_name_snapshot, building_code_snapshot,
    actor_id, action, entity_type, entity_id, before_data, after_data, metadata
  ) values (
    v_before.building_id,
    (select name from public.buildings where id = v_before.building_id),
    (select code from public.buildings where id = v_before.building_id),
    p_actor_id, 'support_request.status_updated', 'support_request', v_before.id,
    pg_catalog.jsonb_build_object('status', v_before.status),
    pg_catalog.jsonb_build_object('status', v_after.status),
    pg_catalog.jsonb_build_object('tenant_id', v_before.tenant_id, 'contract_id', v_before.contract_id)
  );
  return pg_catalog.to_jsonb(v_after);
end;
$$;
revoke all on function public.update_tenant_support_request_status_with_audit(uuid,text,text,uuid)
  from public, anon, authenticated;
grant execute on function public.update_tenant_support_request_status_with_audit(uuid,text,text,uuid)
  to service_role;

notify pgrst, 'reload schema';
commit;

-- Rollback requires an explicit reviewed grant/policy restoration; never restore
-- tenant canonical writes automatically. No existing profile/file is modified.
