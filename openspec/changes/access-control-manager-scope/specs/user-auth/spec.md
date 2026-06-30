## MODIFIED Requirements

### Requirement: Login bằng email và password
App SHALL cho phép admin user đăng nhập bằng email và password qua Supabase Auth. Form SHALL hiển thị loading state khi đang xử lý và error message khi thất bại. Permission model SHALL sử dụng capability set tách biệt theo role, bao gồm `billing.corrections` riêng biệt với `billing.write`.

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

## ADDED Requirements

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
