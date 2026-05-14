## Why

F0.1.3 đã có auth middleware và `requireAuth()` nhưng chưa có shared TypeScript types hay server-side utility helpers — mọi API handler sẽ phải tự tạo error shape, viết lại permission check, và không có typed `AuthUser`. F0.1.4 đặt nền móng infrastructure để F0.1.5 (Buildings vertical slice) và mọi domain sau có thể implement nhanh và nhất quán.

## What Changes

- Tạo `app/types/api.ts` — codify `ApiSuccess<T>`, `ApiError`, `ErrorCode` union type thành shared types
- Tạo `app/types/auth.ts` — `AuthUser` type với typed `role`, H3Event context type augmentation
- Tạo `server/utils/errors.ts` — convenience error helpers: `throwForbidden()`, `throwNotFound()`, `throwValidationError()`, `throwConflict()`
- Tạo `server/utils/permissions.ts` — `can(user, capability)` role-based permission check
- Update `server/utils/auth.ts` — `requireAuth()` trả về `AuthUser` (typed) thay vì raw Supabase user

## Capabilities

### New Capabilities
- `api-types`: Shared TypeScript types cho API layer — `ApiSuccess<T>`, `ApiError`, `ErrorCode`, `AuthUser`, H3Event context augmentation
- `server-utils`: Server-side utility helpers — typed error throwers, `can()` permission check

### Modified Capabilities
<!-- none -->

## Impact

- `app/types/api.ts` — file mới, import bởi composables và server handlers
- `app/types/auth.ts` — file mới, import bởi server middleware, services, handlers
- `server/utils/errors.ts` — file mới, import bởi tất cả service + api handler
- `server/utils/permissions.ts` — file mới, import bởi services
- `server/utils/auth.ts` — update return type + gọi `serverSupabaseUser` trực tiếp (không qua context)
- Không có breaking change — chỉ thêm mới và update internal server util chưa có downstream
