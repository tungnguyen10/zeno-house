---
type: Implementation Plan
title: "Khoản thu khác của tòa nhà"
status: draft
change_state: implementation
tags: [change, operations-report, reserve-fund, v2]
---

# Khoản thu khác ngoài billing — kế hoạch đề xuất

Ngày: 18/11/2026. Trạng thái: đã triển khai và kiểm thử cục bộ. Xem verification.md cho các bước phát hành còn mở.

Mục tiêu: thêm khoản thu đã nhận ngoài billing ngay tại operations-report, dùng giao diện tương tự “Thêm chi phí”, phân bổ độc quyền vào quỹ dự phòng hoặc lợi nhuận và không cộng lại nguồn thu billing.

Cơ sở kiểm tra: `tungnguyen10/zeno-house`, nhánh `develop` (V2), commit `d2cc1d22238e393de1ebd18386d2c2241d16c11c`. Nhánh làm tính năng xuất phát từ commit develop này.

Đối chiếu trên develop: [khoản phát sinh theo hợp đồng/phòng](https://github.com/tungnguyen10/zeno-house/blob/d2cc1d22238e393de1ebd18386d2c2241d16c11c/server/services/billing/drafts.ts#L698-L718), [nguồn thu và chỉ số lợi nhuận](https://github.com/tungnguyen10/zeno-house/blob/d2cc1d22238e393de1ebd18386d2c2241d16c11c/server/services/operations-report/report.ts#L152-L255), [phạm vi inventory V2](https://github.com/tungnguyen10/zeno-house/blob/d2cc1d22238e393de1ebd18386d2c2241d16c11c/docs/changes/zeno-house-v2-optimization/brief.md#L118-L125). Inventory phục vụ danh mục và bàn giao. Khoản thanh lý được ghi khi tiền thực nhận thuộc về tòa nhà. Phiên bản đầu không yêu cầu chọn tài sản trong inventory.

## 1. Yêu cầu và lựa chọn thiết kế

- User yêu cầu nút và modal theo mẫu “Thêm chi phí”.
- Mỗi khoản thu có đúng một lựa chọn phân bổ: “Quỹ dự phòng” hoặc “Lợi nhuận”.
- Khi mở modal mới, chọn sẵn “Quỹ dự phòng”; backend cũng mặc định `reserve_fund` nếu thiếu trường phân bổ.
- Chọn quỹ: 100% số tiền cộng thẳng vào quỹ, có trong tổng tiền thu, không tính vào lợi nhuận hay cơ sở trích quỹ theo tỷ lệ.
- Chọn lợi nhuận: có trong doanh thu vận hành và lợi nhuận; phân bổ trọn khoản này vào lợi nhuận. Cơ sở trích quỹ định kỳ tiếp tục dùng lợi nhuận từ nguồn billing và chi phí hiện hành.
- Phiên bản đầu ghi nhận khoản đã thu đủ, một ngày thu, một kỳ và một đích phân bổ; không có công nợ, thu từng phần hay chia tỷ lệ trên cùng một khoản.
- Chọn nơi ghi theo bản chất giao dịch. Tiền phải thu của phòng theo hợp đồng, kể cả phí bị bỏ sót sau khi khách thanh toán, thuộc Billing. Báo cáo vận hành nhận tiền thực thu độc lập với hóa đơn phòng, ví dụ bán thanh lý thiết bị của tòa nhà. Trạng thái thanh toán của hóa đơn và lựa chọn phân bổ vào quỹ/lợi nhuận không quyết định nơi ghi.
- Với phí thuộc hóa đơn cũ đã thanh toán, luồng sửa hiện có trên giao diện Billing khi kỳ còn mở là hoàn tác ghi nhận thanh toán, hủy hóa đơn có lý do, sửa đầu vào, phát hành lại và ghi nhận lại đúng số đã nhận. Nếu kỳ billing đã chốt, quản trị viên cần mở lại kỳ trước khi sửa. Phí mới thực sự thuộc kỳ sau có thể thêm ở bước Soạn kỳ sau. Tham chiếu [luồng đính chính Billing](https://github.com/tungnguyen10/zeno-house/blob/d2cc1d22238e393de1ebd18386d2c2241d16c11c/docs/features/billing.md#paid-invoice-correction).
- Ngày thu phải là ngày lịch hợp lệ trong tháng báo cáo theo múi giờ Việt Nam. Tòa nhà và kỳ được lấy từ bộ lọc, bất biến sau khi tạo; sửa sai kỳ bằng hủy và tạo lại trong kỳ đang mở.
- Tiền cọc, tiền vay, vốn góp và thanh toán hóa đơn không được hướng dẫn nhập ở đây như thu nhập vận hành.

Ba phương án đã cân nhắc:

| Phương án | Đánh giá |
| --- | --- |
| Tạo sổ khoản thu ngoài billing và liên kết giao dịch quỹ theo ID khoản thu | Đề xuất: rõ nguồn, không sửa hóa đơn, hỗ trợ đầy đủ lựa chọn quỹ/lợi nhuận. |
| Ghi tất cả vào hóa đơn bằng loại khoản phát sinh | Đã có cơ chế tương tự trong billing nhưng không đáp ứng khoản thu độc lập của tòa nhà. |
| Dùng chi phí âm hoặc nạp quỹ thủ công | Làm sai ý nghĩa chi phí/doanh thu, khó theo dõi phân bổ và chống đếm hai lần. |

## 2. Giao diện

Thêm khối “Khoản thu khác của tòa nhà” trước khối “Chi phí phát sinh trong tháng”, gồm tổng thu khác và bảng chi tiết; hàng trên điện thoại theo mẫu danh sách chi phí.

Nút “Thêm khoản thu” có kích thước, icon convention, màu, vị trí hành động và trạng thái loading giống “Thêm chi phí”. Dùng primitive sẵn có, không tạo hệ thống giao diện mới.

Modal “Thêm khoản thu” / “Sửa khoản thu”:

| Trường | Quy tắc |
| --- | --- |
| Tên khoản thu | Bắt buộc, tối đa 200 ký tự. |
| Số tiền | Bắt buộc, số nguyên VND dương, trong giới hạn tiền tệ hiện hành. |
| Ngày thu | Mặc định hôm nay nếu cùng kỳ, nếu khác kỳ để trống yêu cầu nhập đúng kỳ. |
| Phân bổ vào | Nhóm hai lựa chọn loại trừ nhau: Quỹ dự phòng / Lợi nhuận; mặc định quỹ. Không dùng hai checkbox độc lập. |
| Người nộp | Không bắt buộc, tối đa 200 ký tự. |
| Phương thức thanh toán | Theo lựa chọn hiện có của dự án. |
| Mã giao dịch | Không bắt buộc; lưu dạng chuẩn hóa để đối chiếu. |
| Ghi chú | Không bắt buộc, tối đa 500 ký tự. |

Gợi ý dưới phân bổ: “Quỹ dự phòng: cộng toàn bộ vào quỹ, không tính vào lợi nhuận.” / “Lợi nhuận: tính vào lợi nhuận vận hành, toàn bộ khoản thu được phân bổ vào lợi nhuận.”

Gợi ý trên form “Chỉ ghi tiền đã nhận ngoài hóa đơn phòng. Phí thu thêm của phòng được ghi trong Billing.” Nếu có dấu hiệu trùng, hiển thị cảnh báo và yêu cầu xác nhận khoản độc lập trước khi lưu. Lưu xác nhận vào lịch sử.

Bảng có ngày, tên khoản thu, số tiền, nơi phân bổ, người nộp, thao tác sửa/hủy. Hủy yêu cầu lý do, giữ lịch sử. Kỳ đã chốt không có thao tác ghi; khi server báo kỳ vừa chốt, giữ dữ liệu modal và hướng dẫn tải lại.

## 3. Công thức báo cáo và quỹ

Ký hiệu: B = doanh thu hóa đơn hợp lệ; C = tiền mới thu qua thanh toán hóa đơn; P = khoản thu khác chọn lợi nhuận; Q = khoản thu khác chọn quỹ; E = chi phí dùng cho lợi nhuận theo quy tắc hiện hành; D = khoản chi từ quỹ; A = trích quỹ theo tỷ lệ.

| Chỉ số | Công thức |
| --- | --- |
| Doanh thu billing (`issuedRevenue`) | B, giữ nguyên ý nghĩa hiện tại. |
| Tiền thu billing (`collectedCash`) | C, giữ nguyên ý nghĩa hiện tại. |
| Thu khác (`otherIncomeTotal`) | P + Q. |
| Thu khác vào lợi nhuận (`otherIncomeProfitTotal`) | P. |
| Thu khác vào quỹ (`otherIncomeReserveTotal`) | Q. |
| Tổng doanh thu vận hành (`totalOperatingRevenue`) | B + P. |
| Tổng đã thu của kỳ (`totalCollectedCash`) | C + P + Q. |
| Lợi nhuận theo doanh thu (`profitByRevenue`) | B + P − E. |
| Lợi nhuận theo tiền thu (`profitByCash`) | C + P − E. |
| Trích quỹ theo tỷ lệ | A = làm tròn(max(B − E, 0) × tỷ lệ hiện hành), theo quy tắc phân bổ đã duyệt. |
| Biến động quỹ tháng | Q + A đã áp dụng − D. |

C là các khoản thanh toán gắn với hóa đơn của kỳ, kể cả thanh toán khác tháng. P và Q thuộc tháng thực nhận. UI và Excel phải ghi “Tổng đã thu của kỳ” và hiển thị hai nguồn để giải thích số liệu khi đối chiếu sao kê. Tổng tiền đã thu có phần chuyển vào quỹ; vì vậy lợi nhuận theo tiền thu không thể lấy toàn bộ chỉ số này trừ chi phí. UI và Excel phải có giải thích “Loại trừ khoản thu phân bổ vào quỹ”. Công nợ hóa đơn và biên điện/nước giữ nguyên.

Khoản Q được phản ánh vào quỹ ngay khi lưu thành công, kể cả kỳ báo cáo đang mở. A chỉ áp dụng theo trạng thái chốt hiện có; khi kỳ mở hiển thị ước tính A riêng. Mở lại báo cáo không xóa Q vì khoản thu vẫn tồn tại.

Ví dụ: B=100 triệu, C=90 triệu, E=60 triệu, tỷ lệ quỹ 10%. Thêm 2 triệu chọn quỹ và 3 triệu chọn lợi nhuận: tổng tiền thu=95 triệu; tổng doanh thu vận hành=103 triệu; lợi nhuận theo doanh thu=43 triệu; theo tiền thu=33 triệu; Q=2 triệu; A=4 triệu khi chốt; tổng tăng quỹ trước chi=6 triệu.

## 4. Dữ liệu, giao dịch và chống trùng

Tạo `building_other_incomes` riêng, với building/kỳ, tên, số tiền, ngày thu, `allocation_target` enum `reserve_fund | profit`, thông tin người nộp/thanh toán, mã giao dịch, operation ID, phiên bản cập nhật, người tạo và thông tin hủy. Không tạo invoice, invoice charge hay invoice payment từ luồng này.

Mở rộng sổ quỹ với nguồn `other_income` và `linked_other_income_id` khóa ngoại. Mỗi khoản thu chọn quỹ có tối đa một giao dịch quỹ còn hiệu lực, cùng số tiền. Đây là giao dịch dẫn xuất, không phải nguồn thu thứ hai.

- Create, edit, đổi phân bổ, void và audit chạy trong cùng một giao dịch cơ sở dữ liệu.
- Đổi quỹ → lợi nhuận hủy hiệu lực khoản cộng quỹ; đổi lợi nhuận → quỹ tạo/khôi phục khoản cộng quỹ tương ứng. Không còn hai giao dịch quỹ hiệu lực cho cùng khoản thu.
- Sửa số tiền đồng bộ số tiền quỹ; hủy khoản thu loại khỏi tổng thu/lợi nhuận và đảo phần cộng quỹ liên quan. Không xóa cứng lịch sử.
- Khóa kỳ dùng cùng cơ chế đồng bộ với close/reopen để không có giao dịch ghi lọt vào kỳ vừa chốt; thao tác thu và chốt dùng cùng thứ tự khóa để tránh deadlock.
- `operation_id` ổn định cho mỗi lần tạo bảo đảm retry/double-click chỉ tạo một khoản thu, một giao dịch quỹ và một audit. Dùng lại ID với payload khác trả conflict.
- Sửa/hủy dùng `expected_updated_at` hoặc version tương đương để ngăn ghi đè dữ liệu cũ.
- Không lấy giao dịch quỹ `other_income` cộng thêm lần nữa vào tổng tiền thu; tổng tiền thu khác chỉ đọc nguồn `building_other_incomes` còn hiệu lực.
- Không sao chép incidental charges/phụ thu hóa đơn sang sổ khoản thu khác. Không nhận các trường liên kết invoice/contract/payment từ payload tạo khoản thu độc lập.
- Đối chiếu mã giao dịch nếu cả hai nguồn đang có định danh dùng chung; trước khi triển khai phải kiểm tra schema thanh toán thực tế. Không giả định billing đã có mã giao dịch chuẩn hóa.
- Đối chiếu mềm theo tòa nhà, số tiền và ngày thu với khoản thu khác còn hiệu lực và tiền mới thu billing trong ngày. Cùng số tiền/ngày chưa đủ để kết luận là trùng, nên cảnh báo có xác nhận, không chặn cứng khoản độc lập.
- Việc không có đường liên kết hóa đơn không chứng minh hai bản ghi nhập tay là hai nghiệp vụ khác nhau. Không cam kết phát hiện tuyệt đối khoản bị nhập lại khác tên, ngày hoặc mã giao dịch. Khi phát hiện đã nhập trùng billing phải hủy khoản thu khác, không tự trừ invoice.

Quyền: bổ sung `building-other-incomes.read/write/delete` theo ma trận vai trò hiện có. Khoản liên quan quỹ cần thêm `reserve-fund.manage`; đổi khỏi quỹ và hủy khoản quỹ cũng kiểm tra quyền này. Người chỉ có quyền ghi lợi nhuận phải chủ động chọn “Lợi nhuận”; không âm thầm đổi mặc định. Mọi truy cập đều giới hạn tòa nhà phía server và DB theo chuẩn dự án. Cảnh báo trùng không tiết lộ chi tiết billing vượt quyền người dùng.

## 5. Các bước triển khai

Đây là một checklist thực thi duy nhất. Thực hiện tuần tự; mỗi bước tài chính bắt đầu bằng test tình huống thất bại, thêm triển khai tối thiểu, kiểm tra lại và commit phạm vi tương ứng.

### Bước 1 — Nền tảng dữ liệu và thao tác khoản thu

- [x] Kiểm tra lại nhánh triển khai, schema audit, tiền tệ, phân quyền, khóa kỳ, định danh thanh toán và SQL snapshot đang được triển khai; nguồn mới hơn được ưu tiên hơn commit tham chiếu.
- [x] Thêm migration `supabase/migrations/20261118000000_operations_other_incomes.sql`: bảng thu, ràng buộc số tiền/ngày/kỳ/enum, FK quỹ, unique operation ID và unique liên kết quỹ hiệu lực; RPC ghi + audit atomic; quyền truy cập theo chuẩn dự án.
- [x] Mở rộng `app/types/operations-report.ts`, `app/utils/validators/operations-report.ts`, `app/utils/mappers/operations-report.ts`, `app/utils/constants/audit.ts`, `app/utils/constants/permissions.ts` và các mapper/permission checks phía server có liên quan. Repository mới dùng kiểu schema cục bộ cho RPC và bảng mới. Sau rollout cloud, sinh lại database types bằng quy trình dự án.
- [x] Tạo `server/repositories/operations-report/other-incomes.ts`, `server/services/operations-report/other-incomes.ts` và API `server/api/building-other-incomes/index.get.ts`, `index.post.ts`, `[id].patch.ts`, `[id].delete.ts`.
- [x] Test trong `tests/server/operations-report/other-income-service.test.ts` và `other-income-api.test.ts`: mặc định quỹ, quyền, sai phạm vi, số tiền 0/âm/lẻ, ngày không tồn tại, kỳ sai, retry, payload conflict, stale update, hủy, rollback khi audit lỗi, close cạnh tranh với create/update/void.

### Bước 2 — Nguồn thu, công thức và sổ quỹ

- [x] Mở rộng RPC `operations_report_snapshot` bằng migration mới, không chỉnh các migration đã áp dụng. Snapshot trả khoản thu khác và các giao dịch quỹ mới trong cùng ngữ cảnh nhất quán; giữ nhánh SQL triển khai thủ công đồng bộ nếu vẫn là đường triển khai của dự án.
- [x] Cập nhật `server/repositories/operations-report/report.ts` và `server/services/operations-report/report.ts`: thêm bốn nhóm metrics đề xuất, danh sách khoản thu khác, phân tích doanh thu P, bảng phân bổ Q và tổng tiền đã thu; tránh nhập Q vào doanh thu vận hành.
- [x] Cập nhật `server/utils/billing/accrual-formula.ts`, `server/services/operations-report/accrual.ts`, `server/services/operations-report/reserve-funds.ts`, `server/repositories/operations-report/reserve-funds.ts` cùng types/mappers quỹ: thêm P vào lợi nhuận hiển thị; tính phần trích quỹ định kỳ theo cơ sở B − E, độc lập với cả P và Q; expose tổng cộng quỹ trực tiếp riêng.
- [x] Đối chiếu mọi đường chốt billing, chốt report, tự chốt, refresh quỹ, tính lại quỹ và `scripts/reconcile-reserve-accruals.mjs` để thống nhất công thức mới. Không chạy script tính lại lịch sử ngoài phạm vi được duyệt.
- [x] Invalidate cache tòa nhà sau ghi thu/đổi phân bổ/hủy; cập nhật version snapshot nếu cache kỳ đóng phụ thuộc version. Không dùng dữ liệu cũ sau reopen/edit/reclose.
- [x] Test thêm vào `tests/server/operations-report/report-service.test.ts`, `reserve-fund-service.test.ts`, `snapshot-performance.test.ts`, `tests/server/billing/accrual-formula.test.ts`, `accrual-inputs.test.ts`, `tests/scripts/reconcile-reserve-accruals.test.ts`.
- [x] Chứng minh ví dụ số mục 3 và các trường hợp: không có billing period, chỉ có Q, chỉ có P, lợi nhuận âm, tỷ lệ quỹ 0%, sửa/đổi phân bổ/hủy, close/reopen/reclose không nhân đôi Q, hóa đơn void không ảnh hưởng khoản thu độc lập.

### Bước 3 — Giao diện theo mẫu Thêm chi phí

- [x] Tạo `app/components/operations-report/OperationsOtherIncomeModal.vue`, tham chiếu `OperationsExpenseModal.vue`; thêm composable `app/composables/operations-report/useOtherIncomes.ts` và tích hợp `app/pages/dashboard/operations-report/index.vue`.
- [x] Hiện “Tổng đã thu của kỳ” với hai dòng “Đã thu từ hóa đơn của kỳ” và “Thu khác của tòa nhà”; giữ phân biệt doanh thu billing và doanh thu vận hành. Hiện Q trong panel quỹ, P trong lợi nhuận, nguồn thu khác trong danh sách riêng.
- [x] Thêm danh sách/bảng, empty/loading/error states, lưu lặp, cảnh báo trùng, xác nhận độc lập, sửa, hủy có lý do, read-only khi chốt và quyền theo từng lựa chọn phân bổ.
- [x] Test `tests/components/operations-report/OperationsOtherIncomeModal.spec.ts` và `OperationsOtherIncomeSection.spec.ts`: mặc định quỹ, radio loại trừ nhau, nhãn số liệu, tải lại đúng bộ lọc, xung đột, lỗi giữ dữ liệu, không có quyền, kỳ đóng.
- [ ] Kiểm tra trực quan và thao tác desktop/tablet/mobile, light/dark theo workflow UI của dự án; so trực tiếp với “Thêm chi phí”.

### Bước 4 — Excel, tài liệu và kiểm chứng

- [x] Cập nhật `server/services/operations-report/export.ts` và `tests/server/operations-report/export-service.test.ts`: tổng thu, lợi nhuận, Q/P, danh sách khoản thu, quỹ và chú thích khớp UI; không cộng sổ quỹ lần nữa.
- [x] Bổ sung kiểm thử SQL thực tế trong `supabase/tests/operations-other-incomes.sql`: rollback, retry đồng thời, scope, khóa kỳ và liên kết quỹ duy nhất.
- [x] Chạy test hẹp trước, sau đó `npm run typecheck`, `npm test`, `npm run lint`, `npm run knowledge:check` theo quy trình hiện hành. Kiểm tra hiệu năng snapshot không tạo truy vấn theo từng dòng thu.
- [ ] Kiểm chứng migration/RPC/quyền trên môi trường cloud được cấu hình riêng với test local; không coi unit test là bằng chứng migration production đã chạy.
- [ ] Khi tính năng được duyệt và xác minh, cập nhật `docs/capabilities/operations-report.md`, capability quỹ tương ứng, `docs/features/operations-report.md`, `docs/user-guide/expenses-and-reports.md`, `docs/architecture/auth-permissions.md`, `docs/changes/index.md` và bằng chứng kiểm chứng trong cùng change; archive theo workflow khi hoàn tất.

## 6. Tiêu chí nghiệm thu

1. Người dùng tạo/sửa/hủy khoản thu ngoài billing từ operations-report bằng trải nghiệm giống “Thêm chi phí”.
2. Mặc định quỹ, chỉ chọn một đích phân bổ; UI/backend thống nhất.
3. Khoản vào quỹ tăng tổng tiền thu và số dư quỹ đúng một lần, không tăng lợi nhuận hay bị trích quỹ lần hai.
4. Khoản vào lợi nhuận tăng đúng tổng tiền thu, doanh thu vận hành và cả hai loại lợi nhuận; cơ chế trích quỹ theo tỷ lệ dùng cùng công thức ở mọi đường chốt.
5. Không thay đổi công nợ, thanh toán hoặc incidental charges của billing.
6. Retry/đổi phân bổ/hủy/close/reopen không sinh bản ghi quỹ hoặc doanh thu lặp; cùng số tiền/ngày có cảnh báo nhưng khoản độc lập vẫn ghi nhận được.
7. UI, Excel, snapshot và quỹ khớp nhau; số liệu cũ không có khoản thu mới giữ nguyên; lịch sử đã chốt không bị tự sửa.
8. Phân quyền, khóa kỳ, audit atomic và lỗi cạnh tranh được kiểm chứng bằng test và SQL cloud trước khi tuyên bố hoàn tất.

## 7. Phạm vi chưa đưa vào lần đầu

Upload chứng từ thu, khoản phải thu ngoài billing, thu từng phần, chia một khoản cho nhiều nơi, tự chuyển khoản thu vào hóa đơn và tự động khớp ngân hàng chưa nằm trong lần đầu. Không thêm phụ thuộc hay runtime mới cho tính năng này.

## 8. Đối chiếu xuyên suốt từ giao diện đến lúc chốt

| Thao tác trong kỳ mở | Tổng đã thu tăng | Lợi nhuận tăng | Quỹ tăng trực tiếp | Trích thêm khi chốt |
| --- | ---: | ---: | ---: | ---: |
| Lưu thanh lý máy giặt 800.000đ với mặc định | 800.000 | 0 | 800.000 | 0 |
| Cùng khoản đó, chuyển từ quỹ sang lợi nhuận (so với trước khi tạo) | 800.000 | 800.000 | 0 | 0 |
| Hủy khoản trên (so với trước khi tạo) | 0 | 0 | 0 | 0 |

- Kiểm tra thao tác trước khi có kỳ Billing và sau khi kỳ Billing đã chốt. Quyền ghi phụ thuộc kỳ báo cáo vận hành.
- Với hóa đơn có tiền thu trùng số tiền và ngày của khoản thanh lý, thao tác đầu tiên phải cảnh báo. Chỉ lưu sau khi người nhập xác nhận đây là giao dịch độc lập. Bấm lưu lại sau lỗi mạng dùng cùng mã thao tác.
- Chạy cùng một dữ liệu qua màn hình, Excel, chốt thủ công, tự chốt và cập nhật lại quỹ. Đối chiếu riêng tổng tiền thu, lợi nhuận, tiền vào quỹ trực tiếp và trích quỹ định kỳ.
- Triển khai thay đổi cơ sở dữ liệu trước phiên bản ứng dụng. Xác minh quyền RPC và số liệu trên môi trường kiểm thử trước khi phát hành.
