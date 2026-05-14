## Context

Buildings và rooms đã có full CRUD theo pattern: migration → regen types → repository → service → API → composables → pages. Tenants là entity mới hoàn toàn, không phụ thuộc rooms/contracts ở giai đoạn này. Pattern đã ổn định qua 2 domain → áp dụng lại không cần thay đổi kiến trúc.

**Current state**: Không có bảng `tenants` trong DB. Sidebar chưa có mục Khách thuê.

## Goals / Non-Goals

**Goals:**
- Tạo `tenants` table với thông tin cá nhân (họ tên, SĐT, CMND/CCCD, ngày sinh, địa chỉ thường trú, ghi chú)
- CRUD đầy đủ theo pattern buildings/rooms
- List page có tìm kiếm theo tên / số điện thoại + phân trang
- Sidebar: thêm mục Khách thuê

**Non-Goals:**
- Liên kết tenant ↔ room (F0.2.4)
- Hợp đồng (F0.2.5)
- Tenant portal / auth cho khách (phase sau)

## Decisions

**D1 — Tìm kiếm full-text qua ILIKE, không dùng pg_trgm**
Scope v0.2: dataset nhỏ (< 1000 tenants). `ILIKE '%query%'` trên `full_name` + `phone` đủ dùng. pg_trgm cần extension — thêm phức tạp không cần thiết.

**D2 — `id_number` nullable, không unique constraint ở DB**
CMND/CCCD không phải bắt buộc khi mới nhập liệu nhanh. Unique validation ở application layer (service check) thay vì DB constraint để trả về error message tiếng Việt rõ ràng.

**D3 — Không có `status` field ở phase này**
Tenant chưa gắn với room nên "active/inactive" chưa có nghĩa nghiệp vụ. Status sẽ được derive từ contracts (F0.2.5).

**D4 — Search parameter `q` thay vì `name` + `phone` riêng lẻ**
Một ô tìm kiếm duy nhất tìm cả tên và SĐT — UX đơn giản hơn, API linh hoạt hơn.

## Risks / Trade-offs

- **ILIKE không có index** → Mitigation: acceptable ở v0.2 data size, thêm GIN index sau nếu cần
- **id_number không unique ở DB** → Mitigation: service layer check trả về `CONFLICT` error; có thể thêm DB constraint sau khi data sạch

## Migration Plan

1. Viết migration SQL `supabase/migrations/YYYYMMDD_tenants.sql`
2. Apply qua Supabase API (không có CLI)
3. Regen `database.types.ts`
4. Implement server layer (repository → service → API)
5. Implement client layer (types → mapper → validator → composables → pages)
6. Thêm sidebar item
