## MODIFIED Requirements

### Requirement: AppSidebar hiển thị user info thật ở footer
AppSidebar SHALL hiển thị thông tin user đã đăng nhập ở cuối sidebar: avatar initial, email, và role. Data lấy từ auth store.

#### Scenario: Sidebar footer hiển thị email và role
- **WHEN** user đã login và admin layout mount
- **THEN** sidebar footer hiển thị email đầy đủ và role (`admin` / `manager`)

#### Scenario: Avatar initial lấy từ email
- **WHEN** user email là `abc@example.com`
- **THEN** avatar hiển thị chữ `A` (ký tự đầu viết hoa)

---

### Requirement: AppHeader hiển thị title và user placeholder
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

### Requirement: Login placeholder page tồn tại
`pages/login.vue` SHALL render trong auth layout với form email/password thật nối Supabase Auth. Form SHALL xử lý loading state và error message.

#### Scenario: Route /login render login page
- **WHEN** người dùng truy cập `/login`
- **THEN** trang hiển thị với auth layout (không có sidebar/header)

#### Scenario: Login form submit thành công
- **WHEN** user nhập đúng credentials và submit
- **THEN** session được tạo, user redirect về `/`

#### Scenario: Login form hiển thị lỗi khi thất bại
- **WHEN** user nhập sai credentials và submit
- **THEN** form hiển thị error message, không redirect
