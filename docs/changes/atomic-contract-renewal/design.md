---
type: Change Design
title: "2026-11-05-atomic-contract-renewal-design"
status: draft
change_state: implementation-review
tags: [superpowers, change, migration]
sources:
  - resource: "https://github.com/tungnguyen10/zeno-house/blob/060d0d77e07095c593b9ff154450580db8ba0f41/docs/superpowers/specs/2026-11-05-atomic-contract-renewal-design.md"
generated:
  by: "process:docs-okf-consolidation"
  at: "2026-11-06T00:00:00Z"
---

> Migrated P0 design/execution artifact. Validate actual source, migrations, tests, and rollout state before treating checked tasks as delivered. Canonical accepted requirements live in `docs/capabilities/**`.

# ZH-CTR-01: Gia hạn hợp đồng atomic

## Bối cảnh

Đây là sub-project thứ hai trong đợt P0 Stabilization, đi sau ZH-SEC-01 (`2026-11-05-tenant-authorization-scope-design.md`). Mục tiêu: gia hạn hợp đồng chỉ có hai kết cục, hoàn tất toàn bộ hoặc rollback toàn bộ. Người ở, dịch vụ và tiền cọc đang giữ phải được chuyển đúng sang hợp đồng mới.

## Hiện trạng (nhánh `develop`)

- `ContractRenewalService.renew()` (`server/services/contract-renewals.ts`) gọi nhiều request DB rời nhau và chỉ rollback thủ công theo kiểu best-effort.
- `extend`: insert `contract_renewals`, sau đó cập nhật hợp đồng; nếu cập nhật thất bại mới xóa log. Audit và việc hủy phụ lục `scheduled` nằm ngoài transaction.
- `new_contract`: đổi hợp đồng cũ sang `renewed`, insert successor `active`, clone dịch vụ, clone occupancy, insert renewal log, ghi 2 audit, rồi hủy phụ lục qua `ContractAmendmentService.cancelScheduledForContract`.
- Người thuê chính cũng là một dòng `contract_occupants` với `role='primary'`. `ContractOccupantRepository.cloneActiveToContract()` không đóng occupancy cũ, mà unique index `contract_occupants_active_tenant_unique(tenant_id) WHERE move_out_date IS NULL` cho mỗi tenant tối đa một occupancy đang mở. Vì thế insert thất bại và lỗi chỉ được `console.error`: successor mất cả người thuê chính lẫn người ở ghép.
- `ContractServiceRepository.cloneFromContract()` cũng nuốt lỗi.
- Billing coi `end_date` bao gồm ngày cuối (`billableDays = end - start + 1`, `server/services/billing/rules.ts`). Renewal lại đặt `new.start_date = old.end_date`, nên ngày giao nhau bị tính tiền hai lần.
- Tiền cọc: successor chỉ chép trường `contracts.deposit`. Receipt (`contract_payments`) và source (`contract_checkout_sources`) vẫn thuộc hợp đồng cũ. Checkout đọc source theo `contract_checkout_sources.contract_id` nên checkout của successor không thấy khoản cọc nào để cấn trừ hay hoàn.
- `ContractPaymentService` không kiểm trạng thái hợp đồng. Receipt cọc ghi vào hợp đồng `renewed` sẽ sinh source mồ côi.
- Không có idempotency key. Không có ràng buộc DB nào chặn một hợp đồng có hai successor.

## Quyết định đã chốt

1. **Quy ước ngày:** `end_date` bao gồm ngày cuối. Với successor:
   - `start_date = old.end_date + 1`;
   - occupancy cũ đóng với `move_out_date = old.end_date`;
   - occupancy mới có `move_in_date = old.end_date + 1`.
2. **Người ở:** chuyển mọi occupancy có `move_out_date IS NULL` của hợp đồng cũ, gồm cả dòng `primary`, giữ `tenant_id`, `role`, `billing_counted`.
3. **Tiền cọc:** chuyển `contract_checkout_sources` còn số dư lớn hơn 0 sang successor. Receipt vẫn thuộc hợp đồng cũ. Không sinh receipt giả.
4. **Receipt trên hợp đồng `renewed`** bị khóa: không thêm, sửa hay xóa.
5. **Idempotency:** client gửi `operation_id`. Server lưu vào `contract_renewals.operation_id` với ràng buộc unique.
6. **Dữ liệu cũ:** chạy báo cáo chỉ đọc trước. Script sửa chỉ chạy khi đã được duyệt.
7. Cho phép sửa UI trong phạm vi mô tả ở mục UI.

