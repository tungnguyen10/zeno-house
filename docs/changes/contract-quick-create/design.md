---
type: Change Design
title: "contract-quick-create-design"
status: draft
change_state: design-review
tags: [superpowers, change, contracts, v2]
---

# PR4a — Contract Quick Create (atomic)

> Sub-project PR4a của [ZENO House V2 — Flow Optimization Brief](../zeno-house-v2-optimization/brief.md). Phụ thuộc PR1 ([building-contract-defaults](../building-contract-defaults/design.md)), PR2 ([room-setup-inventory-lite](../room-setup-inventory-lite/design.md)), PR3 ([tenant-quick-create](../tenant-quick-create/design.md)). Phần xuất DOCX tách sang PR4b ([contract-documents](../contract-documents/design.md)).

## 1. Mục tiêu

- Tạo HĐ từ phòng trống trong một luồng ngắn, điền sẵn mặc định của tòa (PR1), nội thất (PR2), khách (PR3).
- **Một transaction** tạo: HĐ + 2 chỉ số bàn giao + nội thất bàn giao + người ở cùng + xe + dịch vụ + chuyển phòng sang `occupied`. Không còn trạng thái "HĐ đã tạo nhưng thiếu người ở" (brief, vấn đề số 3).
- Lưu danh sách xe đăng ký (chủ xe, biển số, loại/ghi chú) theo HĐ, chỉnh sửa được sau.
- Bấm lại sau lỗi mạng không tạo HĐ trùng.

## 2. Hiện trạng

- `contracts/create.vue`: wizard 3 bước (HĐ → người ở → dịch vụ). Bước 2 gọi `POST /api/contracts` rồi `Promise.allSettled` thêm người ở (thành công một phần); bước 3 sửa dịch vụ **sau** khi HĐ đã tạo.
- `ContractService.create`: kiểm tra phòng/khách, gọi RPC tạo HĐ + bàn giao (PR2: kèm nội thất), rồi **best-effort** `cloneFromBuilding` dịch vụ, cập nhật phòng `occupied`, audit — các bước sau RPC không nguyên tử.
- `ContractOccupantService.add` kiểm tra: không phải khách chính, không đứng tên HĐ khác, không ở HĐ khác (unique index `contract_occupants_active_tenant_unique`), không trùng trong HĐ, không vượt `occupant_count`.
- Không có dữ liệu xe; chỉ có `contract_services.quantity` cho dịch vụ `per_vehicle`.
- `useContractForm` lưu bản nháp wizard (`currentStep`, `pendingOccupants`, `selectedServices`).

## 3. Quyết định đã chốt

| Câu hỏi | Quyết định |
| --- | --- |
| Bố cục | Giữ wizard, rút gọn và cho bỏ qua bước tùy chọn. |
| Danh sách xe | Thêm bảng xe theo HĐ (chủ xe, biển số, loại/ghi chú), nhập khi tạo HĐ, sửa được sau. |
| Người ở cùng | Phải đủ giấy tờ khi **xuất DOCX** (PR4b); khi tạo HĐ không bắt buộc. |

## 4. Wizard

| Bước | Nội dung | Bắt buộc |
| --- | --- | --- |
| 1. Hợp đồng | Phòng, khách (`TenantPicker`), ngày bắt đầu/kết thúc, giá thuê, tiền cọc, ngày đến hạn riêng, số người ở, ghi chú | Có |
| 2. Bàn giao | Chỉ số điện/nước + ngày đọc; nội thất bàn giao (PR2) | Có (chỉ số) |
| 3. Bổ sung | Người ở cùng (`ContractOccupantForm`), xe, dịch vụ (điền sẵn từ dịch vụ đang bật của tòa; sửa đơn giá/số lượng/ghi chú/tắt) | Không — nút **"Bỏ qua"** |
| 4. Xác nhận | Tóm tắt toàn bộ; cảnh báo nếu số người ở cùng + 1 > số người ở, số xe ≠ số lượng dịch vụ gửi xe | — nút **"Tạo hợp đồng"** |

- Sau khi tạo: màn **"Đã tạo hợp đồng {mã}"** với nút "Xem hợp đồng" và "Xuất hợp đồng (DOCX)" (PR4b; ẩn nếu PR4b chưa triển khai).
- Điền sẵn khi chọn phòng (chỉ khi người dùng chưa sửa trường đó):
  - `monthly_rent` = giá phòng (như hiện tại).
  - `end_date` = `start_date` + `default_term_months` (PR1) − 1 ngày.
  - `deposit` = làm tròn nghìn của `monthly_rent × default_deposit_months`.
  - Nguồn mặc định: `GET /api/buildings/{id}/contract-profile` (manager đọc được bản che; chỉ cần các trường mặc định).
- Bản nháp: giữ cơ chế `useContractForm`; thêm `vehicles`, `services` vào `wizardState`. Không lưu thông tin khách (chỉ `tenant_id`, `tenantName`).

## 5. Dữ liệu và RPC

### 5.1. `contract_vehicles`

`id uuid pk`, `contract_id → contracts on delete cascade`, `owner_name text 1–100`, `plate_number text 1–20` (lưu dạng chuẩn hóa: in hoa, bỏ khoảng trắng thừa), `vehicle_type text <= 50 null`, `note text <= 200 null`, `sort_order int`, `created_at`, `updated_at`; `unique (contract_id, plate_number)`. RLS bật, không policy, chỉ `service_role`.

### 5.2. `create_contract_full(...)`

