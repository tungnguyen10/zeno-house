## 1. Database

- [x] 1.1 Write Supabase migration `20260515000000_create_contracts.sql` creating the `contracts` table with all columns, FK constraints, partial unique index, updated_at trigger, RLS enable, admin and manager policies
- [x] 1.2 Apply migration via Supabase Dashboard SQL Editor or `supabase db push`
- [x] 1.3 Regenerate `app/types/database.types.ts` via `supabase gen types typescript`

## 2. TypeScript Types

- [x] 2.1 Create `app/types/contracts.ts` with `Contract`, `ContractInsert`, `ContractUpdate` types mapped from `database.types.ts`, and a `ContractWithDetails` type including nested room and tenant summary fields
- [x] 2.2 Add `ContractStatus` union type (`'active' | 'expired' | 'terminated'`)

## 3. Zod Validators

- [x] 3.1 Create `app/utils/validators/contracts.ts` with `createContractSchema` (all required fields + optional) and `updateContractSchema` (all fields optional, partial)
- [x] 3.2 Add date refinement: `end_date` must be after `start_date`

## 4. Server Repository

- [x] 4.1 Create `server/repositories/contracts/index.ts` with `findAll(params)`, `findById(id)`, `create(data)`, `update(id, data)`, `remove(id)`
- [x] 4.2 `findAll` supports `room_id`, `tenant_id`, `status` filters and pagination (`page`, `limit`)
- [x] 4.3 `findById` joins room (room_number, floor, building name) and tenant (full_name, phone)

## 5. Server Service

- [x] 5.1 Create `server/services/contracts/index.ts` with `listContracts`, `getContract`, `createContract`, `updateContract`, `deleteContract`
- [x] 5.2 `createContract`: check for existing active contract on same room → throw CONFLICT if found
- [x] 5.3 `updateContract`: if status changes to `active`, check for conflicting active contract on same room (excluding self) → throw CONFLICT
- [x] 5.4 `deleteContract`: check existence → throw NOT_FOUND if missing

## 6. Server API Endpoints

- [x] 6.1 Create `server/api/contracts/index.get.ts` — list with query param validation
- [x] 6.2 Create `server/api/contracts/index.post.ts` — create with Zod body validation
- [x] 6.3 Create `server/api/contracts/[id].get.ts` — get by id
- [x] 6.4 Create `server/api/contracts/[id].patch.ts` — update with Zod body validation
- [x] 6.5 Create `server/api/contracts/[id].delete.ts` — delete

## 7. Client Composables

- [x] 7.1 Create `app/composables/contracts/useContractList.ts` exposing `contracts`, `total`, `totalPages`, `page`, `statusFilter`, `isLoading`, `error`, `refresh`; reset `page` to 1 when `statusFilter` changes
- [x] 7.2 Create `app/composables/contracts/useContractDetail.ts` with reactive id ref; mirrors `useBuildingDetail` pattern
- [x] 7.3 Create `app/composables/contracts/useContractForm.ts` handling create/edit with client-side Zod validation

## 8. Client Component

- [x] 8.1 Create `app/components/contracts/ContractForm.vue` with fields: room select (searchable), tenant select (searchable), start_date, end_date, monthly_rent, deposit, status, notes; uses `UiInput` and `UiButton`

## 9. Client Pages

- [x] 9.1 Create `app/pages/contracts/index.vue` — list page with status filter dropdown, pagination, loading skeleton, empty state, create button
- [x] 9.2 Create `app/pages/contracts/create.vue` — create page using `ContractForm`, redirect to `/contracts/:id` on success, show inline API errors
- [x] 9.3 Create `app/pages/contracts/[id]/index.vue` — detail page with all fields, edit/delete actions, `UiConfirmModal` for delete
- [x] 9.4 Create `app/pages/contracts/[id]/edit.vue` — edit page pre-filling `ContractForm`, redirect to `/contracts/:id` on success

## 10. Sidebar Navigation

- [x] 10.1 Add "Hợp đồng" nav item to `app/components/app/AppSidebar.vue` linking to `/contracts`

## 11. Tenant & Room Detail Integration

- [x] 11.1 Add "Hợp đồng" section to `app/pages/tenants/[id]/index.vue` — list tenant's contracts fetched via `GET /api/contracts?tenant_id=:id`, each linking to `/contracts/:id`; show "Chưa có hợp đồng" placeholder when empty
- [x] 11.2 Add "Hợp đồng" section to `app/pages/rooms/[id]/index.vue` — list room's contracts fetched via `GET /api/contracts?room_id=:id`, each linking to `/contracts/:id`; show "Chưa có hợp đồng" placeholder when empty
