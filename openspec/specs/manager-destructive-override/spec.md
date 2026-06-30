# manager-destructive-override Specification

## Purpose
TBD - created by archiving change access-control-manager-scope. Update Purpose after archive.
## Requirements
### Requirement: Manager mặc định không có quyền hard-delete master data

Mọi assignment mới SHALL có `can_delete_master_data = false` mặc định. Manager SHALL NOT thực hiện được hard-delete room, tenant, contract, building service, contract service khi `can_delete_master_data = false` cho building đó.

#### Scenario: Manager mới được gán vào building, thử xóa room
- **WHEN** manager có assignment mới (`can_delete_master_data = false`) gọi `DELETE /api/rooms/:id`
- **THEN** response là 403 Forbidden

#### Scenario: Manager không có flag thử xóa tenant
- **WHEN** manager với `can_delete_master_data = false` gọi `DELETE /api/tenants/:code`
- **THEN** response là 403 Forbidden

#### Scenario: Manager không có flag thử xóa contract
- **WHEN** manager với `can_delete_master_data = false` gọi `DELETE /api/contracts/:code`
- **THEN** response là 403 Forbidden

---

### Requirement: Manager với flag có thể hard-delete master data trong assigned building kèm reason

Khi `can_delete_master_data = true` cho building, manager SHALL có thể hard-delete room, tenant, contract, building service trong building đó. Destructive request SHALL yêu cầu `reason` field. Action SHALL được audit log.

#### Scenario: Manager có flag xóa room trong assigned building
- **WHEN** manager có `can_delete_master_data = true` cho building gọi `DELETE /api/rooms/:id` với `{ "reason": "..." }`
- **THEN** room bị delete, action được ghi vào audit log với reason

#### Scenario: Manager có flag xóa room nhưng thiếu reason
- **WHEN** manager có `can_delete_master_data = true` gọi `DELETE /api/rooms/:id` không có `reason` field
- **THEN** response là 422 Validation Error

#### Scenario: Manager có flag ở building A không thể xóa room ở building B
- **WHEN** manager có `can_delete_master_data = true` cho building A nhưng không có cho building B
- **THEN** DELETE room trong building B trả 403 Forbidden

---

### Requirement: `can_delete_master_data` không mở khóa billing destructive actions

Flag `can_delete_master_data = true` SHALL NOT cấp quyền `billing.close`, `billing.unissue`, `invoice.void`, `invoice.reissue`, `invoice.adjustment`. Những actions này vẫn theo permission model riêng (`billing.close`/`billing.unissue` admin-only, `billing.corrections` capability).

#### Scenario: Manager có flag thử close billing period
- **WHEN** manager với `can_delete_master_data = true` gọi `POST /api/billing/periods/:id/close`
- **THEN** response là 403 Forbidden (thiếu `billing.close` capability)

#### Scenario: Manager có flag thử unissue billing period
- **WHEN** manager với `can_delete_master_data = true` gọi `POST /api/billing/periods/:id/unissue`
- **THEN** response là 403 Forbidden (thiếu `billing.unissue` capability)

---

### Requirement: Admin có thể delete master data, action được audit

Admin SHALL có thể hard-delete room/tenant/contract/service bất kể `can_delete_master_data`. Admin delete action SHALL được ghi vào audit log.

#### Scenario: Admin xóa room
- **WHEN** admin gọi `DELETE /api/rooms/:id` với `{ "reason": "..." }`
- **THEN** room bị delete, action ghi audit log

---

### Requirement: UI hiển thị disabled delete button với tooltip khi thiếu quyền

Internal app (admin/manager) SHALL render delete button nhưng ở trạng thái disabled kèm tooltip giải thích khi user không có `can_delete_master_data` cho building hiện tại. Button SHALL enabled khi có quyền.

#### Scenario: Manager không có flag — thấy disabled delete button
- **WHEN** manager xem detail page của room trong building mà mình không có `can_delete_master_data`
- **THEN** delete button hiển thị disabled với tooltip "Bạn không có quyền xoá dữ liệu này trong building hiện tại. Liên hệ admin nếu cần thao tác."

#### Scenario: Manager có flag — thấy enabled delete button
- **WHEN** manager xem detail page của room trong building mà mình có `can_delete_master_data = true`
- **THEN** delete button enabled, không có tooltip

#### Scenario: API vẫn block dù UI bị bypass
- **WHEN** manager không có flag gọi trực tiếp DELETE API (bỏ qua UI disabled state)
- **THEN** API trả 403 Forbidden

---

### Requirement: `billing.corrections` là capability riêng cho void/reissue/adjustment

System SHALL kiểm tra `billing.corrections` (không phải `billing.write`) cho invoice void, reissue, adjustment. Manager SHALL có `billing.corrections` mặc định, giữ nguyên workflow hiện tại.

#### Scenario: Manager void invoice trong assigned building
- **WHEN** manager có `billing.corrections` gọi `POST /api/billing/invoices/:id/void`
- **THEN** invoice bị void thành công

#### Scenario: User không có billing.corrections thử void invoice
- **WHEN** user không có `billing.corrections` capability gọi void endpoint
- **THEN** response là 403 Forbidden
