## MODIFIED Requirements

### Requirement: Login bằng email và password
App SHALL cho phép authenticated app users đăng nhập bằng email và password qua Supabase Auth. Form SHALL hiển thị loading state khi đang xử lý và error message khi thất bại. Permission model SHALL sử dụng capability set tách biệt theo role, bao gồm `billing.corrections` riêng biệt với `billing.write`. After a successful login or OAuth callback, the app SHALL route the user via the single `getRedirectByRole(role)` helper: internal roles go to `/dashboard`, tenant goes to `/portal`, and a missing role goes to `/auth/pending`.

#### Scenario: Đăng nhập thành công
- **WHEN** user nhập đúng email và password rồi submit
- **THEN** session được tạo và user được redirect theo `getRedirectByRole(role)`

#### Scenario: Callback redirect theo role
- **WHEN** OAuth callback hoàn tất và session có `app_metadata.role`
- **THEN** user được điều hướng bằng `getRedirectByRole(role)`

#### Scenario: Callback redirect pending
- **WHEN** OAuth callback hoàn tất và session chưa có `app_metadata.role`
- **THEN** user được điều hướng tới `/auth/pending`

#### Scenario: Sai credentials
- **WHEN** user nhập sai email hoặc password
- **THEN** form hiển thị error message rõ ràng và không redirect

#### Scenario: Loading state khi đang submit
- **WHEN** form đã submit và đang chờ Supabase response
- **THEN** submit button ở trạng thái loading và không thể submit lại

#### Scenario: Không thể submit form rỗng
- **WHEN** user để trống email hoặc password rồi submit
- **THEN** form validate và không gọi Supabase

## ADDED Requirements

### Requirement: Email registration creates pending access
App SHALL allow self-registration with full name, email, password, and password confirmation. Registration SHALL use Supabase email confirmation when enabled, SHALL never accept a client-selected role, and SHALL show a neutral response that does not reveal whether an email already exists.

#### Scenario: Registration requires confirmation
- **WHEN** Supabase accepts signup without returning a session
- **THEN** the page tells the user to check email without granting application access

#### Scenario: Registration returns a session
- **WHEN** Supabase accepts signup and returns a session
- **THEN** the user is redirected to `/auth/pending`

### Requirement: User can recover and replace password
App SHALL send recovery email with `resetPasswordForEmail`, SHALL accept the recovery session at `/auth/reset-password`, and SHALL update the password with `updateUser`. The request page SHALL always return neutral success copy.

#### Scenario: Recovery requested
- **WHEN** user submits any syntactically valid email on forgot-password
- **THEN** the page shows the same completion message regardless of account existence

#### Scenario: Recovery password updated
- **WHEN** a valid recovery session submits matching valid passwords
- **THEN** Supabase updates the password, signs out the recovery session, and returns the user to login

### Requirement: Password fields support accessible visibility control
Login, registration, and reset forms SHALL use the shared input primitive and an icon button with an accessible label to toggle password visibility without changing the model value.

#### Scenario: User reveals password
- **WHEN** user activates the visibility control
- **THEN** the input type changes between `password` and `text`, focus remains usable, and the accessible label describes the next action
