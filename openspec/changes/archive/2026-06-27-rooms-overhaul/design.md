## Context

Rooms domain hiện ở v0.2 minimal-viable: CRUD chạy, có slug code, có building filter, có occupancy lifecycle qua contracts. Nhưng list không có search/sort, form phẳng, DELETE hard-delete không safe, không có test. Reference design đã chứng minh trong `buildings-overhaul` archive (2026-06-27) — repo dùng lại pattern đó với 2 khác biệt domain:
1. Status enum hiện không có giá trị "archive" — cần thêm `'archived'` vào `rooms.status` check constraint.
2. Conflict surface của room delete khác buildings: phải check active contracts + meter readings thay vì rooms + contracts.

Stack constraints không đổi: Nuxt 4 + Pinia (chỉ global state) + `useFetch` cho list/detail + `$fetch` cho mutations + Supabase + TailwindCSS dark theme tokens.

## Goals / Non-Goals

**Goals:**
- Pattern UX nhất quán với buildings-overhaul (toolbar, hero, bulk, form polish, dirty guard, draft).
- DELETE an toàn cho room: không bao giờ làm orphan active contract hoặc reading lịch sử.
- List API hỗ trợ search/sort/multi-status filter, URL-shareable.
- Test baseline đầy đủ (server + components + composables) — bootstrap zero → covered.
- Có status `'archived'` để giấu room đã retire khỏi list mặc định mà không phá historical data.

**Non-Goals:**
- Không đổi mapper shape, route helpers, occupancy lifecycle buttons (giữ "Giao phòng" / "Thu phòng").
- Không động RLS policies (vẫn theo building scope).
- Không động billing, meter readings logic, contract state machine.
- Không thêm bulk import hoặc quick-room-setup mới (đã có ở change khác).
- Không refactor `RoomCard` layout — chỉ thêm selection mode optional.

## Decisions

### D1. Thêm `'archived'` vào `rooms.status` thay vì cột `archived_at` riêng

**Chọn**: Migration ALTER CHECK constraint của `rooms.status` để chấp nhận thêm `'archived'`. Repository default exclude `status='archived'` khi không có filter `?status` rõ ràng.

**Lý do**: Cùng pattern với buildings (dùng `status='inactive'` cho soft-archive). Không cần thêm column, không cần update mọi query. RLS không đổi. Khi UI cần xem archived, filter chip `?status=archived` mở data.

**Alternative bỏ**:
- Cột `archived_at timestamp null` — tăng surface, mỗi query phải `WHERE archived_at IS NULL`, dễ quên.
- Bảng `rooms_archive` riêng — overkill, mất referential integrity tới contract/reading.

### D2. URL-synced list state qua `useRoute().query` (không Pinia)

**Chọn**: `useRoomList` đọc/ghi `route.query` cho `q`, `status[]`, `sort`, `order`, `page`, `building_id`, `floor`. Refs cục bộ trong composable đồng bộ 2 chiều bằng `watch` + `navigateTo({ query })`. `useFetch` watch refs để tự refetch.

**Lý do**: Cùng D1 của buildings-overhaul. List state phải shareable qua link, back/forward giữ filter. Pinia vi phạm `stores.instructions.md`.

### D3. Safe-delete dùng cùng endpoint với query param `force`

**Chọn**: `DELETE /api/rooms/:id` mặc định check active contracts + meter readings → 409 nếu có. `?force=true` → soft-archive (set `status='archived'`).

**Lý do**: Cùng pattern buildings-overhaul D2. Một endpoint, semantics rõ. Meter readings cố ý giữ để billing history nguyên vẹn.

**Alternative bỏ**:
- Cascade delete meter readings — bể audit trail, không thể tái lập billing đã issue.
- Endpoint `/archive` riêng — tăng surface, lệch chuẩn REST.

### D4. Bulk operations qua single endpoint `POST /api/rooms/bulk`

**Chọn**: 1 endpoint `{ action: 'archive'|'activate'|'set_maintenance'|'delete', ids }` → `{ succeeded, failed }`. `delete` áp dụng cùng safe-check như single DELETE.

**Lý do**: Cùng pattern buildings-overhaul D3. Per-item kết quả cho phép partial success.

### D5. Form draft autosave dùng `localStorage` per-key

**Chọn**: Key `room-form:create:<building_id|none>` hoặc `room-form:edit:<id>`. Debounce 500ms. Restore alert có Khôi phục / Bỏ / Xoá.

