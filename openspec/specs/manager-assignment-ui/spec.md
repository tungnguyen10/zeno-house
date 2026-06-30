# manager-assignment-ui Specification

## Purpose
TBD - created by archiving change access-control-manager-scope. Update Purpose after archive.
## Requirements
### Requirement: Admin thấy tất cả managers và assignments của họ

Trang `/settings/managers` SHALL chỉ accessible với admin. System SHALL hiển thị danh sách tất cả users có role `manager`, kèm danh sách buildings được gán cho từng manager.

#### Scenario: Admin truy cập /settings/managers
- **WHEN** admin navigate đến `/settings/managers`
- **THEN** page hiển thị list managers với số buildings được gán

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

---

### Requirement: Assignment changes có effect ngay lập tức

Thay đổi assignment (add/remove/toggle) SHALL được phản ánh trong scope resolution của request kế tiếp từ manager. Không cần re-login.

#### Scenario: Admin xoá assignment, manager refresh page ngay sau
- **WHEN** admin xoá assignment của manager với building X, manager gọi API ngay sau đó
- **THEN** manager không còn thấy building X (lazy cache bị expire theo request lifecycle)
