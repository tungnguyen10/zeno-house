## ADDED Requirements

### Requirement: Admin manages all owners and managers
Admin SHALL see all owner and manager users, all buildings, and all user-building assignments in Settings user management.

#### Scenario: Admin opens Manage users
- **WHEN** admin opens Settings user management
- **THEN** page shows owners, managers, all buildings, and all assignments

#### Scenario: Admin creates owner
- **WHEN** admin creates a user with `role = 'owner'`
- **THEN** user is created with Supabase Auth `app_metadata.role = 'owner'`

#### Scenario: Admin creates manager
- **WHEN** admin creates a user with `role = 'manager'`
- **THEN** user is created with Supabase Auth `app_metadata.role = 'manager'`

---

### Requirement: Owner manages managers only inside owner scope
Owner SHALL create, view, assign, unassign, and toggle manager assignment settings only for buildings assigned to that owner.

#### Scenario: Owner sees scoped managers
- **WHEN** owner opens Settings user management
- **THEN** page shows only managers assigned to buildings in owner scope

#### Scenario: Owner creates manager for scoped building
- **WHEN** owner creates manager and selects one or more buildings in owner scope
- **THEN** manager user is created and assigned only to those buildings

#### Scenario: Owner cannot assign manager outside scope
- **WHEN** owner attempts to assign a manager to a building outside owner scope
- **THEN** response is 403 Forbidden

#### Scenario: Owner cannot create owner
- **WHEN** owner submits user creation with `role = 'owner'`
- **THEN** response is 403 Forbidden

---

### Requirement: Manager cannot access user management
Manager SHALL NOT access Settings user management pages or APIs.

#### Scenario: Manager opens Manage users
- **WHEN** manager navigates to Settings user management
- **THEN** manager is redirected away or receives 403 Forbidden

#### Scenario: Manager calls assignment API
- **WHEN** manager calls a user-management or assignment mutation API directly
- **THEN** response is 403 Forbidden

---

### Requirement: Created manager must have immediate building scope
System SHALL reject owner-created manager users unless at least one selected building belongs to the owner scope. System SHALL NOT leave manager accounts with no assignment from owner-created flows.

#### Scenario: Owner creates manager without building
- **WHEN** owner submits manager creation without any building assignment
- **THEN** response is 422 Validation Error

#### Scenario: Owner creates manager with mixed building scope
- **WHEN** owner submits manager creation with one scoped building and one unscoped building
- **THEN** response is 403 Forbidden and no unscoped assignment is created
