## Why

Buildings là entity gốc của hệ thống nhưng UX hiện đang ở mức tối thiểu: list không có search/filter/sort, detail page là 4 card phẳng thiếu quick stats, form 4 section không có thứ bậc thị giác và mobile không có sticky save. CRUD layer cũng còn lỗ hổng: DELETE hard-delete không kiểm tra ràng buộc (rooms, contracts) nên có thể mất data; list API không hỗ trợ search/filter/sort; service sync trả về thiếu thông tin để UI feedback; toàn bộ feature buildings hiện không có test. Cần một đợt overhaul gọn gàng để Building trở thành "showcase" về UI đẹp và CRUD chắc của hệ thống.

## What Changes

**UI — list page**
- Toolbar mới: search box (debounced 250ms), status filter chips, sort selector (name / created / room count), toggle view (grid card / dense table).
- Bulk-select column (checkbox), bulk actions bar (đổi status, xoá nhiều) — chỉ admin.
- Pagination URL-synced (`?page`, `?q`, `?status`, `?sort`), back/forward giữ state.
- Skeleton + empty + error state nâng cấp.

**UI — detail page**
- Hero header với building name + 3 quick stats (rooms / occupied / active services) + status pill.
- Layout chia rõ: Overview / Services / Operations / Danger zone.
- Quick actions: link "Xem phòng", "Xem hợp đồng" trong building.
- Fast service toggle giữ nguyên, thêm row hint khi disabled (manager).

**UI — form (create + edit)**
- 4 sections trở thành cards rời với numbered heading + border-top, mô tả ngắn dưới heading.
- Inline validation on blur (không đợi submit), error summary ở đầu form khi submit fail.
- Sticky save bar trên mobile (`md:hidden`), desktop giữ footer hiện tại.
- Dirty-state guard: confirm khi navigate away với form đã đổi (Nuxt `onBeforeRouteLeave`).
- Form draft autosave localStorage (theo `buildingId` hoặc `:create`), restore khi quay lại.

**API — list filter/search/sort**
- `GET /api/buildings` thêm query params: `q` (search name/address/code), `status`, `sort` (`name` | `created_at` | `total_rooms`), `order` (`asc` | `desc`). Envelope giữ nguyên.

**API — safe delete**
- `DELETE /api/buildings/:id` SHALL kiểm tra rooms count và active contracts count trước khi xoá; trả `409 CONFLICT` với detail `{ rooms, activeContracts }` nếu có ràng buộc.
- Thêm `?force=true` (admin only): khi force, soft-archive (status = `inactive`) thay vì hard-delete; document rõ trong spec.

**API — bulk operations**
- `POST /api/buildings/bulk` với body `{ action: 'archive' | 'activate' | 'delete', ids: string[] }`, validate Zod, trả về `{ succeeded: string[], failed: { id, reason }[] }`.

**Tests (mới)**
- `tests/server/buildings.api.test.ts`: cover 6 endpoints + permission matrix + filter/sort/safe-delete edge cases.
- `tests/components/BuildingsListToolbar.test.ts`, `BuildingForm.test.ts`, `BuildingDetailHero.test.ts`.
- Composable test cho `useBuildingForm` (validation + autosave).

**Composables**
- `useBuildingList` nhận thêm `q`, `status`, `sort`, `order` refs, đồng bộ với URL query.
- `useBuildingForm` thêm `isDirty`, `restoreDraft()`, `clearDraft()`.
- `useBuildingBulkActions` (mới) cho bulk operations.

**Không thay đổi**: database schema, mapper shape, route helpers, các API contract khác của buildings.

## Capabilities

### New Capabilities

(không có capability mới — toàn bộ thay đổi nằm trong các spec hiện có)

### Modified Capabilities

- `buildings-ui`: thêm requirements cho toolbar (search/filter/sort), bulk select, hero detail layout, form polish (sticky save, dirty guard, inline validation, autosave).
- `buildings-client`: mở rộng `useBuildingList` (filter/sort refs, URL sync), `useBuildingForm` (dirty + draft), thêm `useBuildingBulkActions`, DTO không đổi.
- `buildings-api`: thêm query params `q`/`status`/`sort`/`order` cho GET list, safe-delete với conflict check, endpoint bulk operations.

## Impact

**Code**
- `app/pages/buildings/index.vue`, `app/pages/buildings/[id]/index.vue`, `app/pages/buildings/create.vue`, `app/pages/buildings/[id]/edit.vue`
- `app/components/buildings/*` (cập nhật `BuildingForm`, `BuildingCard`, thêm `BuildingListToolbar`, `BuildingDetailHero`, `BuildingBulkActionsBar`)
- `app/composables/buildings/*`
- `app/utils/validators/buildings.ts` (thêm `buildingListQuerySchema`, `buildingBulkActionSchema`)
- `server/api/buildings/index.get.ts`, `server/api/buildings/[id].delete.ts`, `server/api/buildings/bulk.post.ts` (mới)
- `server/services/buildings/index.ts`, `server/repositories/buildings/index.ts` (filter/sort, ràng buộc delete, bulk)
- `tests/server/buildings.api.test.ts` (mới), `tests/components/buildings/*` (mới), `tests/composables/buildings/*` (mới)

**APIs**
- GET `/api/buildings` — thêm query params, response shape giữ nguyên.
- DELETE `/api/buildings/:id` — có thể trả 409 mới; cần handler ở client.
- POST `/api/buildings/bulk` — endpoint mới.

**Follow-up (không thuộc change này)**: mở rộng response `POST /api/contract-services/sync` để trả `affectedContracts` tách thành change riêng khi `contract-services-api` spec được tạo.

**Không impact**: database migrations, RLS policies, auth flow, billing logic, dashboard, các domain khác.
