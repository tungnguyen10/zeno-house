# Báo Cáo Vận Hành

Tài liệu này ghi lại hướng explore cho module **Báo cáo vận hành**. Mục tiêu là tổng hợp hiệu quả vận hành theo từng tòa nhà và từng tháng, dựa trên doanh thu đã có từ billing và chi phí vận hành mới cần nhập thêm.

## Mục Tiêu

Báo cáo vận hành trả lời các câu hỏi:

- Tòa nhà này tháng này phải thu bao nhiêu?
- Đã thu tiền mặt bao nhiêu?
- Còn công nợ bao nhiêu?
- Tổng chi phí vận hành bao nhiêu?
- Lãi/lỗ theo doanh thu và theo tiền đã thu là bao nhiêu?
- Điện, nước thu khách so với điện, nước đầu vào chênh lệch ra sao?

Module này không thay thế billing workspace. Billing vẫn là nguồn tính tiền khách, phát hành hóa đơn và ghi nhận thanh toán. Báo cáo vận hành chỉ đọc doanh thu từ billing và thêm lớp chi phí của tòa nhà.

## Nguyên Tắc Dữ Liệu

Revenue không nhập tay. Revenue lấy từ billing:

```text
billing_periods(building_id, period_year, period_month)
  -> invoices(total_amount, paid_amount, balance_amount)
    -> invoice_charges(charge_type, amount)
```

Expense là dữ liệu mới, nhập theo building và theo tháng.

```text
Revenue: billing sinh ra
Expense: người dùng nhập
Report: tổng hợp revenue + expense
```

## Khái Niệm

| Khái niệm | Ý nghĩa |
| --- | --- |
| Doanh thu phát hành | Tổng tiền trên hóa đơn đã phát hành, chưa trừ công nợ. |
| Tiền đã thu | Tổng payment thực thu từ `invoice_payments`. |
| Công nợ | Tổng `balance_amount` của invoice chưa void. |
| Chi phí cố định | Khoản lặp lại theo tháng của building, ví dụ tiền thuê lại tòa nhà. |
| Chi phí tháng | Khoản chi phát sinh theo building/tháng, ví dụ điện đầu vào, nước đầu vào, sửa chữa. |
| Lãi theo doanh thu | Doanh thu phát hành - tổng chi. |
| Lãi tiền mặt | Tiền đã thu - tổng chi. |

## Chi Phí Cố Định

Tiền thuê lại tòa nhà/căn hộ nên là chi phí cố định có lịch sử hiệu lực, không nên chỉ lưu một field trên `buildings`. Lý do: khi giá thuê thay đổi, báo cáo tháng cũ vẫn phải đúng.

Đề xuất bảng:

```text
building_fixed_costs
- id
- building_id
- category
- amount
- effective_from_period_year
- effective_from_period_month
- effective_to_period_year
- effective_to_period_month
- note
- created_by
- created_at
- updated_at
```

MVP category cố định:

```text
rent
```

Sau này có thể mở rộng fixed cost cho internet hợp đồng dài hạn, phí quản lý cố định, lương nhân sự cố định.

## Nhập Tên Chi Phí

Các form chi phí dùng `UiCombobox` khi người dùng có thể vừa chọn gợi ý vừa nhập tay.

- Chi phí định kỳ và chi phí trả trước đã có field `name`, nên lưu tên chọn/nhập vào `recurring_expenses.name` và `prepaid_expenses.name`.
- Chi phí vận hành một lần và chi phí cố định không thêm cột `name`; UI hiển thị "Tên/Ghi chú chi phí" và lưu vào field `note` hiện có của `building_expenses` hoặc `building_fixed_costs`.
- Category vẫn là field controlled dùng cho report/grouping, không bị thay bằng tên nhập tay.
- Không cần migration cho thay đổi UI này.

## Chi Phí Theo Tháng

Chi phí phát sinh theo tháng nên lưu thành từng dòng expense.

Đề xuất bảng:

```text
building_expenses
- id
- building_id
- expense_date
- period_year
- period_month
- category
- amount
- payee
- payment_method
- note
- created_by
- created_at
- updated_at
- voided_at
- voided_by
- void_reason
```

Category MVP:

```text
electricity_input   tiền điện đầu vào
water_input         tiền nước đầu vào
internet            internet / truyền hình
cleaning            vệ sinh / rác / tạp vụ
repair              sửa chữa / bảo trì
admin_fee           công an / tạm trú / giấy tờ / hành chính
supplies            vật tư vận hành
staff               lương nhân sự
rent_adjustment     điều chỉnh tiền thuê nhà, nếu có
other               khác
```

