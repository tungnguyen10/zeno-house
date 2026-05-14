## ADDED Requirements

### Requirement: Typed error throwing helpers
`server/utils/errors.ts` SHALL export `throwForbidden(message?)`, `throwNotFound(message?)`, `throwValidationError(message?, details?)`, `throwConflict(message?)`. Mỗi helper SHALL throw `createError` với đúng HTTP status code và `{ error: { code, message } }` shape.

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
`server/utils/permissions.ts` SHALL export `can(user: AuthUser, capability: string): boolean`. Permission được xác định bởi `user.app_metadata.role` mapping sang tập capabilities. Admin có toàn quyền, manager có subset.

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
