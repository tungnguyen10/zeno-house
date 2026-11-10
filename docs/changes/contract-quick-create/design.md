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

- Tạo HĐ từ phòng trống trên **một trang**, điền sẵn tối đa từ mặc định của tòa (PR1), nội thất (PR2), khách (PR3); ca phổ biến chỉ cần chọn phòng, chọn khách, bấm tạo.
- Bản nháp lưu trên server, mở ở trình duyệt khác vẫn còn.
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
| Bố cục | **Một trang**, bỏ wizard. Bốn khối luôn hiện: Phòng, Khách, Điều khoản, Bàn giao. Các khối thu gọn sẵn: Người ở cùng, Xe, Dịch vụ, Nội thất; có chỉ báo khi đã nhập. |
| Trường bắt buộc | Phòng, khách, giá thuê, ngày bắt đầu/kết thúc. Chỉ số điện/nước bàn giao tự điền từ số gần nhất nên thường không phải nhập; chỉ bắt nhập khi phòng chưa từng có chỉ số (giữ mốc tính tiền đầu tiên của V1). |
| Bàn giao "hoàn tất sau" | Nội thất bàn giao sửa được sau khi tạo HĐ, tới khi phát hành DOCX hợp đồng; sau đó khóa (PR4b). |
| Thao tác | Nút chính "Tạo & xuất DOCX" (phụ: "Tạo hợp đồng"); không có bước/modal xác nhận; nhớ lựa chọn gần nhất theo tòa. |
| Lỗi | Báo tại ô; khi bấm tạo, cuộn tới lỗi đầu tiên và tự mở khối đang thu gọn chứa lỗi. |
| Bản nháp | Lưu trên server theo người dùng (thay localStorage). |
| Danh sách xe | Bảng xe theo HĐ (chủ xe, biển số, loại/ghi chú), nhập khi tạo HĐ, sửa được sau. |
| Người ở cùng | Phải đủ giấy tờ khi **xuất DOCX** (PR4b); khi tạo HĐ không bắt buộc. |

## 4. Trang tạo hợp đồng

| Khối | Nội dung | Mặc định |
| --- | --- | --- |
| **Phòng** (luôn hiện) | Chọn phòng trống; nhận `room_id` dạng uuid hoặc code từ query (PR3) | — |
| **Khách** (luôn hiện) | `TenantPicker` (PR3): chọn khách cũ, thêm nhanh, hoặc chụp CCCD khi PR5 bật | — |
| **Điều khoản** (luôn hiện) | Ngày bắt đầu, ngày kết thúc, giá thuê, tiền cọc, ngày đến hạn riêng, số người ở, ghi chú; dòng tóm tắt "Điều khoản áp dụng theo mẫu mặc định của tòa" (đọc từ PR1, link xem chi tiết) | Ngày bắt đầu = hôm nay; giá = giá phòng; kết thúc = bắt đầu + `default_term_months` − 1 ngày; cọc = làm tròn nghìn của giá × `default_deposit_months`; ngày đến hạn riêng để trống (hiện giá trị hiệu lực lấy từ tòa) |
| **Bàn giao** (luôn hiện) | Chỉ số điện/nước + ngày đọc | Điền từ chỉ số gần nhất; ngày đọc = ngày bắt đầu |
| Người ở cùng (thu gọn) | `ContractOccupantForm` (PR3) | Trống |
| Xe (thu gọn) | `ContractVehiclesEditor` | Trống |
| Dịch vụ (thu gọn) | Dịch vụ đang bật của tòa; sửa đơn giá/số lượng/ghi chú/tắt | Từ tòa |
| Nội thất (thu gọn) | Nội thất bàn giao (PR2) | Từ phòng |

- Khối thu gọn có chỉ báo ở tiêu đề: số người, số xe, số dịch vụ đã đổi, số món nội thất.
- **Thứ tự ưu tiên khi điền sẵn:** giá trị người dùng đã sửa > lựa chọn gần nhất của người dùng cho tòa đó > mặc định của tòa. Không ghi đè trường đã sửa.
- **Nhớ lựa chọn gần nhất theo tòa:** sau khi tạo thành công, lưu `localStorage` khóa `contract-create:prefs:{buildingId}` gồm `termMonths`, `depositMonths`, `paymentDueDay`, `occupantCount` và trạng thái mở/thu của các khối. Không chứa dữ liệu cá nhân.
- **Nút:** "Tạo & xuất DOCX" (chính) và "Tạo hợp đồng" (phụ). Không có bước hoặc modal xác nhận. Cảnh báo không chặn (số người ở cùng vượt `occupant_count`, số xe khác số lượng dịch vụ gửi xe) hiện ngay dưới khối liên quan.
- **Kiểm tra trước khi xuất:** khi đã chọn phòng và khách, trang gọi kiểm tra sẵn sàng DOCX (PR4b). Nếu còn thiếu, nút chính đổi thành "Tạo hợp đồng" và hiện danh sách mục thiếu kèm link; vẫn tạo được hợp đồng.
- **Lỗi:** báo tại ô; bấm tạo thì cuộn tới lỗi đầu tiên và tự mở khối thu gọn chứa lỗi. Lỗi 409 từ server gắn vào khối tương ứng (người ở đang ở nơi khác → khối Người ở cùng).
- **Sau khi tạo:** màn "Đã tạo hợp đồng {mã}" với "Xem hợp đồng"; nếu bấm "Tạo & xuất DOCX" thì phát hành ngay (PR4b) và hiện nút tải file, hoặc danh sách mục thiếu / nút "Tạo lại file" nếu sinh file lỗi. Hợp đồng luôn được giữ.

