-- Verification for contract_documents (V2 PR4b). Run as service_role; rolled back.
-- Builds a throwaway building + room + tenant + contract, then exercises the document state machine.
begin;

do $$
declare
  v_actor uuid := (select id from auth.users order by created_at limit 1);
  v_building uuid;
  v_room uuid;
  v_tenant uuid;
  v_contract uuid;
  v_res jsonb;
  v_doc public.contract_documents%rowtype;
  v_doc2 public.contract_documents%rowtype;
  v_amendment_doc public.contract_documents%rowtype;
  v_failed boolean;
  v_state text;
  v_snapshot jsonb := jsonb_build_object('verify', true);
begin
  if v_actor is null then raise exception 'VERIFY: need at least one auth.users row'; end if;

  v_res := public.create_building_with_rooms(
    jsonb_build_object(
      'slug', 'pr4b-verify-' || substr(gen_random_uuid()::text, 1, 8),
      'code', 'pr4b' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6),
      'name', 'PR4b verify', 'address', '1 Verify', 'status', 'active',
      'electricity_pricing_type', 'per_kwh', 'water_pricing_type', 'per_m3', 'grace_period_days', 0,
      'created_by', null, 'owner_user_id', null),
    jsonb_build_array(jsonb_build_object('room_number', 'R1', 'slug', 'r1', 'floor', 1, 'monthly_rent', 3000000, 'area', null)),
    null, v_actor, gen_random_uuid());
  v_building := (v_res->'building'->>'id')::uuid;
  v_room := (select id from public.rooms where building_id = v_building and room_number = 'R1');
  insert into public.tenants (code, full_name, phone, status)
  values ('pr4b-t1-' || substr(gen_random_uuid()::text, 1, 6), 'Khách 1', '0900000011', 'active') returning id into v_tenant;

  v_res := public.create_contract_full(
    jsonb_build_object(
      'room_id', v_room, 'tenant_id', v_tenant, 'building_id', v_building,
      'start_date', '2026-12-01', 'end_date', '2027-11-30', 'monthly_rent', 3000000,
      'deposit', 3000000, 'payment_due_day', 5, 'occupant_count', 1, 'status', 'active',
      'handover_electricity_reading', 10, 'handover_water_reading', 5,
      'handover_reading_date', '2026-12-01', 'recorded_by', v_actor),
    jsonb_build_array(jsonb_build_object('name', 'Giường', 'quantity', 1, 'condition', 'good', 'unit_value', 1000000, 'note', null)),
    '[]'::jsonb, '[]'::jsonb, null, v_actor, gen_random_uuid());
  v_contract := (v_res->>'contract_id')::uuid;

  -- Inventory is editable while no document is issued.
  update public.contract_inventory_items set quantity = 2 where contract_id = v_contract;

  -- 1. Reserve creates pending v1.
  v_doc := public.reserve_contract_document(v_contract, 'contract', null, 'hop-dong-thue-phong', 1, v_snapshot, '2026-12-01', v_actor, null, null);
  if v_doc.status <> 'pending' or v_doc.version_no <> 1 then raise exception 'VERIFY 1 failed: reserve'; end if;

  -- 2. Unique-active: second reserve without replaces is rejected while pending exists.
  v_failed := false;
  begin perform public.reserve_contract_document(v_contract, 'contract', null, 'hop-dong-thue-phong', 1, v_snapshot, '2026-12-01', v_actor, null, null);
  exception when others then v_failed := sqlerrm = 'CONTRACT_DOCUMENT_ACTIVE_EXISTS'; end;
  if not v_failed then raise exception 'VERIFY 2 failed: unique-active (pending)'; end if;

  -- 3. Pending cannot jump to signed; mark_signed requires issued.
  v_failed := false;
  begin perform public.mark_contract_document_signed(v_doc.id, v_actor);
  exception when others then v_failed := sqlerrm = 'CONTRACT_DOCUMENT_STATE_INVALID'; end;
  if not v_failed then raise exception 'VERIFY 3 failed: pending -> signed allowed'; end if;
  v_failed := false;
  begin update public.contract_documents set status = 'signed' where id = v_doc.id;
  exception when others then v_failed := sqlerrm = 'CONTRACT_DOCUMENT_IMMUTABLE'; end;
  if not v_failed then raise exception 'VERIFY 3 failed: guard allowed pending -> signed'; end if;

  -- 4. claim_stale returns pending rows older than the interval (negative interval = everything).
  if not exists (select 1 from public.claim_stale_contract_documents(interval '-1 second') where id = v_doc.id) then
    raise exception 'VERIFY 4 failed: claim_stale did not return the pending row';
  end if;
  if exists (select 1 from public.claim_stale_contract_documents(interval '1 day') where id = v_doc.id) then
    raise exception 'VERIFY 4 failed: claim_stale returned a fresh row';
  end if;

  -- 5. Fail keeps the snapshot, and the failed row still blocks a second active document.
  v_doc := public.fail_contract_document(v_doc.id, 'UPLOAD_FAILED');
  if v_doc.status <> 'failed' or v_doc.snapshot is distinct from v_snapshot then raise exception 'VERIFY 5 failed: fail'; end if;
  v_failed := false;
  begin perform public.reserve_contract_document(v_contract, 'contract', null, 'hop-dong-thue-phong', 1, v_snapshot, '2026-12-01', v_actor, null, null);
  exception when others then v_failed := sqlerrm = 'CONTRACT_DOCUMENT_ACTIVE_EXISTS'; end;
  if not v_failed then raise exception 'VERIFY 5 failed: unique-active (failed)'; end if;

  -- 6. Finalize from failed (regenerate) -> issued, with storage fields.
  v_doc := public.finalize_contract_document(v_doc.id, 'c/' || v_contract::text || '/v1.docx', repeat('a', 64), 1234, v_actor);
  if v_doc.status <> 'issued' or v_doc.issued_at is null or v_doc.last_error_code is not null then raise exception 'VERIFY 6 failed: finalize'; end if;
  v_failed := false;
  begin perform public.finalize_contract_document(v_doc.id, 'x', repeat('b', 64), 1, v_actor);
  exception when others then v_failed := sqlerrm = 'CONTRACT_DOCUMENT_STATE_INVALID'; end;
  if not v_failed then raise exception 'VERIFY 6 failed: double finalize'; end if;

  -- 7. Immutability: snapshot, storage fields, delete are all rejected once issued.
  v_failed := false;
  begin update public.contract_documents set snapshot = '{}'::jsonb where id = v_doc.id;
  exception when others then v_failed := sqlerrm = 'CONTRACT_DOCUMENT_IMMUTABLE'; end;
  if not v_failed then raise exception 'VERIFY 7 failed: snapshot mutable'; end if;
  v_failed := false;
  begin update public.contract_documents set sha256 = repeat('c', 64) where id = v_doc.id;
  exception when others then v_failed := sqlerrm = 'CONTRACT_DOCUMENT_IMMUTABLE'; end;
  if not v_failed then raise exception 'VERIFY 7 failed: sha256 mutable after issue'; end if;
  v_failed := false;
  begin delete from public.contract_documents where id = v_doc.id;
  exception when others then v_failed := sqlerrm = 'CONTRACT_DOCUMENT_IMMUTABLE'; end;
  if not v_failed then raise exception 'VERIFY 7 failed: delete allowed'; end if;

  -- 8. Handover inventory is locked once an issued/signed contract document exists.
  v_failed := false;
  begin update public.contract_inventory_items set quantity = 3 where contract_id = v_contract;
  exception when others then v_failed := sqlerrm = 'CONTRACT_INVENTORY_LOCKED'; end;
  if not v_failed then raise exception 'VERIFY 8 failed: inventory update not locked'; end if;
  v_failed := false;
  begin insert into public.contract_inventory_items (contract_id, name, quantity, condition, sort_order) values (v_contract, 'Tủ', 1, 'good', 9);
  exception when others then v_failed := sqlerrm = 'CONTRACT_INVENTORY_LOCKED'; end;
  if not v_failed then raise exception 'VERIFY 8 failed: inventory insert not locked'; end if;
  v_failed := false;
  begin delete from public.contract_inventory_items where contract_id = v_contract;
  exception when others then v_failed := sqlerrm = 'CONTRACT_INVENTORY_LOCKED'; end;
  if not v_failed then raise exception 'VERIFY 8 failed: inventory delete not locked'; end if;

  -- 9. Sign, then voiding needs a reason of at least 10 characters.
  v_doc := public.mark_contract_document_signed(v_doc.id, v_actor);
  if v_doc.status <> 'signed' or v_doc.signed_at is null then raise exception 'VERIFY 9 failed: sign'; end if;
  v_failed := false;
  begin perform public.void_contract_document(v_doc.id, 'ngắn', v_actor);
  exception when others then v_failed := sqlerrm = 'CONTRACT_DOCUMENT_REASON_REQUIRED'; end;
  if not v_failed then raise exception 'VERIFY 9 failed: short reason accepted'; end if;

  -- 10. Replace: reserve with replaces_document_id voids the old row and creates v2.
  v_failed := false;
  begin perform public.reserve_contract_document(v_contract, 'contract', null, 'hop-dong-thue-phong', 1, v_snapshot, '2026-12-01', v_actor, gen_random_uuid(), 'Lý do thay thế dài');
  exception when others then v_failed := sqlerrm = 'CONTRACT_DOCUMENT_ACTIVE_EXISTS'; end;
  if not v_failed then raise exception 'VERIFY 10 failed: wrong replaces id accepted'; end if;
  v_doc2 := public.reserve_contract_document(v_contract, 'contract', null, 'hop-dong-thue-phong', 1, v_snapshot, '2026-12-01', v_actor, v_doc.id, 'Lý do thay thế dài');
  if v_doc2.version_no <> 2 or v_doc2.status <> 'pending' or v_doc2.replaces_document_id <> v_doc.id then raise exception 'VERIFY 10 failed: replace v2'; end if;
  select status into v_state from public.contract_documents where id = v_doc.id;
  if v_state <> 'voided' then raise exception 'VERIFY 10 failed: old document not voided (%)', v_state; end if;
  if (select void_reason from public.contract_documents where id = v_doc.id) <> 'Lý do thay thế dài' then raise exception 'VERIFY 10 failed: void reason'; end if;

  -- 11. A voided document can never be revived.
  v_failed := false;
  begin update public.contract_documents set status = 'issued' where id = v_doc.id;
  exception when others then v_failed := sqlerrm = 'CONTRACT_DOCUMENT_IMMUTABLE'; end;
  if not v_failed then raise exception 'VERIFY 11 failed: voided revived'; end if;

  -- 12. Issued v2 -> void with reason -> inventory unlocks again (no issued/signed contract document).
  v_doc2 := public.finalize_contract_document(v_doc2.id, 'c/' || v_contract::text || '/v2.docx', repeat('d', 64), 999, v_actor);
  v_doc2 := public.void_contract_document(v_doc2.id, 'Hủy để phát hành lại', v_actor);
  if v_doc2.status <> 'voided' then raise exception 'VERIFY 12 failed: void'; end if;
  update public.contract_inventory_items set quantity = 4 where contract_id = v_contract;

  -- 13. Appendix documents are tracked separately from the contract document, and need an amendment.
  v_failed := false;
  begin insert into public.contract_documents (contract_id, building_id, type, amendment_id, version_no, template_key, template_version, snapshot, signed_date)
    values (v_contract, v_building, 'appendix', null, 1, 'phu-luc-hop-dong', 1, v_snapshot, '2026-12-01');
  exception when check_violation then v_failed := true; end;
  if not v_failed then raise exception 'VERIFY 13 failed: appendix without amendment accepted'; end if;

  -- 14. FK on delete restrict: a contract with documents cannot be hard-deleted.
  v_failed := false;
  begin delete from public.contracts where id = v_contract;
  exception when foreign_key_violation then v_failed := true; end;
  if not v_failed then raise exception 'VERIFY 14 failed: contract with documents deleted'; end if;

  raise notice 'contract_documents verification passed';
end $$;

-- 15. Grants.
select p.proname,
       has_function_privilege('anon', p.oid, 'execute') as anon_exec,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_exec,
       has_function_privilege('service_role', p.oid, 'execute') as service_exec
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('reserve_contract_document', 'finalize_contract_document', 'fail_contract_document',
                    'mark_contract_document_signed', 'void_contract_document', 'claim_stale_contract_documents')
order by p.proname;
-- Expected: anon=false, authenticated=false, service_role=true for all six.

select
  has_table_privilege('anon', 'public.contract_documents', 'select') as anon_select,
  has_table_privilege('authenticated', 'public.contract_documents', 'select') as auth_select,
  has_table_privilege('service_role', 'public.contract_documents', 'select') as service_select;
-- Expected: false, false, true.

-- 16. Bucket is private.
select id, public, file_size_limit from storage.buckets where id = 'contract-documents';
-- Expected: public=false.

rollback;
