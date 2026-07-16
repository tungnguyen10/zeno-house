## MODIFIED Requirements

### Requirement: Login bằng email và password
App SHALL cho phép authenticated app users đăng nhập bằng email và password qua Supabase Auth. Form SHALL hiển thị loading state khi đang xử lý và error message khi thất bại. Permission model SHALL sử dụng capability set tách biệt theo role, bao gồm `billing.corrections` riêng biệt với `billing.write`. After a successful login or OAuth callback, the app SHALL route the user via the single `getRedirectByRole(role)` helper (reading `app_metadata.role`) rather than a hard-coded landing path.

#### Scenario: Đăng nhập thành công
- **WHEN** user nhập đúng email và password rồi submit
- **THEN** session được tạo, user được redirect theo `getRedirectByRole(role)` (`/dashboard` cho internal roles, `/portal` cho tenant)

#### Scenario: Callback redirect theo role
- **WHEN** OAuth callback hoàn tất và session có `app_metadata.role`
- **THEN** user được điều hướng bằng `getRedirectByRole(role)`

#### Scenario: Sai credentials
- **WHEN** user nhập sai email hoặc password
- **THEN** form hiển thị error message rõ ràng, không redirect

#### Scenario: Loading state khi đang submit
- **WHEN** form đã submit và đang chờ Supabase response
- **THEN** submit button ở trạng thái loading (disabled + spinner), không thể submit lại
