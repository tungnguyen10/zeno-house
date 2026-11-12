---
type: Change Design
title: "atomic-building-room-setup-design"
status: draft
change_state: design-review
tags: [superpowers, change, buildings, rooms, migration, v2]
---

# PR0 — Tạo Building + phòng hàng loạt nguyên tử

> Sub-project đầu tiên (P0) của [ZENO House V2 — Flow Optimization Brief](../zeno-house-v2-optimization/brief.md). Thiết kế này chưa được chấp nhận hay triển khai; yêu cầu đã chấp nhận vẫn nằm ở `docs/capabilities/**`.

## 1. Mục tiêu

- Không còn trạng thái Building/Room "tạo dở" mà người dùng không biết.
- Bấm thử lại (kể cả sau khi mất mạng) không sinh Building hoặc Room trùng.
- Preview phòng có cột Tầng, cho sửa giá/diện tích/tầng từng phòng và không mất giá trị đã sửa.
- Quyền và phạm vi tòa kiểm tra ở backend.
- Thiết kế lõi tạo phòng hàng loạt để PR2 dùng lại, không viết API hai lần.

## 2. Hiện trạng (develop)

- [useBuildingForm.ts](../../../app/composables/buildings/useBuildingForm.ts) tạo Building rồi gọi `Promise.all` N lần `POST /api/rooms`, `floor` cố định bằng 1. Lỗi giữa chừng để lại Building và một phần phòng; bấm lại tạo thêm Building mới vì slug tự thêm hậu tố.
- [create.vue](../../../app/pages/dashboard/buildings/create.vue): `previewRooms` là `computed`, `updatePreviewRent` ghi vào kết quả computed nên giá sửa tay mất khi bất kỳ tham số sinh phòng nào đổi. Diện tích không sửa được; không có Tầng.
- `BuildingService.create` kiểm tra `buildings.create` (admin, owner). Owner được tự gán vào tòa; nếu gán lỗi thì xóa bù Building trong TypeScript.
- `RoomService.create` kiểm tra `rooms.create` + `assertBuildingScope(..., 'write')`.
- Slug/code Building và Room sinh ở repository (TypeScript), không có trigger. Room `code = building.code || '-' || slug`.
- DB đã có `unique (building_id, room_number)`, `rooms_building_slug_uq`, `rooms_code_uq`.
- Đã có `audit_operations` (`idempotency_key text unique`, `actor_id`, `status` gồm `completed`) và `AuditService.appendBulk`.

## 3. Quyết định đã chốt

| Câu hỏi | Quyết định |
| --- | --- |
| Cơ chế nguyên tử | **Kết hợp (C):** RPC lõi `create_rooms_batch` dùng chung; RPC `create_building_with_rooms` gọi Building + gán owner + batch trong một transaction. |
| Phạm vi UI | **Tối thiểu (A):** giữ bộ sinh tiền tố + số bắt đầu + số lượng; thêm Tầng mặc định và cột Tầng/Diện tích sửa được. Bộ sinh theo dải tầng để PR2. |
| Lỗi một phòng | Rollback toàn batch, kể cả Building. |

## 4. Database và RPC

Một migration mới, hai hàm `SECURITY INVOKER`, `set search_path = ''`, `grant execute` chỉ cho `service_role`, `revoke` khỏi `public`, `anon`, `authenticated` (giống `create_contract_with_handover`).

### 4.1. `public.create_rooms_batch(p_building_id uuid, p_rooms jsonb) returns setof public.rooms`

- `p_rooms`: mảng `{ room_number, slug, floor, monthly_rent, area }`; `slug` do app tính bằng `slugifyName`.
- `pg_advisory_xact_lock` theo `building_id` để hai batch đồng thời trên cùng tòa chạy nối tiếp.
- Kiểm tra: 1–200 phần tử; không trùng `room_number`/`slug` trong batch và so với phòng hiện có của tòa. Trùng thì `raise` với `errcode = '23505'` và `detail` là JSON danh sách số phòng trùng.
- Một câu `insert … select` từ `jsonb_to_recordset`; `code` tính trong SQL từ `buildings.code`; `status = 'available'`.
- Bất kỳ lỗi nào → toàn bộ batch rollback.

### 4.2. `public.create_building_with_rooms(p_building jsonb, p_assign_owner uuid, p_rooms jsonb, p_actor_id uuid, p_request_id uuid) returns jsonb`

Trong cùng transaction:

1. Idempotency: key `building.create:<p_request_id>`.
   - Nếu đã có dòng `audit_operations` với key này và `actor_id = p_actor_id`: trả `{ building, room_count, replayed: true }`, không ghi gì thêm.
   - Nếu key thuộc actor khác: `raise` lỗi xung đột, **không** trả dữ liệu Building.
