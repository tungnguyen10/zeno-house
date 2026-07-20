## MODIFIED Requirements

### Requirement: AppSidebar hiển thị navigation items
AppSidebar SHALL nhận `navItems: NavItem[]` qua props và render các navigation link tới `/dashboard`-based paths theo nhóm tĩnh. `Dashboard` SHALL đứng riêng; các link còn lại SHALL thuộc `Tài sản & cho thuê`, `Tài chính & vận hành`, hoặc `Quản trị`. Section không còn item sau khi lọc theo role SHALL không được render. Item active SHALL được highlight và expose `aria-current="page"`. Label của link SHALL vẫn là accessible name khi desktop sidebar thu gọn. AppSidebar SHALL hiển thị thông tin user đã đăng nhập ở footer: avatar initial, email, và role. AppSidebar SHALL NOT render trong `/portal` namespace.

#### Scenario: Sidebar trỏ tới dashboard routes
- **WHEN** admin layout mount
- **THEN** mỗi nav item trỏ tới đường dẫn dưới `/dashboard`

#### Scenario: Sidebar nhóm các destination liên quan
- **WHEN** admin mở sidebar
- **THEN** `Dashboard` đứng riêng và các section `Tài sản & cho thuê`, `Tài chính & vận hành`, `Quản trị` hiển thị link theo đúng product relationship

#### Scenario: Empty role section is hidden
- **WHEN** manager mở sidebar và không có item nào thuộc section `Quản trị`
- **THEN** section label `Quản trị` không được render

#### Scenario: Active nav item được highlight
- **WHEN** người dùng đang ở route `/dashboard/buildings`
- **THEN** nav item "Tòa nhà" có class active và `aria-current="page"`, các item còn lại không có

#### Scenario: Hoá đơn nav active khi ở /dashboard/invoices
- **WHEN** người dùng đang ở route `/dashboard/invoices` hoặc `/dashboard/invoices?...`
- **THEN** nav item "Hoá đơn" có class active và `aria-current="page"`

#### Scenario: Sidebar collapse trên mobile
- **WHEN** viewport nhỏ hơn `lg` breakpoint (1024px)
- **THEN** sidebar collapse mặc định, có nút toggle để mở/đóng và navigation link có touch target tối thiểu 44px

#### Scenario: Collapsed desktop rail remains accessible
- **WHEN** desktop sidebar được thu gọn thành icon rail
- **THEN** section label được thay bằng separator và mỗi navigation link vẫn có accessible name

#### Scenario: Sidebar footer hiển thị email và role
- **WHEN** user đã login và admin layout mount
- **THEN** sidebar footer hiển thị email đầy đủ và role (`admin` / `manager`)

#### Scenario: Avatar initial lấy từ email
- **WHEN** user email là `abc@example.com`
- **THEN** avatar hiển thị chữ `A` (ký tự đầu viết hoa)

#### Scenario: Sidebar không xuất hiện ở portal
- **WHEN** một route thuộc `/portal` được render
- **THEN** AppSidebar nội bộ không được render
