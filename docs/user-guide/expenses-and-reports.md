# Chi Phí Và Báo Cáo Vận Hành

Báo cáo vận hành không thay thế billing — doanh thu luôn được đọc từ dữ liệu billing (hóa đơn/thanh toán), còn chi phí là dữ liệu bạn nhập thêm theo từng tòa nhà/tháng.

## Báo Cáo Vận Hành

Route: `/dashboard/operations-report`.

### Bộ lọc

Chọn **tòa nhà**, **năm**, **tháng** (giới hạn theo tháng/năm bắt đầu vận hành của tòa nhà đã cấu hình), và có thể lọc thêm theo **loại chi phí**.

### Các chỉ số chính

- **Doanh thu phát hành** — tổng tiền trên hóa đơn đã phát hành trong kỳ.
- **Đã thu** — tổng tiền thực thu.
- **Công nợ** — tổng số dư hóa đơn chưa thu.
- **Tổng chi phí** — tổng chi phí cố định + chi phí phát sinh trong tháng.
- **Lợi nhuận (theo phát hành)** = doanh thu phát hành − tổng chi phí.
- **Lợi nhuận (theo tiền thu)** = tiền đã thu − tổng chi phí.

Ngoài ra, mục **"Doanh thu theo loại"** tách doanh thu theo tiền thuê/điện/nước/dịch vụ/phát sinh/giảm giá/phụ thu; riêng điện và nước còn hiển thị **chênh lệch** giữa tiền thu khách và chi phí điện/nước đầu vào — số dương (xanh) nghĩa là thu đủ bù chi phí đầu vào, số âm (đỏ) nghĩa là đang bù lỗ phần điện/nước.

### Chi phí cố định và chi phí trả trước

- **Chi phí cố định**: khoản lặp lại theo tháng có hiệu lực theo khoảng thời gian (ví dụ tiền thuê lại tòa nhà, internet dài hạn, lương nhân sự cố định, bảo hiểm, phí ngân hàng, PCCC...). Vì có hiệu lực theo thời gian, báo cáo của các tháng cũ vẫn đúng dù giá sau này có thay đổi.
- **Chi phí trả trước**: khoản trả trước một lần nhưng được phân bổ dần theo từng tháng; báo cáo chỉ hiển thị phần phân bổ của tháng đang xem.
- **Nhắc chi phí sắp đến hạn**: nếu có cấu hình chi phí định kỳ sắp tới hạn, trang hiển thị danh sách nhắc — bạn có thể **Ghi nhận** (mở sẵn form thêm chi phí với dữ liệu điền trước) hoặc **Bỏ qua**.

### Ghi nhận chi phí phát sinh trong tháng

Nhấn **Thêm chi phí** để mở form, gồm:

- Số tiền, loại chi phí (điện đầu vào, nước đầu vào, internet, vệ sinh/rác, sửa chữa/bảo trì, hành chính/giấy tờ, vật tư vận hành, lương nhân sự, điều chỉnh tiền thuê, bảo hiểm, phí ngân hàng, PCCC, khác).
- Tên/ghi chú chi phí, ngày chi, ảnh biên lai (tùy chọn).
- Mục mở rộng cho người/đơn vị nhận và hình thức thanh toán.
- Nếu bạn có quyền quản lý quỹ dự phòng, có thêm tùy chọn **"Trừ quỹ dự phòng"** để chi phí này được trừ trực tiếp vào quỹ thay vì tính là chi phí trực tiếp của tháng.

Chi phí đã ghi có thể **sửa** hoặc **hủy** (hủy yêu cầu nhập lý do; chi phí đã hủy không tính vào tổng chi phí nhưng vẫn hiển thị mờ để tra soát).

### Chốt và mở lại báo cáo

- **Chốt báo cáo**: khóa số liệu chi phí/doanh thu của tháng đó lại.
- **Mở lại**: yêu cầu nhập lý do, dùng khi cần sửa lại báo cáo đã chốt.
- **Xuất Excel**: xuất báo cáo hiện tại ra file (nếu tài khoản có quyền xuất báo cáo).

