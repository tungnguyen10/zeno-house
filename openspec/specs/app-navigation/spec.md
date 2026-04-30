## Purpose

App navigation shell for admin, manager, and tenant roles. Covers the sidebar, header bar, mobile hamburger overlay, and tenant bottom navigation bar. All labels are i18n-keyed; icons use custom SVG components per `svg.md` conventions.

## Requirements

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

#### Scenario: Inactive menu items có màu phù hợp với dark sidebar
- **WHEN** a sidebar link is not active
- **THEN** link hiển thị `text-white/60` và hover thành `text-white bg-white/10`

#### Scenario: Sidebar background là navy trong cả light và dark mode
- **WHEN** user toggle dark mode
- **THEN** sidebar background vẫn là `#001C49` (dark-nav không thay đổi)

#### Scenario: Layout background đổi theo dark mode
- **WHEN** user toggle dark mode
- **THEN** main content area background đổi từ `#F2F5FA` sang `#0a0f1e`

### Requirement: Default layout is mobile responsive with hamburger menu
The system SHALL hide the sidebar on small screens and show a hamburger button in the header that toggles sidebar visibility via an overlay.

#### Scenario: Sidebar hidden on mobile by default
- **WHEN** the viewport width is below the `md` Tailwind breakpoint
- **THEN** the sidebar is not visible and a hamburger button is shown in the header

#### Scenario: Hamburger toggles sidebar
- **WHEN** a user taps the hamburger button on mobile
- **THEN** the sidebar slides in as an overlay; tapping outside or the X button closes it

### Requirement: Header user dropdown shows profile and logout
The system SHALL have a `UserDropdown.vue` component in the header that shows the current user's `full_name` and provides links to profile settings and a logout action.

#### Scenario: User dropdown shows name
- **WHEN** a logged-in user opens the header dropdown
- **THEN** their `full_name` (or email as fallback) is displayed

#### Scenario: Logout action clears session
- **WHEN** a user clicks logout in the dropdown
- **THEN** `useLogout().logout()` is called and they are redirected to `/login`

### Requirement: Header language switcher toggles vi/en locale
The system SHALL have a `LanguageSwitcher.vue` component that toggles between Vietnamese (`vi`) and English (`en`) locales using `useI18n().setLocale()`.

#### Scenario: Language toggle switches locale
- **WHEN** a user clicks the language switcher
- **THEN** the UI language switches between vi and en

### Requirement: Tenant layout renders simplified header and bottom navigation
The system SHALL implement `app/layouts/tenant.vue` with a simplified top header and a bottom navigation bar (mobile-first, hidden on `md:` and above) containing: Trang chủ, Hóa đơn, Hợp đồng, Bảo trì, Thông báo, Tài khoản.

#### Scenario: Tenant bottom nav renders all items
- **WHEN** a tenant views any page using the tenant layout
- **THEN** the bottom navigation shows 6 items with icons and labels

#### Scenario: Bottom nav hidden on desktop
- **WHEN** the viewport width is at or above the `md` Tailwind breakpoint
- **THEN** the bottom navigation bar is not visible

#### Scenario: Active bottom nav item is highlighted
- **WHEN** the current route matches a bottom nav item
- **THEN** that item is visually highlighted

### Requirement: Header chứa dark mode toggle
Header SHALL có `LayoutDarkModeToggle.vue` component hiển thị sun/moon icon. Component này wrap logic từ `useColorMode()` (VueUse hoặc Nuxt color-mode).

#### Scenario: Toggle button hiển thị đúng icon
- **WHEN** đang ở light mode
- **THEN** button hiển thị moon icon; **WHEN** dark mode, hiển thị sun icon

#### Scenario: Toggle button accessible
- **WHEN** button rendered
- **THEN** có `aria-label` mô tả action ("Switch to dark mode" / "Switch to light mode")

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

### Requirement: Navigation uses i18n keys for all labels
The system SHALL have `i18n/locales/vi/navigation.json` and `i18n/locales/en/navigation.json` containing all sidebar and bottom nav labels under a `"navigation"` root key. No navigation label is hardcoded in templates.

#### Scenario: Sidebar labels are translated
- **WHEN** the locale is switched to English
- **THEN** all sidebar menu labels render in English from `navigation.*` keys
