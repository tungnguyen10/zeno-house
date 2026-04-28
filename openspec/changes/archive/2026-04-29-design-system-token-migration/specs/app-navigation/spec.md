## MODIFIED Requirements

### Requirement: Default layout renders sidebar and header for admin/manager
The system SHALL implement `app/layouts/admin.vue` (và `manager.vue`) với sidebar navigation bên trái và header bar bên trên. Layout wrapper SHALL dùng `bg-[--color-bg-page]`. Sidebar SHALL dùng `bg-dark-nav` (`#001C49`) — structural dark zone, không thay đổi theo dark mode. Header SHALL dùng `bg-[--color-bg-surface]` với `border-[--color-border]`.

#### Scenario: Admin sees all sidebar items
- **WHEN** an admin user views any page using the admin layout
- **THEN** the sidebar shows: Dashboard, Tòa nhà, Phòng, Khách thuê, Hợp đồng, Hóa đơn, Điện nước, Chi phí, Bảo trì, Báo cáo, Cài đặt

#### Scenario: Manager does not see Cài đặt
- **WHEN** a manager user views any page using the manager layout
- **THEN** the sidebar shows all items except "Cài đặt"

#### Scenario: Sidebar routes are role-aware
- **WHEN** a manager user views the sidebar
- **THEN** all nav links point to `/manager/...` paths, not `/admin/...`

#### Scenario: Active menu item is highlighted on dark sidebar
- **WHEN** the current route matches a sidebar link
- **THEN** that link hiển thị với `bg-white/15 text-white` (active state cho nền dark navy)

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
The system SHALL hide the sidebar on small screens và show a hamburger button trong header that toggles sidebar visibility via an overlay.

#### Scenario: Sidebar hidden on mobile by default
- **WHEN** the viewport width is below the `md` Tailwind breakpoint
- **THEN** the sidebar is not visible and a hamburger button is shown in the header

#### Scenario: Hamburger toggles sidebar
- **WHEN** a user taps the hamburger button on mobile
- **THEN** the sidebar slides in as an overlay; tapping outside or the X button closes it

### Requirement: Header user dropdown shows profile and logout
The system SHALL have a `UserDropdown.vue` component in the header that shows the current user's `full_name` và provides links to profile settings and a logout action.

#### Scenario: User dropdown shows name
- **WHEN** user opens the dropdown
- **THEN** the user's `full_name` is displayed at the top

#### Scenario: Logout clears session
- **WHEN** user clicks logout
- **THEN** session is cleared và user is redirected to login page

## ADDED Requirements

### Requirement: Header chứa dark mode toggle
Header SHALL có `LayoutDarkModeToggle.vue` component hiển thị sun/moon icon. Component này wrap logic từ `useColorMode()` (VueUse hoặc Nuxt color-mode).

#### Scenario: Toggle button hiển thị đúng icon
- **WHEN** đang ở light mode
- **THEN** button hiển thị moon icon; **WHEN** dark mode, hiển thị sun icon

#### Scenario: Toggle button accessible
- **WHEN** button rendered
- **THEN** có `aria-label` mô tả action ("Switch to dark mode" / "Switch to light mode")
