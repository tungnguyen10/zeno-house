## 1. Database

- [x] 1.1 Tạo migration `audit_events` table: schema (`building_id` nullable, `correlation_id` nullable), indexes (partial index trên `building_id` WHERE NOT NULL, index trên `correlation_id` WHERE NOT NULL), RLS (admin all, manager building-scoped read/insert với `building_id IS NOT NULL`)

## 2. Types & Constants

- [x] 2.1 Thêm `AUDIT_ACTIONS` constant vào `app/utils/constants/audit.ts`
- [x] 2.2 Thêm `AuditEvent` interface vào `app/types/`
- [x] 2.3 Thêm `mapAuditEvent()` vào `app/utils/mappers/audit.ts`

## 3. Server Layer

- [x] 3.1 Tạo `server/repositories/audit.ts` — `append()`, `listByEntity()`, `listByBuilding()`; schema với `building_id` nullable và `correlation_id` nullable
- [x] 3.2 Tạo `server/services/audit.ts` — `AuditService.append()` với try-catch silent fail + log; `AuditService.appendBulk()` emit 1 aggregate parent event + N per-entity child events cùng `correlation_id`

## 4. Domain Service Wiring

- [x] 4.1 Wire `AuditService.append` vào `BuildingService` (create, update, remove, bulkAction)
- [x] 4.2 Wire `AuditService.append` vào `RoomService` (create, update, remove); `AuditService.appendBulk` vào `RoomService.bulkAction` — action codes: `room.archived` / `room.activated` / `room.maintenance_set` / `room.removed`
- [x] 4.3 Wire `AuditService.append` vào `TenantService` (create, update, remove, bulkAction) — gửi `building_id = null` (tenant không có building context tự nhiên)
- [x] 4.4 Wire `AuditService.append` vào `ContractService` (create, update, remove, bulkAction) — detect status để chọn action: `terminated` → `contract.terminated`, `expired` → `contract.expired`, else `contract.updated`
- [x] 4.5 Wire `AuditService.append` vào `ContractRenewalService.renew` — action `contract.renewed` trên source contract entity

## 5. API

- [x] 5.1 Tạo `server/api/audit/index.get.ts` — query by optional `building_id` (required for manager, optional for admin) + optional `entity_type`/`entity_id`/`correlation_id`; auth guard; building scope check
