## Why

Tenants là entity người dùng cuối — quản lý hồ sơ khách thuê (id, liên hệ khẩn cấp, contract history). UX hiện đã có search/building filter/contract-state filter nhưng query không được validate qua Zod, không có sort/order, không URL-sync; form 13 field render phẳng không có sections; DELETE hard-delete không kiểm tra active contract/occupancy nên có thể mất hồ sơ pháp lý; route `/tenants/[code]/edit` thậm chí chưa tồn tại (detail page có nút edit). Zero tests (chỉ có file stub repository.test.ts). Tenants cần overhaul theo cùng pattern với buildings/rooms.

## What Changes

**UI — list page**
- Toolbar mới: search box (debounced 250ms — full_name / phone / email / id_number / code), filter chips status (`active`, `archived`), giữ building filter + contract-state filter hiện có, sort selector (`full_name` / `created_at` / `code`) + order toggle.
- Bulk-select checkbox trên row, bulk actions bar (archive, activate, delete) — chỉ admin.
- Pagination + filter URL-synced (`?page`, `?q`, `?status`, `?building_id`, `?contract_state`, `?sort`, `?order`).
- Skeleton + filtered-empty vs no-data + error retry state nâng cấp.

**UI — detail page**
- Hero header: full name + code + status pill + 3 quick stat tiles (active contracts count / current room link / occupancy count). Phone + email rendered ngay dưới name.
- Layout sectioned: Personal / ID document / Emergency contact / Contracts history / Danger zone.
- Edit + delete actions chỉ admin; danger zone hide cho manager.

**UI — form (create + edit)**
- 4 sections numbered card: Thông tin cá nhân (full_name, phone, email, date_of_birth, gender, occupation) / Giấy tờ tuỳ thân (id_number, id_issued_date, id_issued_place) / Liên hệ khẩn cấp (emergency_contact_name, emergency_contact_phone, permanent_address) / Ghi chú (notes).
- Inline blur validation; error summary banner đầu form (click-to-focus).
- Sticky save bar mobile + safe-area; desktop giữ footer.
- Dirty-state guard qua `onBeforeRouteLeave` + `beforeunload`.
- Form draft autosave localStorage (`tenant-form:create` / `tenant-form:edit:<id>`) debounce 500ms với restore alert.
- Thêm route `/tenants/[code]/edit` (hiện chưa có) dùng cùng `TenantForm` mới.

**API — list query schema + sort**
- `GET /api/tenants` validate qua `tenantListQuerySchema` (Zod) mới: `page`, `limit`, `q`, `building_id`, `contract_state`, `status[]`, `sort` (`full_name` | `created_at` | `code`), `order` (`asc` | `desc`). Giữ default current behavior. Default list KHÔNG trả `status='archived'`; phải filter `?status=archived` để xem.

**API — safe delete**
- `DELETE /api/tenants/:id` SHALL kiểm tra số active contracts (primary tenant) + số active occupants (occupant đang ở) trước khi xoá; trả `409 CONFLICT` với detail `{ activeContracts, activeOccupancies }` nếu có.
- Thêm `?force=true` (admin only): soft-archive (set `status='archived'`). Soft-archived tenant vẫn giữ ràng buộc tới contract/occupant lịch sử.

**API — bulk operations**
- `POST /api/tenants/bulk` body `{ action: 'archive' | 'activate' | 'delete', ids: string[] }`, validate qua `tenantBulkActionSchema`. Trả `{ succeeded, failed: [{ id, reason }] }`.

**Schema**
- Add `tenants.status` column (`text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived'))`) và backfill `'active'` cho rows hiện có. Update RLS không đổi.

**Composables**
- `useTenantList`: thêm refs `status`, `sort`, `order`; URL sync 2 chiều; reset `page=1` khi filter đổi.
- `useTenantForm`: thêm `isDirty`, `hasDraft`, `restoreDraft()`, `clearDraft()`.
- Mới: `useTenantBulkActions`.

**Tests (mới)**
- `tests/server/tenants.api.test.ts`: cover 6 endpoints + permission + filter/sort + safe-delete + bulk + Zod query validation.
- `tests/components/TenantListToolbar.test.ts`, `TenantForm.test.ts`, `TenantDetailHero.test.ts`.
- `tests/composables/tenants/useTenantForm.test.ts`, `useTenantBulkActions.test.ts`.

**Không thay đổi**: tenant code generation (`buildUniqueTenantCode`), enrichment fields đã có, building filter logic, mapper shape, route helpers.

## Capabilities

### New Capabilities
- `tenants-ui`: page-level UI requirements (list toolbar, detail hero/section layout, form sections/sticky save/draft, edit route).

### Modified Capabilities
- `tenants-api`: thêm requirements cho query schema validation (Zod), sort/order, safe-delete với conflict 409, endpoint bulk operations, status filter.
- `tenants-client`: mở rộng `useTenantList` (URL sync + sort), `useTenantForm` (dirty + draft), thêm `useTenantBulkActions`.
- `tenants-database`: thêm column `status` với check constraint.

## Impact

**Code**
- `app/pages/tenants/index.vue`, `app/pages/tenants/[code]/index.vue`, `app/pages/tenants/create.vue`, `app/pages/tenants/[code]/edit.vue` (mới)
- `app/components/tenants/*` (cập nhật `TenantForm`; thêm `TenantListToolbar`, `TenantDetailHero`, `TenantBulkActionsBar`)
- `app/composables/tenants/*` (mở rộng `useTenantList`, `useTenantForm`; thêm `useTenantBulkActions`)
- `app/utils/validators/tenants.ts` (thêm `tenantListQuerySchema`, `tenantBulkActionSchema`)
- `app/types/tenants.ts` (thêm `TenantStatus`, mở rộng `Tenant.status`)
- `server/api/tenants/index.get.ts` (Zod validation), `server/api/tenants/[id].delete.ts`, `server/api/tenants/bulk.post.ts` (mới)
- `server/services/tenants/index.ts`, `server/repositories/tenants/index.ts` (status filter, sort/order, conflict checks, soft-archive, bulk)
- `supabase/migrations/<timestamp>_tenants_add_status.sql`
- `tests/server/tenants.api.test.ts`, `tests/components/tenants/*`, `tests/composables/tenants/*`

**APIs**
- GET `/api/tenants` — thêm Zod validation + sort/status; response giữ nguyên.
- DELETE `/api/tenants/:id` — có thể trả 409 mới; `?force=true` soft-archive.
- POST `/api/tenants/bulk` — endpoint mới.

**DB**
- 1 migration thêm `tenants.status` (default `'active'`).

**Không impact**: RLS policies, auth flow, billing, dashboard, các domain khác.