2. Insert Building (slug/code do app tính trước).
3. Nếu `p_assign_owner` khác null: insert gán owner vào tòa (thay cho xóa bù trong TypeScript).
4. Nếu `p_rooms` không rỗng: gọi `create_rooms_batch`.
5. Insert `audit_operations(idempotency_key, actor_id, building_id, action = 'building.create', entity_type = 'building', entity_id, status = 'completed', completed_at = now())`. Reconciler chỉ nhận `pending`/`executing` nên không đụng dòng này.
6. Trả `{ building, room_count, replayed: false }`.

Không thay đổi cấu trúc bảng. Ràng buộc unique sẵn có là lớp bảo vệ cuối.

## 5. Service, API và audit

### 5.1. API

- Mở rộng `POST /api/buildings`; body cũ giữ nguyên, thêm tùy chọn:
  - `request_id: uuid`
  - `rooms: Array<{ room_number, floor, monthly_rent, area | null }>`, tối đa 200.
- Validator `buildingCreateWithRoomsSchema` trong `app/utils/validators/buildings.ts`, dùng chung client/server; schema phòng tái dùng ràng buộc của `roomCreateSchema`; `superRefine` báo `room_number` trùng trong batch theo index.
- Response giữ `{ data: Building }`, thêm `meta: { room_count }`.
- Không thêm route batch cho tòa đã có trong PR0 (PR2 sẽ thêm, gọi `create_rooms_batch`).

### 5.2. `BuildingService.create`

1. `requireCapability(user, 'buildings.create')`; nếu có `rooms` thì thêm `requireCapability(user, 'rooms.create')`.
2. Repository tính slug/code Building và slug từng phòng.
3. Luôn gọi RPC `create_building_with_rooms` (có hoặc không có phòng); bỏ nhánh xóa bù cũ.
4. Lỗi:
   - Trùng slug/code Building → tính lại và thử tối đa 2 lần.
   - Trùng phòng → `409`, `details.duplicate_room_numbers`.
   - Key idempotency thuộc actor khác → `409` thông báo chung, không lộ dữ liệu.
   - Khác → `throwDbError`.
5. `replayed: true` → trả kết quả, không ghi audit.
6. Reset `event.context.__buildingScope`.

### 5.3. Audit

Sau commit, giống hành vi hiện tại:

- `BUILDING_CREATED` (metadata `room_count`, `request_id`).
- `USER_ASSIGNMENT_ADDED` nếu owner.
- N × `ROOM_CREATED` qua một lần `AuditService.appendBulk`.

Rủi ro đã biết: audit lỗi sau commit → dữ liệu còn nhưng thiếu dấu vết; đây là hành vi chung hiện tại, do [harden-event-audit](../harden-event-audit/verification.md) theo dõi, ngoài phạm vi PR0.

## 6. UI và composable

### 6.1. `useQuickRoomPreview` (`app/composables/buildings/`)

- Tham số sinh: tiền tố, số bắt đầu, số lượng (1–200), giá mặc định, diện tích mặc định, **tầng mặc định** (1).
- `rows: Ref<PreviewRoom[]>` với `{ roomNumber, floor, rent, area, overridden: Set<'floor' | 'rent' | 'area'> }`.
- Đổi tham số → dựng lại danh sách, **giữ ô đã sửa tay** theo `roomNumber`; phòng rơi khỏi dải bị bỏ phần sửa tay.
- Bật "Đồng giá cho tất cả phòng" → đặt giá mặc định cho mọi phòng, xóa override `rent`.
- `toPayload()` trả `rooms[]` đúng schema 5.1; lỗi trùng dùng chính validator chung.
- Không gọi API.

### 6.2. `create.vue`

- Cột: Mã phòng, Tầng (sửa được), Giá thuê (sửa được khi bỏ đồng giá), Diện tích (sửa được).
- Ô đã sửa tay có dấu hiệu nhẹ theo token hiện có và hành động khôi phục mặc định.
- Bản nháp cục bộ vẫn chỉ lưu thông tin Building.

### 6.3. `useBuildingForm.submitCreate`

- Một request `POST /api/buildings` kèm `rooms` và `request_id`; bỏ `Promise.all`.
- `request_id = crypto.randomUUID()` một lần mỗi phiên trang, giữ nguyên qua các lần thử lại.
- `409 duplicate_room_numbers` → đánh dấu đúng dòng, thông báo "Các mã phòng đã tồn tại: …", giữ form và preview.
- Lỗi khác/mạng → "Chưa có dữ liệu nào được lưu. Bạn có thể bấm lại để thử." Trường hợp server đã lưu nhưng mất phản hồi, bấm lại nhận Building cũ và chuyển trang bình thường.
- Thành công → xóa nháp, chuyển về danh sách tòa nhà như hiện tại.

