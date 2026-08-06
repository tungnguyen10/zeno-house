# Tòa Nhà Và Phòng

## Trang Tổng Quan (Dashboard)

Route: `/dashboard`.

Trang đầu tiên sau khi đăng nhập, tổng hợp nhanh:

- Số tòa nhà đang quản lý.
- Số phòng theo trạng thái (trống, đang thuê, bảo trì, đã lưu trữ).
- Số hợp đồng đang hoạt động.
- Số khách thuê.

Dùng trang này để nắm nhanh quy mô vận hành trước khi đi sâu vào từng khu vực.

## Quản Lý Tòa Nhà

Routes: `/buildings` (danh sách), `/buildings/create` (tạo mới), `/buildings/[id]` (chi tiết), `/buildings/[id]/edit` (sửa), `/buildings/[id]/settings` (cài đặt).

### Danh sách tòa nhà

- Ô tìm kiếm, bộ lọc trạng thái, sắp xếp theo tên/ngày tạo/số phòng — toàn bộ trạng thái lọc được lưu trên URL.
- Admin có thể bật **chế độ chọn** để thao tác hàng loạt: lưu trữ, kích hoạt lại hoặc xóa nhiều tòa nhà cùng lúc. Xóa hàng loạt yêu cầu xác nhận và chỉ thành công với những tòa nhà không còn phòng/hợp đồng đang hoạt động; kết quả hiển thị rõ mục nào thành công, mục nào bị bỏ qua kèm lý do.

### Trang chi tiết tòa nhà

Hiển thị tên, mã, trạng thái, địa chỉ và ba số liệu nhanh: số phòng, số phòng đang thuê, số dịch vụ đang áp dụng. Có lối tắt để xem danh sách phòng của tòa này, xem hợp đồng, hoặc vào thẳng màn hình đọc chỉ số điện nước tháng hiện tại.

### Tạo/sửa tòa nhà

Form chia thành các phần: thông tin cơ bản, thông tin chủ sở hữu, cấu hình giá billing mặc định (điện/nước), và lịch vận hành (năm/tháng bắt đầu vận hành — dùng để giới hạn các kỳ billing/báo cáo hợp lệ). Khi tạo mới, có thêm mục tạo nhanh một số phòng ngay trong cùng form.

Form tự lưu nháp vào trình duyệt trong lúc bạn nhập; nếu rời trang giữa chừng, lần sau mở lại form sẽ có banner đề nghị khôi phục dữ liệu đã nhập dở. Rời trang khi có thay đổi chưa lưu sẽ có cảnh báo xác nhận.

### Xóa hoặc lưu trữ tòa nhà

Xóa một tòa nhà còn phòng hoặc còn hợp đồng đang hoạt động sẽ bị từ chối và hệ thống đề nghị **"Lưu trữ thay vì xoá"** — chuyển tòa nhà sang trạng thái lưu trữ thay vì xóa hẳn, giữ nguyên toàn bộ lịch sử.

## Quản Lý Phòng

Routes: `/rooms` (danh sách), `/rooms/create`, `/rooms/[id]` (chi tiết), `/rooms/[id]/edit`.

Trạng thái phòng: **trống**, **đang thuê**, **bảo trì**, **đã lưu trữ**. Trạng thái đang thuê/trống được hệ thống tự cập nhật theo vòng đời hợp đồng — tạo hợp đồng hoạt động sẽ chuyển phòng sang đang thuê; kết thúc hoặc hết hạn hợp đồng sẽ trả phòng về trống (trừ khi phòng đang ở trạng thái bảo trì).

### Danh sách phòng

Tìm kiếm, lọc theo tòa nhà, tầng, trạng thái; sắp xếp theo số phòng/tầng/giá thuê/ngày tạo. Admin có thể chọn nhiều phòng để đánh dấu trống, đưa vào bảo trì, lưu trữ hoặc xóa hàng loạt; xóa hàng loạt bắt buộc nhập lý do.

### Chi tiết phòng

Hiển thị định danh phòng, trạng thái, tòa nhà, hợp đồng đang hoạt động (nếu có), số người ở, số đồng hồ điện/nước đang theo dõi. Có các mục: hợp đồng đang hoạt động, lịch sử chỉ số, lịch sử hợp đồng, và khu vực xóa/lưu trữ (chỉ admin).

### Xóa hoặc lưu trữ phòng

Không thể xóa phòng đang có hợp đồng hoạt động hoặc còn lịch sử chỉ số điện nước — hệ thống hiển thị rõ lý do chặn và đề nghị lưu trữ thay vì xóa. Xóa/lưu trữ đều yêu cầu nhập lý do.