## Công Thức Báo Cáo

Báo cáo theo `building_id + period_year + period_month`.

```text
Doanh thu phát hành
= sum(invoices.total_amount)
  where invoice.status != 'void'

Tiền đã thu
= sum(invoice_payments.amount)
  where invoice_payments.deleted_at is null
  and invoice belongs to building/month

Công nợ
= sum(invoices.balance_amount)
  where invoice.status != 'void'

Tổng chi
= fixed_costs áp dụng trong tháng
+ sum(building_expenses.amount)
   where voided_at is null

Lãi theo doanh thu
= Doanh thu phát hành - Tổng chi

Lãi tiền mặt
= Tiền đã thu - Tổng chi
```

Doanh thu theo nhóm lấy từ `invoice_charges.charge_type`:

```text
rent
electricity
water
service
discount
surcharge
adjustment
other
```

Với hiển thị tổng quan, discount nên hiện là số âm hoặc dòng riêng để người dùng thấy rõ.

## Điện Nước Đầu Vào Và Đầu Ra

Điện/nước là điểm quan trọng của căn hộ dịch vụ. Báo cáo cần hiện riêng chênh lệch đầu vào/đầu ra:

```text
Điện thu khách
= sum(invoice_charges.amount where charge_type = 'electricity')

Điện đầu vào
= sum(building_expenses.amount where category = 'electricity_input')

Chênh điện
= Điện thu khách - Điện đầu vào

Nước thu khách
= sum(invoice_charges.amount where charge_type = 'water')

Nước đầu vào
= sum(building_expenses.amount where category = 'water_input')

Chênh nước
= Nước thu khách - Nước đầu vào
```

Ví dụ:

```text
Điện thu khách:  8,000,000
Điện đầu vào:    6,700,000
Chênh điện:     +1,300,000

Nước thu khách:  2,300,000
Nước đầu vào:    1,800,000
Chênh nước:       +500,000
```

## UI Đề Xuất

Menu/page chính:

```text
Báo cáo vận hành
```

Mô tả:

```text
Theo dõi doanh thu, chi phí và lãi/lỗ từng tòa nhà theo tháng.
```

Route có thể là:

```text
/operations-report
```

Hoặc nếu đặt trong detail building:

```text
/buildings/[id]/operations
```

MVP nên có page tổng hợp riêng `/operations-report`, vì admin cần so sánh nhiều tòa.

### Bộ Lọc

- Building
- Tháng/năm
- Category chi phí

Manager chỉ thấy building được gán. Admin thấy tất cả.

### Tổng Quan

Metric cards:

- Doanh thu phát hành
- Tiền đã thu
- Công nợ
- Tổng chi
- Lãi theo doanh thu
- Lãi tiền mặt

### Breakdown Thu

Bảng/cột:

- Tiền phòng
- Điện thu khách
- Nước thu khách
- Dịch vụ
- Phụ thu/khác
- Giảm giá

### Breakdown Chi

Bảng/cột:

- Tiền thuê nhà cố định
- Điện đầu vào
- Nước đầu vào
- Internet
- Vệ sinh/rác
- Sửa chữa
- Công an/hành chính
- Vật tư
- Khác

### Sổ Chi Phí

Bảng expense entries:

- Ngày chi
- Tòa nhà
- Loại chi
- Số tiền
- Trả cho ai
- Phương thức
- Ghi chú
- Người nhập
- Hành động: sửa / hủy

Nút chính:

```text
Thêm khoản chi
```

## API Đề Xuất

```text
GET    /api/operations-report
POST   /api/operations-report/close
POST   /api/operations-report/reopen
GET    /api/operations-report/export
GET    /api/building-expenses
POST   /api/building-expenses
PATCH  /api/building-expenses/[id]
DELETE /api/building-expenses/[id]

GET    /api/building-fixed-costs
POST   /api/building-fixed-costs
PATCH  /api/building-fixed-costs/[id]
POST   /api/reserve-funds/[buildingId]/refresh-accrual
POST   /api/internal/operations-report/auto-close
```

Delete nên là soft void, không hard delete:

```text
DELETE /api/building-expenses/[id]
-> set voided_at, voided_by, void_reason
```

## Quyền Và Scope

Capabilities đề xuất:

```text
operations-report.read
operations-report.export
operations-report.close
operations-report.reopen
building-expenses.read
building-expenses.write
building-expenses.delete
building-fixed-costs.read
building-fixed-costs.write
reserve-fund.refresh-accrual
```

