## MODIFIED Requirements

### Requirement: AppSidebar hiển thị navigation items
AppSidebar SHALL nhận `navItems: NavItem[]` qua props và render danh sách navigation link. Item active SHALL được highlight theo route hiện tại. AppSidebar SHALL hiển thị thông tin user đã đăng nhập ở footer: avatar initial, email, và role.

#### Scenario: Sidebar hiển thị 7 navigation items
- **WHEN** admin layout mount
- **THEN** sidebar hiển thị đủ theo thứ tự: Dashboard, Tòa nhà, Phòng, Khách thuê, Hợp đồng, Hoá đơn, Vận hành

#### Scenario: Active nav item được highlight
- **WHEN** người dùng đang ở route `/buildings`
- **THEN** nav item "Tòa nhà" có class active, các item còn lại không có

#### Scenario: Hoá đơn nav active khi ở /invoices
- **WHEN** người dùng đang ở route `/invoices` hoặc `/invoices?...`
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
