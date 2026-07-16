## MODIFIED Requirements

### Requirement: Default layout wraps admin pages
App SHALL render internal admin pages với `layouts/default.vue` bao gồm AppSidebar ở trái và AppHeader ở trên, except dedicated print-only routes MAY set `layout: false` so printed output excludes application chrome. Content area ở giữa scroll độc lập. Internal pages SHALL live under the `/dashboard` namespace; navigation and route-level links SHALL target `/dashboard`-based paths, and legacy top-level paths SHALL redirect to their `/dashboard` equivalents.

#### Scenario: Admin page sử dụng default layout
- **WHEN** người dùng truy cập một internal route dưới `/dashboard`
- **THEN** trang hiển thị với sidebar bên trái, header ở trên, content area ở giữa

#### Scenario: Content area scroll không ảnh hưởng sidebar
- **WHEN** nội dung trang dài hơn viewport
- **THEN** chỉ content area scroll, sidebar và header giữ nguyên vị trí

#### Scenario: Legacy path redirect về dashboard namespace
- **WHEN** người dùng mở một đường dẫn nội bộ cũ ở top-level (ví dụ `/buildings`)
- **THEN** app redirect tới đường dẫn `/dashboard` tương ứng

#### Scenario: Print-only route không render application chrome
- **WHEN** người dùng mở một dedicated print-only route dưới `/dashboard`
- **THEN** route vẫn được namespace guard bảo vệ nhưng MAY render với `layout: false` để không hiển thị sidebar và header trong bản in

---

### Requirement: AppSidebar hiển thị navigation items
AppSidebar SHALL nhận `navItems: NavItem[]` qua props và render danh sách navigation link tới các `/dashboard`-based path. Item active SHALL được highlight theo route hiện tại. AppSidebar SHALL hiển thị thông tin user đã đăng nhập ở footer: avatar initial, email, và role. AppSidebar SHALL NOT render trong `/portal` namespace.

#### Scenario: Sidebar trỏ tới dashboard routes
- **WHEN** admin layout mount
- **THEN** mỗi nav item trỏ tới đường dẫn dưới `/dashboard`

#### Scenario: Active nav item được highlight
- **WHEN** người dùng đang ở route `/dashboard/buildings`
- **THEN** nav item "Tòa nhà" có class active, các item còn lại không có

#### Scenario: Sidebar không xuất hiện ở portal
- **WHEN** một route thuộc `/portal` được render
- **THEN** AppSidebar nội bộ không được render