Admin:

- Xem tất cả building.
- Cấu hình chi phí cố định.
- Thêm/sửa/hủy chi phí.
- Xem lãi/lỗ tổng hợp.

Manager:

- Chỉ xem building được gán.
- Có thể thêm chi phí cho building được gán nếu được cấp quyền.
- Không được cấu hình chi phí cố định nếu không có permission riêng.

Cần dùng `getAssignedBuildingIds` và `assertBuildingScope` giống các module hiện có.

## Audit

Expense và fixed cost nên ghi audit master/operations, vì đây là dữ liệu tài chính.

Action codes đề xuất:

```text
building_expense.created
building_expense.updated
building_expense.voided
building_fixed_cost.created
building_fixed_cost.updated
building_fixed_cost.ended
```

Nếu muốn tách riêng, có thể tạo `operations_audit_events`. MVP có thể reuse audit chung nếu phù hợp với model hiện tại.

## MVP Scope

Phase 1 nên làm:

1. Bảng `building_expenses`.
2. Bảng `building_fixed_costs` với category `rent`.
3. API CRUD cho fixed costs và expenses.
4. API `operations-report` tổng hợp theo building/month.
5. Page `Báo cáo vận hành` với filters, metric cards, revenue breakdown, expense breakdown, expense table.
6. Manager scope theo building assignment.

Chưa nên làm trong MVP:

- Approval workflow.
- Upload hóa đơn/chứng từ.
- Custom categories.
- Multi-currency.
- Kế toán double-entry.
- Tax/VAT.

## Câu Hỏi Đã Chốt

- Manager có được nhập chi phí không? => Có. Manager có `building-expenses.write` cho building được gán, nhưng không được hủy (`building-expenses.delete`) và không cấu hình fixed cost.
- Khoản chi có bắt buộc lý do khi hủy không? => Có. Void là soft-void, bắt buộc `void_reason`.
- Fixed cost có nhiều dòng theo lịch sử hiệu lực từ MVP không? => Có. `building_fixed_costs` có `effective_from`/`effective_to` theo period, kết thúc bằng cách set `effective_to` qua PATCH.
- Report ưu tiên page nào? => `/operations-report` tổng hợp theo building + tháng (MVP một tòa một tháng).

## Trạng Thái Triển Khai (MVP)

Đã ship trong change `add-operations-report`:

- Bảng `building_expenses`, `building_fixed_costs` + RLS (admin/owner FOR ALL; manager SELECT/INSERT/UPDATE expense, SELECT fixed cost).
- Capabilities: `operations-report.read`, `building-expenses.read/write/delete`, `building-fixed-costs.read/write`. Admin + owner có đủ 6; manager chỉ có `operations-report.read`, `building-expenses.read`, `building-expenses.write`.
- API: `GET /api/operations-report`, `GET|POST /api/building-expenses`, `PATCH|DELETE /api/building-expenses/[id]` (DELETE = soft-void, đọc `void_reason` từ body), `GET|POST /api/building-fixed-costs`, `PATCH /api/building-fixed-costs/[id]` (end-date qua `effective_to`).
- Flow: page `/operations-report` -> composable `useOperationsReport`/`useOperationsMutations` -> server API -> service -> repository -> Supabase.
- Service enforce `can(...)`, `assertBuildingScope(..., 'read'|'write')`, fixed-cost overlap => 409 CONFLICT, audit trên mọi mutation.
- Revenue read-only từ invoice không void + payment `deleted_at is null`. Chi phí đã void bị loại khỏi tổng và khỏi danh sách report.
- Audit actions: `building_expense.created/updated/voided`, `building_fixed_cost.created/updated/ended`.

Chưa làm (như MVP scope đã nêu): approval, upload chứng từ, custom category, multi-currency, double-entry, tax/VAT, so sánh nhiều tòa cùng lúc.

## Trạng Thái Triển Khai (Receipt/Export)

Đã ship trong change `add-expense-receipt-export`:

- Expense có thể gắn ảnh biên lai jpeg/png/webp tới 5MB. File nằm trong bucket private `expense-receipts`; API chỉ trả signed URL ngắn hạn.
- API export Excel `GET /api/operations-report/export` xuất báo cáo tháng của một tòa nhà. Chỉ admin/owner có `operations-report.export`; manager không thấy nút export.
- Category chi phí mở rộng thêm `insurance`, `bank_fee`, `fire_safety`.
- Quản lý chi phí cố định được chuyển sang `/buildings/[id]/settings`; trang báo cáo chỉ hiện chi phí cố định dạng read-only.

