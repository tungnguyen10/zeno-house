# Bắt Đầu Sử Dụng

Hướng dẫn này dành cho nhân viên nội bộ (admin, chủ nhà/owner, quản lý/manager) sử dụng khu vực `/dashboard`. Nếu bạn là khách thuê dùng cổng thông tin `/portal`, tài liệu này không áp dụng.

## Vai Trò Và Phạm Vi

Zeno House có ba vai trò nội bộ:

| Vai trò | Phạm vi | Có thể làm gì |
| --- | --- | --- |
| **Admin** | Toàn hệ thống, không giới hạn tòa nhà | Mọi thao tác, gồm cả quản lý người dùng, duyệt yêu cầu truy cập, xem nhật ký hoạt động, xóa dữ liệu nhạy cảm |
| **Owner (chủ nhà)** | Chỉ các tòa nhà được gán | Vận hành đầy đủ trong phạm vi của mình: tạo quản lý, cấu hình tòa nhà/dịch vụ, billing, báo cáo, chi phí dùng chung, quỹ dự phòng |
| **Manager (quản lý)** | Chỉ các tòa nhà được gán | Vận hành hằng ngày (phòng, khách thuê, hợp đồng, chỉ số, billing) nhưng không có thao tác phá hủy dữ liệu hoặc quản trị hệ thống |

Nếu bạn không thấy một nút hoặc trang trong hướng dẫn này, nhiều khả năng tài khoản của bạn không có quyền cho thao tác đó — đây là hành vi đúng theo thiết kế, không phải lỗi.

## Đăng Nhập

1. Vào trang đăng nhập, nhập email và mật khẩu, hoặc chọn đăng nhập bằng Google.
2. Sau khi đăng nhập thành công, hệ thống tự chuyển bạn đến đúng khu vực theo vai trò (nội bộ vào `/dashboard`, khách thuê vào `/portal`).

### Quên Mật Khẩu

1. Từ trang đăng nhập, chọn quên mật khẩu và nhập email.
2. Kiểm tra email để nhận liên kết đặt lại mật khẩu.
3. Đặt mật khẩu mới; hệ thống đăng xuất phiên khôi phục và đưa bạn về lại trang đăng nhập để đăng nhập bằng mật khẩu mới.

### Tài Khoản Đang Chờ Duyệt

Nếu bạn vừa đăng ký (hoặc đăng nhập Google lần đầu) và chưa được admin gán vai trò, bạn sẽ thấy màn hình chờ duyệt. Màn hình này tự kiểm tra định kỳ trong lúc bạn đang mở trang; khi được duyệt, hệ thống tự chuyển bạn vào đúng khu vực làm việc. Nếu yêu cầu bị từ chối, màn hình hiển thị lý do và bạn cần liên hệ admin — luồng đăng ký lại từ đầu chưa được hỗ trợ.

## Điều Hướng Dashboard

Sau khi đăng nhập, bạn sẽ thấy:

- **Trang tổng quan** (`/dashboard`): số liệu nhanh về số tòa nhà, tình trạng phòng, số hợp đồng đang hoạt động, số khách thuê.
- **Menu bên** dẫn đến các khu vực chính: Tòa nhà, Phòng, Khách thuê, Hợp đồng, Vận hành tháng (billing), Hóa đơn, Báo cáo vận hành, Chi phí dùng chung, và (với admin/owner) mục Cài đặt.
- **Trợ lý AI**: nút chat ở góc dưới bên phải màn hình (nếu đang bật) — xem chi tiết ở [Trợ lý AI](ai-assistant.md).

Các trang danh sách (tòa nhà, phòng, khách thuê, hợp đồng, hóa đơn...) đều có ô tìm kiếm, bộ lọc và sắp xếp; trạng thái lọc được lưu trên đường dẫn URL nên bạn có thể sao chép liên kết để chia sẻ đúng danh sách đang xem.

## Xem Tiếp

- [Quản lý truy cập và người dùng](access-management.md) — dành cho admin/owner.
- [Tòa nhà và phòng](buildings-and-rooms.md)
- [Khách thuê và hợp đồng](tenants-and-contracts.md)
- [Dịch vụ và chỉ số điện nước](services-and-meters.md)
- [Vận hành billing và hóa đơn](billing-and-invoices.md)
- [Chi phí và báo cáo vận hành](expenses-and-reports.md)
- [Trợ lý AI](ai-assistant.md)