**Lý do**: Form ~8 field, draft đủ để chống reload accident. Per-key tách create cho từng building.

### D6. Dirty-state guard bằng `onBeforeRouteLeave` + `beforeunload`

**Chọn**: Cùng pattern buildings-overhaul D5.

### D7. Search dùng PostgreSQL `ilike` trên nhiều cột

**Chọn**: Repository `findAll({ q })` build `room_number.ilike.%q% OR code.ilike.%q% OR description.ilike.%q%` (thêm floor convert text khi cần). Không tsvector.

**Lý do**: Rooms table scale ~hàng nghìn rows max — ilike đủ. Khi >10k cần optimize.

### D8. Filter `status` multi-value qua repeat query param

**Chọn**: `?status=available&status=occupied`. Validator normalize array. Cùng pattern buildings.

### D9. Section UI: numbered card + border-top accent

**Chọn**: Cùng pattern buildings-overhaul D9.

### D10. Form section split cho RoomForm

**Chọn**: 4 sections:
1. **Vị trí**: `building_id`, `floor`, `room_number` — fields định danh, không đổi sau create (thường).
2. **Trạng thái**: `status` (radio chips: available / occupied / maintenance / archived — archived chỉ admin).
3. **Giá thuê & diện tích**: `monthly_rent`, `area` — commercial.
4. **Mô tả**: `description` — textarea.

**Lý do**: Group field theo intent thị giác, dễ scan, dễ test isolation.

### D11. Tests: Vitest + Vue Test Utils + Nitro test utils

**Chọn**: Cùng pattern buildings-overhaul D10. Reuse `tests/__mocks__/` cho supabase.

## Risks / Trade-offs

[**Risk**: Migration thêm `'archived'` vào CHECK constraint cần lock table — production có downtime nhỏ] → Mitigation: Supabase `ALTER TABLE ... DROP CONSTRAINT ... ADD CONSTRAINT` chạy nhanh trên bảng vài chục nghìn row; chấp nhận lock <1s.

[**Risk**: Default exclude `status='archived'` có thể che data người dùng cần xem] → Mitigation: Filter chip "Đã lưu trữ" hiện rõ trong toolbar; URL `?status=archived` shareable.

[**Risk**: Meter readings có thể có hàng nghìn rows / room — count check chậm] → Mitigation: Dùng `SELECT count(*) ... LIMIT 1` (early exit) hoặc `EXISTS` check; chỉ cần biết "có ít nhất 1" để block.

[**Risk**: Bulk delete có thể partial fail làm UI khó hiểu] → Mitigation: Response trả từng `succeeded` + `failed[].reason`, UI hiển thị toast tóm tắt + modal chi tiết.

[**Risk**: Soft-archived rooms làm danh sách phòng trong building hiển thị sai count (tổng rooms)] → Mitigation: Building summary count đã có flag `includeArchived` (nếu chưa có thì thêm). Default count exclude archived.

[**Risk**: Backward-compat khi DELETE đổi behavior — chưa có client cũ ngoài repo] → Mitigation: Toàn bộ client cùng repo, update đồng thời.

## Migration Plan

Không có data migration phức tạp. Triển khai theo thứ tự:

1. **DB migration** — extend `rooms.status` CHECK constraint để chấp nhận `'archived'`.
2. **Server (API + service + repo)** — thêm filter/sort/safe-delete/bulk, giữ default behavior khi không có query mới.
3. **Composable** — mở rộng `useRoomList` (URL sync), `useRoomForm` (dirty + draft), thêm `useRoomBulkActions`.
4. **Components mới + update** — `RoomListToolbar`, `RoomDetailHero`, `RoomBulkActionsBar`; refactor `RoomForm` sections; update `RoomCard` cho selection mode.
5. **Pages** — refactor list/detail/create/edit dùng components mới.
6. **Tests** — viết song song mỗi layer.

Rollback: revert merge commit + revert migration (DROP `'archived'` value khỏi CHECK — chỉ an toàn khi chưa có row nào với status `'archived'`).

## Open Questions

- Có cần hiển thị "đã lưu trữ X phòng" trong building detail page sau khi soft-archive? → Quyết: có, cho admin thấy; UI nhỏ.
- Bulk action `set_maintenance` có cần lý do (reason) không? → Quyết: không cần ở v1; nếu sau cần audit log thì tách change.
- Floor filter giữ ở toolbar hay ẩn vào "Bộ lọc nâng cao"? → Quyết: giữ trong toolbar nhưng có thể collapse khi mobile (`md:flex hidden`).
