## MODIFIED Requirements

### Requirement: Default layout wraps admin pages
The default layout SHALL wrap all internal dashboard routes with the responsive application shell and SHALL activate the resolved dashboard color theme for shell content and teleported overlays. It SHALL clean up dashboard document theme state when the layout unmounts.

#### Scenario: Dashboard shell resolves theme
- **WHEN** an authenticated internal user enters a `/dashboard` route
- **THEN** the layout activates the stored or system-resolved dashboard theme before interactive content is shown

#### Scenario: Dashboard shell cleans up theme
- **WHEN** client navigation leaves the default dashboard layout
- **THEN** dashboard-specific document attributes and listeners are removed

### Requirement: AppHeader tích hợp global actions với page header
Trên desktop, AppHeader SHALL render như một global action rail ở góc phải để page title, description, page actions, pending-operations trigger, theme toggle, và user menu cùng nằm trong dải đầu trang mà không tạo một hàng header trống. Trên mobile, AppHeader SHALL giữ một hàng cao 64px với hamburger và global actions. User menu SHALL expose user info thật và logout action.

#### Scenario: Header hiển thị đúng structure
- **WHEN** admin layout mount
- **THEN** `UiPageHeader` render title/description ở trái và dành đủ khoảng trống cho AppHeader global actions ở phải mà không overlap

#### Scenario: Header có nút toggle sidebar trên mobile
- **WHEN** viewport nhỏ hơn `lg` breakpoint
- **THEN** header hiển thị hamburger button để toggle sidebar

#### Scenario: Header exposes theme toggle
- **WHEN** an internal user views any dashboard route
- **THEN** the global action rail shows an accessible theme toggle immediately before the user menu

#### Scenario: Header hiển thị email user đã đăng nhập
- **WHEN** user đã login và đang ở admin page
- **THEN** AppHeader hiển thị email của user hiện tại trong vùng user info

#### Scenario: Logout từ AppHeader
- **WHEN** user click nút logout trong AppHeader
- **THEN** session bị xoá và user được redirect về `/login`

#### Scenario: Pending operations indicator is truthful
- **WHEN** `pendingOperations` có ít nhất một item
- **THEN** nút chuông hiển thị chấm trạng thái và popover hiển thị tối đa năm item theo đúng thứ tự API

#### Scenario: No pending operations
- **WHEN** `pendingOperations` rỗng
- **THEN** nút chuông không hiển thị chấm trạng thái và popover hiển thị positive empty state

#### Scenario: Pending operations popover is keyboard accessible
- **WHEN** người dùng mở popover bằng keyboard và nhấn Escape
- **THEN** popover đóng và focus trở lại nút chuông
