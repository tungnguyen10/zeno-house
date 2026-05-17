## Context

Table `contract_occupants` đã tồn tại trong DB với RLS đúng. Interface `ContractOccupant` đang nằm nhờ trong `app/types/meter-devices.ts`. Chưa có API, service, repository, composable, hay UI nào cho occupants. Contract detail page hiện hiển thị tenant chính nhưng không có section "người ở chung".

## Goals / Non-Goals

**Goals:**
- CRUD occupants qua API (list, add, move-out, delete)
- UI trên contract detail: xem danh sách, thêm roommate, ghi nhận move-out
- Admin: full CRUD; Manager: read-only

**Non-Goals:**
- Không tạo tenant mới từ form này — roommate phải là tenant đã tồn tại
- Không billing logic — `billing_counted` lưu nhưng chưa dùng
- Không thay đổi DB schema

## Decisions

**D1: Move-out thay vì delete**
Khi roommate rời phòng, set `move_out_date = today` thay vì xoá record. Phù hợp thiết kế gốc (lịch sử ra vào). Admin vẫn có thể xoá hoàn toàn nếu nhập nhầm.

**D2: Tenant picker là free-text search**
Form thêm roommate cần chọn tenant từ danh sách. Dùng `useTenantList` có sẵn để search theo tên, hiển thị dropdown. Không cần component picker mới — dùng `<select>` hoặc combobox đơn giản trong form.

**D3: Type file riêng**
Move `ContractOccupant` ra `app/types/contract-occupants.ts` riêng, xoá khỏi `meter-devices.ts`. Consistent với pattern của `contract-payments.ts`, `contract-renewals.ts`.

**D4: Tách `primary` khỏi danh sách roommate trong UI**
Hiển thị tenant chính (từ `contract.tenantId`) riêng ở đầu section, bên dưới list các roommate (`role = 'roommate'`, chưa có `move_out_date`). Người đã move-out hiển thị mờ với ngày kết thúc.

## Risks / Trade-offs

- **[Risk]** Tenant picker trong form nếu có nhiều tenant → Mitigation: tìm kiếm theo tên, limit kết quả
- **[Risk]** Trùng lặp occupant (thêm cùng 1 tenant 2 lần) → Mitigation: server check unique (contract_id, tenant_id) khi chưa có move_out_date
