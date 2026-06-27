## Context

Tenants domain ở v0.2: có CRUD, search, building filter, contract-state filter, enrichment fields (6 cột thêm), tenant code slug. Nhưng query không validate Zod, không sort, không URL-sync, form phẳng 13 field, DELETE hard-delete không safe (có thể xoá tenant đang có active contract), route edit chưa tồn tại, zero tests. Reference design đã chứng minh trong `buildings-overhaul` archive. Hai khác biệt domain so với buildings:
1. Tenants table **không có** status column → cần thêm `tenants.status` enum (`active`/`archived`) qua migration.
2. Conflict surface của delete: active contracts (primary tenant) + active occupants (occupant đang ở phòng).

Stack constraints không đổi.

## Goals / Non-Goals

**Goals:**
- Pattern UX nhất quán với buildings/rooms overhaul.
- DELETE an toàn: không bao giờ làm orphan contract đang chạy hoặc occupant đang ở.
- List API có Zod validation đầy đủ + sort/order + URL-shareable.
- Test baseline đầy đủ (bootstrap từ chỉ-có-repository.test.ts stub).
- Route edit `/tenants/[code]/edit` đã có sẵn (detail page có nút trỏ tới).

**Non-Goals:**
- Không động tenant code generation (`buildUniqueTenantCode`).
- Không động enrichment fields đã thêm.
- Không động building filter logic (đã ổn từ change archive 2026-06-14).
- Không thêm portal tenant (vẫn admin shell).
- Không thêm cột mới ngoài `status` (giữ schema gọn).

## Decisions

### D1. Thêm cột `tenants.status` (active/archived) thay vì dùng contract relationship

**Chọn**: Migration `ALTER TABLE tenants ADD COLUMN status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived'))`. Backfill `'active'` cho rows hiện có (tự động qua DEFAULT).

**Lý do**: Tenants cần "archived" khái niệm độc lập với contract — một tenant có thể đã end hết contract nhưng vẫn `active` (có thể quay lại); hoặc admin chủ động archive (đã chuyển đi vĩnh viễn, không xoá để giữ history). Dùng contract relationship để xác định trạng thái tenant sẽ bị nhập nhằng với `contract_state` filter (with_contract/without_contract) hiện có.

**Alternative bỏ**:
- Dùng `contract_state='without_contract'` làm "archived" — nhập nhằng semantics, không cho phép admin chủ động archive tenant đang còn contract (edge case nhưng có).
- Soft-delete `deleted_at timestamp` — tăng surface mọi query phải filter.

### D2. URL-synced list state qua `useRoute().query` (không Pinia)

**Chọn**: Cùng D2 của rooms-overhaul / D1 của buildings-overhaul.

### D3. Safe-delete dùng cùng endpoint với query param `force`

**Chọn**: `DELETE /api/tenants/:id`:
- Mặc định check: count active contracts (primary tenant, status `active`) + count active occupants (`contract_occupants` với `move_out_date IS NULL`) → 409 CONFLICT với `{ activeContracts, activeOccupancies }` nếu > 0.
- `?force=true` (admin only): soft-archive (set `status='archived'`).

**Lý do**: Cùng pattern buildings/rooms. Active occupants check quan trọng — tenant có thể không là primary contract holder nhưng đang ở phòng làm roommate.

### D4. Bulk operations qua single endpoint `POST /api/tenants/bulk`

**Chọn**: 1 endpoint `{ action: 'archive'|'activate'|'delete', ids }` → `{ succeeded, failed }`.

### D5. Form draft autosave dùng `localStorage` per-key

**Chọn**: Key `tenant-form:create` hoặc `tenant-form:edit:<id>`. Debounce 500ms.

### D6. Dirty-state guard bằng `onBeforeRouteLeave` + `beforeunload`

**Chọn**: Cùng pattern.

### D7. Search dùng PostgreSQL `ilike` trên nhiều cột

**Chọn**: Repository search build `full_name.ilike OR phone.ilike OR email.ilike OR id_number.ilike OR code.ilike`. Đã có một phần (`q` param) — mở rộng thêm `code`.

**Lý do**: Tenants table scale vài nghìn rows max — ilike đủ.

