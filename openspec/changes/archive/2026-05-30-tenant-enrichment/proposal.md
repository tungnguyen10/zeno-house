## Why

Tenant hiện tại chỉ có thông tin cơ bản (tên, SĐT, CMND, ngày sinh, địa chỉ thường trú). Trong thực tế quản lý nhà trọ, admin cần thêm thông tin để:

- Xác minh danh tính đầy đủ (ngày cấp + nơi cấp CMND)
- Liên hệ khẩn cấp khi không liên lạc được với tenant
- Phân loại tenant (giới tính, nghề nghiệp) cho thống kê và quản lý

Đây là change nhỏ, độc lập, không ảnh hưởng business logic khác.

## What Changes

- Thêm 6 columns mới vào bảng `tenants`: `gender`, `occupation`, `id_issued_date`, `id_issued_place`, `emergency_contact_name`, `emergency_contact_phone`
- Tất cả fields mới đều optional (nullable)
- Cập nhật validator, mapper, type, form, và detail page

## Non-goals

- Không thêm ảnh giấy tờ / file upload (phase sau, cần storage)
- Không thay đổi business logic liên quan đến tenant
- Không thêm search/filter theo fields mới

## Capabilities

### Modified Capabilities
- `tenants-database`: Thêm 6 columns vào `tenants` table, regen types
- `tenants-api`: Cập nhật validator (createSchema + updateSchema) và mapper
- `tenants-client`: TenantForm thêm các fields mới; Tenant detail page hiển thị đủ thông tin

## Impact

- **DB**: Migration thêm 6 nullable columns, không break data cũ
- **Server**: Sửa `app/utils/validators/tenants.ts`, `app/utils/mappers/tenants.ts`, `app/types/tenants.ts`
- **Client**: Sửa `app/components/tenants/TenantForm.vue`, `app/pages/tenants/[id]/index.vue`
- **Không có breaking change** — tất cả fields mới đều optional
