## MODIFIED Requirements

### Requirement: Default layout renders sidebar and header for admin/manager
The system SHALL implement `app/layouts/app.vue` (replacing `admin.vue` and `manager.vue`) with a sidebar navigation on the left and a header bar on top. The sidebar contains nav items filtered by the current user's permission set. The header contains breadcrumb, notification bell, user dropdown, dark mode toggle, and language switcher.

#### Scenario: Admin sees all sidebar items
- **WHEN** a user with `role = 'admin'` views any `/app/*` page
- **THEN** the sidebar shows: Dashboard, Tòa nhà, Phòng, Khách thuê, Hợp đồng, Hóa đơn, Điện nước, Chi phí, Bảo trì, Báo cáo, Quản lý người quản lý, Cài đặt

#### Scenario: Manager sees only permitted feature items
- **WHEN** a user with `role = 'manager'` has grants for `rooms` and `invoices` only
- **THEN** the sidebar shows: Dashboard, Tòa nhà, Phòng, Hóa đơn (feature items with no grant are hidden); Cài đặt and Quản lý người quản lý are not shown

#### Scenario: Sidebar routes all point to /app/*
- **WHEN** any authenticated user (admin or manager) views the sidebar
- **THEN** all nav links point to `/app/...` paths

#### Scenario: Active menu item is highlighted
- **WHEN** the current route matches a sidebar link
- **THEN** that link is visually highlighted as active

## ADDED Requirements

### Requirement: app-guard middleware protects all /app/* routes
The system SHALL have an `app-guard.ts` Nuxt route middleware that verifies the current user has `role = 'admin'` or `role = 'manager'`. Any other role (including tenant) is redirected to `/login`.

#### Scenario: Admin accesses /app routes
- **WHEN** a user with `role = 'admin'` navigates to `/app/rooms`
- **THEN** the page renders normally

#### Scenario: Manager accesses /app routes
- **WHEN** a user with `role = 'manager'` navigates to `/app/rooms`
- **THEN** the page renders normally (feature-level permission checked inside the page)

#### Scenario: Tenant blocked from /app routes
- **WHEN** a user with `role = 'tenant'` navigates to `/app`
- **THEN** they are redirected to `/login`

### Requirement: Old /admin and /manager paths redirect to /app equivalents
The system SHALL serve 301 redirects from `/admin/*` → `/app/*` and `/manager/*` → `/app/*` to prevent broken bookmarks after path migration.

#### Scenario: Old admin URL redirects
- **WHEN** a browser navigates to `/admin/rooms`
- **THEN** a 301 redirect sends them to `/app/rooms`

#### Scenario: Old manager URL redirects
- **WHEN** a browser navigates to `/manager/contracts`
- **THEN** a 301 redirect sends them to `/app/contracts`

## REMOVED Requirements

### Requirement: Default layout is role-aware for path prefix
**Reason**: Replaced by unified `/app/*` path with permission-based nav filtering
**Migration**: Update `definePageMeta` in all pages to use `layout: 'app'` and `middleware: ['auth', 'app-guard']`

### Requirement: Sidebar routes are role-aware
**Reason**: All routes are now under `/app/*` — no role-prefix switching needed
**Migration**: Remove the `base` computed property from `Sidebar.vue`; all links hardcode `/app/...`
