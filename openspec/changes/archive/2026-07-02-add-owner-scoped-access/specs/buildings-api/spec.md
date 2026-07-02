## MODIFIED Requirements

### Requirement: POST /api/buildings tạo building mới
`server/api/buildings/index.post.ts` SHALL require auth, validate body bằng Zod `buildingCreateSchema`, delegate sang service, trả về `ApiSuccess<Building>` với status 201. Admin and owner SHALL be allowed to create buildings. Owner-created buildings SHALL be automatically assigned to the owner.

#### Scenario: Tạo building thành công
- **WHEN** admin gửi POST /api/buildings với `{ name, address }` hợp lệ
- **THEN** response 201 với `{ data: Building }` chứa building vừa tạo

#### Scenario: Owner tạo building thành công
- **WHEN** owner gửi POST /api/buildings với `{ name, address }` hợp lệ
- **THEN** response 201 với `{ data: Building }` chứa building vừa tạo
- **AND** owner có assignment vào building đó

#### Scenario: Validation error khi thiếu required fields
- **WHEN** request body thiếu `name` hoặc `address`
- **THEN** response 422 với `error.code === 'VALIDATION_ERROR'` và `error.details` chứa Zod errors

#### Scenario: Manager không có quyền tạo
- **WHEN** user có role 'manager' gửi POST
- **THEN** response 403 với `error.code === 'FORBIDDEN'`

---

### Requirement: PATCH /api/buildings/:id cập nhật building
`server/api/buildings/[id].patch.ts` SHALL require auth, validate body bằng Zod `buildingUpdateSchema` (partial), trả về `ApiSuccess<Building>` sau update. Admin SHALL update any building. Owner SHALL update only buildings in owner scope.

#### Scenario: Cập nhật building thành công
- **WHEN** admin gửi PATCH /api/buildings/:id với partial data hợp lệ
- **THEN** response 200 với `{ data: Building }` chứa data đã update

#### Scenario: Owner cập nhật scoped building
- **WHEN** owner gửi PATCH /api/buildings/:id với partial data hợp lệ cho building trong scope
- **THEN** response 200 với `{ data: Building }` chứa data đã update

#### Scenario: Owner không thể update ngoài scope
- **WHEN** owner gửi PATCH /api/buildings/:id cho building ngoài scope
- **THEN** response 403 với `error.code === 'FORBIDDEN'`

#### Scenario: Manager không thể update
- **WHEN** user có role 'manager' gửi PATCH
- **THEN** response 403 với `error.code === 'FORBIDDEN'`

---

### Requirement: DELETE /api/buildings/:id xoá building
`server/api/buildings/[id].delete.ts` SHALL require auth and delete or archive a building only when permission, scope, and safety checks pass. Admin SHALL delete any eligible building. Owner SHALL delete only eligible buildings in owner scope.

#### Scenario: Xoá building thành công
- **WHEN** admin gửi DELETE /api/buildings/:id
- **THEN** response 204, building bị xoá khỏi database

#### Scenario: Owner xoá scoped building thành công
- **WHEN** owner gửi DELETE /api/buildings/:id cho empty building trong scope
- **THEN** response 204, building bị xoá khỏi database

#### Scenario: Owner không thể xoá ngoài scope
- **WHEN** owner gửi DELETE /api/buildings/:id cho building ngoài scope
- **THEN** response 403 với `error.code === 'FORBIDDEN'`

#### Scenario: Manager không thể xoá
- **WHEN** user có role 'manager' gửi DELETE
- **THEN** response 403 với `error.code === 'FORBIDDEN'`

## ADDED Requirements

### Requirement: Building responses expose owner provenance
Building API responses SHALL include owner provenance fields needed by Settings and scoped management, without exposing sensitive auth data.

#### Scenario: Owner-created building response
- **WHEN** owner creates a building
- **THEN** response includes non-sensitive owner/creator identifiers needed by the app

#### Scenario: List response includes provenance
- **WHEN** admin lists buildings
- **THEN** each building includes owner provenance fields if present
