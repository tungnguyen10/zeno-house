## ADDED Requirements

### Requirement: ApiSuccess và ApiError là shared TypeScript types
`app/types/api.ts` SHALL export `ApiSuccess<T>`, `ApiError`, và `ErrorCode` union type. Tất cả server API handlers SHALL trả về `ApiSuccess<T>` hoặc throw với shape `ApiError`.

#### Scenario: Successful response shape
- **WHEN** API handler trả về data
- **THEN** response object có shape `{ data: T }` hoặc `{ data: T, meta: Record<string, unknown> }`

#### Scenario: ErrorCode union type
- **WHEN** code cần tham chiếu đến error code
- **THEN** có thể dùng `ErrorCode` type thay vì string literal để đảm bảo type safety

#### Scenario: Error response shape
- **WHEN** API handler ném error
- **THEN** response object có shape `{ error: { code: ErrorCode, message: string, details?: unknown } }`

---

### Requirement: AuthUser type với typed role
`app/types/auth.ts` SHALL export `AuthUser` type extending Supabase `User` với `app_metadata.role` được typed là `UserRole | null`.

#### Scenario: AuthUser có typed role
- **WHEN** code đọc `user.app_metadata.role` từ `AuthUser`
- **THEN** TypeScript infer type là `UserRole | null` (không phải `unknown` hay `string`)

#### Scenario: H3Event context augmentation
- **WHEN** server handler đọc `event.context.user`
- **THEN** TypeScript infer type là `AuthUser | null` (không cần cast)
