## Why

Contracts là domain phức tạp nhất (state machine 4 trạng thái, sub-resources occupants/payments/renewals/services, atomic handover meter readings, room status coupling) nhưng UX/CRUD đang ở mức v0.2 tối thiểu: list query không validate Zod + không có search/sort/order, detail page là tập hợp tabs phẳng không có hero, form lớn (~20 field) render phẳng không có sections/sticky save/draft, DELETE hard-delete không kiểm tra issued billing periods / paid invoices / meter readings nên có thể bể billing history. Zero tests. Cần overhaul theo cùng pattern với buildings/rooms/tenants để tới mức "showcase".

## What Changes

**UI — list page**
- Toolbar mới: search box (debounced 250ms — contract_code / tenant_name / room_number), filter chips status (`active`, `expired`, `terminated`, `renewed`), giữ building filter hiện có, sort selector (`start_date` / `end_date` / `created_at` / `monthly_rent`) + order toggle.
- Bulk-select checkbox trên row, bulk actions bar (terminate, delete) — chỉ admin. Bulk `delete` chỉ chấp nhận contracts không-active và không có billing data.
- Pagination + filter URL-synced (`?page`, `?q`, `?status`, `?building_id`, `?sort`, `?order`).
- Skeleton + filtered-empty vs no-data + error retry state nâng cấp.

**UI — detail page**
- Hero header: contract_code + status pill + 4 quick stat tiles (tenant name link / room link / months elapsed / total paid + deposit balance). Building → Room → Tenant breadcrumb dưới hero.
- Layout sectioned theo anchor: `#overview` / `#occupants` / `#payments` / `#services` / `#renewals` / `#meter-readings` / `#danger-zone` — giữ tabs hiện có nhưng style thành section cards với sticky tab nav.
- Quick actions trong hero: "Gia hạn" (renew), "Kết thúc sớm" (terminate confirm), "Nhập chỉ số" (link meter readings).
- Hide danger zone cho manager.

**UI — form (create + edit)**
- Form create giữ 3-step wizard nhưng polish: progress indicator (1. Hợp đồng → 2. Khách ở cùng → 3. Dịch vụ), step navigation guard.
- Form edit refactor thành 4 sections numbered card: Quan hệ (room + tenant, readonly khi đã active) / Thời hạn & Giá (start_date, end_date, payment_day, monthly_rent, deposit) / Điều khoản (occupant_count, discounts[], surcharges[]) / Trạng thái & Ghi chú (status, notes).
- Inline blur validation; error summary banner đầu form (click-to-focus).
- Sticky save bar mobile + safe-area; desktop footer.
- Dirty-state guard qua `onBeforeRouteLeave` + `beforeunload` (cả create wizard + edit).
- Form draft autosave localStorage (`contract-form:create` / `contract-form:edit:<id>`) debounce 500ms. Wizard draft phải bao gồm pending occupants + selected services.

**API — list query schema + sort**
- `GET /api/contracts` validate qua `contractListQuerySchema` (Zod) mới: `page`, `limit`, `q`, `building_id`, `room_id`, `tenant_id`, `status[]`, `sort` (`start_date` | `end_date` | `created_at` | `monthly_rent`), `order` (`asc` | `desc`). Giữ default current behavior (sort `created_at desc` khi không có param). Search `q` ilike trên contract_code + join tới tenant.full_name / room.room_number.

**API — safe delete**
- `DELETE /api/contracts/:id` SHALL kiểm tra: status không phải `active` (active phải terminate trước), số billing periods đã issue, số paid payments, số meter readings ngoài handover; trả `409 CONFLICT` với detail `{ status, issuedBillingPeriods, paidPayments, nonHandoverMeterReadings }` nếu vi phạm.
- Thêm `?force=true` (admin only): soft "archive" via giữ status `terminated` (nếu active sẽ tự terminate trước khi force-delete cascade child records không-billing). Không xoá historical billing data — chỉ disassociate.
- Note: vì contracts đã có status `terminated`, không cần thêm status mới.

