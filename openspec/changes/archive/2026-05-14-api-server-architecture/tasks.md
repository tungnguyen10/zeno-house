## 1. Shared Types

- [x] 1.1 Tạo `app/types/api.ts` — export `ErrorCode` union, `ApiSuccess<T>`, `ApiError`
- [x] 1.2 Tạo `app/types/auth.ts` — export `AuthUser` type + H3Event context module augmentation

## 2. Server Utilities

- [x] 2.1 Tạo `server/utils/errors.ts` — export `throwForbidden`, `throwNotFound`, `throwValidationError`, `throwConflict`
- [x] 2.2 Tạo `server/utils/permissions.ts` — export `can(user, capability)` với permission map cho `admin` và `manager`
- [x] 2.3 Update `server/utils/auth.ts` — `requireAuth(event)` async, gọi `serverSupabaseUser(event)`, trả về `AuthUser`