Đóng kỳ billing, chốt báo cáo vận hành, hoặc tự động chốt cuối tháng đều kích hoạt tính lại khoản trích quỹ dự phòng của tháng đó — xem phần Quỹ dự phòng bên dưới.

## Chi Phí Dùng Chung

Route: `/dashboard/shared-expenses` — chỉ admin và owner (manager không có quyền với mục này).

Dùng khi một khoản chi phí thực tế phát sinh chung cho nhiều tòa nhà (ví dụ một hóa đơn dịch vụ dùng chung, một lần sửa chữa chung), thay vì phải tự tay chia và nhập riêng từng tòa.

1. Tạo một khoản chi phí dùng chung: tên, loại chi phí, số tiền, chọn các tòa nhà cùng chia sẻ.
2. Chọn kỳ (tháng/năm) cần phân bổ, nhấn phân bổ. Hệ thống chia đều số tiền cho các tòa đã chọn; tòa cuối cùng nhận thêm phần dư làm tròn để tổng luôn khớp với số tiền gốc.
3. Sau khi phân bổ, mỗi tòa nhà sẽ có một dòng chi phí riêng tương ứng, hiển thị trong Báo cáo vận hành của tòa đó ở đúng tháng.

Một khoản chi phí dùng chung không thể phân bổ trùng hai lần cho cùng một kỳ. Tính năng này chỉ chia đều — không hỗ trợ chia theo tỷ lệ phần trăm tùy chỉnh hay tự động lặp lại hằng tháng.

## Quỹ Dự Phòng

Chỉ admin và owner có quyền xem/quản lý quỹ dự phòng của một tòa nhà; manager không có quyền này.

Quỹ dự phòng là một sổ cái theo tòa nhà, ghi nhận:

- **Trích quỹ hằng tháng** (tự động): tính theo công thức `max(doanh thu phát hành − tổng chi phí báo cáo, 0) × tỷ lệ quỹ / 100`, được ghi hoặc cập nhật mỗi khi bạn chốt kỳ billing, chốt báo cáo vận hành, hoặc hệ thống tự chốt báo cáo cuối tháng.
- **Chi từ quỹ**: khi một khoản chi phí được đánh dấu "Trừ quỹ dự phòng" lúc ghi nhận (xem phần chi phí ở trên), khoản đó được trừ thẳng vào số dư quỹ.

### Cấu hình tỷ lệ quỹ

Trong cài đặt tòa nhà (`/buildings/[id]/settings`), phần quỹ dự phòng cho phép thêm một mốc **tỷ lệ %** áp dụng kể từ một tháng cụ thể, và kết thúc hiệu lực của một mốc khi cần đổi tỷ lệ. Tỷ lệ áp dụng theo từng kỳ, nên báo cáo các tháng cũ luôn dùng đúng tỷ lệ đã áp dụng tại thời điểm đó, không bị ảnh hưởng khi bạn đổi tỷ lệ sau này.

### Xem số dư quỹ

Số dư và khoản trích quỹ hiển thị ngay trong Báo cáo vận hành (mục "Quỹ dự phòng"): tỷ lệ đang áp dụng, tiền quỹ tháng này (ghi rõ là số ước tính nếu báo cáo chưa chốt, hoặc số chính thức nếu đã chốt), số dư trong tháng, và tổng số dư lũy kế của tòa nhà. Số dư có thể âm nếu chi từ quỹ vượt quá số đã trích.

Nếu có thay đổi chi phí sau khi đã chốt kỳ billing (thêm/sửa/hủy/phân bổ chi phí), admin có thể dùng nút **Cập nhật quỹ** trong menu của báo cáo vận hành để tính lại khoản trích quỹ của đúng tháng đó mà không cần chốt lại toàn bộ báo cáo.

Quỹ dự phòng không phải là khoản thu từ khách thuê — đây là công cụ nội bộ để chủ nhà dự trù chi phí phát sinh trong tương lai.
