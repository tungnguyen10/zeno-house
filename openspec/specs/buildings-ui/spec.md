## ADDED Requirements

### Requirement: Trang danh sách buildings
`app/pages/buildings/index.vue` SHALL dùng `useBuildingList()`, hiển thị danh sách buildings dưới dạng grid cards, có nút "Thêm tòa nhà" trỏ đến `/buildings/create`, có pagination controls, có empty state khi không có dữ liệu.

#### Scenario: Hiển thị danh sách buildings
- **WHEN** user truy cập `/buildings` và có data
- **THEN** trang hiển thị grid các BuildingCard, mỗi card có name, address, status, totalRooms

#### Scenario: Empty state khi không có buildings
- **WHEN** list trống
- **THEN** trang hiển thị empty state với CTA "Thêm tòa nhà đầu tiên"

#### Scenario: Pagination controls
- **WHEN** total > limit
- **THEN** có pagination controls để navigate qua các trang

#### Scenario: Nút "Thêm tòa nhà" chỉ hiện với admin
- **WHEN** user có role 'admin'
- **THEN** nút "Thêm tòa nhà" hiển thị; với manager không hiển thị

---

### Requirement: Trang tạo building mới
`app/pages/buildings/create.vue` SHALL render `BuildingForm` component, dùng `useBuildingForm().submitCreate()`, hiển thị loading state khi đang submit, redirect về `/buildings` sau khi thành công.

#### Scenario: Submit tạo building thành công
- **WHEN** admin điền form hợp lệ và submit
- **THEN** gọi POST /api/buildings, sau đó redirect về `/buildings`

#### Scenario: Hiển thị validation errors
- **WHEN** form được submit với data không hợp lệ
- **THEN** form hiển thị error messages dưới các field tương ứng, không redirect

#### Scenario: Nút cancel về lại danh sách
- **WHEN** user click Cancel
- **THEN** navigate về `/buildings`

---

### Requirement: Trang chi tiết building
`app/pages/buildings/[id]/index.vue` SHALL fetch building theo id, hiển thị thông tin đầy đủ, có nút Edit (chỉ admin), có nút Delete với confirmation (chỉ admin).

#### Scenario: Hiển thị chi tiết building
- **WHEN** user truy cập `/buildings/:id` với id hợp lệ
- **THEN** trang hiển thị name, address, description, status, totalRooms, createdAt

#### Scenario: 404 khi building không tồn tại
- **WHEN** id không tồn tại trong database
- **THEN** trang hiển thị not found message hoặc redirect về `/buildings`

#### Scenario: Nút Edit và Delete chỉ hiện với admin
- **WHEN** user có role 'admin'
- **THEN** nút Edit và Delete hiển thị; với manager không hiển thị

#### Scenario: Delete với confirmation
- **WHEN** admin click Delete và confirm
- **THEN** gọi DELETE /api/buildings/:id và redirect về `/buildings`

---

### Requirement: Trang chỉnh sửa building
`app/pages/buildings/[id]/edit.vue` SHALL fetch building hiện tại để pre-fill form, render `BuildingForm`, dùng `useBuildingForm().submitUpdate()`, redirect về `/buildings/:id` sau thành công.

#### Scenario: Form pre-filled với data hiện tại
- **WHEN** user truy cập `/buildings/:id/edit`
- **THEN** form có sẵn values từ building hiện tại

#### Scenario: Submit update thành công
- **WHEN** admin chỉnh sửa và submit
- **THEN** gọi PATCH /api/buildings/:id, redirect về `/buildings/:id`

---

### Requirement: BuildingCard component
`app/components/buildings/BuildingCard.vue` SHALL nhận `building: Building` qua props, hiển thị name, address, status badge, totalRooms, link đến `/buildings/:id`.

#### Scenario: BuildingCard render đúng data
- **WHEN** component nhận building prop
- **THEN** hiển thị name, address, status badge (màu theo active/inactive), totalRooms

---

### Requirement: BuildingForm component
`app/components/buildings/BuildingForm.vue` SHALL nhận `modelValue: BuildingFormData`, `loading: boolean`, emit `submit` với form data. Có fields: name (required), address (required), description (optional), status (select: active/inactive).

#### Scenario: Form emit submit khi click Save
- **WHEN** user điền form hợp lệ và click Save
- **THEN** component emit `submit` với form data

#### Scenario: Fields disabled khi loading
- **WHEN** `loading` prop là true
- **THEN** tất cả form fields và submit button bị disabled