## Thiết kế

### Migration `supabase/migrations/<timestamp>_atomic_contract_renewal.sql`

**Schema:**

- `alter table public.contract_renewals add column operation_id uuid unique;` (nullable cho dữ liệu cũ).
- `create unique index contracts_one_successor on public.contracts(previous_contract_id) where previous_contract_id is not null;`. Trước khi áp dụng, phải chạy script verification để chắc chắn không có dữ liệu vi phạm; nếu có thì dừng lại và báo cáo.

**RPC:**

```sql
create or replace function public.renew_contract_atomic(
  p_contract_id uuid,
  p_mode text,                 -- 'extend' | 'new_contract'
  p_new_end_date date,
  p_new_monthly_rent numeric,  -- null = giữ giá hiện tại
  p_reason text,
  p_actor_id uuid,
  p_operation_id uuid,
  p_correlation_id uuid
) returns jsonb
language plpgsql
security invoker
set search_path = ''
```

Kết quả trả về: `{ renewal, contract, new_contract, transferred_source_ids, replayed }`.

`revoke all ... from public, anon, authenticated; grant execute ... to service_role;`

**Bước chung:**

1. Nếu đã có `contract_renewals.operation_id = p_operation_id`:
   - trùng `contract_id`, `mode`, `new_end_date` và `new_monthly_rent` đã lưu thì trả kết quả của lần trước với `replayed = true`;
   - ngược lại raise `RENEWAL_OPERATION_MISMATCH`.
2. `select * from public.contracts where id = p_contract_id for update`; không có thì raise `CONTRACT_NOT_FOUND`.
3. `status <> 'active'` thì raise `CONTRACT_NOT_ACTIVE`.
4. Có `contract_checkouts` của hợp đồng (bất kỳ trạng thái nào) thì raise `CONTRACT_CHECKOUT_IN_PROGRESS`.
5. Kiểm tra `p_mode` và `p_new_monthly_rent` (null hoặc số nguyên lớn hơn hoặc bằng 0). `p_mode = 'new_contract'` thì bắt buộc có giá.

**`extend`:**

1. `p_new_end_date > old.end_date`, nếu không thì raise `RENEWAL_END_DATE_INVALID`.
2. Cập nhật `end_date`, `monthly_rent` (nếu có giá mới), `original_end_date = coalesce(original_end_date, old.end_date)`, `renewal_count + 1`.
3. Insert `contract_renewals` kèm `operation_id`.
4. Hủy phụ lục `scheduled` của hợp đồng với lý do "Hợp đồng đã được gia hạn", ghi audit hủy cho từng phụ lục theo cách các RPC amendments đang ghi audit.
5. Ghi audit `CONTRACT_RENEWED` với metadata `{ mode: 'extend', renewal_id, new_end_date, new_monthly_rent }`.

**`new_contract`:**

1. `p_new_end_date > old.end_date + 1`, nếu không thì raise `RENEWAL_END_DATE_INVALID`.
2. Khóa theo thứ tự cố định:
   1. contract (đã khóa ở bước chung);
   2. `public.rooms` của hợp đồng;
   3. `contract_occupants` đang mở của hợp đồng, theo `id`;
   4. `contract_checkout_sources` của hợp đồng, theo `id`.
3. Đã có successor (`previous_contract_id = p_contract_id`) thì raise `CONTRACT_ALREADY_RENEWED`.
4. Không có occupancy đang mở nào thì lấy `contracts.tenant_id` làm người ở chính (`primary`, `billing_counted = true`) cho successor, vì hợp đồng cũ có thể chưa có dòng occupancy. Nếu tenant đó đang có occupancy mở ở hợp đồng khác thì raise `RENEWAL_OCCUPANTS_MISSING`.
5. Đóng occupancy đang mở: `move_out_date = old.end_date`.
6. Chuyển hợp đồng cũ sang `status = 'renewed'`.
7. Cấp `contract_code` bằng cơ chế advisory lock theo tòa như trong `create_contract_with_handover`.
8. Insert successor:
   - `status = 'active'`, `previous_contract_id = old.id`;
   - `start_date = old.end_date + 1`, `end_date = p_new_end_date`;
   - `monthly_rent = p_new_monthly_rent`;
   - các trường `room_id`, `tenant_id`, `building_id`, `deposit`, `payment_due_day`, `occupant_count`, `discount_amount`, `surcharge_amount`, `notes` chép từ hợp đồng cũ;
   - `renewal_count = old.renewal_count + 1`, `original_end_date = coalesce(old.original_end_date, old.end_date)`.
