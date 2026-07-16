## Purpose
Defines the authenticated admin application shell, layouts, navigation, and route-level presentation expectations.

## Requirements

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

### Requirement: Auth layout dành riêng cho trang login
App SHALL có `layouts/auth.vue` tách biệt với default layout — không có sidebar, không có header. Centered content area.

#### Scenario: Login page dùng auth layout
- **WHEN** người dùng truy cập `/login`
- **THEN** trang hiển thị layout tối giản, không có sidebar và header

---

### Requirement: AppSidebar hiển thị navigation items
AppSidebar SHALL nhận `navItems: NavItem[]` qua props và render danh sách navigation link tới các `/dashboard`-based path. Item active SHALL được highlight theo route hiện tại. AppSidebar SHALL hiển thị thông tin user đã đăng nhập ở footer: avatar initial, email, và role. AppSidebar SHALL NOT render trong `/portal` namespace.

#### Scenario: Sidebar trỏ tới dashboard routes
- **WHEN** admin layout mount
- **THEN** mỗi nav item trỏ tới đường dẫn dưới `/dashboard`

#### Scenario: Active nav item được highlight
- **WHEN** người dùng đang ở route `/dashboard/buildings`
- **THEN** nav item "Tòa nhà" có class active, các item còn lại không có

#### Scenario: Hoá đơn nav active khi ở /dashboard/invoices
- **WHEN** người dùng đang ở route `/dashboard/invoices` hoặc `/dashboard/invoices?...`
- **THEN** nav item "Hoá đơn" có class active

#### Scenario: Sidebar collapse trên mobile
- **WHEN** viewport nhỏ hơn `lg` breakpoint (1024px)
- **THEN** sidebar collapse mặc định, có nút toggle để mở/đóng

#### Scenario: Sidebar footer hiển thị email và role
- **WHEN** user đã login và admin layout mount
- **THEN** sidebar footer hiển thị email đầy đủ và role (`admin` / `manager`)

#### Scenario: Avatar initial lấy từ email
- **WHEN** user email là `abc@example.com`
- **THEN** avatar hiển thị chữ `A` (ký tự đầu viết hoa)

#### Scenario: Sidebar không xuất hiện ở portal
- **WHEN** một route thuộc `/portal` được render
- **THEN** AppSidebar nội bộ không được render

---

### Requirement: AppHeader hiển thị title và user info
AppHeader SHALL hiển thị page title ở trái và user info thật ở phải. User info SHALL bao gồm email của user đã đăng nhập và nút logout.

#### Scenario: Header hiển thị đúng structure
- **WHEN** admin layout mount
- **THEN** header có vùng title bên trái và vùng actions bên phải

#### Scenario: Header có nút toggle sidebar trên mobile
- **WHEN** viewport nhỏ hơn `lg` breakpoint
- **THEN** header hiển thị hamburger button để toggle sidebar

#### Scenario: Header hiển thị email user đã đăng nhập
- **WHEN** user đã login và đang ở admin page
- **THEN** AppHeader hiển thị email của user hiện tại trong vùng user info

#### Scenario: Logout từ AppHeader
- **WHEN** user click nút logout trong AppHeader
- **THEN** session bị xoá và user được redirect về `/login`

---

### Requirement: App root sử dụng NuxtLayout và NuxtPage
`app/app.vue` SHALL render `<NuxtLayout>` và `<NuxtPage>` thay vì `NuxtWelcome`.

#### Scenario: App root không render NuxtWelcome
- **WHEN** app khởi động
- **THEN** `<NuxtWelcome>` không còn trong DOM; `<NuxtLayout>` và `<NuxtPage>` được render

---

### Requirement: Dashboard page tồn tại trong internal namespace
`pages/dashboard/index.vue` SHALL tồn tại và render trong default layout với tiêu đề "Dashboard". `pages/index.vue` SHALL act as a role-based landing route.

#### Scenario: Route /dashboard render dashboard page
- **WHEN** internal user truy cập `/dashboard`
- **THEN** trang hiển thị với tiêu đề "Dashboard" trong default layout

#### Scenario: Route gốc điều hướng theo role
- **WHEN** authenticated user truy cập `/`
- **THEN** app redirect qua `getRedirectByRole(role)`

---

### Requirement: Login page với Supabase Auth
`pages/login.vue` SHALL render trong auth layout với form email/password thật nối Supabase Auth. Form SHALL xử lý loading state và error message.

#### Scenario: Route /login render login page
- **WHEN** người dùng truy cập `/login`
- **THEN** trang hiển thị với auth layout (không có sidebar/header)

#### Scenario: Login form submit thành công
- **WHEN** user nhập đúng credentials và submit
- **THEN** session được tạo, user redirect qua `getRedirectByRole(role)`

#### Scenario: Login form hiển thị lỗi khi thất bại
- **WHEN** user nhập sai credentials và submit
- **THEN** form hiển thị error message, không redirect
