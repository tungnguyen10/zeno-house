## Why

Sau khi `buildings-overhaul` đặt mặt bằng UX + CRUD chắc cho entity gốc, Rooms là chỗ tiếp theo cần đồng bộ: list page không có search/sort, detail page render phẳng không có quick stats, form 8 field không có hệ thống section/sticky save/draft, DELETE hard-delete không kiểm tra ràng buộc (active contract, meter readings) nên có thể bể referential integrity. Toàn bộ feature rooms hiện không có test. Cần áp dụng lại cùng pattern để Rooms đạt cùng chất lượng.

## What Changes

**UI — list page**
- Toolbar mới: search box (debounced 250ms theo room_number / code / floor), status filter chips (`available`, `occupied`, `maintenance`, `archived`), building filter (giữ select hiện có), sort selector (`room_number` / `floor` / `monthly_rent` / `created_at`) + order toggle.
- Bulk-select checkbox trên card, bulk actions bar (đổi status, archive, delete) — chỉ admin.
- Pagination + filter URL-synced (`?page`, `?q`, `?status`, `?building_id`, `?sort`, `?order`).
- Skeleton + filtered-empty vs no-data + error retry state nâng cấp.

**UI — detail page**
- Hero header: room number + floor + status pill + building link + 3 quick stat tiles (active contract / occupant count / meter device count).
- Layout sectioned: Overview / Active contract / Meter readings shortcut / Danger zone.
- Quick actions: "Xem hợp đồng", "Nhập chỉ số" (deep-link vào meter-reading workspace).
- Hide danger zone cho manager; giữ "Giao phòng" / "Thu phòng" hiện có.

**UI — form (create + edit)**
- 4 sections numbered card: Vị trí (building + floor + room number) / Trạng thái (status) / Giá thuê & diện tích (monthly_rent + area) / Mô tả (description).
- Inline blur validation; error summary banner đầu form khi submit fail (click-to-focus).
- Sticky save bar mobile (`md:hidden fixed bottom-0`) với safe-area; desktop giữ footer.
- Dirty-state guard qua `onBeforeRouteLeave` + `beforeunload`.
- Form draft autosave localStorage (`room-form:create:<building_id>` / `room-form:edit:<id>`) với debounce 500ms; restore alert có Khôi phục / Bỏ / Xoá.

**API — list filter/search/sort**
- `GET /api/rooms` thêm query params: `q` (search room_number/code/description), `status[]` (multi-value), `sort` (`room_number` | `floor` | `monthly_rent` | `created_at`), `order` (`asc` | `desc`). Giữ default current behavior khi không có param mới. Validate qua `roomListQuerySchema` (Zod). Default list KHÔNG trả `status='archived'`; phải chủ động filter `?status=archived` để xem.

**API — safe delete**
- `DELETE /api/rooms/:id` SHALL kiểm tra số active contracts trên room (status `active`) và meter readings count trước khi xoá; trả `409 CONFLICT` với detail `{ activeContracts, meterReadings }` nếu có.
- Thêm `?force=true` (admin only): soft-archive (set `status='archived'`) thay vì hard-delete. Soft-archived room vẫn giữ ràng buộc tới contract/meter reading lịch sử.

**API — bulk operations**
- `POST /api/rooms/bulk` body `{ action: 'archive' | 'activate' | 'set_maintenance' | 'delete', ids: string[] }`, validate qua `roomBulkActionSchema`. Trả `{ succeeded: string[], failed: { id, reason }[] }`. `activate` → set `status='available'`; `set_maintenance` → set `status='maintenance'`; `archive` → `status='archived'`; `delete` → cùng rule với DELETE (conflict block).

**Schema**
- Add `'archived'` as a valid value for `rooms.status` (loosen CHECK constraint hoặc enum); RLS + index không đổi. List default filter `status != 'archived'` ở repository.

**Composables**
- `useRoomList`: thêm refs `q`, `status` (array), `sort`, `order`; URL sync 2 chiều với `useRoute().query`; reset `page=1` khi filter đổi.
- `useRoomForm`: thêm `isDirty` (computed snapshot vs current), `hasDraft`, `restoreDraft()`, `clearDraft()`; integrate `useDebounceFn(500)` cho autosave.
- Mới: `useRoomBulkActions` (`selectedIds`, `toggle`, `selectAll`, `clear`, `runAction`).

**Tests (mới)**
- `tests/server/rooms.api.test.ts`: cover 6 endpoints + permission matrix + filter/sort/safe-delete + bulk.
- `tests/components/RoomListToolbar.test.ts`, `RoomForm.test.ts`, `RoomDetailHero.test.ts`, `RoomCard.test.ts` (selection mode).
- `tests/composables/rooms/useRoomForm.test.ts` (dirty + draft), `useRoomBulkActions.test.ts`.

**Không thay đổi**: mapper shape, route helpers (`roomPath`, `buildingRoomPath`), các API contract khác (rent helper text, occupancy buttons).

## Capabilities

### New Capabilities
- `rooms-ui`: page-level UI requirements (list toolbar, detail hero/section layout, form sections/sticky save/draft), tách khỏi composable-level `rooms-client`.

### Modified Capabilities
- `rooms-api`: thêm requirements cho query params (q/status[]/sort/order), safe-delete với conflict 409, endpoint bulk operations.
- `rooms-client`: mở rộng `useRoomList` (filter/sort refs + URL sync), `useRoomForm` (dirty + draft), thêm `useRoomBulkActions`. DTO không đổi.
- `rooms-database`: thêm `'archived'` vào tập giá trị hợp lệ của `rooms.status`.

## Impact

**Code**
- `app/pages/rooms/index.vue`, `app/pages/rooms/[code]/index.vue`, `app/pages/rooms/create.vue`, `app/pages/rooms/[code]/edit.vue`
- `app/components/rooms/*` (cập nhật `RoomForm`, `RoomCard`; thêm `RoomListToolbar`, `RoomDetailHero`, `RoomBulkActionsBar`)
- `app/composables/rooms/*` (mở rộng `useRoomList`, `useRoomForm`; thêm `useRoomBulkActions`)
- `app/utils/validators/rooms.ts` (thêm `roomListQuerySchema`, `roomBulkActionSchema`)
- `app/types/rooms.ts` (`RoomStatus` thêm `'archived'`)
- `server/api/rooms/index.get.ts`, `server/api/rooms/[id].delete.ts`, `server/api/rooms/bulk.post.ts` (mới)
- `server/services/rooms/index.ts`, `server/repositories/rooms/index.ts` (filter/sort, conflict checks, soft-archive, bulk)
- `supabase/migrations/<timestamp>_rooms_add_archived_status.sql` (extend CHECK / enum)
- `tests/server/rooms.api.test.ts`, `tests/components/rooms/*`, `tests/composables/rooms/*` (mới)

**APIs**
- GET `/api/rooms` — thêm query params, response shape giữ nguyên.
- DELETE `/api/rooms/:id` — có thể trả 409 mới; cần handler ở client; thêm `?force=true`.
- POST `/api/rooms/bulk` — endpoint mới.

**DB**
- 1 migration nhỏ extend `rooms.status` để chấp nhận `'archived'`.

**Không impact**: RLS policies (vẫn dùng building_id scope), auth flow, billing, dashboard, các domain khác.
