---
type: Capability Specification
title: "manager-assignment-ui"
status: stable
tags: [capability, requirements]
sources:
  - resource: "https://github.com/tungnguyen10/zeno-house/blob/ae95811bbdc1932368b4e6b9ed3e9540399d26e6/openspec/specs/manager-assignment-ui/spec.md"
generated:
  by: "process:okf-migration"
  at: "2026-11-06T00:00:00Z"
---

# manager-assignment-ui Specification

## Purpose
TBD - created by archiving change access-control-manager-scope. Update Purpose after archive.
## Requirements
### Requirement: Admin thấy tất cả managers và assignments của họ

Trang Settings user management (`/dashboard/settings/managers`, mục `Người dùng`) SHALL be accessible to admin and owner, with different visibility. Trang SHALL là danh sách gọn có tìm kiếm theo tên/email và (chỉ admin) lọc theo vai trò; mỗi dòng mở ngăn chi tiết người dùng. Admin SHALL see all owners, managers, assignments, and buildings. Owner SHALL see only manager assignments for buildings in owner scope. Manager SHALL NOT access this page.

#### Scenario: Admin truy cập /dashboard/settings/managers
- **WHEN** admin navigate đến `/dashboard/settings/managers`
- **THEN** page hiển thị tất cả owners/managers và bộ lọc vai trò, và ngăn chi tiết của mỗi người liệt kê assignments của họ

#### Scenario: Owner truy cập /dashboard/settings/managers
- **WHEN** owner navigate đến `/dashboard/settings/managers`
- **THEN** page hiển thị managers thuộc buildings trong owner scope hoặc do owner tạo (`created_by`), không có bộ lọc vai trò, và dòng owner khác không mở được ngăn chi tiết

#### Scenario: Manager thử truy cập /dashboard/settings/managers
- **WHEN** manager navigate đến `/dashboard/settings/managers`
- **THEN** redirect về `/dashboard` hoặc 403

---

### Requirement: Admin assign manager vào building

Admin SHALL có thể gán manager vào building từ ngăn chi tiết người dùng trên trang `/dashboard/settings/managers` (control chọn tòa nhà chỉ liệt kê các tòa chưa gán). Assignment mới SHALL có `can_delete_master_data = false` mặc định. Thao tác thất bại SHALL hiện toast lỗi và giữ ngăn mở.

#### Scenario: Admin gán manager vào building chưa được gán
- **WHEN** admin mở ngăn chi tiết của manager, chọn building, submit assign
- **THEN** `user_building_assignments` row được tạo, manager có thể thấy building ngay lập tức

#### Scenario: Admin thử gán manager vào building đã được gán
- **WHEN** admin thử gán lần 2 cùng manager + building (ví dụ từ một phiên cũ)
- **THEN** conflict được xử lý gracefully (không duplicate, hiển thị thông báo)

---

### Requirement: Admin unassign manager khỏi building

Admin SHALL có thể xoá assignment bằng nút `Bỏ gán` trên dòng tòa nhà trong ngăn chi tiết, manager SHALL mất access vào building đó ngay lập tức. `Bỏ gán` không xoá người dùng.

#### Scenario: Admin xoá assignment
- **WHEN** admin click `Bỏ gán` cho 1 manager-building pair trong ngăn chi tiết
- **THEN** assignment bị xoá, manager không còn thấy building đó trong list

---

### Requirement: Admin toggle can_delete_master_data

Admin SHALL có thể bật/tắt `can_delete_master_data` (công tắc `Cho xoá dữ liệu`) cho từng assignment trong ngăn chi tiết. Thay đổi SHALL có effect ngay lập tức (next request của manager).

#### Scenario: Admin bật can_delete_master_data cho manager ở building A
- **WHEN** admin toggle `can_delete_master_data = true` cho assignment
- **THEN** manager có thể delete master data trong building A ngay sau đó

