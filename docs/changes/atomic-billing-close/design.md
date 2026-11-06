---
type: Change Design
title: "2026-11-05-atomic-billing-close-design"
status: draft
change_state: implementation-review
tags: [superpowers, change, migration]
sources:
  - resource: "https://github.com/tungnguyen10/zeno-house/blob/060d0d77e07095c593b9ff154450580db8ba0f41/docs/superpowers/specs/2026-11-05-atomic-billing-close-design.md"
generated:
  by: "process:docs-okf-consolidation"
  at: "2026-11-06T00:00:00Z"
---

> Migrated P0 design/execution artifact. Validate actual source, migrations, tests, and rollout state before treating checked tasks as delivered. Canonical accepted requirements live in `docs/capabilities/**`.

# ZH-BIL-01: Chốt và mở lại kỳ billing atomic

## Bối cảnh

Đây là sub-project thứ ba trong đợt P0 Stabilization, đi sau ZH-SEC-01 và ZH-CTR-01. Mục tiêu:

- chốt kỳ, cập nhật accrual quỹ dự phòng và ghi audit trong một transaction;
- chịu được retry và concurrency;
- mọi đường ghi tài chính đều tôn trọng trạng thái kỳ.

Phần reconciliation dữ liệu cũ (PR3a) là bước chỉ đọc, phải chạy trước khi deploy PR3.

## Hiện trạng (nhánh `develop`)

**`BillingPeriodService.close()`** (`server/services/billing/periods.ts`) chạy các bước DB rời nhau:

1. kiểm công nợ;
2. đổi trạng thái kỳ sang `closed`;
3. đọc invoice, chi phí cố định, chi phí tháng và phân bổ trả trước;
4. gọi `ReserveFundService.recordMonthlyAccrual()`;
5. ghi audit.

Nếu accrual hoặc audit lỗi, kỳ vẫn đã `closed`. Lần retry gặp `closed` thì trả về ngay, nên phần còn thiếu không bao giờ được ghi.

**`reopen()`** đổi trạng thái rồi mới ghi audit, bằng hai thao tác riêng.

**Hai nơi cùng ghi accrual.** Dòng `reserve_fund_transactions` với `source = 'monthly_accrual'` (unique theo `fund_id, period_year, period_month`) được ghi từ billing close và từ operations report (chốt tay, auto-close 23:55 ngày cuối tháng, admin refresh). Dòng nào ghi sau thì đè dòng trước.

**Hai công thức khác nhau.** Operations report loại chi phí trả từ quỹ (`fundedBy !== 'reserve_fund'`); billing close cộng tất cả chi phí.

**Billing close ghi đè accrual kể cả khi operations report của tháng đã chốt.** Điều này vượt qua cơ chế khóa của báo cáo.

**Các đường ghi khác:**

| Đường ghi | Kiểm kỳ `closed` | Khóa kỳ |
|---|---|---|
| `record_bulk_payments` | có | không: khóa invoice trước rồi mới đọc trạng thái kỳ, rủi ro race và deadlock với close |
| RPC thanh toán AI | có | cần xác minh khi implement |
| `issue_period_invoices`, `issue_and_pay` | có | `FOR UPDATE` |
| Undo payment, unissue | kiểm ở service | — |
| Void/correct invoice | **không** kiểm | — |

**Grants:** `issue_period_invoices`, `record_bulk_payments` và `issue_and_pay` đang cấp `EXECUTE` cho `authenticated`. Server dùng `serverSupabaseServiceRole` và `app/` không gọi `.rpc(`, nên thu hồi quyền này là an toàn.

## Quyết định đã chốt

1. **Operations report sở hữu accrual.** Billing close chỉ upsert accrual khi `operations_report_periods` của tháng đó còn mở hoặc chưa có dòng. Nếu báo cáo đã chốt thì không đụng accrual, ghi rõ trong audit và nhắc trên UI.
2. **Một công thức duy nhất** cho billing close, operations report và admin refresh.
3. **Reopen không xóa hay sửa accrual.** Close lại thì cập nhật accrual (nếu báo cáo còn mở), audit ghi trước/sau.
4. **Reconciliation chạy trước**, chỉ đọc. Script sửa dữ liệu chỉ viết và chạy sau khi đã duyệt báo cáo.

## Thiết kế

### Công thức dùng chung

