## Context

Tất cả entity master data (buildings, rooms, tenants, contracts) hiện chỉ có `created_at`/`updated_at`. Không có actor tracking, không có change snapshot. Không thể trả lời "ai sửa giá phòng này?" hay "contract này bị terminate lúc nào?"

`billing_audit_events` đã chứng minh pattern hoạt động tốt. `audit_events` dùng schema tương tự nhưng với `building_id` làm RLS anchor thay vì `billing_period_id` — phù hợp với master data không gắn với billing period. Khác với billing, `building_id` nullable để support tenant events (tenant không có building_id trực tiếp).

Các services hiện tại (`ContractService`, `RoomService`, `TenantService`, `BuildingService`) đều có mutation methods (`create`, `update`, `remove`, `bulkAction`) nhưng không ghi audit.

## Goals / Non-Goals

**Goals:**
- Tạo bảng `audit_events` với building-scoped RLS
- Repository + Service layer tái dùng được
- Wire vào 4 domain services
- API endpoint query by entity hoặc by building
- Types + constants đồng bộ

**Non-Goals:**
- Không merge với `billing_audit_events`
- Không build UI trong change này (chỉ data layer + API)
- Không audit contract_occupants, meter_devices trong v1 (chỉ 4 entity chính)

## Decisions

**D1 — `building_id` nullable cho tenant events**

Building/Room/Contract đều có `building_id` trực tiếp → set khi ghi audit. Tenant là **global entity** không scoped to building — `TenantService.create/update/remove` không mang `building_id`. Infer chỉ khi context rõ ràng (e.g. caller biết building_id). → `building_id` **nullable**, ghi `NULL` cho tenant events khi không có context. RLS cho manager vẫn đúng: manager chỉ đọc được events có `building_id IN (assigned)` — tenant events với `NULL` building_id không lọt qua, chỉ admin thấy.

**D2 — entity_type: CHECK constraint hay text free?**

`billing_audit_events` dùng CHECK hardcoded → phải migration khi thêm type. Với `audit_events`: dùng CHECK constraint chứa set entity types đã biết, nhưng có thể ALTER ADD sau. Tradeoff: safety vs flexibility. → **Dùng CHECK** để enforce, cùng pattern với billing.

**D3 — Write path: service layer hay repository trực tiếp?**

`BillingAuditService.append` inject `actor_id` từ `user` context — pattern tốt. → `AuditService.append(event, user, input)` cùng signature, services gọi sau mỗi mutation.

**D4 — Atomic với mutation?**

Billing ghi audit bên trong RPC (atomic). Với application-layer mutations: audit append là separate DB call sau mutation. Nếu audit fail, mutation đã committed. → **Acceptable**: audit là observability layer, không phải invariant. Log lỗi nhưng không rollback.

**D5 — before_data: read trước mutation hay trust caller?**

Service đọc entity trước khi update (nhiều services đã làm `get` trước `update`). → Service tự đọc before, caller không cần pass vào.

**D6 — Bulk audit: aggregate vs per-entity vs cả hai**

Bulk action với N entities: emit 1 aggregate event hay N per-entity events? Per-entity cho phép truy lịch sử từng entity riêng lẻ. Aggregate đơn giản hơn nhưng mất detail. → **Cả hai**: emit 1 aggregate parent event (`correlation_id = parent.id`) + N per-entity child events (mỗi cái mang cùng `correlation_id`). Schema cần thêm cột `correlation_id uuid` nullable. Aggregate event: `entity_id = null`, `metadata` chứa tổng kết (`total`, `succeeded`, `failed`). Child events: `entity_id = <entity_id>`, `metadata.correlation_id = <parent_id>`.

**D7 — Contract lifecycle: terminated vs expired vs ended**

`contract.terminated` = chấm dứt sớm (manual, trước end_date). `contract.expired` = hết hạn tự nhiên (status → `expired`). Không dùng `contract.ended` làm action code — quá mơ hồ. Action code phản ánh **cơ chế** chấm dứt, không phải trạng thái cuối. Detect trong wiring: `input.status === 'terminated'` → `contract.terminated`, `input.status === 'expired'` → `contract.expired`, else → `contract.updated`.

## Risks / Trade-offs

- **Audit fail silent**: Nếu `AuditService.append` throw, service hiện tại sẽ propagate error. Cần wrap trong try-catch + log để tránh audit failure làm hỏng main operation.
- **Before snapshot overhead**: Mỗi update cần 1 extra read. Acceptable với master data (low frequency mutations).
- **Migration retroactive gap**: Data cũ không có audit trail — document là known limitation.

## Migration Plan

1. Deploy migration: `CREATE TABLE audit_events` + RLS + indexes
2. Deploy code: repository, service, constants, types, mapper
3. Wire services: buildings, rooms, tenants, contracts
4. Deploy API endpoint
5. Rollback: migration `DROP TABLE audit_events` + revert code (no data dependency)
