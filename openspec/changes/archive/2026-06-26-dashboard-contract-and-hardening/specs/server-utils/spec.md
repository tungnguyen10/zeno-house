## MODIFIED Requirements

### Requirement: `can()` permission check
`server/utils/permissions.ts` SHALL export `can(user: AuthUser, capability: string): boolean`. Permission được xác định bởi `user.app_metadata.role` mapping sang tập capabilities. Admin có toàn quyền, manager có subset. Capability `dashboard.read` SHALL được cấp cho cả `admin` và `manager`.

#### Scenario: Admin có mọi quyền
- **WHEN** `user.app_metadata.role === 'admin'` và `can(user, 'buildings.create')` được gọi
- **THEN** return `true`

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

#### Scenario: Manager có dashboard.read
- **WHEN** `user.app_metadata.role === 'manager'` và `can(user, 'dashboard.read')` được gọi
- **THEN** return `true`

#### Scenario: User không có role không có dashboard.read
- **WHEN** `user.app_metadata.role` là `null` và `can(user, 'dashboard.read')` được gọi
- **THEN** return `false`

## ADDED Requirements

### Requirement: `throwInternal()` error helper
`server/utils/errors.ts` SHALL export `throwInternal(originalError: unknown, context?: string): never` that throws a Nuxt error with statusCode 500 and body shaped as `{ error: { code: 'INTERNAL', message: 'Lỗi hệ thống, vui lòng thử lại.', details?: { context } } }`. The function SHALL log the original error (including any Supabase-specific fields like `message`, `code`, `details`, `hint`) to the server console for debugging. The function SHALL NOT include the original error message in the response body.

#### Scenario: Throws standardized 500
- **WHEN** server code calls `throwInternal(supabaseError, 'dashboard.repository.queryRooms')`
- **THEN** throws a Nuxt error with statusCode 500 and body `{ error: { code: 'INTERNAL', message: 'Lỗi hệ thống, vui lòng thử lại.', details: { context: 'dashboard.repository.queryRooms' } } }`

#### Scenario: Logs original error server-side
- **WHEN** `throwInternal(supabaseError)` is called
- **THEN** the original `supabaseError` is logged to `console.error` with all available fields

#### Scenario: Does not leak raw message to client
- **WHEN** `throwInternal(new Error('SQL syntax error near table foo'))` is called and the response is observed by a client
- **THEN** the response body does NOT contain the string `'SQL syntax error near table foo'`
