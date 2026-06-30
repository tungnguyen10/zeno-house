## 1. Database

- [ ] 1.1 Tạo migration `audit_events` table: schema, indexes, RLS (admin all, manager building-scoped read/insert)

## 2. Types & Constants

- [ ] 2.1 Thêm `AUDIT_ACTIONS` constant vào `app/utils/constants/audit.ts`
- [ ] 2.2 Thêm `AuditEvent` interface vào `app/types/`
- [ ] 2.3 Thêm `mapAuditEvent()` vào `app/utils/mappers/audit.ts`

## 3. Server Layer

- [ ] 3.1 Tạo `server/repositories/audit.ts` — `append()`, `listByEntity()`, `listByBuilding()`
- [ ] 3.2 Tạo `server/services/audit.ts` — `AuditService.append()` với try-catch silent fail + log

## 4. Domain Service Wiring

- [ ] 4.1 Wire `AuditService.append` vào `BuildingService` (create, update, remove, bulkAction)
- [ ] 4.2 Wire `AuditService.append` vào `RoomService` (create, update, remove, bulkAction)
- [ ] 4.3 Wire `AuditService.append` vào `TenantService` (create, update, remove, bulkAction)
- [ ] 4.4 Wire `AuditService.append` vào `ContractService` (create, update, remove, bulkAction)

## 5. API

- [ ] 5.1 Tạo `server/api/audit/index.get.ts` — query by `building_id` + optional `entity_type`/`entity_id`, auth guard, building scope check
