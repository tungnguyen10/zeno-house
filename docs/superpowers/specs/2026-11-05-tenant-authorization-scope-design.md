# ZH-SEC-01: Phân quyền và phạm vi Tenant

## Bối cảnh

Đây là sub-project đầu tiên trong đợt P0 Stabilization. Thứ tự các sub-project:

1. **ZH-SEC-01**: phân quyền Tenant (tài liệu này).
2. ZH-CTR-01: gia hạn hợp đồng atomic (spec riêng).
3. Reconciliation dữ liệu billing cũ (chỉ đọc), sau đó ZH-BIL-01: close/reopen kỳ billing atomic (spec riêng).

Repository dùng Supabase `service_role` nên RLS không bảo vệ được service code. Mọi quyết định phân quyền phải nằm ở service.

## Hiện trạng (nhánh `develop`)

- `TenantService.get()` kiểm tra hợp đồng thuộc tòa được gán, kể cả hợp đồng cũ, hoặc Owner là người tạo Tenant. Kết quả trả về toàn bộ hồ sơ kèm URL ký của ảnh CCCD.
- `update()`, `uploadIdImage()`, `removeIdImage()` chỉ kiểm tra capability, không kiểm tra scope.
- `remove()` dùng `opts.buildingId` từ client khi không xác định được tòa đang ở.
- `bulkAction()` với `archive`/`activate` đưa toàn bộ `input.ids` vào RPC `bulk_master_data_action` mà không kiểm tra scope. Map `scopes` chỉ dùng để ghi audit. Nhánh `delete` vẫn truyền `input.building_id`.
- `TenantAccountService.loadTenantInScope()` chấp nhận hợp đồng cũ hoặc người tạo. Owner cũ vẫn quản lý được tài khoản Portal sau khi Tenant đã chuyển đi.
- `TenantService.list()` của Owner luôn có thêm các Tenant do Owner tạo, kể cả khi Tenant đã ở tòa khác.
- "Người tạo" không lưu thành cột riêng mà suy ra từ audit `TENANT_CREATED` (`wasCreatedByActor`, `findCreatedTenantIdsByActor`).

## Quyết định đã chốt

1. **Custodian của Tenant không có quan hệ đang hiệu lực:** người tạo chỉ có quyền khi Tenant **chưa từng có hợp đồng**. Khi Tenant đã có lịch sử hợp đồng thì chỉ Admin được sửa hồ sơ. Không thêm migration cho custodian.
2. **Owner cũ:** chỉ đọc hồ sơ cơ bản (tên, SĐT, mã) để tra cứu hợp đồng và hóa đơn cũ. Không thấy số CCCD, ảnh CCCD hay trạng thái Portal. Tenant không nằm trong danh sách mặc định của Owner cũ.
3. **Nhiều quan hệ đang hiệu lực:** trường hợp này có thể xảy ra nhưng chưa có luồng chia sẻ quyền. Nếu có ít nhất một quan hệ ở tòa ngoài scope của actor thì **fail closed**: thao tác nhạy cảm chỉ dành cho Admin.
4. **Bulk archive/activate:** kiểm tra lại trong DB transaction bằng RPC riêng cho tenant, chỉ cấp cho `service_role`. Không sửa `bulk_master_data_action` dùng chung.
5. Toàn bộ quy tắc phân quyền nằm trong một service TypeScript dùng chung. RPC chỉ xác minh rằng quan hệ không thay đổi kể từ lúc kiểm tra.

## Mô hình quyền

**Quan hệ đang hiệu lực:** có `contracts.tenant_id = tenant` với `status = 'active'`, hoặc có `contract_occupants.tenant_id = tenant` với `move_out_date IS NULL`. Giữ nguyên định nghĩa hiện tại; việc xét theo ngày thuộc ZH-CTR-01.

**Mức quyền:**

