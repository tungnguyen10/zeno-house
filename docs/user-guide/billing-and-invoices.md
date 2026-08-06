# Vận Hành Billing Và Hóa Đơn

Billing là quy trình rủi ro cao nhất trong hệ thống — mọi số tiền đều do server tính, người dùng chỉ nhập chỉ số và xác nhận thao tác qua giao diện hoặc trợ lý AI.

## Khái Niệm Cơ Bản

| Khái niệm | Ý nghĩa |
| --- | --- |
| Kỳ vận hành (billing period) | Một tháng vận hành của một tòa nhà |
| Draft (nháp hóa đơn) | Bản tính trước do server tạo cho từng hợp đồng đang hoạt động |
| Hóa đơn | Bản chốt (snapshot) của draft sau khi phát hành |
| Khoản phí | Từng dòng trong hóa đơn (tiền thuê, điện, nước, dịch vụ, phụ thu...) |
| Thanh toán | Khoản thu ghi nhận vào một hóa đơn |
| Usage override | Mức tiêu thụ điện/nước đặt thủ công khi chỉ số không phản ánh đúng thực tế |

### Trạng thái kỳ vận hành

**Nháp** → **Nhập chỉ số** → **Soát hoá đơn** → **Đã phát hành** → **Đang thu** → **Đã chốt**

### Trạng thái hóa đơn

**Chưa thu** (issued) → **Một phần** (partial) → **Đã thu** (paid); ngoài ra còn **Quá hạn** (overdue) và **Đã huỷ** (void).

## Danh Sách Kỳ Vận Hành

Route: `/dashboard/billing`.

Trang liệt kê tất cả kỳ theo tòa nhà, có bộ đếm nhanh theo trạng thái (cần nhập chỉ số, chờ phát hành, đang thu, còn công nợ, đã chốt) — bấm vào một bộ đếm sẽ lọc danh sách theo đúng nhóm đó. Có thể lọc thêm theo tòa nhà, năm và trạng thái.

Mỗi dòng hiển thị tòa nhà, kỳ (MM/YYYY), trạng thái, tiến độ nhập chỉ số, số hóa đơn, tiến độ thu tiền và công nợ còn lại. Nhấn vào dòng để mở không gian làm việc của kỳ đó.

### Mở kỳ mới

Từ menu góc trên bên phải, chọn **Mở kỳ mới**, chọn tòa nhà và kỳ (mặc định tháng hiện tại), rồi xác nhận. Nếu kỳ đã tồn tại, hệ thống mở lại đúng kỳ đó thay vì tạo trùng.

## Không Gian Làm Việc Của Một Kỳ

Route: `/dashboard/billing/[building]/[period]`. Có hai tab chính.

### Tab "Soạn kỳ" — nhập chỉ số và phát hành

1. Nhập chỉ số điện/nước cho từng phòng (có thể gõ trực tiếp — hệ thống tự lưu sau khi bạn dừng gõ — hoặc dùng **Nhập nhanh** để dán nhiều dòng cùng lúc).
2. Dùng các bộ lọc trạng thái (thiếu chỉ số, lỗi, cần soát, sẵn sàng, đã phát hành) để kiểm tra tiến độ.
3. Chọn các phòng đã sẵn sàng, nhấn **Xem trước & phát hành**.
4. Kiểm tra bản xem trước: số hóa đơn, tổng tiền, hạn thu chung, cùng danh sách phòng bị loại (kèm lý do) nếu có.
5. Nhấn **Phát hành N hoá đơn** để xác nhận. Nếu dữ liệu kỳ đã thay đổi sau khi xem trước (ví dụ ai đó vừa sửa chỉ số), hệ thống báo dữ liệu đã cũ và yêu cầu xem trước lại trước khi phát hành.

Nếu có usage override chưa được duyệt, hệ thống yêu cầu **Phê duyệt điều chỉnh chỉ số** trước khi tiếp tục phát hành.

### Tab "Thu tiền & công nợ" — quản lý hóa đơn đã phát hành

- Lọc hóa đơn theo tất cả/chưa thu/đã thu/quá hạn.
- Với từng hóa đơn: **Đã thu** (ghi nhận thanh toán — luôn thu đủ số dư còn lại, không hỗ trợ thu một phần), **Hoàn tác thu** (khi ghi nhầm), **Phát hành lại** (hủy và tạo hóa đơn thay thế khi hóa đơn gốc chưa có thanh toán), **Huỷ** (chỉ khi chưa có thanh toán nào, yêu cầu lý do).
- Có thể chọn nhiều hóa đơn để **Ghi thu hàng loạt**, **In phiếu** hoặc **Gửi email** cùng lúc.
- Nhấn vào một hóa đơn để xem chi tiết: khoản phí, thông tin thanh toán trên hóa đơn, lịch sử thanh toán; từ đây có thể mở trang chi tiết đầy đủ hoặc in phiếu.
- Hóa đơn đã hủy được gom vào mục riêng **"Hoá đơn đã huỷ"** để tra soát, không tính vào công nợ.

### Chốt và mở lại kỳ

- **Chốt kỳ**: chỉ thực hiện được khi không còn công nợ. Sau khi chốt, không thể phát hành thêm, sửa chỉ số, hủy hay điều chỉnh hóa đơn của kỳ đó nữa.
- **Mở lại kỳ**: yêu cầu nhập lý do (tối thiểu 10 ký tự) — dùng khi cần sửa lại một kỳ đã chốt.
- **Huỷ phát hành kỳ**: hủy toàn bộ hóa đơn chưa thu của kỳ (đưa kỳ về lại trạng thái trước phát hành) trong khi vẫn giữ nguyên các hóa đơn đã thu; cũng yêu cầu lý do.
- Menu của kỳ còn có **Nhật ký** (xem lịch sử thao tác của kỳ này) và **Xuất Excel**.

## Quản Lý Hóa Đơn Ngoài Ngữ Cảnh Một Kỳ

Route: `/dashboard/invoices` — tra cứu hóa đơn theo tòa nhà, kỳ, trạng thái và tên khách thuê, không giới hạn trong một kỳ cụ thể. Dùng khi cần tìm nhanh một hóa đơn mà không nhớ chính xác kỳ hoặc tòa nhà.

Từ danh sách này bạn vẫn có thể chọn nhiều hóa đơn để in hàng loạt hoặc gửi email hàng loạt (tối đa 100 hóa đơn/lần).

### In hóa đơn

Nút **In phiếu** mở route `/dashboard/invoices/print` với danh sách hóa đơn đã chọn, hiển thị dạng khổ A4 sẵn sàng in — nhấn **In ngay** để in trực tiếp từ trình duyệt.

### Gửi hóa đơn qua email

Nếu tính năng gửi email đang được bật cho hệ thống/tòa nhà, hóa đơn có thể gửi tới email liên hệ chính của khách thuê. Trạng thái gửi (đã tiếp nhận, đã giao, lỗi...) hiển thị trong phần chi tiết hóa đơn; nếu khách thuê chưa có email liên hệ, hệ thống nhắc bổ sung trước khi gửi. Có thể gửi lại nếu cần, kể cả khi lần trước đã gửi thành công.
