## Context

Contracts là domain phức tạp nhất: 4-state machine (`active|expired|terminated|renewed`), atomic create-with-handover qua RPC, room status coupling (active contract làm room `occupied`), sub-resources phong phú (occupants, payments, renewals, services), wizard create 3 bước. UX hiện đã có building filter + status filter + tabs detail, nhưng list query không validate Zod, không có search/sort, form lớn render phẳng, DELETE hard-delete có thể bể billing history (issued periods, paid payments, meter readings nằm ngoài handover). Zero tests. Reference design buildings-overhaul; ba khác biệt domain quan trọng:

1. **Không cần status mới** — `terminated` đã đóng vai trò "archived" sẵn. Soft-delete = ensure status `terminated` rồi cleanup safe-deletable child records.
2. **Create là wizard 3 bước**, không đơn giản như 1-form CRUD; cần giữ wizard nhưng polish bước-progress + dirty guard cho cả wizard.
3. **Conflict matrix nhiều layer**: billing periods đã issue + paid payments + non-handover meter readings — phải check tất cả trước delete.

Stack constraints không đổi.

## Goals / Non-Goals

**Goals:**
- Pattern UX nhất quán với buildings/rooms/tenants overhaul.
- DELETE an toàn tuyệt đối: không bao giờ làm orphan billing/payment/meter readings.
- List API Zod validation + search/sort/multi-status filter + URL-shareable.
- Form edit có sections, sticky save, dirty guard, draft autosave; form create wizard có progress indicator + dirty guard cho cả 3 bước.
- Test baseline đầy đủ — đặc biệt cover conflict matrix.

**Non-Goals:**
- KHÔNG đổi state machine (active → expired/terminated/renewed, renew flow, terminate side effects, room status coupling).
- KHÔNG đổi atomic `createWithHandover` RPC.
- KHÔNG đổi sub-resource API surface (`/contracts/:id/occupants|payments|renewals`); chỉ polish parent endpoints.
- KHÔNG thêm status mới (như `draft`) — tách change riêng nếu cần.
- KHÔNG đổi contract code generation.
- KHÔNG động billing logic, meter readings logic, dashboard.

## Decisions

### D1. Không thêm status mới — dùng `terminated` cho soft-archive semantics

**Chọn**: Khi `?force=true`:
- Nếu contract `active`: trước hết gọi service `terminate` (set `terminated`, release room, release tenant) — reuse logic hiện có.
- Sau khi terminated: thử cascade-clean child records không phá history: occupants không có move_out_date thì set move_out_date, contract_services giữ nguyên (history), pending payments không có gì xoá thêm.
- Không xoá row contract (giữ historical reference cho billing periods).

**Lý do**: Domain semantics rõ — `terminated` đã là "archived" trong domain ngôn ngữ này. Thêm status mới (`archived`) sẽ làm bể UI hiện có (badge, filter) và lệch nghĩa nghiệp vụ. Hard-delete chỉ được phép khi contract chưa từng phát sinh data (chưa active, chưa billing).

**Alternative bỏ**:
- Thêm `'archived'` status — lệch domain, hỏng filter hiện có.
- Cột `archived_at` riêng — overlap với `terminated_at` đã có.

### D2. URL-synced list state qua `useRoute().query` (không Pinia)

**Chọn**: Cùng D2 rooms / D1 buildings. Refs `q`, `status[]`, `sort`, `order`, `page`, `building_id`, `room_id`, `tenant_id`.

### D3. Safe-delete với conflict matrix nhiều layer

**Chọn**: `DELETE /api/contracts/:id` flow:
1. Load contract.
2. Nếu `status='active'`: 409 CONFLICT `{ reason: 'ACTIVE_CONTRACT', message: 'Phải kết thúc hợp đồng trước khi xoá' }` (admin phải gọi PATCH `status=terminated` hoặc dùng `?force=true`).
3. Nếu có billing_periods.contracts chứa id: 409 `{ issuedBillingPeriods: number }`.
4. Nếu có invoices status `paid` hoặc `partial`: 409 `{ paidPayments: number }`.
5. Nếu có meter_readings không phải `handover_in`/`handover_out`: 409 `{ nonHandoverMeterReadings: number }`.
6. Pass tất cả → cascade delete sub-resources (occupants, payments, renewals, contract_services, handover readings) → delete contract row.

`?force=true` (admin only):
- Skip check (1) — nếu active, terminate trước.
- Vẫn enforce check (2), (3), (4) — không bao giờ xoá khi có billing/payment history.
- Vẫn enforce (5) — meter readings ngoài handover phải clear thủ công trước (link tới meter workspace).

**Lý do**: Billing/meter history immutable. Wreck billing là bug nghiêm trọng. Force chỉ giúp skip "phải terminate trước" — không skip data integrity.

### D4. Bulk operations qua single endpoint `POST /api/contracts/bulk`

**Chọn**: `{ action: 'terminate'|'delete', ids, reason? }` → `{ succeeded, failed }`. `terminate` áp dụng cùng side effects với single endpoint; `delete` áp dụng cùng safe-check.

**Lý do**: Cùng pattern. Không thêm `activate` (contract chuyển từ terminated/expired về active là edge case + nguy hiểm — vẫn cho qua single PATCH).

### D5. Form create giữ wizard 3-step nhưng polish progress + dirty guard

**Chọn**: Component `ContractWizardSteps` hiển thị 3 step (Hợp đồng → Khách ở cùng → Dịch vụ) với current step highlight. Step nav chỉ cho phép forward sau khi step trước valid; cho phép back tự do. Dirty guard activate khi form dirty ở bất kỳ step nào — confirm leave nếu chưa hoàn thành.

