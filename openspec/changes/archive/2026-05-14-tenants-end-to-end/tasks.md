## 1. Database

- [x] 1.1 Viết migration `supabase/migrations/20260514000004_create_tenants.sql` — bảng `tenants` với đủ columns, trigger `set_updated_at`, RLS policies (admin_all, manager_select)
- [x] 1.2 Apply migration lên Supabase (qua API)
- [x] 1.3 Regen `app/types/database.types.ts`

## 2. Server Layer

- [x] 2.1 Tạo `app/types/tenants.ts` — interface `Tenant`, type `TenantCreateInput`, `TenantUpdateInput`
- [x] 2.2 Tạo `app/utils/mappers/tenants.ts` — `mapTenant(row: Tables<'tenants'>): Tenant`
- [x] 2.3 Tạo `app/utils/validators/tenants.ts` — `tenantCreateSchema`, `tenantUpdateSchema` (Zod)
- [x] 2.4 Tạo `server/repositories/tenants/index.ts` — `findAll(filters)`, `findById`, `insert`, `update`, `remove`
- [x] 2.5 Tạo `server/services/tenants/index.ts` — business logic, permission check, id_number conflict check
- [x] 2.6 Tạo `server/api/tenants/index.get.ts` — GET /api/tenants (list + search + pagination)
- [x] 2.7 Tạo `server/api/tenants/index.post.ts` — POST /api/tenants
- [x] 2.8 Tạo `server/api/tenants/[id].get.ts` — GET /api/tenants/:id
- [x] 2.9 Tạo `server/api/tenants/[id].patch.ts` — PATCH /api/tenants/:id
- [x] 2.10 Tạo `server/api/tenants/[id].delete.ts` — DELETE /api/tenants/:id

## 3. Client Composables

- [x] 3.1 Tạo `app/composables/tenants/useTenantList.ts` — fetch list, `q` search, `page`, `totalPages`, reset page khi q thay đổi
- [x] 3.2 Tạo `app/composables/tenants/useTenantDetail.ts` — fetch single tenant, reactive id, watch id
- [x] 3.3 Tạo `app/composables/tenants/useTenantForm.ts` — form state, Zod validation, create/update submit

## 4. Client Pages & Components

- [x] 4.1 Tạo `app/pages/tenants/index.vue` — list với search box, pagination, empty state, create button
- [x] 4.2 Tạo `app/pages/tenants/create.vue` — form tạo mới, redirect /tenants sau success
- [x] 4.3 Tạo `app/pages/tenants/[id]/index.vue` — detail page, edit/delete buttons, UiConfirmModal cho delete
- [x] 4.4 Tạo `app/pages/tenants/[id]/edit.vue` — pre-fill form, redirect /tenants/:id sau success
- [x] 4.5 Tạo `app/components/tenants/TenantForm.vue` — form component dùng chung cho create + edit

## 5. Navigation

- [x] 5.1 Thêm mục "Khách thuê" vào AppSidebar linking to /tenants

## 6. Verify

- [x] 6.1 Chạy `npm run lint && npm run typecheck` — 0 errors
- [x] 6.2 Test thủ công: tạo tenant → list hiện → detail đúng → edit → xoá với confirm modal
- [x] 6.3 Test search: gõ tên / SĐT → list filter đúng, page reset về 1
