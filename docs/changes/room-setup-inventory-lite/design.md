---
type: Change Design
title: "room-setup-inventory-lite-design"
status: draft
change_state: design-review
tags: [superpowers, change, rooms, inventory, contracts, v2]
---

# PR2 — Room Setup & Inventory Lite

> Sub-project PR2 của [ZENO House V2 — Flow Optimization Brief](../zeno-house-v2-optimization/brief.md). Phụ thuộc [PR0 atomic-building-room-setup](../atomic-building-room-setup/design.md). Thiết kế chưa được chấp nhận hay triển khai.

## 1. Mục tiêu

- Bộ sinh phòng theo dải tầng, dùng chung cho tạo tòa và thêm phòng hàng loạt vào tòa đã có.
- Nội thất cơ bản theo phòng, khởi tạo nhanh từ bộ mẫu của tòa.
- Chụp danh sách nội thất bàn giao vào hợp đồng khi tạo HĐ, làm nguồn cho Phụ lục 1 (PR4) và tham chiếu khi trả phòng.

## 2. Hiện trạng (develop + PR0)

- PR0 có RPC `create_rooms_batch(p_building_id, p_rooms)` và `create_building_with_rooms`; bộ sinh PR0 là tiền tố + số bắt đầu + số lượng, một tầng mặc định.
- Không có bảng nội thất/tài sản nào.
- `create_contract_with_handover` tạo HĐ + 2 chỉ số bàn giao trong một transaction.
- Gia hạn tạo HĐ mới qua `renew_contract_atomic`, liên kết bằng `contracts.previous_contract_id`.
- Mẫu DOCX Điều 1.2: *"Tài sản cho thuê và giá trị tài sản được đính kèm ở Phụ lục Hợp đồng số 1"*; file mẫu chưa có phụ lục.

## 3. Quyết định đã chốt

| Câu hỏi | Quyết định |
| --- | --- |
| Trường của một món | Tên, số lượng, tình trạng, **đơn giá (giá trị bồi thường, không bắt buộc)**, ghi chú. Không tự trừ cọc. |
| Nhập cho nhiều phòng | **Bộ nội thất mẫu của tòa**, sao chép (không liên kết) vào phòng; từng phòng thêm/bớt/sửa tự do. |
| Bàn giao | **Chụp vào hợp đồng khi tạo HĐ**, cùng transaction với `create_contract_with_handover`. HĐ hiện có không chụp bổ sung. |
| Gia hạn | Không sửa `renew_contract_atomic`; đọc danh sách bàn giao theo chuỗi `previous_contract_id` về HĐ gốc. |
| Bộ sinh phòng | Theo dải tầng, thay hẳn bộ sinh PR0; có "Số thứ tự bắt đầu", công tắc "Gắn số tầng vào mã phòng", "Số tầng trong tên" tách khỏi tầng lưu DB; ≤ 99 phòng/tầng; không có nhiều mẫu đánh số (tiền tố tự do). |

## 4. Mô hình dữ liệu và RPC

Ba bảng mới, đều bật RLS, không policy, `revoke all` khỏi `public, anon, authenticated`, chỉ `service_role`.

### 4.1. `building_inventory_templates`

`id uuid pk`, `building_id → buildings on delete cascade`, `name text 1–100`, `quantity int 1–999`, `condition text in ('good','used','damaged') default 'good'`, `unit_value numeric(12,0) >= 0 null`, `note text <= 200 null`, `sort_order int`, `created_at`, `updated_at`; `unique (building_id, lower(name))`.

### 4.2. `room_inventory_items`

Cùng cột, `room_id → rooms on delete cascade` thay `building_id`; `unique (room_id, lower(name))`.

### 4.3. `contract_inventory_items`

`id`, `contract_id → contracts on delete cascade`, `name`, `quantity`, `condition`, `unit_value`, `note`, `sort_order`, `created_at`. Không có `updated_at`. Trigger chặn `update` (bản chụp không sửa được). Xóa chỉ xảy ra khi HĐ bị xóa cứng (luồng xóa HĐ hiện có xóa các bảng con trước; `cascade` bảo đảm không sót dòng).

### 4.4. RPC

