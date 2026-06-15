## Purpose
Defines user authentication behavior for login and logout using Supabase email and password sessions.

## Requirements

### Requirement: Login bằng email và password
App SHALL cho phép admin user đăng nhập bằng email và password qua Supabase Auth. Form SHALL hiển thị loading state khi đang xử lý và error message khi thất bại.

#### Scenario: Đăng nhập thành công
- **WHEN** user nhập đúng email và password rồi submit
- **THEN** session được tạo, user được redirect về `/`

#### Scenario: Sai credentials
- **WHEN** user nhập sai email hoặc password
- **THEN** form hiển thị error message rõ ràng, không redirect

#### Scenario: Loading state khi đang submit
- **WHEN** form đã submit và đang chờ Supabase response
- **THEN** submit button ở trạng thái loading (disabled + spinner), không thể submit lại

#### Scenario: Không thể submit form rỗng
- **WHEN** user để trống email hoặc password rồi submit
- **THEN** form validate và hiển thị lỗi, không gọi Supabase

---

### Requirement: Logout
App SHALL cho phép user đăng xuất. Sau khi logout, session SHALL bị xoá và user SHALL được redirect về `/login`.

#### Scenario: Logout thành công
- **WHEN** user click nút logout trong AppHeader
- **THEN** Supabase session bị invalidate, user được redirect về `/login`

#### Scenario: Sau logout không thể truy cập admin route
- **WHEN** user đã logout và cố truy cập `/`
- **THEN** middleware redirect về `/login`
