## Purpose
Defines user authentication behavior for login and logout using Supabase email and password sessions.
## Requirements
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

#### Scenario: Không thể submit form rỗng
- **WHEN** user để trống email hoặc password rồi submit
- **THEN** form validate và hiển thị lỗi, không gọi Supabase

### Requirement: Logout
App SHALL cho phép user đăng xuất. Sau khi logout, session SHALL bị xoá và user SHALL được redirect về `/login`.

#### Scenario: Logout thành công
- **WHEN** user click nút logout trong AppHeader
- **THEN** Supabase session bị invalidate, user được redirect về `/login`

#### Scenario: Sau logout không thể truy cập admin route
- **WHEN** user đã logout và cố truy cập một route dưới `/dashboard`
- **THEN** middleware redirect về `/login`

### Requirement: billing.corrections là capability riêng, tách khỏi billing.write

System SHALL dùng capability `billing.corrections` để guard `invoice.void`, `invoice.reissue`, `invoice.adjustment`. `billing.write` SHALL không cover các actions này. Manager SHALL có `billing.corrections` trong default capability set.

#### Scenario: Manager có billing.corrections thực hiện void
- **WHEN** manager gọi void/reissue/adjustment endpoint
- **THEN** request được xử lý nếu manager có `billing.corrections` (mặc định là có)

#### Scenario: billing.write không đủ để void invoice
- **WHEN** user có `billing.write` nhưng không có `billing.corrections` gọi void endpoint
- **THEN** response là 403 Forbidden

#### Scenario: Manager mặc định có billing.corrections
- **WHEN** user có role `manager` gọi void/reissue/adjustment
- **THEN** request không bị chặn do thiếu `billing.corrections`

### Requirement: Auth supports owner role
System SHALL support `owner` and `tenant` as Supabase Auth `app_metadata.role` values in addition to `admin` and `manager`. The `tenant` role is isolated from internal roles and is not creatable through internal user management.

#### Scenario: Owner login
- **WHEN** user logs in with `app_metadata.role = 'owner'`
- **THEN** session is accepted and role-derived helpers expose owner role state

#### Scenario: Tenant login
- **WHEN** user logs in with `app_metadata.role = 'tenant'`
- **THEN** session is accepted and `isTenant` is true while internal role helpers are false

#### Scenario: Missing role remains unauthorized for capabilities
- **WHEN** logged-in user has no `app_metadata.role`
- **THEN** protected capabilities return false and server actions reject the user

### Requirement: Client auth store exposes role-derived helpers
Client auth state SHALL expose role-derived helpers needed for UI visibility: `isAdmin`, `isOwner`, `isManager`, `isTenant`, and user-management visibility derived from capability or role.

#### Scenario: Tenant helper
- **WHEN** current user has `app_metadata.role = 'tenant'`
- **THEN** `isTenant` is true and all internal role helpers are false

#### Scenario: Owner helper
- **WHEN** current user has `app_metadata.role = 'owner'`
- **THEN** `isOwner` is true and `isAdmin` is false

#### Scenario: Admin helper
- **WHEN** current user has `app_metadata.role = 'admin'`
- **THEN** `isAdmin` is true and `isOwner` is false