### 4.1. Bản nháp trên server

- Bảng `contract_create_drafts`: `user_id uuid pk → auth.users on delete cascade`, `payload jsonb not null` (≤ 64 KB), `updated_at`. Mỗi người dùng một bản nháp tạo HĐ. RLS bật, không policy, chỉ `service_role`.
- `payload` theo `contractCreateDraftSchema` (mọi trường không bắt buộc): các trường form, `tenant_id` + tên hiển thị, người ở cùng (id + tên), xe, dịch vụ đã sửa, nội thất. **Không** chứa dữ liệu trong dialog thêm nhanh khách (CCCD, ngày sinh…).
- API: `GET` / `PUT` / `DELETE /api/contracts/create-draft` (quyền `contracts.create`; chỉ đọc/ghi bản của chính mình). Lưu tự động sau 1 giây không gõ; xóa khi tạo thành công. Bản nháp cũ hơn 30 ngày bị xóa khi đọc.
- Bỏ bản nháp `localStorage` của wizard cũ; khi mở trang, nếu còn bản nháp `localStorage` cũ thì xóa đi.

### 4.2. Nội thất bàn giao hoàn tất sau

- `PUT /api/contracts/[id]/handover-inventory` (quyền `contracts.update` + scope): thay toàn bộ danh sách bàn giao của chính hợp đồng đó. Hợp đồng gia hạn đang dùng danh sách của hợp đồng gốc thì ghi danh sách riêng cho hợp đồng mới.
- PR4a chưa có bảng tài liệu nên chưa khóa; PR4b thêm khóa ở DB khi hợp đồng đã có DOCX hợp đồng `issued`/`signed`.
- Chi tiết HĐ: mục "Bàn giao" (PR2) có nút "Sửa" khi chưa khóa.

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

- Trang `contracts/create.vue` viết lại thành một trang; bỏ `ContractWizardSteps` khỏi trang này. Tách `ContractForm` thành các khối dùng lại được (`ContractTermsFields`, `ContractHandoverFields`) để trang sửa HĐ vẫn dùng `ContractForm` như cũ.
- Khối thu gọn dùng primitive có sẵn (`UiFormSection` có trạng thái mở/đóng hoặc `UiDisclosure` nếu có); nếu chưa có primitive thu gọn thì đánh giá và xin duyệt trước khi tạo.
- Component mới `ContractVehiclesEditor.vue` (chủ xe, biển số, loại/ghi chú; mobile dạng thẻ); dùng ở trang tạo và mục **"Xe"** ở chi tiết HĐ (`sectionIds` thêm `'vehicles'` sau `'occupants'`).
- `ContractServicesEditor` (chế độ cục bộ, không gọi API) cho khối Dịch vụ.
- Thanh hành động dính đáy trên mobile với hai nút tạo.
- Theo [ui-polish-workflow](../../../.agents/skills/zeno-house/references/ui-polish-workflow.md); bắt buộc `frontend-design` + Hallmark; primitive sẵn có; token/primitive mới chỉ khi đánh giá kỹ và được duyệt. Trạng thái: ca ngắn nhất (phòng + khách), phòng chưa có chỉ số, lỗi trong khối thu gọn, lỗi 409 từng loại, bấm lại sau lỗi mạng, khôi phục bản nháp, thiếu dữ liệu DOCX, mobile.

## 7. Kiểm thử

| Lớp | Trọng tâm |
| --- | --- |
| SQL verification | Idempotency (cùng/khác actor); vượt `occupant_count` → rollback toàn bộ (không còn HĐ, chỉ số, nội thất); người ở đang ở nơi khác → rollback; `p_services` null → chép dịch vụ tòa; service lạ → rollback; phòng `occupied`; bảng bản nháp khóa với client |
| Validator | Biển số chuẩn hóa; trùng biển số; giới hạn số lượng; `request_id`; schema bản nháp từ chối trường CCCD/ngày sinh |
| Service/API | Payload RPC đúng; mapping lỗi; replay không audit; audit đủ sự kiện; bản nháp chỉ của chính mình, quá 64 KB → 413, quá 30 ngày → xem như không có; sửa nội thất bàn giao sau khi tạo |
| Composable/UI | Thứ tự ưu tiên điền sẵn (đã sửa > gần nhất > tòa); chỉ số bắt buộc chỉ khi không có số trước; cuộn tới lỗi và mở khối thu gọn; `request_id` ổn định; bản nháp server tự lưu/khôi phục/xóa; màn hoàn tất; mục Xe ở chi tiết HĐ |

## 8. Tài liệu

- Bundle `index.md`, `design.md`, `implementation-plan.md`, `verification.md`; link từ brief và changes index.
- Khi chấp nhận: cập nhật [contracts-api](../../capabilities/contracts-api.md), [contracts-ui](../../capabilities/contracts-ui.md), [contracts-client](../../capabilities/contracts-client.md), [contracts-database](../../capabilities/contracts-database.md), [contract-occupants-api](../../capabilities/contract-occupants-api.md).

## 9. Ngoài phạm vi

- DOCX, phụ lục, snapshot tài liệu, kiểm tra sẵn sàng DOCX, khóa nội thất sau phát hành (PR4b).
- Cho tạo HĐ khi phòng chưa từng có chỉ số mà không nhập chỉ số bàn giao.
- Tự đồng bộ số lượng dịch vụ gửi xe theo số xe.
- Sửa luồng gia hạn/trả phòng.
