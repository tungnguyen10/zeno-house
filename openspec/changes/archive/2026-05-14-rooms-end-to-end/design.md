## Context

`Rooms` là bước tiếp theo tự nhiên sau `Buildings`. Pattern đã được thiết lập ở F0.1.5: migration → RLS → server layer (repository → service → api) → client layer (validator → mapper → composable → component → page). Rooms theo đúng pattern này với thêm quan hệ `building_id`.

Current state:
- `server/api/rooms/`, `server/services/rooms/`, `server/repositories/rooms/` — empty directories đã tạo sẵn
- `rooms` table chưa có trong DB (không có trong `database.types.ts`)
- Không có client code cho rooms

## Goals / Non-Goals

**Goals:**
- Rooms CRUD hoạt động end-to-end với data thật
- Filter theo building, status, floor
- Hiển thị occupancy status (available/occupied/maintenance)
- RLS đúng: admin full access, manager read-only

**Non-Goals:**
- Room assignment (tenant ↔ room) — Step 4
- Tính giá phòng tự động, invoices — v0.3+
- Bulk operations — sau khi có pattern ổn định

## Decisions

### D1: Schema rooms table

Các trường cần có:
- `id` uuid PK
- `building_id` uuid FK → buildings(id) ON DELETE CASCADE
- `room_number` text NOT NULL (số phòng, e.g. "101", "A2")
- `floor` integer NOT NULL DEFAULT 1
- `status` text NOT NULL DEFAULT 'available' CHECK IN ('available', 'occupied', 'maintenance')
- `monthly_rent` numeric(12,0) NOT NULL DEFAULT 0 (VND, không cần decimal)
- `area` numeric(6,2) — diện tích m²
- `description` text
- `created_at`, `updated_at` timestamptz

**Tại sao `room_number` là text?** Vì số phòng thực tế có thể là "A101", "Tầng 1", "Phòng đầu góc" — không nên ép kiểu số.

### D2: RLS strategy

Giống buildings: admin full, manager select. Manager không tạo/sửa/xóa phòng — đây là tác vụ của admin.

### D3: API filter params

`GET /api/rooms` nhận query params:
- `building_id` — filter theo tòa nhà
- `status` — filter theo trạng thái
- `floor` — filter theo tầng

Tất cả optional. Không có filter → trả toàn bộ (admin dùng).

### D4: Client list pattern

Dùng `useFetch` cho list (SSR-friendly), `$fetch` cho mutations — giống buildings pattern.

## Risks / Trade-offs

- [Unique constraint] `room_number` phải unique PER building, không phải globally → dùng `UNIQUE(building_id, room_number)`
- [Cascade delete] Khi xóa building, rooms bị cascade delete — phù hợp vì rooms không tồn tại độc lập
- [monthly_rent = 0] Cho phép phòng có giá 0 để không block khi tạo — admin có thể điền sau