- `apply_inventory_template(p_building_id uuid, p_room_ids uuid[], p_mode text) returns jsonb` — `merge` thêm món chưa có theo tên (không phân biệt hoa thường); `replace` xóa rồi chép. Khóa advisory theo tòa; mọi `room_id` phải thuộc `p_building_id`, nếu không `raise 'INVENTORY_ROOM_SCOPE'`. Trả `{ room_id: added_count }`.
- `create_rooms_batch` của PR0 **giữ nguyên**.
- `create_rooms_batch_idempotent(p_building_id, p_rooms, p_apply_inventory, p_actor_id, p_request_id) returns jsonb` — khóa `rooms.batch:<request_id>` trong `audit_operations`, cùng quy tắc PR0 (replay chỉ khi cùng actor; khác actor → `BUILDING_SETUP_REQUEST_CONFLICT`); gọi `create_rooms_batch`, nếu `p_apply_inventory` thì gọi `apply_inventory_template(..., 'merge')` lên các phòng vừa tạo, cùng transaction.
- `create_contract_with_handover` (định nghĩa mới nhất tại `20261001143337_contract_checkout_settlement.sql`) **giữ nguyên**. Thêm hàm bọc `create_contract_with_handover_and_inventory(<17 tham số cũ>, p_inventory jsonb)` gọi hàm cũ rồi ghi `contract_inventory_items`, cùng transaction; grant chỉ `service_role`.

## 5. Bộ sinh phòng, API, quyền

### 5.1. Bộ sinh (hàm thuần, mở rộng `useQuickRoomPreview`)

| Ô nhập | Mặc định | Ràng buộc |
| --- | --- | --- |
| Từ tầng / Đến tầng | 1 / 1 | 1–100; từ ≤ đến |
| Số phòng mỗi tầng | 3 | 1–99 |
| Tiền tố | `P` | ≤ 10 ký tự, tự do |
| Số thứ tự bắt đầu | 1 | ≥ 0; khi gắn số tầng: bắt đầu + số phòng − 1 ≤ 99 |
| Gắn số tầng vào mã phòng | bật nếu ≥ 2 tầng, tắt nếu 1 tầng | |
| Số tầng trong tên (tầng đầu) | = Từ tầng | ≥ 0; tầng sau tăng dần |
| Giá thuê / diện tích mặc định | | |

- Gắn số tầng: `{tiền tố}{số tầng trong tên}{STT 2 chữ số}`.
- Không gắn: `{tiền tố}{STT tối thiểu 2 chữ số}`, STT chạy liên tục qua các tầng.
- Tổng ≤ 200. Preview nhóm theo tầng, sửa từng ô (giữ override như PR0), xóa dòng, thêm dòng thủ công, đánh dấu và loại phòng đã tồn tại (lấy từ `GET /api/rooms?building_id=`).

### 5.2. API

| Route | Quyền | Ghi chú |
| --- | --- | --- |
| `POST /api/buildings/[id]/rooms/batch` | `rooms.create` + scope write | `{ request_id, rooms[], apply_inventory }`; idempotent; trùng → 409 `duplicate_room_numbers` |
| `GET` / `PUT /api/buildings/[id]/inventory-template` | đọc `rooms.read`; ghi `buildings.update` | `PUT` thay toàn bộ, ≤ 50 món |
| `POST /api/buildings/[id]/inventory-template/apply` | `rooms.update` + scope write | `{ room_ids[] 1–200, mode }` |
| `GET` / `PUT /api/rooms/[id]/inventory` | đọc `rooms.read`; ghi `rooms.update` + scope | `PUT` thay toàn bộ |
| `GET /api/contracts/[id]/handover-inventory` | `contracts.read` + scope | Theo chuỗi gia hạn về HĐ gốc |

- Validator tạo HĐ thêm `inventory?: InventoryItemInput[]` (≤ 50). Không gửi → service tự chụp nội thất hiện tại của phòng.

### 5.3. Audit

- `room.bulk_create` + `room.created` như PR0.
- `building.inventory_template.updated` (`item_count`).
- `room.inventory.updated` (`added`, `removed`, `changed`).
- `room.inventory.template_applied` (`mode`, `room_count`).
- Bàn giao trong HĐ không có audit riêng.

## 6. UI

Component dùng chung trong `app/components/inventory/`:

- `InventoryItemsEditor.vue` — bảng sửa trực tiếp (Tên, SL, Tình trạng, Đơn giá, Ghi chú), thêm/xóa dòng, báo trùng tên; mobile dạng thẻ.
- `InventoryItemsList.vue` — chỉ đọc, có tổng giá trị.
- `RoomBatchGenerator.vue` — ô nhập bộ sinh + preview nhóm theo tầng.

