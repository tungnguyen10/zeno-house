## Context

F0.1.3 đã implement auth middleware (`server/middleware/01.auth.ts`) và `requireAuth()` helper nhưng cả hai đều thiếu TypeScript types chặt chẽ — `event.context.user` là `User | null | undefined` từ Supabase chứ không phải `AuthUser` với typed role. Chưa có shared API response types hay server error helpers, nên F0.1.5 (Buildings) sẽ phải tự tạo inline error shape và không có `can()` để check permission.

F0.1.4 đặt nền móng infrastructure — types và utilities — trước khi F0.1.5 implement domain logic thật.

## Goals / Non-Goals

**Goals:**
- Codify `ApiSuccess<T>`, `ApiError`, `ErrorCode` thành shared types tại `app/types/api.ts`
- Codify `AuthUser` type tại `app/types/auth.ts` với H3Event context augmentation
- Cung cấp typed error throwing helpers (`throwForbidden`, `throwNotFound`, `throwValidationError`, `throwConflict`) tại `server/utils/errors.ts`
- Cung cấp `can(user, capability)` role-based permission check tại `server/utils/permissions.ts`
- Update `requireAuth()` trả về `AuthUser` (typed)

**Non-Goals:**
- Không implement domain API nào (buildings, rooms, etc.) — đó là F0.1.5
- Không thêm caching, rate limiting, hay request logging
- Không thay đổi Supabase auth flow (đã xong F0.1.3)
- Không generate OpenAPI spec

## Decisions

### D1: `AuthUser` extends Supabase `User` với typed `role`

**Quyết định:** `AuthUser` là intersection type `User & { app_metadata: { role: UserRole | null } }` thay vì wrapper object riêng.

**Lý do:** Giữ compatibility với `serverSupabaseUser()` return type. Service layer nhận `AuthUser` và có thể dùng toàn bộ Supabase User fields mà không cần unwrap.

**Alternatives considered:**
- Wrapper object `{ id, email, role }` — loại vì mất Supabase fields hữu ích, cần mapping thêm

---

### D2: H3Event context augmentation qua module augmentation

**Quyết định:** Khai báo `event.context.user: AuthUser | null` qua TypeScript module augmentation trong `app/types/auth.ts`.

```ts
declare module 'h3' {
  interface H3EventContext {
    user: AuthUser | null
  }
}
```

**Lý do:** Nuxt/H3 hỗ trợ pattern này. Cho phép `event.context.user` có type chính xác trong mọi server handler mà không cần cast.

**Alternatives considered:**
- Cast inline `(event.context.user as AuthUser)` — loại vì repetitive và dễ miss

---

### D3: `requireAuth()` gọi `serverSupabaseUser()` trực tiếp, không đọc context

**Quyết định:** `requireAuth(event)` gọi `await serverSupabaseUser(event)` thay vì đọc `event.context.user`.

**Lý do:** `serverSupabaseUser()` là authoritative source, đọc JWT từ cookie — không phụ thuộc vào thứ tự middleware. Context attachment qua `01.auth.ts` middleware vẫn giữ để các trường hợp cần đọc nhanh mà không await.

**Alternatives considered:**
- Chỉ đọc `event.context.user` từ middleware — loại vì phụ thuộc vào middleware ordering, khó test

---

### D4: Error helpers là functions, không phải class

**Quyết định:** `throwForbidden(message?)`, `throwNotFound(message?)`, v.v. — top-level functions trong `server/utils/errors.ts`.

**Lý do:** Đơn giản hơn class hierarchy, tree-shakeable, dùng tốt với Nuxt auto-import server utils.

**Alternatives considered:**
- Error class hierarchy — loại vì over-engineered cho scope hiện tại

---

### D5: `can()` dùng role-based permission map, không phải RBAC library

**Quyết định:** `can(user, capability)` lookup trong static permission map `{ admin: Set, manager: Set }`.

```ts
const PERMISSIONS: Record<UserRole, Set<string>> = {
  admin: new Set(['buildings.read', 'buildings.create', ...]),
  manager: new Set(['buildings.read', ...]),
}
```

**Lý do:** V0.1 chỉ có 2 roles, permissions tương đối đơn giản. CASL hay policy object quá nặng cho scope này. Dễ mở rộng sau.

**Alternatives considered:**
- CASL library — loại vì dependency nặng không cần thiết ở phase này
- Inline role check (`user.role === 'admin'`) trong service — loại vì scattered, không testable

## Risks / Trade-offs

- **Permission map cứng trong code** → Mitigation: Là intentional design cho v0.1. Nếu cần dynamic permissions, refactor sang DB-backed RBAC ở phase sau — scope rõ ràng.
- **`requireAuth()` gọi `serverSupabaseUser()` mỗi request** → Mitigation: Supabase client cache JWT validation trong process, overhead negligible so với DB round-trip. Middleware vẫn set context cho trường hợp cần user mà không cần await auth.

## Migration Plan

1. Tạo type files và utils mới — không có breaking change
2. Update `server/utils/auth.ts` (`requireAuth` return type + async `serverSupabaseUser` call) — backward compatible vì return value vẫn là user object, chỉ typed hơn
3. Không cần database migration, không cần deployment steps đặc biệt