- `full`: đọc toàn bộ hồ sơ (gồm số CCCD, URL ảnh CCCD đã ký, `activeAssignment`), cập nhật, quản lý ảnh CCCD, archive/activate/delete, quản lý tài khoản Portal.
- `basic`: chỉ đọc `id`, `code`, `full_name`, `phone`, `status`. Mọi thao tác ghi và thao tác Portal trả 403.
- `none`: mọi thao tác trả 404.

Capability tương ứng vẫn bắt buộc ở mọi mức; thiếu capability thì trả 403 trước khi xét scope.

| Tình huống của Tenant | Admin | Owner/Manager có scope | Owner/Manager khác |
|---|---|---|---|
| Có quan hệ hiệu lực, mọi tòa đều trong scope của actor | full | full | none |
| Có quan hệ hiệu lực, có tòa ngoài scope của actor | full | basic | none |
| Chưa từng có hợp đồng | full | full nếu là người tạo, ngược lại none | none |
| Đã có lịch sử, hiện không có quan hệ hiệu lực | full | basic nếu từng có hợp đồng ở tòa trong scope | none |

"Có scope" nghĩa là actor được gán ít nhất một tòa mà Tenant có quan hệ, hiện tại hoặc trong lịch sử. Manager không phải người tạo theo định nghĩa của quy tắc custodian, trừ khi audit `TENANT_CREATED` ghi actor đó.

## Thiết kế

### `server/services/tenants/authorization.ts` (mới)

```ts
type TenantAccessLevel = 'full' | 'basic' | 'none'
type TenantAction =
  | 'read_profile'
  | 'update_profile'
  | 'manage_documents'
  | 'archive'
  | 'activate'
  | 'delete'
  | 'manage_account'

interface TenantAccessContext {
  tenant: Tenant
  level: TenantAccessLevel
  activeBuildingIds: string[]
  everContracted: boolean
}

TenantAuthorizationService.resolveAccess(event, user, idOrCode): Promise<TenantAccessContext | null>
TenantAuthorizationService.resolveAccessMany(event, user, ids): Promise<Map<string, TenantAccessContext>>
TenantAuthorizationService.assertAccess(event, user, idOrCode, action): Promise<TenantAccessContext>
```

- `assertAccess` xử lý theo thứ tự:
  1. thiếu capability của action → 403;
  2. không tìm thấy Tenant hoặc `level = 'none'` → 404;
  3. action khác `read_profile` mà `level = 'basic'` → 403.
- Bảng capability của action giữ nguyên capability mà từng method đang dùng: `tenants.read`, `tenants.update`, `tenant.account.provision`. Delete vẫn dùng `canDeleteMasterData` với tòa do server xác định.
- ID canonical luôn lấy từ `tenant.id` sau khi resolve, không lấy từ tham số của request.
- Không mở rộng `server/utils/scope.ts`; helper building giữ nguyên.

### Repository `server/repositories/tenants/index.ts`

Thêm `findAccessFacts(event, tenantIds)`, truy vấn theo lô và trả về cho từng Tenant:

- `activeBuildingIds`: tòa của hợp đồng `active` mà Tenant đứng tên chính, cộng tòa của occupancy đang mở;
- `historicalBuildingIds`: tòa của mọi hợp đồng mà Tenant từng đứng tên chính hoặc từng là occupant;
- `everContracted`: `historicalBuildingIds` khác rỗng.

`wasCreatedByActor` và `findCreatedTenantIdsByActor` giữ nguyên. Repository chỉ truy vấn; quyết định mức quyền thuộc service.

### Thay đổi trong service