### D8. Filter `status` multi-value (mặc định ẩn `archived`)

**Chọn**: `?status=active&status=archived`. Default repository exclude `archived` khi không có filter. Cùng pattern buildings/rooms.

### D9. Section UI: numbered card + border-top accent

**Chọn**: Cùng pattern.

### D10. Form section split cho TenantForm

**Chọn**: 4 sections:
1. **Thông tin cá nhân**: `full_name`, `phone`, `email`, `date_of_birth`, `gender`, `occupation` — thông tin xác định người.
2. **Giấy tờ tuỳ thân**: `id_number`, `id_issued_date`, `id_issued_place` — group ID document.
3. **Liên hệ khẩn cấp & Địa chỉ**: `emergency_contact_name`, `emergency_contact_phone`, `permanent_address` — group liên hệ phụ.
4. **Ghi chú**: `notes` — free text.

**Lý do**: Group theo intent, scan nhanh, mobile-friendly.

### D11. Route `/tenants/[code]/edit` mới

**Chọn**: Tạo route file `app/pages/tenants/[code]/edit.vue` dùng cùng `TenantForm` với `submitUpdate`. Detail page hiện đã có nút trỏ tới (broken link) → fix.

### D12. Tests: Vitest + Vue Test Utils + Nitro test utils

**Chọn**: Cùng pattern.

## Risks / Trade-offs

[**Risk**: Migration thêm column `status` cần ALTER TABLE — production downtime nhỏ] → Mitigation: `ADD COLUMN ... DEFAULT 'active'` trên Postgres 11+ là instant (không rewrite table); chấp nhận khoá metadata <1s.

[**Risk**: Default exclude `status='archived'` làm building filter count sai khi xem "tổng khách hàng từng thuê building"] → Mitigation: Building filter logic không count tenant table trực tiếp — đi qua contracts/occupants. Không impact.

[**Risk**: Soft-archived tenant vẫn xuất hiện trong contract detail/occupant list (đúng — cần history)] → Mitigation: Document trong spec — archive chỉ ẩn khỏi list page và prevent assign mới, không xoá refs lịch sử.

[**Risk**: Hard-delete tenant với contract chỉ có `expired`/`terminated` status (không active) hiện vẫn cho phép — sẽ orphan contract history nếu FK không CASCADE] → Mitigation: Check schema FK `contracts.tenant_id` — nếu CASCADE thì sẽ mất contract; nếu RESTRICT thì DELETE sẽ fail. Quyết: assume RESTRICT (an toàn hơn) và document — admin phải dùng `?force=true` để soft-archive thay vì hard-delete khi có lịch sử contract.

[**Risk**: Bulk delete partial fail làm UI khó hiểu] → Mitigation: Response per-item + UI summary toast + chi tiết modal.

[**Risk**: Backward-compat DELETE đổi behavior — chưa có client cũ ngoài repo] → Mitigation: Update đồng thời trong cùng PR.

## Migration Plan

1. **DB migration** — `ADD COLUMN status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived'))` trên `tenants`.
2. **Server** — thêm Zod query schema, sort, safe-delete, bulk endpoint, soft-archive.
3. **Composable** — mở rộng `useTenantList` (URL sync + sort), `useTenantForm` (dirty + draft), thêm `useTenantBulkActions`.
4. **Components mới + update** — `TenantListToolbar`, `TenantDetailHero`, `TenantBulkActionsBar`; refactor `TenantForm` sections; tenant row selection mode.
5. **Pages** — refactor list/detail/create; thêm edit route.
6. **Tests** — viết song song.

Rollback: revert merge commit + revert migration (DROP COLUMN `status` — chấp nhận mất giá trị archived của row hiện tại).

## Open Questions

- Cần cho phép archive tenant từ bulk hay chỉ từ detail page? → Quyết: cả hai. Bulk thuận tiện cho cleanup hàng loạt.
- Có cần "unarchive" action riêng không? → Quyết: `activate` trong bulk action đã làm việc này; trên detail page cũng có nút "Khôi phục".
- Email + phone bắt buộc unique không? → Quyết: KHÔNG ép unique ở change này (giữ behavior hiện tại). Tách thành change riêng nếu cần.
