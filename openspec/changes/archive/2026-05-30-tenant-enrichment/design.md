## Context

Bảng `tenants` hiện tại có: `full_name`, `phone`, `email`, `id_number`, `date_of_birth`, `permanent_address`, `notes`. Đủ để tạo HĐ, nhưng thiếu thông tin để:

1. Xác minh danh tính đầy đủ theo yêu cầu pháp lý — CMND/CCCD cần có ngày cấp + nơi cấp
2. Liên hệ khẩn cấp — thực tế hay cần số người thân khi mất liên lạc với tenant
3. Phân loại cơ bản — giới tính, nghề nghiệp

Tất cả fields mới đều **optional**, không thay đổi bất kỳ business rule nào hiện có.

## Goals / Non-goals

**Goals:**
- Thêm 6 fields mới vào `tenants` table: tất cả nullable
- Hiển thị trong TenantForm và tenant detail page
- Không làm lỗi data cũ

**Non-goals:**
- Upload ảnh giấy tờ / OCR (cần storage, phase sau)
- Search/filter theo fields mới
- Validation CMND format (quá strict, nhiều loại giấy tờ khác nhau)
- Report hay export theo gender/occupation

## Decisions

**D1 — Tất cả 6 fields đều nullable, không required**

`gender`, `occupation`, `id_issued_date`, `id_issued_place`, `emergency_contact_name`, `emergency_contact_phone` — tất cả nullable. Nếu force required thì data cũ sẽ fail validation.

**D2 — `gender` dùng enum string: `'male'` | `'female'` | `'other'`**

Không dùng boolean `is_male`. Enum rõ hơn và có thể extend sau. DB column type là `text` với CHECK constraint, không tạo Postgres ENUM type (tránh phức tạp migration sau này).

**D3 — `id_issued_date` dùng `date` type (text trong app layer)**

Nhất quán với `date_of_birth` đang dùng text ISO. Validator: optional ISO date string.

**D4 — Form layout: nhóm thành 2 section**

Section "Thông tin cơ bản" (đã có) + Section "Thông tin bổ sung" (6 fields mới). Không phải wizard, không có tab — form đơn giản scroll xuống.

**D5 — Không regen database.types.ts từ CLI**

Thêm thủ công vào `app/types/database.types.ts` vì CLI supabase gen types cần project ref. Nhất quán với cách các migration trước đã làm.

## Files bị thêm

```
supabase/migrations/20260530100000_tenant_enrichment.sql
```

## Files bị sửa

```
app/types/database.types.ts              ← thêm 6 fields vào tenants Row/Insert/Update
app/types/tenants.ts                     ← thêm 6 fields vào Tenant interface
app/utils/validators/tenants.ts          ← thêm 6 fields vào create/update schema
app/utils/mappers/tenants.ts             ← map 6 fields mới từ row
app/components/tenants/TenantForm.vue    ← thêm section "Thông tin bổ sung"
app/pages/tenants/[id]/index.vue         ← hiển thị 6 fields mới trong detail view
```

## Schema bổ sung

```sql
ALTER TABLE public.tenants
  ADD COLUMN gender               text         CHECK (gender IN ('male','female','other')),
  ADD COLUMN occupation           text,
  ADD COLUMN id_issued_date       date,
  ADD COLUMN id_issued_place      text,
  ADD COLUMN emergency_contact_name  text,
  ADD COLUMN emergency_contact_phone text;
```

## Type mapping

| DB column | TS type | App field |
|-----------|---------|-----------|
| `gender` | `string \| null` | `gender` |
| `occupation` | `string \| null` | `occupation` |
| `id_issued_date` | `string \| null` | `idIssuedDate` |
| `id_issued_place` | `string \| null` | `idIssuedPlace` |
| `emergency_contact_name` | `string \| null` | `emergencyContactName` |
| `emergency_contact_phone` | `string \| null` | `emergencyContactPhone` |