- Tách phần tính doanh thu và lợi nhuận trong `buildReportSnapshot` (`server/services/operations-report/report.ts`) thành `computeAccrualInputs(event, buildingId, periodYear, periodMonth)`. Hàm trả về `{ billingPeriodId, issuedRevenue, profitByRevenue, reserveRatePercent, accrualAmount }`.
  - `issuedRevenue`: tổng invoice không `void` của kỳ, tính đúng như báo cáo hiện tại.
  - `profitByRevenue = issuedRevenue - (fixedCostTotal + directMonthlyExpenseTotal + prepaidAllocationTotal)`. Chi phí trả từ quỹ bị loại khỏi `directMonthlyExpenseTotal`.
  - `reserveRatePercent` lấy qua `ReserveFundService.findEffectiveRate`, bằng 0 nếu không có.
  - `accrualAmount = round(max(profitByRevenue, 0) * reserveRatePercent / 100)`.
- `buildReportSnapshot`, `refreshReserveAccrual`, `closeReportPeriod` và billing close đều dùng hàm này. Xóa công thức riêng trong `BillingPeriodService.close()`.
- `ReserveFundService.recordMonthlyAccrual` bị xóa nếu không còn nơi nào dùng.

### Migration `supabase/migrations/<timestamp>_atomic_billing_close.sql`

**RPC `close_billing_period_atomic`:**

```sql
create or replace function public.close_billing_period_atomic(
  p_period_id uuid,
  p_actor_id uuid,
  p_correlation_id uuid,
  p_expected_issued_revenue numeric,
  p_issued_profit numeric,
  p_reserve_rate_percent numeric,
  p_accrual_amount numeric
) returns jsonb   -- { period, accrual_status, accrual, replayed }
language plpgsql
security invoker
set search_path = ''
```

1. `select * from public.billing_periods where id = p_period_id for update`; không có thì raise `PERIOD_NOT_FOUND`.
2. Nếu `status = 'closed'`:
   - đã có audit `period.closed` cho kỳ này với `closed_at` hiện tại thì trả `{ replayed: true }`;
   - nếu không thì raise `PERIOD_CLOSED_INCONSISTENT`.
3. `status` không thuộc `issued`/`collecting` thì raise `PERIOD_STATUS_INVALID`.
4. Đếm invoice không `void` có `balance > 0` hoặc chưa ở trạng thái đã thanh toán, theo đúng điều kiện của `InvoiceRepository.listOutstandingByPeriod`. Còn invoice như vậy thì raise `PERIOD_HAS_OUTSTANDING`, kèm số lượng trong `detail`.
5. Tính lại tổng invoice không `void`. Khác `p_expected_issued_revenue` thì raise `PERIOD_SNAPSHOT_STALE`.
6. `update public.billing_periods set status = 'closed', closed_at = now(), updated_at = now()`.
7. `pg_advisory_xact_lock` với đúng khóa `operations-report:<building>:<year>:<month>` mà `close_operations_report_with_audit` dùng, rồi đọc `operations_report_periods` của tháng.
   - Chưa có dòng hoặc `status = 'open'`: lấy hoặc tạo `reserve_funds` của tòa, lưu accrual hiện có làm `accrual_before`, rồi upsert `monthly_accrual` theo unique index sẵn có (cùng các cột mà `close_operations_report_with_audit` ghi: `amount`, `billing_period_id`, `reserve_rate_percent`, `issued_revenue`, `created_by`; xóa thông tin void). Kết quả `accrual_status = 'recorded'`.
   - `status = 'closed'`: không ghi gì, `accrual_status = 'skipped_report_closed'`.
8. Ghi audit `period.closed` với `entity_type = 'billing_period'`, `billing_period_id`, `building_id`, `actor_id`, `correlation_id`, before/after của kỳ. Metadata gồm `{ accrual_status, accrual_before, accrual_after, issued_revenue, issued_profit, reserve_rate_percent }`. Khi implement, cần đối chiếu với `BillingAuditService.append` để audit trong SQL có cùng hình dạng (gồm cả cột `billing_period_id` nếu `audit_events` có).

**RPC `reopen_billing_period_atomic`:**

```sql
create or replace function public.reopen_billing_period_atomic(
  p_period_id uuid, p_actor_id uuid, p_reason text, p_correlation_id uuid
) returns jsonb
```

- Khóa kỳ. Kỳ không `closed` thì raise `PERIOD_NOT_CLOSED`. `length(btrim(p_reason)) < 10` thì raise `PERIOD_REOPEN_REASON_INVALID`.
- Chuyển về `collecting`, đặt `closed_at = null`, rồi ghi audit `period.reopened` với metadata `{ reason, prior_status: 'closed' }` như hiện tại.
- Không đụng `reserve_fund_transactions`.

**Khóa và kiểm trạng thái ở các đường ghi khác:**