**API — bulk operations**
- `POST /api/contracts/bulk` body `{ action: 'terminate' | 'delete', ids: string[], reason?: string }`, validate qua `contractBulkActionSchema`. Trả `{ succeeded, failed: [{ id, reason }] }`. `terminate`: set status `terminated`, release room + tenant như single endpoint. `delete`: cùng rule với DELETE.

**Composables**
- `useContractList`: thêm refs `q`, `status` (array), `sort`, `order`, `roomFilter`, `tenantFilter`; URL sync 2 chiều; reset `page=1` khi filter đổi.
- `useContractForm`: thêm `isDirty`, `hasDraft`, `restoreDraft()`, `clearDraft()`. Wizard state đồng bộ vào draft.
- Mới: `useContractBulkActions`.

**Tests (mới)**
- `tests/server/contracts.api.test.ts`: cover endpoints chính (list/get/create/update/delete/bulk) + permission + Zod validation + safe-delete conflict matrix + bulk partial success.
- `tests/components/ContractListToolbar.test.ts`, `ContractForm.test.ts` (sections + wizard nav), `ContractDetailHero.test.ts`.
- `tests/composables/contracts/useContractForm.test.ts`, `useContractBulkActions.test.ts`.

**Không thay đổi**: state machine logic (`renew` flow, `terminate` side effects, room status coupling), atomic `createWithHandover` RPC, sub-resource endpoints (occupants/payments/renewals/services), mapper shape, route helpers (`contractPath`), contract code generation.

## Capabilities

### New Capabilities
- `contracts-ui`: page-level UI requirements (list toolbar, detail hero/section layout, form sections + wizard polish + sticky save + draft).

### Modified Capabilities
- `contracts-api`: thêm requirements cho Zod query validation, search/sort/order, safe-delete với conflict matrix 409, endpoint bulk operations.
- `contracts-client`: mở rộng `useContractList` (URL sync + sort + search), `useContractForm` (dirty + draft + wizard state), thêm `useContractBulkActions`.

## Impact

**Code**
- `app/pages/contracts/index.vue`, `app/pages/contracts/[code]/index.vue`, `app/pages/contracts/create.vue`, `app/pages/contracts/[code]/edit.vue`
- `app/components/contracts/*` (cập nhật `ContractForm`; thêm `ContractListToolbar`, `ContractDetailHero`, `ContractBulkActionsBar`, `ContractWizardSteps`)
- `app/composables/contracts/*` (mở rộng `useContractList`, `useContractForm`; thêm `useContractBulkActions`)
- `app/utils/validators/contracts.ts` (thêm `contractListQuerySchema`, `contractBulkActionSchema`)
- `server/api/contracts/index.get.ts` (Zod), `server/api/contracts/[id].delete.ts`, `server/api/contracts/bulk.post.ts` (mới)
- `server/services/contracts/index.ts`, `server/repositories/contracts/index.ts` (filter/sort, conflict checks, bulk)
- `tests/server/contracts.api.test.ts`, `tests/components/contracts/*`, `tests/composables/contracts/*`

**APIs**
- GET `/api/contracts` — thêm Zod validation + sort/search; response giữ nguyên.
- DELETE `/api/contracts/:id` — có thể trả 409 mới; `?force=true` cho admin.
- POST `/api/contracts/bulk` — endpoint mới.

**DB**
- Không migration (status enum đã đủ; `terminated` dùng cho soft-archive semantics).

**Không impact**: state machine của renew, atomic handover insert, sub-resource APIs (`/api/contracts/:id/occupants|payments|renewals`), billing, meter readings, dashboard.

**Follow-up (không thuộc change này)**: nếu cần "draft" status cho contract chưa active để giữ data tạm thời thay vì localStorage, tách change riêng `contract-draft-status`.
