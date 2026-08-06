# Khách Thuê Và Hợp Đồng

## Quản Lý Khách Thuê

Routes: `/tenants` (danh sách), `/tenants/create`, `/tenants/[code]` (chi tiết), `/tenants/[code]/edit`.

Hồ sơ khách thuê gồm thông tin liên hệ, giới tính, nghề nghiệp, ngày/nơi cấp giấy tờ tùy thân, người liên hệ khẩn cấp, và trạng thái (đang hoạt động/đã lưu trữ).

- Danh sách hỗ trợ tìm kiếm, lọc theo tòa nhà, theo tình trạng hợp đồng (đã có/chưa có hợp đồng), và trạng thái; admin có thể lưu trữ/kích hoạt/xóa hàng loạt (xóa yêu cầu lý do).
- Trang chi tiết hiển thị badge trạng thái, các chip liên hệ (gọi điện, gửi email, mã số giấy tờ) và ba số liệu nhanh: số hợp đồng đang hoạt động, phòng hiện tại, số lần đồng ở.
- Không thể xóa hẳn một khách thuê còn hợp đồng hoạt động, còn đang ở ghép, hoặc còn tài khoản cổng thông tin liên kết — hệ thống đề nghị lưu trữ thay vì xóa trong các trường hợp đó.
- Form tạo/sửa tự lưu nháp và cảnh báo khi rời trang lúc còn thay đổi chưa lưu, tương tự form tòa nhà/phòng.

## Hợp Đồng

Routes: `/contracts` (danh sách), `/contracts/create` (wizard 3 bước), `/contracts/[id]` (chi tiết), `/contracts/[id]/edit`.

Hợp đồng là trung tâm kết nối tòa nhà, phòng, khách thuê, dịch vụ, thanh toán, người ở cùng, chỉ số bàn giao và billing.

Trạng thái hợp đồng: **đang hoạt động**, **hết hạn**, **đã kết thúc**, **đã gia hạn**.

### Tạo hợp đồng mới

Wizard 3 bước thu thập: thông tin tòa nhà/phòng/khách thuê, các điều khoản (ngày bắt đầu/kết thúc, tiền thuê, tiền cọc, ngày thanh toán, số người ở, giảm giá/phụ thu), và dịch vụ áp dụng.

Một bước bắt buộc là nhập **chỉ số bàn giao** (điện kWh và nước m³) tại thời điểm giao phòng — đây là mốc để tính hóa đơn tháng đầu tiên chính xác. Form tự gợi ý sẵn chỉ số gần nhất của phòng; nếu bạn nhập số thấp hơn chỉ số trước đó, hệ thống chỉ cảnh báo nhẹ (trường hợp thay đồng hồ mới là hợp lệ), không chặn lưu.

Có thể tạo hợp đồng thẳng từ trang chi tiết phòng (đã điền sẵn phòng).

### Chi tiết hợp đồng

Trang chi tiết có điều hướng theo mục: thông tin chung, liên kết phòng/khách thuê, người ở cùng, thanh toán hợp đồng, lịch sử (gia hạn + nhật ký thay đổi), dịch vụ áp dụng, chỉ số bàn giao, và khu vực xóa/kết thúc (chỉ admin).

- **Người ở cùng**: thêm người ở ghép, ghi nhận ngày dọn ra.
- **Thanh toán hợp đồng**: các khoản thu ngoài hóa đơn hằng tháng như tiền cọc, thuê trả trước — tách biệt với thanh toán hóa đơn billing.
- **Dịch vụ áp dụng**: các dịch vụ (internet, gửi xe, vệ sinh...) được sao chép từ cấu hình mặc định của tòa nhà khi tạo hợp đồng, có thể bật/tắt, đổi số tiền/số lượng riêng cho hợp đồng này, hoặc xóa dịch vụ không cần dùng (yêu cầu nhập lý do).
- **Gia hạn**: chọn gia hạn hợp đồng hiện tại hoặc tạo hợp đồng mới thay thế. Gia hạn không thu lại chỉ số bàn giao — hợp đồng mới kế thừa chỉ số gần nhất của hợp đồng cũ làm mốc.

### Kết thúc và xóa hợp đồng

Kết thúc hợp đồng sẽ trả phòng về trạng thái trống (trừ khi phòng đang bảo trì). Xóa hợp đồng chỉ thực hiện được khi hợp đồng chưa có billing đã phát hành, chưa có thanh toán đã ghi nhận, và không còn lịch sử chỉ số ngoài chỉ số bàn giao — nếu có, hệ thống liệt kê rõ các mục đang chặn. Với hợp đồng đang hoạt động, admin có lựa chọn **"Kết thúc rồi xoá"** để kết thúc hợp đồng trước rồi xóa nếu các điều kiện còn lại đều thỏa.

Trang danh sách hợp đồng cho phép admin kết thúc hoặc xóa nhiều hợp đồng cùng lúc (yêu cầu lý do và xác nhận rõ ràng cho thao tác xóa).