- `record_bulk_payments`: trước vòng xử lý invoice, xác định các `billing_period_id` liên quan rồi `select ... from public.billing_periods where id = any(...) order by id for share`. Sau khi khóa, kỳ nào `closed` thì raise như hiện tại. Phần còn lại giữ nguyên. Function được `create or replace` lại đúng signature hiện hành.
- RPC thanh toán AI: áp dụng cùng quy tắc nếu RPC này đang khóa invoice trước kỳ.
- Trigger `billing_period_closed_guard`:
  - `before insert or update or delete` trên `public.invoice_payments`: nếu kỳ của invoice đang `closed` thì raise `PERIOD_CLOSED_LOCKED`.
  - `before update` trên `public.invoices` khi đổi `status`, `total_amount` hoặc các cột tiền: tương tự.
  - Trigger dùng `for share` trên dòng kỳ để không chạy đua với close.
  - Phải cho phép các ghi mà chính `close_billing_period_atomic` và checkout settlement cần. Khi implement, chạy lại verification của checkout (`supabase/verification/` hiện có) để chắc không chặn nhầm. Nếu checkout bắt buộc ghi vào kỳ đã `closed` thì giới hạn trigger theo `funding_source = 'cash'` và ghi rõ lý do trong spec.
- Thứ tự khóa thống nhất cho mọi RPC billing: `billing_periods` → `invoices` → `invoice_payments`.

**Grants:**

- `close_billing_period_atomic`, `reopen_billing_period_atomic`: `revoke all ... from public, anon, authenticated; grant execute ... to service_role;`.
- Các signature hiện hành của `issue_period_invoices`, `record_bulk_payments` và `issue_and_pay`: revoke khỏi `public`, `anon`, `authenticated`; grant cho `service_role`.

**Mã lỗi:**

| Mã | SQLSTATE | HTTP | Thông báo |
|---|---|---|---|
| `PERIOD_NOT_FOUND` | P0002 | 404 | Không tìm thấy kỳ vận hành |
| `PERIOD_STATUS_INVALID` | 23514 | 409 | Chỉ có thể chốt kỳ đã phát hành hoặc đang thu |
| `PERIOD_HAS_OUTSTANDING` | 23514 | 409 | Còn N hoá đơn chưa thanh toán đủ. Cần xử lý trước khi chốt kỳ. |
| `PERIOD_SNAPSHOT_STALE` | 40001 | 409 | Dữ liệu kỳ vừa thay đổi, vui lòng thử lại |
| `PERIOD_CLOSED_INCONSISTENT` | 23514 | 409 | Kỳ đã chốt nhưng thiếu dữ liệu chốt; cần kiểm tra đối soát |
| `PERIOD_NOT_CLOSED` | 23514 | 409 | Kỳ chưa chốt |
| `PERIOD_REOPEN_REASON_INVALID` | 22023 | 422 | Lý do mở lại phải có ít nhất 10 ký tự |
| `PERIOD_CLOSED_LOCKED` | 23514 | 409 | Kỳ đã chốt, không thể thay đổi hoá đơn hoặc thanh toán |

### Server

- `BillingPeriodService.close()`:
  1. kiểm `billing.close` và building scope (`write`);
  2. gọi `computeAccrualInputs`;
  3. gọi `BillingPeriodRepository.closeAtomic(...)`;
  4. gặp `PERIOD_SNAPSHOT_STALE` thì tính lại và thử thêm đúng một lần;
  5. trả về kỳ cùng `accrualStatus`.
- `BillingPeriodService.reopen()`: kiểm `billing.reopen`, scope và reason (validator hiện có), rồi gọi `BillingPeriodRepository.reopenAtomic(...)`.
- Không gọi `BillingAuditService.append` cho close/reopen nữa, vì audit đã nằm trong RPC.
- Void/correct invoice (`server/services/billing/invoices.ts`): kiểm kỳ `closed` thì trả 409 "Kỳ đã chốt — không thể sửa hoá đơn". Trigger ở DB là lớp chặn cuối.
- `server/utils/errors.ts`: thêm map cho các mã ở bảng trên.
- Response của `POST` close có thêm `accrualStatus: 'recorded' | 'skipped_report_closed' | null` (`null` khi replay). Type ở `app/types/**` được cập nhật tương ứng.
- Cache operations report của tòa bị invalidate sau khi close và reopen.

### UI

Theo `.agents/skills/zeno-house/references/ui-polish-workflow.md`, chỉ dùng primitive có sẵn.

- Sau khi chốt kỳ:
  - `accrualStatus = 'skipped_report_closed'`: hiện toast hoặc `UiAlert` loại warning, nội dung "Báo cáo vận hành tháng này đã chốt. Quỹ dự phòng chưa được cập nhật theo kỳ billing; Admin cần làm mới quỹ.";
  - các trường hợp khác giữ thông báo thành công hiện tại.
- Lỗi 409 và 422 hiện đúng thông báo từ API ở khu vực chốt/mở lại kỳ và ở thao tác void/correct invoice.
- Kiểm tra các trạng thái loading, lỗi, disabled và đang gửi, ở cả desktop lẫn mobile.

