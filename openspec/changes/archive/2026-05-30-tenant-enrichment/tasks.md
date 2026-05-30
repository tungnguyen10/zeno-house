## 1. Database

- [x] 1.1 Viết migration `supabase/migrations/20260530100000_tenant_enrichment.sql`:
  ```sql
  ALTER TABLE public.tenants
    ADD COLUMN gender                   text CHECK (gender IN ('male','female','other')),
    ADD COLUMN occupation               text,
    ADD COLUMN id_issued_date           date,
    ADD COLUMN id_issued_place          text,
    ADD COLUMN emergency_contact_name   text,
    ADD COLUMN emergency_contact_phone  text;
  ```
- [x] 1.2 Apply migration lên Supabase (via dashboard SQL editor hoặc `supabase db push`)

## 2. Types & Mapper

- [x] 2.1 Sửa `app/types/database.types.ts` — thêm 6 fields vào `tenants.Row`, `tenants.Insert`, `tenants.Update`:
  - `gender: string | null`
  - `occupation: string | null`
  - `id_issued_date: string | null`
  - `id_issued_place: string | null`
  - `emergency_contact_name: string | null`
  - `emergency_contact_phone: string | null`

- [x] 2.2 Sửa `app/types/tenants.ts` — thêm vào `Tenant` interface:
  - `gender: string | null`
  - `occupation: string | null`
  - `idIssuedDate: string | null`
  - `idIssuedPlace: string | null`
  - `emergencyContactName: string | null`
  - `emergencyContactPhone: string | null`

- [x] 2.3 Sửa `app/utils/mappers/tenants.ts` — thêm 6 fields vào `mapTenant()`:
  - `gender: row.gender`
  - `occupation: row.occupation`
  - `idIssuedDate: row.id_issued_date`
  - `idIssuedPlace: row.id_issued_place`
  - `emergencyContactName: row.emergency_contact_name`
  - `emergencyContactPhone: row.emergency_contact_phone`

## 3. Validator

- [x] 3.1 Sửa `app/utils/validators/tenants.ts` — thêm vào `tenantCreateSchema`:
  ```ts
  gender: z.enum(['male', 'female', 'other']).nullable().optional(),
  occupation: z.string().max(100).nullable().optional(),
  id_issued_date: z.string().nullable().optional(),
  id_issued_place: z.string().max(200).nullable().optional(),
  emergency_contact_name: z.string().max(100).nullable().optional(),
  emergency_contact_phone: z.string().max(20).nullable().optional(),
  ```

## 4. Client — TenantForm

- [x] 4.1 Sửa `app/components/tenants/TenantForm.vue` — thêm section "Thông tin bổ sung" bên dưới section cơ bản:
  - Select `gender` (options: Nam / Nữ / Khác, nullable)
  - Input text `occupation` (Nghề nghiệp)
  - Input date `id_issued_date` (Ngày cấp CMND/CCCD)
  - Input text `id_issued_place` (Nơi cấp)
  - Input text `emergency_contact_name` (Liên hệ khẩn cấp — Tên)
  - Input text `emergency_contact_phone` (Liên hệ khẩn cấp — SĐT)
  - Tất cả fields đều không required

## 5. Client — Tenant detail page

- [x] 5.1 Sửa `app/pages/tenants/[id]/index.vue` — thêm hiển thị 6 fields mới:
  - Nhóm "Thông tin CMND/CCCD": `idNumber`, `idIssuedDate`, `idIssuedPlace`
  - Nhóm "Thông tin bổ sung": `gender`, `occupation`
  - Nhóm "Liên hệ khẩn cấp": `emergencyContactName`, `emergencyContactPhone`
  - Các fields null thì hiển thị "—" hoặc ẩn

## 6. Verify

- [x] 6.1 Chạy `npm run typecheck` — 0 errors
- [x] 6.2 Chạy `npm run lint` — 0 errors
- [x] 6.3 Test: tạo tenant mới với đầy đủ 6 fields mới → lưu thành công
- [x] 6.4 Test: tạo tenant không có 6 fields mới → lưu thành công (không required)
- [x] 6.5 Test: tenant detail page hiển thị đúng 6 fields mới
- [x] 6.6 Test: sửa tenant → form pre-fill đúng 6 fields mới
