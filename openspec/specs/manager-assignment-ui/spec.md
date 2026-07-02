# manager-assignment-ui Specification

## Purpose
TBD - created by archiving change access-control-manager-scope. Update Purpose after archive.
## Requirements
### Requirement: Admin thấy tất cả managers và assignments của họ

Trang Settings user management SHALL be accessible to admin and owner, with different visibility. Admin SHALL see all owners, managers, assignments, and buildings. Owner SHALL see only manager assignments for buildings in owner scope. Manager SHALL NOT access this page.

#### Scenario: Admin truy cập /settings/managers
- **WHEN** admin navigate đến `/settings/managers`
- **THEN** page hiển thị tất cả owners/managers và assignments của họ

#### Scenario: Owner truy cập /settings/managers
- **WHEN** owner navigate đến `/settings/managers`
- **THEN** page hiển thị managers và assignments thuộc buildings trong owner scope

#### Scenario: Manager thử truy cập /settings/managers
- **WHEN** manager navigate đến `/settings/managers`
- **THEN** redirect về `/` hoặc 403

---

### Requirement: Admin assign manager vào building

Admin SHALL có thể gán manager vào building từ trang `/settings/managers`. Assignment mới SHALL có `can_delete_master_data = false` mặc định.

#### Scenario: Admin gán manager vào building chưa được gán
- **WHEN** admin chọn manager, chọn building, submit assign
- **THEN** `user_building_assignments` row được tạo, manager có thể thấy building ngay lập tức

#### Scenario: Admin thử gán manager vào building đã được gán
- **WHEN** admin thử gán lần 2 cùng manager + building
- **THEN** conflict được xử lý gracefully (không duplicate, hiển thị thông báo)

---

### Requirement: Admin unassign manager khỏi building

Admin SHALL có thể xoá assignment, manager SHALL mất access vào building đó ngay lập tức.

#### Scenario: Admin xoá assignment
- **WHEN** admin click unassign cho 1 manager-building pair
- **THEN** assignment bị xoá, manager không còn thấy building đó trong list

---

### Requirement: Admin toggle can_delete_master_data

Admin SHALL có thể bật/tắt `can_delete_master_data` cho từng assignment. Thay đổi SHALL có effect ngay lập tức (next request của manager).

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
- **THEN** page hiển thị warning badge/indicator cho building đó

---

### Requirement: Building settings hiển thị contextual section assigned managers

Trang `/buildings/:id/settings` SHALL có section "Quản lý phân quyền" hiển thị danh sách managers được gán vào building đó và link về `/settings/managers` để admin có thể quản lý.

#### Scenario: Admin xem building settings
- **WHEN** admin mở `/buildings/:id/settings`
- **THEN** section "Managers" hiển thị tên managers đang được gán, kèm link "Quản lý phân quyền"

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
Settings user management SHALL expose create-owner actions only to admin and create-manager actions to admin or owner. The UI SHALL NOT expose create-admin actions.

#### Scenario: Admin sees create owner
- **WHEN** admin opens Settings user management
- **THEN** create owner control is available

#### Scenario: Owner does not see create owner
- **WHEN** owner opens Settings user management
- **THEN** create owner control is not available

#### Scenario: No create admin control
- **WHEN** admin or owner opens Settings user management
- **THEN** no create admin control is rendered

### Requirement: Owner assignment controls are scoped
Owner SHALL only see building options and assignment controls for buildings in owner scope.

#### Scenario: Owner assign manager options
- **WHEN** owner opens assign-manager control
- **THEN** building options contain only owner-scoped buildings

#### Scenario: Owner cannot unassign outside scope via UI
- **WHEN** a manager has assignments outside owner scope
- **THEN** owner UI does not show controls to remove those assignments