9. Insert occupancy mới cho từng occupancy vừa đóng: giữ `tenant_id`, `role`, `billing_counted`; `move_in_date = old.end_date + 1`.
10. Clone `contract_services`: `catalog_id`, `amount`, `quantity`, `is_enabled`, `notes`.
11. `update public.contract_checkout_sources set contract_id = <successor>, updated_at = clock_timestamp() where contract_id = old.id and public.contract_checkout_source_balance(id) > 0`. Lấy danh sách id và số dư để ghi audit.
12. Insert `contract_renewals` với `new_contract_id` và `operation_id`.
13. Hủy phụ lục `scheduled` của hợp đồng cũ với lý do "Hợp đồng đã được gia hạn thành hợp đồng mới", kèm audit.
14. Ghi audit, dùng chung `correlation_id`:
    - `CONTRACT_RENEWED` trên hợp đồng cũ, metadata `{ mode: 'new_contract', renewal_id, new_contract_id, new_end_date, new_monthly_rent }`;
    - `CONTRACT_CREATED` trên successor, metadata `{ source: 'renewal', renewal_id, previous_contract_id }`;
    - nếu có source được chuyển: `CONTRACT_CHECKOUT_SOURCE_TRANSFERRED` trên successor, metadata `{ from_contract_id, renewal_id, sources: [{ id, source_type, balance }] }`.

Mọi lỗi đều raise nên toàn bộ transaction rollback. Hằng số audit mới được thêm vào `app/utils/constants/audit.ts` và phần enrichment audit tương ứng.

**Mã lỗi:**

| Mã | SQLSTATE | HTTP | Thông báo |
|---|---|---|---|
| `CONTRACT_NOT_FOUND` | P0002 | 404 | Không tìm thấy hợp đồng |
| `CONTRACT_NOT_ACTIVE` | 23514 | 409 | Chỉ gia hạn được hợp đồng đang hiệu lực |
| `CONTRACT_CHECKOUT_IN_PROGRESS` | 23514 | 409 | Hợp đồng đang làm thủ tục trả phòng |
| `CONTRACT_ALREADY_RENEWED` | 23505 | 409 | Hợp đồng đã được gia hạn |
| `RENEWAL_OPERATION_MISMATCH` | 23505 | 409 | Yêu cầu gia hạn bị trùng với một thao tác khác |
| `RENEWAL_OCCUPANTS_MISSING` | 23514 | 409 | Hợp đồng không có người ở hợp lệ để chuyển |
| `RENEWAL_END_DATE_INVALID` | 22008 | 422 | Ngày kết thúc mới không hợp lệ |
| `CONTRACT_RENEWED_RECEIPT_LOCKED` | 23514 | 409 | Hợp đồng đã gia hạn, không thể thay đổi khoản thu |

Unique violation trên `contracts_one_active_per_room` hoặc `contracts_one_successor` cũng map sang 409 `CONTRACT_ALREADY_RENEWED`.

### Thay đổi trong checkout và receipts (cùng migration)

- **`contract_checkout_get`:** `sources` lấy theo `cs.contract_id = p_contract_id`, gộp với các receipt của chính hợp đồng chưa thành source. Mỗi phần tử có thêm `originContractId` và `originContractCode`, lấy từ `contract_payments.contract_id`.
- **`contract_checkout_payment_guard`:** khi chặn xóa hoặc sửa receipt đã phân bổ, điều kiện statement đổi từ `h.contract_id = old.contract_id` sang `h.contract_id = source.contract_id`.
- **`contract_checkout_credit`:** receipt `prepaid_rent`/`other` được chấp nhận nếu `payment.contract_id` là `p_contract_id` hoặc là một hợp đồng `renewed` nằm trước nó trong chuỗi `previous_contract_id` (truy vấn đệ quy, có giới hạn độ sâu). Source mới vẫn mang `contract_id = p_contract_id`.
- **Trigger mới** `contract_payments_renewed_lock` (before insert/update/delete trên `contract_payments`): nếu hợp đồng của receipt có `status = 'renewed'` thì raise `CONTRACT_RENEWED_RECEIPT_LOCKED`. Trigger này phải chạy trước `contract_checkout_payment_guard`.
- Mọi hàm checkout bị sửa được `create or replace` lại nguyên văn, chỉ đổi các điểm nêu trên. Grants giữ nguyên.

### Server