`create_contract_full(p_contract jsonb, p_inventory jsonb, p_occupants jsonb, p_vehicles jsonb, p_services jsonb, p_actor_id uuid, p_request_id uuid) returns jsonb` — `security invoker`, `search_path = ''`, chỉ `service_role`.

1. Idempotency `contract.create:<request_id>` trong `audit_operations` (như PR0): cùng actor → trả `{ contract_id, replayed: true }`; khác actor → `CONTRACT_CREATE_REQUEST_CONFLICT`.
2. Gọi `create_contract_with_handover_and_inventory` (PR2) với các trường từ `p_contract`.
3. Người ở cùng: kiểm tra số lượng (`1 + count <= occupant_count`, nếu không `CONTRACT_OCCUPANT_LIMIT`), không trùng khách chính (`CONTRACT_OCCUPANT_PRIMARY`), rồi insert `contract_occupants(role='roommate')`; unique index chặn khách đang ở nơi khác (`23505` → `CONTRACT_OCCUPANT_BUSY`).
4. Xe: insert `contract_vehicles`.
5. Dịch vụ: nếu `p_services` null → chép dịch vụ đang bật của tòa (như `cloneFromBuilding`); nếu là mảng → insert đúng danh sách (`catalog_id` phải thuộc dịch vụ của tòa, nếu không `CONTRACT_SERVICE_INVALID`).
6. Nếu `status = 'active'`: `update rooms set status = 'occupied'`.
7. Ghi `audit_operations` completed; trả `{ contract_id, replayed: false }`.

Không sửa `create_contract_with_handover`, `create_contract_with_handover_and_inventory`.

### 5.3. Service / API

- `contractCreateSchema` thêm: `request_id: uuid` (bắt buộc với route mới), `occupants?: { tenant_id, move_in_date, billing_counted }[] (≤ 10)`, `vehicles?: VehicleInput[] (≤ 10)`, `services?: { catalog_id, amount, quantity, is_enabled, notes }[]`.
- `ContractService.create` giữ các kiểm tra trước RPC (phòng, bảo trì, xung đột khách chính, giá thuê), thêm kiểm tra người ở cùng bằng repository hiện có để trả thông báo thân thiện trước khi gọi RPC; gọi `create_contract_full`; bỏ `cloneFromBuilding` best-effort và `RoomRepository.update` sau RPC; audit sau commit: `CONTRACT_CREATED`, `ROOM_UPDATED`, N × `CONTRACT_OCCUPANT_ADDED`, `contract.vehicles.updated` (count). Replay → không audit.
- Lỗi RPC map sang 409/422 với thông báo tiếng Việt, không lộ tên index.
- Xe sau khi tạo: `GET` / `PUT /api/contracts/[id]/vehicles` (thay toàn bộ; quyền `contracts.read` / `contracts.update` + scope); audit `contract.vehicles.updated` với `count`.

## 6. UI

- `ContractWizardSteps` nhận 4 bước; bước 3 hiển thị nhãn "tùy chọn".
- Component mới `ContractVehiclesEditor.vue` (bảng: chủ xe, biển số, loại/ghi chú; mobile dạng thẻ); dùng trong wizard và mục **"Xe"** ở chi tiết HĐ (`sectionIds` thêm `'vehicles'` sau `'occupants'`).
- `ContractServicesTab` dùng lại cho danh sách dịch vụ chưa lưu (chế độ local, không gọi API) — thêm prop `mode: 'local' | 'remote'` hoặc tách `ContractServicesEditor` nếu tab gắn chặt API.
- Màn xác nhận: `UiDefinitionList` theo nhóm; cảnh báo dạng `UiAlert severity="warning"`.
- Theo [ui-polish-workflow](../../../.agents/skills/zeno-house/references/ui-polish-workflow.md); bắt buộc `frontend-design` + Hallmark; primitive sẵn có; token/primitive mới chỉ khi đánh giá kỹ và được duyệt. Trạng thái: bỏ qua bước 3, quay lại sửa, lỗi 409 từng loại, bấm lại sau lỗi mạng, mobile.

## 7. Kiểm thử

| Lớp | Trọng tâm |
| --- | --- |
| SQL verification | Idempotency (cùng/khác actor); vượt `occupant_count` → rollback toàn bộ (không còn HĐ, chỉ số, nội thất); người ở đang ở nơi khác → rollback; `p_services` null → chép dịch vụ tòa; service lạ → rollback; phòng `occupied` |
| Validator | Biển số chuẩn hóa; trùng biển số; giới hạn số lượng; `request_id` |
| Service/API | Payload RPC đúng; mapping lỗi; replay không audit; audit đủ sự kiện |
| Composable/UI | Điền sẵn ngày kết thúc/cọc theo PR1 (không ghi đè trường đã sửa); bỏ qua bước 3; `request_id` ổn định; màn hoàn tất; mục Xe ở chi tiết HĐ |

## 8. Tài liệu

- Bundle `index.md`, `design.md`, `implementation-plan.md`, `verification.md`; link từ brief và changes index.
- Khi chấp nhận: cập nhật [contracts-api](../../capabilities/contracts-api.md), [contracts-ui](../../capabilities/contracts-ui.md), [contracts-client](../../capabilities/contracts-client.md), [contracts-database](../../capabilities/contracts-database.md), [contract-occupants-api](../../capabilities/contract-occupants-api.md).

## 9. Ngoài phạm vi

- DOCX, phụ lục, snapshot tài liệu (PR4b).
- Tự đồng bộ số lượng dịch vụ gửi xe theo số xe.
- Sửa luồng gia hạn/trả phòng.