| Method | Action | Thay đổi |
|---|---|---|
| `TenantService.get` | `read_profile` | Với `basic`, trả DTO đã lược bỏ: không `id_number`, không ký URL ảnh CCCD, không `activeAssignment` |
| `TenantService.list` | — | Owner chỉ nhận thêm Tenant do mình tạo nếu Tenant chưa từng có hợp đồng |
| `TenantService.update` | `update_profile` | Gọi `assertAccess` trước khi kiểm trùng và ghi |
| `TenantService.uploadIdImage`, `removeIdImage` | `manage_documents` | Gọi `assertAccess` trước khi thao tác storage |
| `TenantService.remove` | `delete` | Bỏ `opts.buildingId`; tòa để kiểm `canDeleteMasterData` lấy từ `activeBuildingIds` hoặc lịch sử do server xác định; Tenant chưa từng có hợp đồng thì dựa vào quyền `full` theo người tạo |
| `TenantService.bulkAction` | `archive` / `activate` / `delete` | Xem phần Bulk |
| `TenantAccountService.getStatus`, `provision`, `setStatus`, `resetPassword`, `revoke` | `manage_account` | Thay `loadTenantInScope` bằng `assertAccess`, yêu cầu `full` |
| `TenantAccountService.list` | — | Lọc bằng `resolveAccessMany`, chỉ giữ Tenant có `full` |

Thông báo lỗi giữ phong cách tiếng Việt có dấu đang dùng. Thông báo 404 không tiết lộ Tenant có tồn tại hay không.

### Bulk

1. Bỏ ID trùng và giữ giới hạn số lượng của validator hiện có.
2. Gọi `resolveAccessMany`. Mỗi ID được phân loại:
   - không tìm thấy hoặc `none` → `not_found`;
   - `basic` → `forbidden`;
   - `full` → hợp lệ.
3. Với `archive`/`activate`, đưa các ID hợp lệ vào RPC mới, mỗi item kèm `expected_building_ids` (bằng `activeBuildingIds` đã sắp xếp).
4. Với `delete`, gọi `remove()` cho từng ID hợp lệ và không truyền `building_id` của client.
5. Trả `{ succeeded, failed: [{ id, reason }] }` với reason thuộc `not_found | forbidden | conflict | has_active_contracts | has_active_occupancies | unexpected_error`.
6. Audit chỉ ghi các ID thành công, building lấy từ context phía server.

`building_id` trong validator bulk vẫn được nhận để client cũ không vỡ, nhưng server bỏ qua.

### Migration: `supabase/migrations/<timestamp>_tenant_scoped_bulk_status.sql`

```sql
create or replace function public.bulk_tenant_status_action(
  p_action text,   -- 'archive' | 'activate'
  p_items jsonb    -- [{ "id": uuid, "expected_building_ids": [uuid, ...] }]
) returns table (id uuid, succeeded boolean, reason text)
language plpgsql
security invoker
set search_path = ''
```

- Kiểm tra `p_action` thuộc tập cho phép, ngược lại raise lỗi.
- Duyệt các item theo `id` tăng dần. Với mỗi item:
  1. `select ... from public.tenants where id = ... for update`; không có dòng thì trả `not_found`.
  2. Tính lại tập tòa của các quan hệ đang hiệu lực dưới cùng transaction. Nếu tập này khác `expected_building_ids` thì trả `conflict`.
  3. Cập nhật trạng thái theo đúng ngữ nghĩa `archive`/`activate` đang có trong `bulk_master_data_action` cho entity `tenant`.
- Tên bảng và hàm đều schema-qualify.
- `revoke all on function ... from public, anon, authenticated; grant execute on function ... to service_role;`
- Không đổi `bulk_master_data_action`.

Áp dụng qua Dashboard SQL Editor theo quy trình hiện tại. Sau khi áp dụng thì sinh lại `app/types/database.types.ts`, không sửa file này bằng tay.

### Script kiểm tra: `supabase/verification/tenant_scoped_bulk_status.sql`

Chạy trong một transaction và rollback ở cuối:

- `anon` và `authenticated` không có quyền `EXECUTE`; `service_role` có.
- Fixture có tòa A, tòa B và các tenant: khớp scope, lệch scope (expected là A nhưng thực tế B), ID không tồn tại, và tenant đã có trạng thái đích.
- Mỗi case trả boolean hoặc count kèm alias mô tả kết quả mong đợi.

## UI

Theo `.agents/skills/zeno-house/references/ui-polish-workflow.md`. Chỉ dùng primitive có sẵn; không thêm primitive hay token.

