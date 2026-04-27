## Purpose

App navigation shell for admin, manager, and tenant roles. Covers the sidebar, header bar, mobile hamburger overlay, and tenant bottom navigation bar. All labels are i18n-keyed; icons use custom SVG components per `svg.md` conventions.

## Requirements

### Requirement: Default layout renders sidebar and header for admin/manager
The system SHALL implement `app/layouts/default.vue` with a sidebar navigation on the left and a header bar on top. The sidebar contains all admin/manager menu items. The header contains breadcrumb, notification bell, user dropdown, and language switcher.

#### Scenario: Admin sees all sidebar items
- **WHEN** an admin user views any page using the default layout
- **THEN** the sidebar shows: Dashboard, Tòa nhà, Phòng, Khách thuê, Hợp đồng, Hóa đơn, Điện nước, Chi phí, Bảo trì, Báo cáo, Cài đặt

#### Scenario: Manager does not see Cài đặt
- **WHEN** a manager user views any page using the default layout
- **THEN** the sidebar shows all items except "Cài đặt"

#### Scenario: Sidebar routes are role-aware
- **WHEN** a manager user views the sidebar
- **THEN** all nav links point to `/manager/...` paths, not `/admin/...`

#### Scenario: Active menu item is highlighted
- **WHEN** the current route matches a sidebar link
- **THEN** that link is visually highlighted as active

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

### Requirement: Navigation uses i18n keys for all labels
The system SHALL have `i18n/locales/vi/navigation.json` and `i18n/locales/en/navigation.json` containing all sidebar and bottom nav labels under a `"navigation"` root key. No navigation label is hardcoded in templates.

#### Scenario: Sidebar labels are translated
- **WHEN** the locale is switched to English
- **THEN** all sidebar menu labels render in English from `navigation.*` keys
