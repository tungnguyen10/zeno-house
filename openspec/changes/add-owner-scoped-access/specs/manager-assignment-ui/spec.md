## MODIFIED Requirements

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

## ADDED Requirements

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

---

### Requirement: Owner assignment controls are scoped
Owner SHALL only see building options and assignment controls for buildings in owner scope.

#### Scenario: Owner assign manager options
- **WHEN** owner opens assign-manager control
- **THEN** building options contain only owner-scoped buildings

#### Scenario: Owner cannot unassign outside scope via UI
- **WHEN** a manager has assignments outside owner scope
- **THEN** owner UI does not show controls to remove those assignments