| Màn hình | Thay đổi |
| --- | --- |
| Tạo tòa | Thay khối tạo phòng nhanh PR0 bằng `RoomBatchGenerator`; không có tùy chọn nội thất. |
| Thêm phòng hàng loạt (`buildings/[id]/rooms/batch.vue`, mới) | `RoomBatchGenerator` + checkbox "Áp dụng nội thất mẫu (N món)" (tắt + link khi chưa có mẫu); lối vào từ danh sách phòng và chi tiết tòa. |
| Cài đặt tòa | Mục **"Nội thất mẫu"** (`#inventory-template`) + nút "Áp dụng cho phòng…" mở modal chọn phòng và chế độ ("Thêm món còn thiếu" mặc định, "Thay toàn bộ" cần `UiConfirmModal`). Manager chỉ đọc mẫu, vẫn áp dụng được. |
| Chi tiết phòng | Mục **"Nội thất"** (`InventoryItemsEditor`), nút "Áp dụng mẫu tòa", tổng giá trị tham chiếu. |
| Tạo HĐ (`ContractForm`) | Khối thu gọn "Nội thất bàn giao (N món)" điền sẵn từ phòng; sửa tình trạng/ghi chú/bỏ món chỉ cho HĐ này. |
| Chi tiết HĐ | Mục **"Bàn giao"** (`InventoryItemsList`); ghi chú khi lấy từ HĐ gốc. |
| Trả phòng | Panel tham chiếu "Nội thất đã bàn giao", chỉ đọc. |

Chất lượng UI: theo [ui-polish-workflow](../../../.agents/skills/zeno-house/references/ui-polish-workflow.md); bắt buộc `frontend-design` và Hallmark; dùng primitive sẵn có; token/primitive mới chỉ khi đánh giá kỹ và được duyệt. Trạng thái cần rà: tòa chưa có mẫu, phòng chưa có nội thất, trùng tên, trùng phòng, đang lưu, lỗi, mobile.

## 7. Kiểm thử và xác minh

| Lớp | File | Trọng tâm |
| --- | --- | --- |
| Bộ sinh | `tests/composables/useQuickRoomPreview.test.ts` | Gắn/không gắn tầng; số tầng trong tên ≠ tầng DB; STT bắt đầu; ≤ 99/tầng, ≤ 200; STT liên tục khi không gắn; xóa/thêm dòng; loại phòng đã có; giữ override |
| Validator | `tests/utils/inventory-validators.test.ts` | Giới hạn trường; ≤ 50; trùng tên không phân biệt hoa thường báo đúng index; body batch/apply |
| Service/API | `tests/server/inventory/*.test.ts`, `tests/server/rooms-batch.api.test.ts` | Quyền; áp dụng lên phòng tòa khác bị chặn; replay batch; audit |
| Tạo HĐ | `tests/server/contracts*.test.ts` | Không gửi → chụp từ phòng; có gửi → dùng client; `p_inventory` đúng; phòng trống → rỗng |
| Bàn giao | `tests/server/contracts/handover-inventory.test.ts` | Theo chuỗi gia hạn; chuỗi trống → rỗng |
| UI | test component + test mã nguồn | Editor; checkbox tắt khi chưa có mẫu; trang tạo tòa dùng `RoomBatchGenerator` |

- Migration `supabase/migrations/<ts>_inventory_lite.sql` chạy **sau** migration PR0: 3 bảng + trigger; `apply_inventory_template`; `create_rooms_batch_idempotent`; `create_contract_with_handover_and_inventory`. Không sửa hàm nào đang có.
- Script `supabase/verification/inventory_lite.sql`: hàm bọc ghi bàn giao cùng transaction, lỗi chỉ số → rollback cả HĐ và bàn giao; `update` bàn giao bị chặn; `apply_inventory_template` chặn phòng khác tòa; `merge` không trùng; replay batch; grant.
- Thứ tự triển khai: áp migration → xác minh → deploy app gọi hàm bọc; hàm cũ không đổi nên không có khoảng hở.
- Regenerate types; áp dụng cloud là gate riêng.

## 8. Tài liệu

- Bundle `index.md`, `design.md`, `implementation-plan.md`, `verification.md`; liên kết từ [brief](../zeno-house-v2-optimization/brief.md) và [changes index](../index.md).
- Khi chấp nhận: tạo `docs/capabilities/room-inventory.md`; cập nhật [rooms-api](../../capabilities/rooms-api.md), [rooms-ui](../../capabilities/rooms-ui.md), [contracts-api](../../capabilities/contracts-api.md), [buildings-ui](../../capabilities/buildings-ui.md).

## 9. Ngoài phạm vi PR2

- Phụ lục 1 trong DOCX (PR4).
- Ghi tình trạng khi trả phòng, tự khấu trừ cọc.
- Khấu hao, kho, serial.
- Chụp bổ sung cho HĐ hiện có.
- Mẫu nội thất ngay trên trang tạo tòa.
