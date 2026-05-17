## Why

v0.2 đã hoàn tất Core Data cơ bản, nhưng hệ thống vẫn thiếu lớp nền vận hành để bước sang Monthly Billing Workspace mà không biến billing thành luồng gắn chặt vào Room detail. Nếu không chốt ranh giới này trước, v0.3 sẽ phải mang theo các quyết định còn mơ hồ về cấu hình building, occupancy, contract terms, và navigation.

## What Changes

- Introduce a new foundation change that aligns Core Data with the future Monthly Billing Workspace.
- Upgrade Building từ dữ liệu bất động sản đơn thuần thành operational container có billing defaults, schedule, và owner/contact metadata.
- Add quick room setup workflow để tạo nhiều room trong lúc tạo building, có preview và batch submit.
- Introduce occupant / roommate model để tách primary tenant khỏi các occupant cùng ở.
- Align Contract thành nguồn truth thương mại cho billing: occupant count, commercial terms, và trạng thái hợp đồng rõ ràng.
- Define meter device lifecycle ở mức schema / design để chuẩn bị cho replacement flow sau này.
- Add Operations navigation placeholder cho Monthly Billing, đồng thời giữ Room page là master data screen, không phải billing entry point.
- Update architecture docs / ADRs để khóa mindset: billing là workspace-scoped, không room-centric.
- **Deferred**: utility readings entry, service fee CRUD, invoice generation, payment tracking, và tenant billing portal vẫn nằm ở các change v0.3 riêng.

## Capabilities

### New Capabilities
- `product-flow-foundation`: Core-data alignment phase covering building operational config, quick room setup, occupant model, contract commercial terms, meter lifecycle design, and navigation alignment before billing workspace work.

### Modified Capabilities
- `product-architecture`: Update platform boundaries and roadmap to include v0.2.5 core-data alignment before billing workspace work.

## Impact

- `openspec/specs/product-architecture/` needs a boundary update to reflect the new v0.2.5 foundation layer.
- `supabase/migrations/` will need schema changes for buildings, contracts, and any new occupant / meter tables.
- `server/api/buildings/`, `server/services/buildings/`, and `server/repositories/buildings/` will need to accept the new building payload shape.
- `app/pages/buildings/`, `app/composables/buildings/`, and `app/components/buildings/` will need UI for building operational config and quick room setup.
- `server/api/contracts/`, `server/services/contracts/`, and `server/repositories/contracts/` will need contract-term updates.
- `app/pages/contracts/`, `app/composables/contracts/`, and `app/components/contracts/` will need UI updates for the new contract model.
- `app/components/app/` and the sidebar/navigation shell will need an Operations section placeholder.
- Existing v0.3 billing changes such as utility readings, service fees, invoices, and payments remain separate and should not be pulled into this change.