- `server/services/contract-renewals.ts`:
  1. kiểm `contracts.update` và building scope (`write`) như hiện tại;
  2. resolve ID canonical;
  3. gọi `ContractRenewalRepository.renewAtomic(...)` với `actor_id` và `correlation_id` của request;
  4. map kết quả sang DTO `ContractRenewal` như hiện tại.

  Bỏ toàn bộ các bước rời, phần rollback thủ công và lời gọi `cancelScheduledForContract`.
- `server/repositories/contract-renewals/index.ts`: thêm `renewAtomic`, gọi RPC rồi map lỗi qua `throwDbError`.
- `server/utils/errors.ts`: mở rộng phần map mã lỗi domain (hiện chỉ có `CHECKOUT_*`) cho các mã ở bảng trên, giữ thông báo tiếng Việt.
- `ContractOccupantRepository.cloneActiveToContract` và `ContractServiceRepository.cloneFromContract`: xóa nếu không còn nơi nào dùng; nếu còn thì đổi sang throw lỗi thay vì `console.error`.
- `ContractPaymentService.create/update/remove`: nếu `contract.status === 'renewed'` thì trả 409 với thông báo "Hợp đồng đã gia hạn, không thể thay đổi khoản thu". Trigger ở DB vẫn là lớp chặn cuối cùng.
- Validator `app/utils/validators/contract-renewals.ts`: thêm `operation_id: z.string().uuid().optional()`. Nếu client không gửi thì server tự sinh.
- DTO hợp đồng (`app/types/contracts.ts` cùng mapper) thêm `previousContract: { id, code } | null` và `successorContract: { id, code } | null`. Repository lấy hai trường này khi đọc chi tiết hợp đồng.
- DTO `CheckoutSource` thêm `originContractId` và `originContractCode`.

### UI

Theo `.agents/skills/zeno-house/references/ui-polish-workflow.md`. Chỉ dùng primitive có sẵn.

- **`ContractRenewalForm.vue`:**
  - Sinh `operation_id` (`crypto.randomUUID()`) khi form được mở; giữ nguyên ID này khi gửi lại sau lỗi mạng.
  - Ở chế độ "Hợp đồng mới":
    - hiện "Hợp đồng mới bắt đầu: dd/mm/yyyy" (bằng `currentEndDate + 1`);
    - hiện khối tóm tắt những gì được chuyển: số người ở, số dịch vụ và "Tiền cọc đang giữ: X đ";
    - validate ngày kết thúc phải sau ngày bắt đầu mới.
  - Khi đang gửi thì khóa nút chọn mode và nút submit.
  - Hiện thông báo lỗi từ API (`UiAlert`) thay vì câu chung chung.
  - Các số trong khối tóm tắt lấy từ dữ liệu trang chi tiết hợp đồng đã có (occupants, services, checkout bundle hoặc `deposit`); không thêm endpoint preview.
- **`ContractDetailHero.vue`:**
  - hợp đồng `renewed` có badge và liên kết "Đã gia hạn sang HĐ ‹mã›";
  - successor có liên kết "Gia hạn từ HĐ ‹mã›".
- **`ContractPaymentsSection.vue`:**
  - hợp đồng `renewed`: ẩn thêm/sửa/xóa và hiện ghi chú "Hợp đồng đã gia hạn. Tiền cọc đang giữ đã chuyển sang HĐ ‹mã›.";
  - hiện thông báo lỗi của API thay vì câu chung chung.
- **`ContractCheckoutSection.vue`:** source có `originContractId` khác hợp đồng hiện tại hiện nhãn "Từ HĐ ‹mã›".
- Kiểm tra các trạng thái loading, lỗi, disabled và đang gửi, ở cả desktop lẫn mobile.

### Dữ liệu cũ

**`supabase/verification/contract_renewal_integrity.sql`** (chỉ đọc), mỗi truy vấn có alias mô tả kết quả mong đợi:

- successor (`previous_contract_id is not null`) không có occupancy `primary`;
- hợp đồng `renewed` còn occupancy đang mở;
- source có số dư lớn hơn 0 vẫn nằm trên hợp đồng `renewed`;
- hợp đồng có hơn một successor (phải bằng 0 trước khi tạo `contracts_one_successor`);
- successor có `start_date <= previous.end_date`, tức trùng ngày (chỉ ghi nhận, không sửa);
- grants của `renew_contract_atomic`: chỉ `service_role`.

**`supabase/sql-editor/repair-contract-renewal-chains.sql`**: chỉ chạy sau khi đã duyệt báo cáo. Toàn bộ chạy trong một transaction, có `raise notice` cho từng dòng và ghi audit `CONTRACT_RENEWAL_REPAIRED` (dùng chung một `correlation_id`). Với mỗi chuỗi gia hạn:

- xác định successor mới nhất còn `active`;
- đóng các occupancy còn mở trên các hợp đồng `renewed` (`move_out_date = end_date` của chính hợp đồng đó), rồi tạo occupancy tương ứng cho successor mới nhất nếu tenant chưa có occupancy đang mở;
- chuyển source có số dư lớn hơn 0 trên hợp đồng `renewed` sang successor mới nhất.

Script không sửa `start_date` hay dữ liệu billing của các successor cũ. Cuối script có phần `select` để đối chiếu lại; mặc định kết thúc bằng `rollback`, người chạy đổi sang `commit` sau khi kiểm tra kết quả.

## Test

**Vitest** (mock repository):

- Service kiểm capability và scope trước khi gọi RPC, truyền đúng tham số (gồm `operation_id`, `actor_id`, `correlation_id`).
- Map đúng từng mã lỗi sang HTTP và thông báo.
- `ContractPaymentService` trả 409 khi hợp đồng `renewed`.
- Validator nhận `operation_id`.
- Mapper hợp đồng điền `previousContract` và `successorContract`.
- Component: `ContractRenewalForm` hiện ngày bắt đầu mới, khối tóm tắt và lỗi API, giữ `operation_id` khi gửi lại; `ContractPaymentsSection` ẩn thao tác khi hợp đồng `renewed`.

**`supabase/verification/atomic_contract_renewal.sql`** (fixture trong transaction, rollback ở cuối):

- `extend` thành công: ngày, giá, `renewal_count`, renewal log, audit và phụ lục `scheduled` bị hủy.
- `new_contract` với 0, 1 và n người ở ghép, nhiều dịch vụ (có dịch vụ đang tắt): đủ occupancy với `role` và `billing_counted` đúng, đủ dịch vụ, `start_date = old.end_date + 1`, occupancy cũ đóng đúng ngày.
- Source cọc được chuyển; số dư cọc trong `contract_checkout_preview` của successor bằng số dư trước khi chuyển.
- Replay cùng `operation_id` không sinh thêm renewal, hợp đồng hay audit.
- `operation_id` trùng nhưng tham số khác: `RENEWAL_OPERATION_MISMATCH`.
- Hợp đồng đã có checkout: `CONTRACT_CHECKOUT_IN_PROGRESS`, không thay đổi gì.
- Ép lỗi giữa chừng (fixture làm vi phạm ràng buộc khi clone dịch vụ): sau lỗi, hợp đồng cũ vẫn `active`, không có successor, occupancy và source giữ nguyên.
- Receipt trên hợp đồng `renewed`: insert, update, delete đều bị chặn.
- `contract_checkout_credit` nhận được receipt `prepaid_rent` của hợp đồng trước trong chuỗi.

**Concurrency** (hướng dẫn chạy hai session, ghi trong phần đầu của file verification): hai session cùng gọi `renew_contract_atomic` cho một hợp đồng với `operation_id` khác nhau. Chỉ một session thành công; session còn lại nhận `CONTRACT_NOT_ACTIVE` hoặc `CONTRACT_ALREADY_RENEWED`.

**Regression:** checkout thường của hợp đồng không gia hạn, ghi receipt cho hợp đồng `active`, billing kỳ kế tiếp của successor tính tiền thuê từ `old.end_date + 1`, Portal của người ở ghép hiện đúng phòng sau khi gia hạn.

**Lệnh kiểm tra:** test liên quan, sau đó `npm run typecheck`, `npm test`, `npm run lint`. Sau khi áp dụng migration lên staging thì sinh lại `app/types/database.types.ts`.

## Ngoài phạm vi

- UI hiển thị toàn bộ chuỗi gia hạn hoặc trang lịch sử riêng.
- Sửa `start_date` của các successor cũ đang trùng ngày.
- Thay đổi số tiền cọc khi gia hạn (input hiện tại không cho đổi).
- Thay đổi quy ước ngày ở billing, checkout hoặc prorate.

## Phối hợp

- Change đang mở `docs/changes/add-contract-amendments` (task 2.3) yêu cầu hủy phụ lục `scheduled` khi gia hạn. RPC này đáp ứng yêu cầu đó trong cùng transaction; cần đánh dấu task tương ứng sau khi merge.
- Cập nhật `docs/features/contracts.md` (gia hạn, quy ước ngày, chuyển tiền cọc) và `docs/architecture/database.md` (RPC mới, `contracts_one_successor`, trigger khóa receipt).
