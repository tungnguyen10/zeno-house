## Purpose
Defines authentication and guest route guard behavior for protected admin pages and login routing.

## Requirements

### Requirement: Global auth middleware bảo vệ tất cả admin routes
`middleware/auth.global.ts` SHALL chạy trên mọi navigation. Nếu route không nằm trong public routes list và user chưa authenticated, SHALL redirect về `/login`. After a user is resolved, the middleware SHALL enforce role-based namespace isolation before render: a `tenant` user navigating outside `/portal` is redirected to `/portal`, and a non-`tenant` user navigating inside `/portal` is redirected via `getRedirectByRole(role)`. The middleware SHALL retain the `auth.getSession()` fallback that covers the timing gap right after sign-in, and SHALL NOT evaluate manager building scope (that stays in services + RLS).

Public routes: `['/login', '/auth/callback']`

#### Scenario: Unauthenticated user truy cập admin route
- **WHEN** user chưa login và navigate đến một route nội bộ
- **THEN** middleware redirect về `/login`

#### Scenario: Unauthenticated user truy cập route public
- **WHEN** user chưa login và navigate đến `/login` hoặc `/auth/callback`
- **THEN** middleware không redirect, route public được render bình thường

#### Scenario: Tenant bị khóa trong portal namespace
- **WHEN** a `tenant` user navigates to any route outside `/portal`
- **THEN** the middleware redirects to `/portal` before render

#### Scenario: Internal role bị chặn khỏi portal namespace
- **WHEN** an `admin`/`owner`/`manager` user navigates to any `/portal` route
- **THEN** the middleware redirects to `/dashboard`

#### Scenario: Session fallback sau đăng nhập
- **WHEN** `useSupabaseUser()` chưa kịp cập nhật ngay sau `signInWithPassword`
- **THEN** the middleware resolves the session via `auth.getSession()` before deciding, avoiding a bounce to `/login`

#### Scenario: Không có redirect loop
- **WHEN** unauthenticated user bị redirect đến `/login`
- **THEN** `auth.global.ts` không tiếp tục redirect lần nữa từ `/login`

---

### Requirement: Guest middleware redirect authenticated user khỏi login page
`middleware/guest.ts` SHALL được áp dụng trên `/login`. Nếu user đã authenticated, SHALL redirect qua `getRedirectByRole(role)`.

#### Scenario: Authenticated user vào /login
- **WHEN** user đã có session và truy cập `/login`
- **THEN** middleware redirect về `/dashboard` cho internal roles hoặc `/portal` cho tenant

#### Scenario: Unauthenticated user vào /login
- **WHEN** user chưa có session và truy cập `/login`
- **THEN** middleware không redirect, login page render bình thường