**Lý do**: Wizard hiện đã hoạt động (stateless reactive visibility) nhưng UX kém — không có progress indicator. Refactor để rõ ràng nhưng giữ logic.

**Alternative bỏ**:
- Bỏ wizard, single long form — UX tệ vì có 3 phụ thuộc tuần tự (cần contract id để add occupant/service).
- Server-side draft contract — overkill, không cần persist tới server.

### D6. Form edit refactor thành sections (không wizard)

**Chọn**: 4 sections numbered card:
1. **Quan hệ**: room + tenant (readonly khi `status='active'` để tránh phá room coupling).
2. **Thời hạn & Giá**: start_date, end_date, payment_day, monthly_rent, deposit.
3. **Điều khoản**: occupant_count, discounts[], surcharges[].
4. **Trạng thái & Ghi chú**: status (giới hạn transitions hợp lệ theo state machine), notes.

**Lý do**: Edit khác create — không thêm sub-resources, chỉ sửa scalar. Sections giúp scan ~20 field dễ hơn.

### D7. Form draft autosave per-key

**Chọn**: Key `contract-form:create` (wizard state bao gồm currentStep + pending occupants + selected services) và `contract-form:edit:<id>`. Debounce 500ms. Restore alert đầu form.

**Lý do**: Wizard 3-bước dễ mất data khi reload. Cần persist cả 3 step + chosen occupants/services.

### D8. Search `q` với join

**Chọn**: Repository search build query `contract_code.ilike.%q% OR contracts.tenants(full_name.ilike) OR contracts.rooms(room_number.ilike)`. Supabase support nested filter qua `.or()` + foreign-table syntax `tenants.full_name.ilike.*`.

**Lý do**: User type tên tenant hoặc số phòng quen thuộc hơn contract code; phải search xuyên FK.

**Alternative bỏ**:
- Full-text search index — overkill cho scale hiện tại.
- Search chỉ trên contract_code — UX kém.

### D9. Filter `status` multi-value

**Chọn**: `?status=active&status=expired`. Default repository không filter (trả tất cả status — khác với buildings/rooms vì contract `terminated` cũng cần thấy trong list).

**Lý do**: Contract list cần thấy `terminated`/`expired` để xem history. UI mặc định có thể chip `active` selected nhưng URL-empty = all.

### D10. Section UI: numbered card + border-top accent

**Chọn**: Cùng pattern.

### D11. Tests: Vitest + Vue Test Utils + Nitro test utils

**Chọn**: Cùng pattern. Conflict matrix tests dùng table-driven (parametrize từng case).

## Risks / Trade-offs

[**Risk**: Hard-delete với cascade vẫn có thể bể nếu thiếu một bảng reference chưa nghĩ tới] → Mitigation: Liệt kê đầy đủ trong service, test cover cho từng case, integration test với fixture đầy đủ. Document trong spec.

[**Risk**: `?force=true` terminate-then-delete không atomic — terminate thành công nhưng delete fail (data leftover)] → Mitigation: Service wrap trong transaction (Supabase RPC nếu cần); document rằng partial state (terminated nhưng còn) là acceptable fallback.

[**Risk**: Wizard draft state phức tạp (multi-step + pending arrays), restore có thể mismatch nếu code/schema đổi sau khi save draft] → Mitigation: Lưu version key trong draft (`draftVersion: 1`); khi mismatch hiện alert "Bản nháp cũ không tương thích, xoá?" + button Xoá draft.

[**Risk**: Search join làm query chậm khi scale lớn] → Mitigation: Scale hiện vài trăm contracts max — ilike + nested join OK. Khi scale lớn cần index `contract_code`, `tenants.full_name`, `rooms.room_number`.

[**Risk**: Bulk terminate gọi N lần service `terminate` (mỗi cái có side effects: room release, tenant release) — chậm + non-atomic] → Mitigation: Document trong spec; UI hiển thị progress. Tách change riêng nếu cần atomic transaction.

[**Risk**: Form edit cho phép sửa room/tenant khi contract `expired`/`terminated` có thể phá historical record] → Mitigation: Quyết: lock room/tenant readonly cho TẤT CẢ status không phải `draft` (mà draft chưa có); luôn readonly sau create.

## Migration Plan

Không có DB migration. Triển khai theo thứ tự:

1. **Validators** — `contractListQuerySchema`, `contractBulkActionSchema`.
2. **Server (repository + service + API)** — Zod validation list, search/sort, safe-delete conflict matrix, bulk endpoint, soft-delete via terminate.
3. **Composable** — mở rộng `useContractList` (URL sync, search, sort), `useContractForm` (dirty + draft + wizard), thêm `useContractBulkActions`.
4. **Components mới + update** — `ContractListToolbar`, `ContractDetailHero`, `ContractBulkActionsBar`, `ContractWizardSteps`; refactor `ContractForm` sections.
5. **Pages** — refactor list/detail/create wizard/edit.
6. **Tests** — viết song song với conflict matrix.

Rollback: revert merge commit. Không có data migration.

## Open Questions

- Có cần thêm "draft" status để giữ contract chưa active nhưng đã lưu một phần (thay localStorage)? → Quyết: KHÔNG ở change này. Tách thành change riêng nếu user demand.
- Có cho phép bulk renew không? → Quyết: KHÔNG. Renew quá phức tạp (rent change per contract, end date riêng). Giữ single-action.
- Dirty guard cho wizard step nav: confirm khi user nhảy back từ step 3 về step 1 có làm phiền không? → Quyết: chỉ confirm khi rời route, không confirm khi back step trong wizard.
