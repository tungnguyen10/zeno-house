## MODIFIED Requirements

### Requirement: `can()` permission check
`server/utils/permissions.ts` SHALL export `can(user: AuthUser, capability: string): boolean`. Permission được xác định bởi `user.app_metadata.role` mapping sang tập capabilities. Admin có toàn quyền global, owner có quyền rộng nhưng phải được scope ở service layer, manager có subset vận hành. Capability `dashboard.read` SHALL được cấp cho `admin`, `owner`, và `manager`.

#### Scenario: Admin có mọi quyền
- **WHEN** `user.app_metadata.role === 'admin'` và `can(user, 'buildings.create')` được gọi
- **THEN** return `true`

#### Scenario: Owner có quyền tạo building
- **WHEN** `user.app_metadata.role === 'owner'` và `can(user, 'buildings.create')` được gọi
- **THEN** return `true`

#### Scenario: Owner có quyền close billing trong scope
- **WHEN** `user.app_metadata.role === 'owner'` và `can(user, 'billing.close')` được gọi
- **THEN** return `true`

#### Scenario: Owner có quyền quản lý user scoped
- **WHEN** `user.app_metadata.role === 'owner'` và `can(user, 'users.manage.scoped')` được gọi
- **THEN** return `true`

#### Scenario: Owner không có quyền quản lý user global
- **WHEN** `user.app_metadata.role === 'owner'` và `can(user, 'users.manage.global')` được gọi
- **THEN** return `false`

#### Scenario: Owner không có quyền tạo admin
- **WHEN** `user.app_metadata.role === 'owner'` và `can(user, 'users.create.admin')` được gọi
- **THEN** return `false`

#### Scenario: Admin cũng không có app capability tạo admin
- **WHEN** `user.app_metadata.role === 'admin'` và `can(user, 'users.create.admin')` được gọi
- **THEN** return `false`

#### Scenario: Manager có quyền đọc
- **WHEN** `user.app_metadata.role === 'manager'` và `can(user, 'buildings.read')` được gọi
- **THEN** return `true`

#### Scenario: Manager không có quyền xoá
- **WHEN** `user.app_metadata.role === 'manager'` và `can(user, 'buildings.delete')` được gọi
- **THEN** return `false`

#### Scenario: User không có role
- **WHEN** `user.app_metadata.role` là `null` và `can(user, 'buildings.read')` được gọi
- **THEN** return `false`

#### Scenario: Admin có dashboard.read
- **WHEN** `user.app_metadata.role === 'admin'` và `can(user, 'dashboard.read')` được gọi
- **THEN** return `true`

#### Scenario: Owner có dashboard.read
- **WHEN** `user.app_metadata.role === 'owner'` và `can(user, 'dashboard.read')` được gọi
- **THEN** return `true`

#### Scenario: Manager có dashboard.read
- **WHEN** `user.app_metadata.role === 'manager'` và `can(user, 'dashboard.read')` được gọi
- **THEN** return `true`

#### Scenario: User không có role không có dashboard.read
- **WHEN** `user.app_metadata.role` là `null` và `can(user, 'dashboard.read')` được gọi
- **THEN** return `false`

## ADDED Requirements

### Requirement: Role helpers read app_metadata only
Server role helpers SHALL read `user.app_metadata.role` and SHALL NOT use top-level `user.role` or `user_metadata` for authorization.

#### Scenario: Top-level role ignored
- **WHEN** user has `user.role = 'admin'` but `user.app_metadata.role = 'manager'`
- **THEN** authorization behaves as manager

#### Scenario: User metadata ignored
- **WHEN** user has `user_metadata.role = 'admin'` but no `app_metadata.role`
- **THEN** protected capability checks return false
