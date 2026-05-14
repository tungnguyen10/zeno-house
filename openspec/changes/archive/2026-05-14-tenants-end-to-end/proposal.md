## Why

Hệ thống hiện có buildings và rooms nhưng chưa có entity khách thuê. Admin cần quản lý thông tin cá nhân của khách thuê (họ tên, số điện thoại, CMND/CCCD) như một danh bạ riêng trước khi liên kết vào hợp đồng ở F0.2.5.

## What Changes

- Tạo bảng `tenants` trong Supabase với các trường thông tin cá nhân
- RLS policies: admin full access, manager select
- API CRUD: list (có phân trang + tìm kiếm), get by id, create, update, delete
- Client: trang danh sách, chi tiết, tạo mới, chỉnh sửa — theo đúng pattern buildings/rooms
- Composables: `useTenantList`, `useTenantDetail`, `useTenantForm`
- Zod validator dùng chung client + server

## Capabilities

### New Capabilities
- `tenants-database`: Schema bảng `tenants`, migration, RLS, generated types
- `tenants-api`: REST endpoints GET /tenants, GET /tenants/:id, POST, PUT, DELETE
- `tenants-client`: Pages list/detail/create/edit, composables, mapper, validator

### Modified Capabilities
<!-- Không có requirement nào của specs hiện tại thay đổi -->

## Impact

- **DB**: migration mới, regen `database.types.ts`
- **Server**: `server/repositories/tenants/`, `server/services/tenants/`, `server/api/tenants/`
- **Client**: `app/types/tenants.ts`, `app/utils/mappers/tenants.ts`, `app/utils/validators/tenants.ts`, `app/composables/tenants/`, `app/pages/tenants/`
- **Navigation**: thêm mục Khách thuê vào sidebar
- **Không có breaking change** — tenants hoàn toàn độc lập, chưa liên kết với rooms/contracts
