## Purpose
Defines shared server utility behavior for typed errors, authenticated users, and permission checks.

## Requirements

### Requirement: Typed error throwing helpers
`server/utils/errors.ts` SHALL export `throwForbidden(message?)`, `throwNotFound(message?)`, `throwValidationError(message?, details?)`, `throwConflict(message?, details?)`. Mỗi helper SHALL throw `createError` với đúng HTTP status code và `{ error: { code, message } }` shape.

#### Scenario: throwForbidden ném 403
- **WHEN** `throwForbidden()` được gọi
- **THEN** thrown error có statusCode 403 và `error.code === 'FORBIDDEN'`

#### Scenario: throwNotFound ném 404
- **WHEN** `throwNotFound()` được gọi
- **THEN** thrown error có statusCode 404 và `error.code === 'NOT_FOUND'`

#### Scenario: throwValidationError ném 422 với details
- **WHEN** `throwValidationError('Dữ liệu không hợp lệ', zodError.flatten())` được gọi
- **THEN** thrown error có statusCode 422, `error.code === 'VALIDATION_ERROR'`, và `error.details` chứa Zod flatten output

#### Scenario: throwConflict ném 409
- **WHEN** `throwConflict()` được gọi
- **THEN** thrown error có statusCode 409 và `error.code === 'CONFLICT'`

#### Scenario: throwConflict includes details when provided
- **WHEN** `throwConflict('Đã tồn tại', { field: 'code' })` được gọi
- **THEN** thrown error có `statusCode = 409`, `error.code === 'CONFLICT'`, và `error.details.field === 'code'`

#### Scenario: Custom message
- **WHEN** helper được gọi với custom message string
- **THEN** `error.message` là custom string đó, không phải default message

---

### Requirement: `requireAuth()` trả về AuthUser
`server/utils/auth.ts` `requireAuth(event)` SHALL là async function, gọi `serverSupabaseUser(event)`, và trả về `AuthUser`. Nếu user null, SHALL throw 401 với `UNAUTHENTICATED` code.

#### Scenario: Authenticated request
- **WHEN** request có valid Supabase session cookie
- **THEN** `requireAuth(event)` resolve với `AuthUser` object (không throw)

#### Scenario: Unauthenticated request
- **WHEN** request không có session hoặc session hết hạn
- **THEN** `requireAuth(event)` throw error với statusCode 401 và `error.code === 'UNAUTHENTICATED'`

---

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

### Requirement: `throwDbError()` normalizes repository failures
`server/utils/errors.ts` SHALL export `throwDbError(error: unknown, context: string): never` for repository-level Supabase failures. The helper SHALL delegate to `throwInternal(error, context)` so the response stays in the `INTERNAL` envelope while the original DB error is logged server-side.

#### Scenario: DB errors return INTERNAL envelope
- **WHEN** repository code calls `throwDbError(supabaseError, 'buildings.findAll')`
- **THEN** client receives status 500 with `error.code === 'INTERNAL'` and generic message
- **AND** raw `supabaseError.message` is not present in response body

#### Scenario: DB context is preserved for server logs
- **WHEN** `throwDbError` is called with context `contracts.insert`
- **THEN** server logs include context `contracts.insert` for debugging

### Requirement: API parse and response helpers
`server/utils/api.ts` SHALL export `parseBody(event, schema, message?)`, `parseQuery(event, schema, message?)`, `ok(data, meta?)`, and `paginated(items, { total, page, limit })` to enforce consistent handler behavior.

#### Scenario: parseBody throws VALIDATION_ERROR with flatten details
- **WHEN** `parseBody(event, schema)` receives invalid body
- **THEN** it throws 422 with `error.code === 'VALIDATION_ERROR'`
- **AND** `error.details` equals `zodError.flatten()` shape (`fieldErrors`, `formErrors`)

#### Scenario: parseQuery throws VALIDATION_ERROR with flatten details
- **WHEN** `parseQuery(event, schema)` receives invalid query params
- **THEN** it throws 422 with `error.code === 'VALIDATION_ERROR'`
- **AND** `error.details` keeps `zodError.flatten()` output

#### Scenario: ok returns standard success envelope
- **WHEN** handler returns `ok({ id: 'b1' })`
- **THEN** response shape is `{ data: { id: 'b1' } }`

#### Scenario: paginated returns computed totalPages
- **WHEN** handler returns `paginated(items, { total: 45, page: 2, limit: 20 })`
- **THEN** response has `meta.totalPages === 3`

### Requirement: Role helpers read app_metadata only
Server role helpers SHALL read `user.app_metadata.role` and SHALL NOT use top-level `user.role` or `user_metadata` for authorization.

#### Scenario: Top-level role ignored
- **WHEN** user has `user.role = 'admin'` but `user.app_metadata.role = 'manager'`
- **THEN** authorization behaves as manager

#### Scenario: User metadata ignored
- **WHEN** user has `user_metadata.role = 'admin'` but no `app_metadata.role`
- **THEN** protected capability checks return false
