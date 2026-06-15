## Purpose
Defines authentication and guest route guard behavior for protected admin pages and login routing.

## Requirements

### Requirement: Global auth middleware bảo vệ tất cả admin routes
`middleware/auth.global.ts` SHALL chạy trên mọi navigation. Nếu route không nằm trong public routes list và user chưa authenticated, SHALL redirect về `/login`.

Public routes: `['/login']`

#### Scenario: Unauthenticated user truy cập admin route
- **WHEN** user chưa login và navigate đến `/`
- **THEN** middleware redirect về `/login`

#### Scenario: Unauthenticated user truy cập route public
- **WHEN** user chưa login và navigate đến `/login`
- **THEN** middleware không redirect, trang login được render bình thường

#### Scenario: Authenticated user truy cập admin route
- **WHEN** user đã login và navigate đến `/`
- **THEN** middleware không interrupt, trang được render bình thường

#### Scenario: Không có redirect loop
- **WHEN** unauthenticated user bị redirect đến `/login`
- **THEN** `auth.global.ts` không tiếp tục redirect lần nữa từ `/login`

---

### Requirement: Guest middleware redirect authenticated user khỏi login page
`middleware/guest.ts` SHALL được áp dụng trên `/login`. Nếu user đã authenticated, SHALL redirect về `/`.

#### Scenario: Authenticated user vào /login
- **WHEN** user đã có session và truy cập `/login`
- **THEN** middleware redirect về `/`

#### Scenario: Unauthenticated user vào /login
- **WHEN** user chưa có session và truy cập `/login`
- **THEN** middleware không redirect, login page render bình thường