### 6.4. Chất lượng UI

- Theo [ui-polish-workflow](../../../.agents/skills/zeno-house/references/ui-polish-workflow.md); dùng design system và primitive sẵn có (`UiTable`, `UiInput density="compact"`, `UiAlert`, `UiCheckbox`).
- Vẫn bắt buộc dùng skill `frontend-design` (bố cục, mật độ, câu chữ) và Hallmark (rà trạng thái bị ảnh hưởng, responsive, tiết chế) để đạt chất lượng production ngay lần đầu.
- Chỉ tạo token hoặc primitive mới khi primitive hiện có không đáp ứng được; phải đánh giá kỹ, thiết kế để tái sử dụng tối đa, và nêu rõ vấn đề, phương án, bề mặt bị ảnh hưởng, lợi ích, chi phí trước khi xin duyệt.
- Mobile: bảng có ô nhập phải dùng cuộn ngang hoặc dạng thẻ theo pattern hiện có.

## 7. Kiểm thử và xác minh

### 7.1. Test (viết trước — TDD)

| Lớp | File | Nội dung |
| --- | --- | --- |
| Validator | `tests/utils/validators/buildings*.test.ts` | `floor` ngoài 1–100; > 200 phòng; `room_number` trùng trong batch báo đúng index; `request_id` không phải uuid; không có `rooms` vẫn hợp lệ |
| Preview | `tests/composables/buildings/useQuickRoomPreview.test.ts` | Giữ override khi đổi tham số; bỏ override của phòng bị loại; đồng giá reset giá; `toPayload()` đúng schema |
| Form | `tests/composables/buildings/useBuildingForm*.test.ts` | Một request; `request_id` ổn định qua retry; `409` gắn dòng trùng; lỗi chung giữ form |
| Service/API | `tests/server/buildings.api.test.ts` | Admin/owner tạo kèm phòng; manager `403`; payload RPC đúng; owner được gán trong RPC; replay không ghi audit; key của actor khác → `409` không lộ dữ liệu; retry slug tối đa 2 lần; trùng phòng `409` kèm danh sách; audit `BUILDING_CREATED` + N × `ROOM_CREATED` qua một lần `appendBulk` |
| Trang | `tests/pages/**/buildings-create*.test.ts` | Cột Tầng/Diện tích sửa được; dòng trùng được đánh dấu; thông báo "Chưa có dữ liệu nào được lưu" |

### 7.2. SQL và migration

- Migration `supabase/migrations/<timestamp>_create_building_with_rooms.sql`.
- Script `supabase/verification/create_building_with_rooms.sql` theo mẫu `atomic_contract_renewal.sql`, kiểm tra:
  - Một phòng trùng → rollback toàn bộ, không có Building mồ côi.
  - Replay cùng `request_id` và cùng actor → trả Building cũ, số dòng không tăng.
  - Cùng `request_id`, actor khác → lỗi, không trả dữ liệu.
  - Hai batch đồng thời cùng tòa được tuần tự hóa, không trùng.
  - `code` phòng = `building.code || '-' || slug`.
  - Grant/revoke đúng.
- Regenerate `app/types/database.types.ts` theo quy trình; không sửa tay.
- Áp dụng migration trên cloud là gate riêng; không suy ra từ test tĩnh.

### 7.3. QA thủ công

Desktop và mobile: tạo tòa 30 phòng, sửa tay vài ô, cố ý tạo trùng, giả lập mất mạng rồi thử lại.

### 7.4. Lệnh

Test hẹp trước, sau đó `npm run typecheck`, `npm test`, `npm run lint`, `npm run knowledge:check`.

## 8. Tài liệu

- Change bundle: `index.md`, `design.md` (file này), `implementation-plan.md` (checklist duy nhất), `verification.md`.
- Liên kết từ [brief](../zeno-house-v2-optimization/brief.md) và [changes index](../index.md).
- Khi chấp nhận: cập nhật [buildings-api](../../capabilities/buildings-api.md), [rooms-api](../../capabilities/rooms-api.md), [rooms-database](../../capabilities/rooms-database.md), [buildings-ui](../../capabilities/buildings-ui.md); chuyển bundle sang `docs/history/`.

## 9. Ngoài phạm vi PR0

- Route batch tạo phòng cho tòa đã có; bộ sinh theo dải tầng; nội thất (PR2).
- Lưu preview vào bản nháp.
- Bảo đảm audit khi lỗi sau commit (harden-event-audit).
- Xác minh rollout các migration tài chính ngày 10/11 (P0 của brief nhưng là track riêng, không gộp vào PR này).
