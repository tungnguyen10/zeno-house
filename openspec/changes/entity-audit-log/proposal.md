## Why

Các entity master data (buildings, rooms, tenants, contracts) hiện chỉ có `created_at`/`updated_at` — không biết ai sửa, không biết đã thay đổi gì. Khi chủ nhà hỏi "ai vừa đổi giá phòng này?" hay "hợp đồng này bị terminate lúc nào và do ai?" — không có câu trả lời. Cần một `audit_events` table riêng (tách khỏi `billing_audit_events`) để track lifecycle của domain entities.

## What Changes

- **Migration**: Tạo bảng `public.audit_events` với `building_id` làm RLS anchor (khác với `billing_audit_events` dùng `billing_period_id`)
- **RLS policies**: Admin full, manager read/insert scoped theo building assignment
- **Constants**: `AUDIT_ACTIONS` TypeScript object cho tất cả action codes
- **Server repository**: `AuditRepository` — `append()` + `listByEntity()` + `listByBuilding()`
- **Server service**: `AuditService` — wrap repository, inject actor_id từ user context
- **Wire vào services**: `ContractService`, `RoomService`, `TenantService`, `BuildingService` ghi audit event trên create/update/remove/bulkAction
- **API endpoint**: `GET /api/audit` với query params `entity_type`, `entity_id`, `building_id`
- **Type + mapper**: `AuditEvent` DTO, `mapAuditEvent()`

## Capabilities

### New Capabilities
- `entity-audit-log`: Bảng `audit_events`, repository, service, API, type/mapper — track ai làm gì với buildings/rooms/tenants/contracts

### Modified Capabilities
- `buildings-api`: `BuildingService` mutations ghi audit event
- `rooms-api`: `RoomService` mutations ghi audit event
- `tenants-api`: `TenantService` mutations ghi audit event
- `contracts-api`: `ContractService` mutations ghi audit event

## Impact

- `supabase/migrations/` — 1 migration mới
- `app/types/` — thêm `AuditEvent` interface
- `app/utils/constants/` — thêm `AUDIT_ACTIONS`
- `app/utils/mappers/` — thêm `mapAuditEvent`
- `server/repositories/audit.ts` — mới
- `server/services/audit.ts` — mới
- `server/api/audit/index.get.ts` — mới
- `server/services/buildings/index.ts`, `rooms/index.ts`, `tenants/index.ts`, `contracts/index.ts` — wire audit append
