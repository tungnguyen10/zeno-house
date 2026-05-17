## 1. Types & Validators

- [x] 1.1 Move `ContractOccupant` interface ra `app/types/contract-occupants.ts` riêng (xoá khỏi `meter-devices.ts`)
- [x] 1.2 Thêm `contract_occupants` vào `app/types/database.types.ts` nếu chưa có (Row/Insert/Update)
- [x] 1.3 Tạo `app/utils/validators/contract-occupants.ts` với `contractOccupantAddSchema` (tenant_id, role, move_in_date, billing_counted) và `contractOccupantMoveOutSchema` (move_out_date)
- [x] 1.4 Tạo `app/utils/mappers/contract-occupants.ts` với `mapContractOccupant(row)`

## 2. Server — Repository & Service

- [x] 2.1 Tạo `server/repositories/contract-occupants/index.ts`: `listByContract`, `findById`, `insert`, `updateById`, `deleteById`
- [x] 2.2 Tạo `server/services/contract-occupants.ts`: `list`, `add` (check duplicate active), `moveOut`, `remove` — guard permissions đúng role

## 3. Server — API Endpoints

- [x] 3.1 Tạo `server/api/contracts/[id]/occupants.get.ts` — GET list
- [x] 3.2 Tạo `server/api/contracts/[id]/occupants.post.ts` — POST add occupant
- [x] 3.3 Tạo `server/api/contracts/[id]/occupants/[occupantId].patch.ts` — PATCH move-out (admin only)
- [x] 3.4 Tạo `server/api/contracts/[id]/occupants/[occupantId].delete.ts` — DELETE (admin only, 204)

## 4. Client — Composable & Form

- [x] 4.1 Tạo `app/composables/contracts/useContractOccupants.ts`: `occupants`, `isLoading`, `addOccupant`, `moveOut`, `removeOccupant`
- [x] 4.2 Tạo `app/components/contracts/ContractOccupantForm.vue`: tenant searchable select, move_in_date, billing_counted checkbox

## 5. UI — Contract Detail Page

- [x] 5.1 Thêm section "Người ở" vào `app/pages/contracts/[id]/index.vue` với danh sách occupants (primary tenant + roommates)
- [x] 5.2 Admin: nút "Thêm người ở" mở inline form `ContractOccupantForm`
- [x] 5.3 Admin: per-row action "Ghi nhận rời" (date input + confirm) và "Xoá" (confirm modal)

## 6. Scalability & Constraints

- [x] 6.1 Thêm DB partial unique index `contract_occupants_active_tenant_unique ON contract_occupants(tenant_id) WHERE move_out_date IS NULL` (`supabase/migrations/20260517000006_occupant_uniqueness.sql`)
- [x] 6.2 Thêm `findActiveOccupancyByTenant` và `findActiveByTenant` vào repository để check cross-contract trước khi insert
- [x] 6.3 `ContractOccupantService.add`: guard 4 conflict cases (primary tenant same HĐ, primary tenant HĐ khác, active occupant HĐ khác, duplicate trong HĐ này)
- [x] 6.4 `ContractService.create`: check primary tenant chưa đứng tên HĐ khác và chưa là active occupant ở HĐ khác
- [x] 6.5 `server/repositories/tenants`: thêm `available` filter — loại trừ tenants đang là primary hoặc active occupant; hỗ trợ `excludeContractId` cho edit context
- [x] 6.6 `ContractForm` và `ContractOccupantForm` truyền `available=true` + `excludeContractId` để picker chỉ hiện tenants khả dụng

## 7. UI — Contract Create Page

- [x] 7.1 Redesign `/contracts/create` theo two-step layout với numbered circles và connector line
- [x] 7.2 Step 2: section "Người ở chung" (tuỳ chọn) — thêm pending occupants client-side trước khi submit
- [x] 7.3 On submit: tạo HĐ trước → fire occupant adds song song (`Promise.allSettled`) → redirect dù có partial failure
- [x] 7.4 Amber warning banner nếu một số occupant add thất bại (non-blocking)
- [x] 7.5 `ContractOccupantForm`: thêm prop `available?: boolean` pass vào server query

## 8. UI — Occupant Count Warning

- [x] 8.1 Detail page "Người ở" section header hiển thị `X/Y` (active occupants / occupant_count)
- [x] 8.2 Khi vượt `occupantCount`: badge amber với `⚠` — soft warning, không block thêm

## 9. Verify

- [x] 9.1 `npm run typecheck` pass
- [x] 9.2 `npm run lint` pass