- DTO `Tenant` thêm `accessLevel: 'full' | 'basic'` do server trả về.
- Trang chi tiết Tenant khi `basic`:
  - ẩn các nút sửa, tải lên/xóa CCCD, lưu trữ/xóa và toàn bộ khu vực tài khoản Portal;
  - hiện `UiAlert` loại info: "Khách thuê hiện không thuộc tòa nhà bạn quản lý. Bạn chỉ xem được thông tin cơ bản và lịch sử hợp đồng tại tòa của mình.";
  - `TenantDetailHero` không hiển thị CCCD (server cũng không trả trường này).
- Kết quả bulk trên danh sách hiện số thành công, số thất bại và lý do tiếng Việt theo từng nhóm:

  | Mã | Hiển thị |
  |---|---|
  | `forbidden` | Ngoài phạm vi quản lý |
  | `conflict` | Dữ liệu vừa thay đổi, hãy thử lại |
  | `not_found` | Không tìm thấy |
  | `has_active_contracts` | Đang có hợp đồng |
  | `has_active_occupancies` | Đang ở ghép |

- Kiểm tra các trạng thái loading, lỗi, disabled và đang gửi, ở cả desktop lẫn mobile.

## Lỗi API

| Tình huống | HTTP |
|---|---|
| Thiếu capability | 403 |
| Tenant không tồn tại hoặc `none` | 404 |
| `basic` mà thực hiện thao tác ghi, thao tác CCCD hoặc Portal | 403 |
| Còn ràng buộc khi xóa | 409 (giữ nguyên `details`) |
| Lỗi DB | 500 |

## Test

**Unit test `tests/server/tenants/authorization.test.ts`** (mock repository):

- Mỗi ô của ma trận quyền với các role `admin`, `owner`, `manager`.
- Thiếu capability trả 403 trước khi xét scope.
- Resolve được bằng cả `id` lẫn `code`, và kết quả luôn dùng ID canonical.

**Mở rộng test service hiện có:**

- Owner A thao tác Tenant chỉ thuộc tòa B: `update`, upload/remove CCCD, `remove`, bulk `archive`/`activate`/`delete`, và 5 thao tác Portal đều bị từ chối.
- Tenant chuyển từ A sang B: A nhận `basic`; mọi thao tác ghi và Portal trả 403; `get` không trả `id_number` hay URL ảnh.
- Tenant chưa từng có hợp đồng do A tạo: A có `full`, B nhận 404. Sau khi Tenant có hợp đồng ở B, A trở về `none`.
- Tenant có quan hệ đang hiệu lực ở cả A và B, actor chỉ có scope A: thao tác ghi trả 403. Admin thực hiện được.
- Manager có scope nhưng thiếu capability: 403.
- `remove()` không đọc `buildingId` của client.
- Bulk trộn ID hợp lệ, ngoài scope, không tồn tại và trùng lặp: kiểm lý do từng ID, chỉ ID hợp lệ được đưa xuống RPC, audit chỉ có ID thành công. RPC trả `conflict` thì service báo `conflict`.
- `TenantAccountService.list` không trả Tenant mà actor chỉ có `basic`.

**SQL:** chạy `supabase/verification/tenant_scoped_bulk_status.sql` trên staging, hoặc trên Supabase local nếu đã cài CLI.

**Lệnh kiểm tra:** test liên quan, sau đó `npm run typecheck`, `npm test`, `npm run lint`.

## Ngoài phạm vi

- Không thiết kế lại giao diện Tenant ngoài các điểm ở mục UI.
- Luồng chọn Tenant khi tạo hợp đồng, orphan auth accounts (đã giới hạn cho Admin) và Portal tự phục vụ `/api/tenant/**`.
- Luồng chia sẻ quyền giữa nhiều Owner, và bảng custodian.
- Xét quan hệ hiệu lực theo ngày (thuộc ZH-CTR-01).

## Tài liệu cần cập nhật khi implement

- `docs/architecture/auth-permissions.md`: ma trận quyền Tenant.
- `docs/features/` tương ứng với Tenant và Portal account: hành vi `basic` và quy tắc custodian.
