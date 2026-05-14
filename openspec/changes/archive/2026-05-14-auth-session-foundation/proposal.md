## Why

F0.1.2 App Shell hoàn thành — admin layout, UI primitives, và login placeholder đều sẵn sàng. Tuy nhiên toàn bộ routes đang public, login form chưa nối auth thật, và không có session state. Cần auth + session + route guard để admin shell thực sự được bảo vệ, và để F0.1.5 Domain Vertical Slice có thể kiểm tra quyền thật sự từ server.

## What Changes

- Nối `app/pages/login.vue` với Supabase auth (email + password, error handling)
- Tạo `app/stores/auth.ts` — Pinia store cho user session: `user`, `role`, `isAuthenticated`, `loading`
- Tạo `app/composables/auth/useAuth.ts` — `login()`, `logout()`, `getSession()` wrappers
- Tạo `app/middleware/auth.ts` — client route guard: unauthenticated → redirect `/login`
- Tạo `app/middleware/guest.ts` — client route guard: authenticated → redirect `/`
- Tạo `app/utils/constants/roles.ts` — role strings (`admin`, `manager`) + capability key constants
- Tạo `server/middleware/01.auth.ts` — đính Supabase session vào H3 event context
- Tạo `server/utils/auth.ts` — server helpers: `requireAuth()`, `getSessionUser()`
- Cập nhật `app/components/app/AppHeader.vue` — hiển thị email/avatar người dùng thật + logout button

## Capabilities

### New Capabilities

- `user-auth`: Login/logout flow qua Supabase (email + password). Session tự persist qua `@nuxtjs/supabase`. Login page có error handling và loading state.
- `session-store`: Pinia store (`stores/auth.ts`) chứa user session state dùng chung toàn app. Expose `user`, `role`, `isAuthenticated`, `isLoading`. Sync từ `useSupabaseUser()`.
- `route-guard`: Client middleware bảo vệ admin routes (`auth.ts`) và guard login page (`guest.ts`). Server middleware đính session vào event context cho API handlers.

### Modified Capabilities

- `admin-shell`: AppHeader hiển thị user info thật (email, avatar initial) và nút logout — thay placeholder "Người dùng" hiện tại.

## Impact

- `app/pages/login.vue` — nối form thật, emit error, loading state
- `app/stores/auth.ts` — tạo mới
- `app/composables/auth/useAuth.ts` — tạo mới
- `app/middleware/auth.ts`, `guest.ts` — tạo mới
- `app/utils/constants/roles.ts` — tạo mới
- `server/middleware/01.auth.ts` — tạo mới
- `server/utils/auth.ts` — tạo mới
- `app/components/app/AppHeader.vue` — cập nhật user display
- Dependencies: `@nuxtjs/supabase` đã cài — không thêm dep mới
- `nuxt.config.ts` — `supabase.redirect: false` đã set (middleware handle redirect thủ công)
