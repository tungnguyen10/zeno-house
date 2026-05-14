## Why

F0.1.4 đã đặt nền móng API infrastructure. F0.1.5 là vertical slice đầu tiên thật sự — implement Buildings domain end-to-end từ database schema đến UI pages. Đây là feature đầu tiên hoàn chỉnh để kiểm chứng toàn bộ stack và pattern trước khi nhân rộng sang Rooms, Tenants, Contracts.

## What Changes

- Tạo `supabase/migrations/` SQL file cho bảng `buildings` với RLS policies
- Regenerate `app/types/database.types.ts` sau khi migrate
- Tạo `app/types/buildings.ts` — Building DTO, BuildingStatus, BuildingInput, BuildingUpdateInput
- Tạo `app/utils/validators/buildings.ts` — Zod schemas cho create và update
- Tạo `app/utils/mappers/buildings.ts` — DB row → Building DTO
- Tạo `server/repositories/buildings/index.ts` — findAll, findById, insert, update, remove
- Tạo `server/services/buildings/index.ts` — list, get, create, update, remove với permission check
- Tạo `server/api/buildings/` — 5 endpoints: index.get, index.post, [id].get, [id].patch, [id].delete
- Tạo `app/composables/buildings/useBuildingList.ts` — fetch list, pagination
- Tạo `app/composables/buildings/useBuildingForm.ts` — form state, validation, submit
- Tạo `app/components/buildings/BuildingCard.vue` — display card
- Tạo `app/components/buildings/BuildingForm.vue` — shared create/edit form
- Tạo `app/pages/buildings/index.vue` — list page
- Tạo `app/pages/buildings/create.vue` — create page
- Tạo `app/pages/buildings/[id]/index.vue` — detail page
- Tạo `app/pages/buildings/[id]/edit.vue` — edit page

## Capabilities

### New Capabilities
- `buildings-database`: Bảng `buildings` trong Supabase với RLS policies, SQL migration file
- `buildings-api`: Server endpoints CRUD cho buildings — API handlers, service layer, repository layer
- `buildings-client`: Shared types, Zod validators, mappers, composables (list và form)
- `buildings-ui`: Pages list/create/detail/edit và components BuildingCard + BuildingForm

### Modified Capabilities
<!-- none -->

## Impact

- Supabase database: thêm bảng `buildings`
- `app/types/database.types.ts`: cần regenerate sau migration (manual step)
- Tất cả files mới — không breaking change với code hiện có
- AppSidebar "Tòa nhà" nav item sẽ trỏ đến `/buildings` (đã đúng, chỉ cần page tồn tại)