## PR3a: Reconciliation (chỉ đọc, chạy trước PR3)

**`supabase/verification/billing_close_integrity.sql`**, mỗi truy vấn có alias mô tả kết quả mong đợi:

- kỳ `closed` không có audit `period.closed`;
- kỳ `closed` không có `monthly_accrual` cùng tòa và tháng; tách riêng nhóm có rate hiệu lực bằng 0;
- `monthly_accrual` có `billing_period_id` trỏ tới kỳ không `closed` (kỳ đã reopen);
- `invoice_payments` hoặc `invoices` có `created_at`/`updated_at` sau `closed_at` của kỳ đang `closed`;
- grants hiện tại của các RPC billing.

**`scripts/reconcile-reserve-accruals.mjs`** (chỉ đọc):

- Với từng kỳ `closed`, gọi lại công thức dùng chung (qua API nội bộ hoặc module server dùng chung) và so với `monthly_accrual` đang lưu.
- Xuất CSV gồm tòa, kỳ, giá trị đang lưu, giá trị tính lại, chênh lệch và trạng thái báo cáo vận hành.
- Không ghi gì vào DB.
- Cách gọi công thức được chốt trong implementation plan, theo cách các script hiện có trong `scripts/` truy cập dữ liệu.

Chỉ sau khi anh/chị duyệt báo cáo mới viết script sửa (`supabase/sql-editor/repair-billing-close.sql`). Script sửa có log, chạy trong transaction, mặc định kết thúc bằng `rollback`.

## Test

**Vitest** (mock repository):

- `close()` kiểm capability và scope, truyền đúng kết quả của `computeAccrualInputs`, thử lại đúng một lần khi stale, map đúng từng mã lỗi.
- `reopen()` gọi RPC với reason; không còn gọi audit ở TS.
- `computeAccrualInputs`: loại chi phí trả từ quỹ, áp dụng đúng chi phí cố định theo khoảng hiệu lực và phân bổ trả trước, profit âm thì accrual bằng 0.
- Operations report và admin refresh dùng chung hàm, kết quả không đổi so với hiện tại.
- Void/correct invoice ở kỳ `closed` trả 409.
- Component hiện cảnh báo khi `skipped_report_closed`.

**`supabase/verification/atomic_billing_close.sql`** (fixture trong transaction, rollback ở cuối):

- Không còn công nợ: close commit trạng thái, accrual và audit cùng nhau.
- Còn công nợ: `PERIOD_HAS_OUTSTANDING`, kỳ không đổi.
- Doanh thu lệch: `PERIOD_SNAPSHOT_STALE`, kỳ không đổi.
- Gọi close lần hai: `replayed`, không có audit hay accrual trùng.
- Báo cáo vận hành đã chốt: accrual giữ nguyên, audit ghi `skipped_report_closed`.
- Reopen rồi close lại với số liệu mới: vẫn một dòng accrual với giá trị mới, audit có trước/sau.
- `record_bulk_payments` và insert `invoice_payments` vào kỳ `closed` bị chặn.
- Grants: `anon` và `authenticated` không có `EXECUTE` trên các RPC billing.

**Concurrency** (hướng dẫn hai session ở đầu file verification):

- Session 1 gọi `close_billing_period_atomic`, session 2 gọi `record_bulk_payments` vào cùng kỳ. Kết quả phải là: payment commit trước và close thấy đúng số liệu, hoặc payment bị chặn với `closed`. Không deadlock.
- Hai session cùng close: một thành công, một nhận `replayed`.

**Regression:** phát hành hóa đơn, `issue_and_pay`, ghi thu hàng loạt, undo payment, unissue, checkout settlement (chạy lại verification checkout), chốt/mở lại operations report, admin refresh.

**Lệnh kiểm tra:** test liên quan, sau đó `npm run typecheck`, `npm test`, `npm run lint`. Sau khi áp dụng migration lên staging thì sinh lại `app/types/database.types.ts`.

## Ngoài phạm vi

- Auto-close billing (đã bổ sung sau đó cho kỳ đã thu hết vào cuối tháng, xem `docs/features/billing.md`).
- Thay đổi lifecycle hoặc quyền của operations report.
- Tự động refresh accrual khi báo cáo đã chốt.
- Snapshot tài chính đầy đủ (ngoài metadata audit) cho kỳ billing.

## Tài liệu cần cập nhật khi implement

- `docs/features/billing.md`: chốt/mở lại kỳ, quan hệ với accrual, các khóa đối với hóa đơn và thanh toán.
- `docs/features/operations-report.md`: operations report sở hữu accrual, billing close chỉ cập nhật khi báo cáo còn mở.
- `docs/architecture/database.md`: RPC mới, trigger `billing_period_closed_guard`, thứ tự khóa, grants.
