# Hướng Dẫn Sử Dụng Zeno House

Đây là hướng dẫn sử dụng dành cho **nhân viên nội bộ** (admin, chủ nhà/owner, quản lý/manager) làm việc trong khu vực `/dashboard`. Tài liệu tập trung vào cách sử dụng từng tính năng theo góc nhìn người dùng; nếu cần chi tiết kỹ thuật (API, database, kiến trúc), xem [docs/features/**](../features/) và [docs/architecture/**](../architecture/).

Zeno House là ứng dụng vận hành nhà cho thuê: quản lý tòa nhà/phòng, khách thuê, hợp đồng, dịch vụ và chỉ số điện nước, billing hằng tháng, thu hồi công nợ, chi phí vận hành và báo cáo lợi nhuận.

## Vai Trò Người Dùng

| Vai trò | Phạm vi |
| --- | --- |
| Admin | Toàn hệ thống, không giới hạn tòa nhà, có thêm quyền quản trị (duyệt truy cập, quản lý người dùng, nhật ký hoạt động) |
| Owner (chủ nhà) | Vận hành đầy đủ trong các tòa nhà được gán |
| Manager (quản lý) | Vận hành hằng ngày trong các tòa nhà được gán, không có thao tác phá hủy dữ liệu hoặc quản trị hệ thống |

Chi tiết xem [Bắt đầu sử dụng](getting-started.md#vai-trò-và-phạm-vi).

## Mục Lục

1. [Bắt đầu sử dụng](getting-started.md) — đăng nhập, quên mật khẩu, tài khoản chờ duyệt, điều hướng dashboard.
2. [Quản lý truy cập và người dùng](access-management.md) — duyệt yêu cầu truy cập, tạo/gán quản lý, tài khoản khách thuê, nhật ký hoạt động.
3. [Tòa nhà và phòng](buildings-and-rooms.md) — trang tổng quan, quản lý tòa nhà và phòng.
4. [Khách thuê và hợp đồng](tenants-and-contracts.md) — quản lý khách thuê, tạo/gia hạn/kết thúc hợp đồng.
5. [Dịch vụ và chỉ số điện nước](services-and-meters.md) — danh mục dịch vụ, dịch vụ mặc định tòa nhà, nhập chỉ số.
6. [Vận hành billing và hóa đơn](billing-and-invoices.md) — mở kỳ, nhập chỉ số, phát hành, thu tiền, đóng kỳ, in/gửi email hóa đơn.
7. [Chi phí và báo cáo vận hành](expenses-and-reports.md) — báo cáo lợi nhuận, chi phí cố định/phát sinh, chi phí dùng chung, quỹ dự phòng.
8. [Trợ lý AI](ai-assistant.md) — vận hành billing bằng hội thoại tự nhiên.

## Phạm Vi Tài Liệu

- Tài liệu này **không** bao gồm cổng thông tin khách thuê (`/portal`) — đó là trải nghiệm dành cho khách thuê, không phải nhân viên nội bộ.
- Tài liệu này **không** thay thế `docs/features/*.md` — các file đó vẫn là tài liệu tham chiếu kỹ thuật (route API, cấu trúc dữ liệu, quy tắc nghiệp vụ chi tiết) cho đội phát triển.