## Trạng Thái Triển Khai (Recurring/Prepaid)

Đã bổ sung trong change `add-recurring-prepaid-expenses`:

- `recurring_expenses` lưu mẫu nhắc chi phí theo tần suất `monthly`, `quarterly`, `biannual`, `yearly`, ngày neo 1-28, số tiền dự kiến và `next_reminder_at`.
- Tên mẫu nhắc chi phí dùng `UiCombobox` để chọn gợi ý hoặc nhập tay, và lưu vào `recurring_expenses.name`.
- Manager được xem và ghi nhận nhắc chi phí trong phạm vi được gán nếu có `building-expenses.write`, nhưng không được cấu hình mẫu.
- `prepaid_expenses` lưu khoản trả trước theo tổng tiền, số tháng, ngày bắt đầu, ngày kết thúc tính toán và số tiền phân bổ tháng. Tháng cuối hấp thụ phần làm tròn.
- Tên chi phí trả trước dùng cùng pattern `UiCombobox` chọn/nhập và lưu vào `prepaid_expenses.name`.
- Báo cáo vận hành cộng `prepaidAllocationTotal` vào tổng chi phí và lợi nhuận, đồng thời hiển thị `prepaidItems` thành một section riêng.
- Export Excel có section "Chi phí trả trước (phân bổ)" thống nhất với màn hình.

## Trạng Thái Triển Khai (Shared/Reserve polish)

- Modal thêm/sửa chi phí vận hành một lần dùng `UiCombobox allow-custom` cho "Tên/Ghi chú chi phí" và lưu vào `building_expenses.note`.
- Modal chi phí cố định trong building settings dùng cùng pattern cho "Tên/Ghi chú chi phí" và lưu vào `building_fixed_costs.note`.
- Tạo chi phí từ quỹ dự phòng là thao tác hai bước được bọc bởi service compensation: nếu tạo deduction thất bại sau khi expense đã được tạo, expense mới tạo bị xóa lại để không còn orphan row. Void một reserve-funded expense sẽ void linked deduction để khoản chi không còn làm giảm số dư quỹ.

## Trạng Thái Triển Khai (Closure/Reserve accrual)

- `operations_report_periods` lưu trạng thái open/closed riêng cho từng `building_id + period_year + period_month`; thiếu row được hiểu là open.
- API: `POST /api/operations-report/close` nhận `building_id`, `period_year`, `period_month`; `POST /api/operations-report/reopen` nhận thêm `reason`; `POST /api/reserve-funds/[buildingId]/refresh-accrual` nhận `period_year`, `period_month`.
- Chỉ admin có `operations-report.close`, `operations-report.reopen`, và `reserve-fund.refresh-accrual`; owner/manager bị 403 và UI không hiện các nút này.
- Chốt báo cáo thủ công, auto-close cuối tháng, và admin refresh đều upsert cùng một dòng `reserve_fund_transactions.source = monthly_accrual`; không có nhập số quỹ thủ công.
- Admin refresh dùng để cập nhật latest khi có thêm/bớt chi phí sau billing close nhưng trước khi report được chốt lại.
- Công thức quỹ là `max(lãi vận hành, 0) * tỷ lệ quỹ`, trong đó lãi vận hành dựa trên doanh thu phát hành trừ chi phí trực tiếp, chi phí cố định, và phân bổ trả trước.
- Khi báo cáo đã closed, các mutation chi phí ảnh hưởng kỳ đó bị chặn cho tới khi admin mở lại. Sau khi sửa, admin close lại hoặc refresh để cập nhật cùng dòng accrual.
- Auto-close là Nitro task gọi route internal vào ngày cuối tháng theo `Asia/Ho_Chi_Minh`. Route internal yêu cầu `NUXT_OPERATIONS_REPORT_AUTO_CLOSE_SECRET`; nếu thiếu secret hoặc không phải ngày cuối tháng thì không chốt gì.
- Có thể tắt tạm auto-close qua runtime env `NUXT_OPERATIONS_REPORT_AUTO_CLOSE_ENABLED=false` (hữu ích cho môi trường dev/local); bật lại bằng `true`.
- Không có auto-close billing; billing close giữ nguyên flow và điều kiện hiện tại.
- Migration `20260707031000_fix_operations_report_periods_shape.sql` vá các DB đã có `operations_report_periods` shape cũ thiếu `close_source` và reload PostgREST schema cache.