#### Scenario: can_delete_master_data ở building A không ảnh hưởng building B
- **WHEN** admin bật flag cho manager ở building A
- **THEN** manager vẫn không có quyền delete ở building B

---

### Requirement: Warning khi building không có manager nào

System SHALL hiển thị warning cho admin khi có building không có bất kỳ manager nào được gán.

#### Scenario: Building không có manager
- **WHEN** admin xem trang managers và có building chưa được gán cho ai
- **THEN** page hiển thị cảnh báo (`UiAlert`) nêu số lượng và tên các building đó

---

### Requirement: Building settings hiển thị contextual section assigned managers

Trang `/buildings/:id/settings` SHALL có section "Quản lý phân quyền" hiển thị danh sách managers được gán vào building đó và link về `/dashboard/settings/managers` để admin có thể quản lý.

#### Scenario: Admin xem building settings
- **WHEN** admin mở `/buildings/:id/settings`
- **THEN** section "Managers" hiển thị tên managers đang được gán, kèm link "Quản lý phân quyền" tới `/dashboard/settings/managers`

#### Scenario: Manager xem building settings
- **WHEN** manager mở `/buildings/:id/settings` (assigned building)
- **THEN** section managers hiển thị read-only, không có link quản lý

#### Scenario: Owner xem building settings
- **WHEN** owner mở `/buildings/:id/settings` cho building trong scope
- **THEN** section managers hiển thị managers thuộc building đó, kèm link quản lý phân quyền trong scope

---

### Requirement: Assignment changes có effect ngay lập tức

Thay đổi assignment (add/remove/toggle) SHALL được phản ánh trong scope resolution của request kế tiếp từ manager. Không cần re-login.

#### Scenario: Admin xoá assignment, manager refresh page ngay sau
- **WHEN** admin xoá assignment của manager với building X, manager gọi API ngay sau đó
- **THEN** manager không còn thấy building X (lazy cache bị expire theo request lifecycle)

### Requirement: Settings supports creating owners and managers by role
Settings user management SHALL expose create-owner actions only to admin and create-manager actions to admin or owner, through a `Thêm người dùng` modal opened from the page header. The modal SHALL keep entered data and show the error inline when creation fails, and SHALL NOT duplicate that error as a toast. The UI SHALL NOT expose create-admin actions.

#### Scenario: Admin sees create owner
- **WHEN** admin opens the `Thêm người dùng` modal
- **THEN** the owner role option is available

#### Scenario: Owner does not see create owner
- **WHEN** owner opens the `Thêm người dùng` modal
- **THEN** only the manager role option is available

#### Scenario: No create admin control
- **WHEN** admin or owner opens the `Thêm người dùng` modal
- **THEN** no create admin option is rendered

#### Scenario: Create failure stays in the modal
- **WHEN** creating a user fails
- **THEN** the modal stays open with the entered data and an inline error, and no error toast is shown

### Requirement: User deletion is confirmed inside the user drawer
The user detail drawer SHALL expose `Xoá người dùng` in a danger zone that switches to an inline confirmation (`Xoá vĩnh viễn` / `Huỷ`) before deleting. A failed delete SHALL toast an error and keep the drawer open; a successful delete SHALL close it.

#### Scenario: Delete requires inline confirmation
- **WHEN** admin or owner clicks `Xoá người dùng` in the drawer
- **THEN** a confirmation with the consequence is shown and nothing is deleted until `Xoá vĩnh viễn` is clicked

#### Scenario: Failed delete keeps the drawer open
- **WHEN** the delete request fails
- **THEN** an error toast is shown and the drawer stays open

### Requirement: Owner assignment controls are scoped
Owner SHALL only see building options and assignment controls for buildings in owner scope.

#### Scenario: Owner assign manager options
- **WHEN** owner opens assign-manager control
- **THEN** building options contain only owner-scoped buildings

#### Scenario: Owner cannot unassign outside scope via UI
- **WHEN** a manager has assignments outside owner scope
- **THEN** owner UI does not show controls to remove those assignments
