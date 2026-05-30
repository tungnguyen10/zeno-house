## Context

Codebase đã ổn định qua 22 changes từ v0.1→v0.2.5. Trước khi bắt đầu phase 3 (Invoicing), cần resolve 4 issues tích lũy:

1. **Dark theme inconsistency**: 3 service tables (`BuildingServiceSettings`, `BuildingServicesMatrix`, `ContractServicesTab`) dùng light Tailwind classes (`bg-gray-50`, `bg-white`, `text-gray-*`) trong khi toàn bộ app dùng dark design system tokens (`dark-surface`, `dark-border`, `text-white/muted`). Các components này được tạo trong sprint service-definitions và chưa được style align.

2. **`ContractWithDetails.room` thiếu `buildingId`**: DETAIL_SELECT query trong contracts repository chỉ join `rooms(id, room_number, floor, buildings(name))` — không include `building_id` của room. Phase 3 cần `buildingId` để tra cứu electricity/water rates từ building khi tính invoice. Hiện `contract.buildingId` có nhưng nullable (legacy debt #3).

3. **`contracts.payment_day` thiếu**: Mỗi hợp đồng có thể có ngày thanh toán riêng (khác với building default `payment_due_day`). Đây là commercial term cơ bản cần có trước khi generate invoice.

4. **`contracts.building_id` nullable**: Được tạo nullable từ đầu do không enforce. Tất cả contracts thực tế đều có building (qua room), nhưng column cho phép NULL. Repository đang workaround bằng cách filter qua `rooms.building_id` thay vì trực tiếp. Cần backfill rồi NOT NULL.

## Goals / Non-Goals

**Goals:**
- Align 3 service table components sang dark theme
- `ContractWithDetails.room` luôn expose `buildingId`
- `contracts` table có `payment_day` optional field
- `contracts.building_id` là NOT NULL sau backfill migration

**Non-Goals:**
- Không thêm UI cho payment_day ngay (chỉ backend + form, UI đầy đủ ở phase 3)
- Không refactor toàn bộ component styling — chỉ fix 3 components cụ thể
- Không thay đổi business logic contracts — chỉ schema + type + mapper

## Decisions

### D1: Backfill `building_id` trước khi NOT NULL

**Quyết định**: Chạy `UPDATE contracts SET building_id = rooms.building_id FROM rooms WHERE contracts.room_id = rooms.id AND contracts.building_id IS NULL` trong migration trước khi `ALTER TABLE contracts ALTER COLUMN building_id SET NOT NULL`.

**Lý do**: Safe — tất cả contracts thực tế đều join được room có building_id. Migration sẽ fail nếu còn NULL sau backfill (expected behavior — tốt hơn là để production có bad data).

### D2: `payment_day` là `int2 NULL` (1–31)

**Quyết định**: `payment_day smallint CHECK (payment_day BETWEEN 1 AND 31)`, nullable. NULL = dùng building default.

**Lý do**: Không phải hợp đồng nào cũng cần override. NULL có semantic rõ ràng: "inherit from building". Phase 3 invoice sẽ coalesce `contract.payment_day ?? building.payment_due_day`.

**Alternative rejected**: NOT NULL với default 0 → 0 không có nghĩa, gây confusion.

### D3: Chỉ đổi class trong 3 components, không extract shared table style

**Quyết định**: Đổi trực tiếp Tailwind classes trong từng file. Không tạo shared SCSS hoặc wrapper component.

**Lý do**: 3 tables có cấu trúc khác nhau đủ để không justify abstraction. Implementation discipline — chỉ fix vấn đề cụ thể.

## Risks / Trade-offs

- **[Risk] Migration NOT NULL fail nếu có orphan contract** → Mitigation: migration script check `SELECT count(*) FROM contracts c LEFT JOIN rooms r ON c.room_id = r.id WHERE r.id IS NULL` trước khi backfill. Nếu có orphan → raise notice thay vì fail silently.
- **[Risk] `payment_day` = 31 trên tháng có 30 ngày** → Mitigation: đây là known issue, invoice generation sẽ clamp về last-day-of-month — giải quyết ở phase 3.

## Migration Plan

1. Apply `20260531000000_contracts_backfill_building_id.sql` — backfill + NOT NULL
2. Apply `20260531000001_contracts_payment_day.sql` — add payment_day column
3. Regen `database.types.ts`
4. Update server types + mapper
5. Fix 3 components
6. Add payment_day to ContractForm (optional field)
