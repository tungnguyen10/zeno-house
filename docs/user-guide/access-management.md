---
type: User Guide
title: "access-management"
status: stable
tags: [engineering, reference]
---

# Quản Lý Truy Cập Và Người Dùng

Mọi vai trò đều thấy mục **Cài đặt** trong thanh điều hướng (trên điện thoại, mục này nằm trong menu **Thêm**). Mục này mở `/dashboard/settings` với các nhóm:

| Nhóm | Mục | Ai thấy |
| --- | --- | --- |
| Cá nhân | Hồ sơ, Bảo mật | Mọi vai trò |
| Quản trị | Người dùng, Tài khoản người thuê | Admin và owner |
| Quản trị | Yêu cầu truy cập, Hiển thị tòa nhà, Nhật ký hoạt động | Chỉ admin |
| Tòa nhà | Cài đặt tòa nhà | Mọi vai trò (theo phạm vi tòa nhà của bạn) |

Nhóm không còn mục nào cho vai trò của bạn thì không hiển thị: manager chỉ thấy **Cá nhân** và **Tòa nhà**.

Trên máy tính, danh mục này là thanh điều hướng dọc bên trái nội dung; mục đang mở được đánh dấu. Trên điện thoại, `/dashboard/settings` là danh sách theo nhóm — chạm vào một mục để mở, dùng nút quay lại để về danh sách. Mục **Yêu cầu truy cập** có huy hiệu số yêu cầu đang chờ duyệt (chỉ admin thấy).

## Hồ Sơ Và Bảo Mật

- **Hồ sơ** (`/dashboard/settings/profile`): đổi tên hiển thị và ảnh đại diện (**Đổi ảnh** hoặc kéo thả ảnh JPEG/PNG/WebP, tối đa 2 MB; **Xoá ảnh** để về ảnh mặc định). Email và vai trò chỉ để xem.
- **Bảo mật** (`/dashboard/settings/security`): đổi mật khẩu. Sau khi đổi thành công, bạn ở lại trang này.

Các đường dẫn cũ `/dashboard/profile` và `/dashboard/profile/password` tự chuyển sang hai trang trên.

## Duyệt Yêu Cầu Truy Cập

Route: `/dashboard/settings/access-requests` — chỉ admin.

Khi ai đó đăng ký tài khoản mới (email/password hoặc đăng nhập Google lần đầu) mà chưa có vai trò, yêu cầu của họ xuất hiện ở đây. Chuyển giữa các tab **Chờ duyệt** (có số đếm), **Cần tiếp tục**, **Đã duyệt** và **Đã từ chối** để xem từng hàng đợi.

Mỗi dòng hiển thị họ tên (hoặc "Chưa cung cấp tên"), email, nguồn đăng nhập, ngày gửi và trạng thái. Nếu email chưa được xác thực, nhãn **"Chưa xác minh email"** thay cho nút duyệt.

### Duyệt yêu cầu

1. Nhấn **Duyệt** (hoặc **Tiếp tục** nếu yêu cầu đang ở trạng thái cần tiếp tục do lần trước bị gián đoạn).
2. Chọn **Vai trò**: Owner, Manager hoặc Tenant.
   - Với Owner/Manager: chọn ít nhất một **tòa nhà** trong phạm vi tòa nhà.
   - Với Tenant: tìm và chọn đúng **người thuê chưa có tài khoản** (theo tên, mã, số điện thoại hoặc CCCD).
3. Nhấn **Duyệt và cấp quyền**.

Không thể duyệt một danh tính có email chưa xác minh. Nếu quá trình bị gián đoạn giữa chừng (ví dụ lỗi mạng), yêu cầu chuyển sang trạng thái **Cần tiếp tục** — hãy dùng lại đúng quyết định cũ (cùng vai trò/phạm vi) để hệ thống hoàn tất an toàn, không tạo bản ghi trùng.

### Từ chối yêu cầu

1. Nhấn **Từ chối** (chỉ khả dụng khi yêu cầu đang **Chờ duyệt**; vẫn dùng được kể cả khi email chưa xác minh).
2. Nhập **lý do** (tối thiểu 3 ký tự) để người đăng ký biết cần xử lý gì.
3. Nhấn **Xác nhận từ chối**.

Từ chối là quyết định cuối cùng: người dùng không thể tự đăng ký lại trong phiên bản hiện tại.

## Quản Lý Người Dùng

Route: `/dashboard/settings/managers` — admin và owner (owner chỉ thấy quản lý trong phạm vi của mình).

Trang là một danh sách gọn: mỗi dòng có avatar chữ cái đầu, tên, email, vai trò và số tòa nhà phụ trách (hoặc cảnh báo "Chưa có tòa"). Dùng ô tìm theo tên/email và, với admin, bộ lọc **Tất cả / Chủ nhà / Quản lý**. Nếu có tòa nhà chưa có quản lý nào, một cảnh báo phía trên danh sách nêu số lượng và tên các tòa đó.

### Thêm người dùng

1. Nhấn **Thêm người dùng** để mở hộp thoại.
2. Điền **Email**, **Mật khẩu** tạm, **Họ tên** (tùy chọn).
3. Chọn **vai trò**: admin thấy cả "Chủ nhà" và "Quản lý"; owner chỉ tạo được "Quản lý".
4. Tùy chọn chọn ngay một hoặc nhiều **tòa nhà**.
5. Nhấn tạo. Nếu lỗi, thông báo hiện ngay trong hộp thoại và dữ liệu đã nhập được giữ lại. Hệ thống không tự gửi email — hãy tự gửi email và mật khẩu cho người dùng.

### Ngăn chi tiết người dùng

Chạm vào một dòng để mở ngăn chi tiết (trên điện thoại là bảng trượt từ dưới lên; dòng mà bạn không được quản lý, ví dụ owner khác, không mở được). Trong ngăn:

- **Thông tin**: nhấn **Sửa** để đổi email, họ tên, mật khẩu mới (để trống nếu không đổi) và vai trò (chỉ admin), rồi **Lưu** hoặc **Huỷ**.
- **Tòa nhà phụ trách**: mỗi tòa nhà một dòng, có công tắc **Cho xoá dữ liệu** (cho phép người này thực hiện thao tác xoá nhạy cảm trong tòa nhà đó) và nút **Bỏ gán** (gỡ khỏi tòa nhà, không xoá người dùng). Chọn tòa nhà chưa gán rồi nhấn **Gán** để thêm.
- **Vùng nguy hiểm**: **Xoá người dùng** hiện bước xác nhận ngay trong ngăn; nhấn **Xoá vĩnh viễn** để thu hồi quyền đăng nhập của tài khoản — không thể hoàn tác. Chọn **Huỷ** để quay lại.

Mỗi thao tác có thông báo thành công hoặc lỗi riêng, và ngăn vẫn mở khi có lỗi.

## Quản Lý Tài Khoản Người Thuê (Tenant Accounts)

Route: `/dashboard/settings/tenant-accounts` — admin và owner.

Trang này cấp và quản lý tài khoản đăng nhập cổng khách thuê (`/portal`) cho những khách thuê đã có hồ sơ trong hệ thống. Dùng ô tìm theo tên, mã hoặc email để lọc danh sách.

### Cấp tài khoản mới

1. Nhấn **Cấp tài khoản**.
2. Tìm và chọn khách thuê (theo tên, mã, số điện thoại hoặc CCCD) — trang hiển thị hợp đồng/phòng hiện tại của người này để bạn xác nhận đúng người.
3. Nhập **email đăng nhập**, nhấn **Cấp tài khoản**.
4. Hệ thống hiển thị **mật khẩu tạm chỉ một lần** — sao chép và gửi cho khách thuê ngay, vì màn hình này không hiển thị lại được.

### Menu thao tác của một tài khoản (⋯)

- **Khoá / Mở lại**: tạm khoá hoặc mở lại quyền đăng nhập.
- **Đặt lại mật khẩu**: tạo mật khẩu tạm mới (mật khẩu cũ ngừng hoạt động ngay).
- **Gỡ quyền truy cập**: thu hồi quyền truy cập cổng khách thuê. Hệ thống tự xoá tài khoản đăng nhập nếu an toàn, hoặc vô hiệu hoá (giữ lại lịch sử) nếu tài khoản còn dữ liệu tham chiếu.
- **Dọn liên kết**: thay cho **Gỡ quyền truy cập** ở dòng mà tài khoản đăng nhập không còn tồn tại.

Admin có thêm khu vực **Tài khoản Auth mồ côi** (tài khoản đăng nhập mang vai trò người thuê nhưng không còn liên kết tới hồ sơ người thuê nào). Khi không có mục nào, khu vực chỉ là một dòng trạng thái với nút **Kiểm tra lại**; khi có, mỗi tài khoản có nút **Xử lý tài khoản** để xoá hoặc vô hiệu hoá.

## Hiển Thị Tòa Nhà Và Cài Đặt Tòa Nhà

- **Hiển thị tòa nhà** (`/dashboard/settings/buildings`, chỉ admin): bật/tắt tòa nhà nào đang hiển thị.
- **Cài đặt tòa nhà** (`/dashboard/settings/building-settings`, mọi vai trò): danh sách tòa nhà trong phạm vi của bạn; nhấn **Mở cài đặt** để vào trang cài đặt của từng tòa.

## Nhật Ký Hoạt Động (Audit History)

Route: `/dashboard/settings/history` — chỉ admin.

Trang này ghi lại mọi thay đổi dữ liệu quan trọng: master data (tòa nhà/phòng/khách thuê), phân quyền, hợp đồng, vận hành billing, và cổng khách thuê.

- Lọc theo **tòa nhà** và **loại đối tượng** (entity type).
- Mỗi sự kiện hiển thị hành động (tạo/sửa/xóa), đối tượng bị tác động, người thực hiện (hoặc "Hệ thống" nếu là tác vụ tự động), và thời gian.
- Nhấn vào một sự kiện để xem chi tiết: bảng **trước/sau** cho từng trường bị thay đổi, hoặc snapshot dữ liệu thô nếu là tạo mới/xóa.
- Nút **Làm mới** để tải lại danh sách; nút **Tải thêm** để xem các sự kiện cũ hơn.

Đây là công cụ để tra soát "ai đã đổi cái gì, khi nào" khi có sai lệch dữ liệu hoặc cần kiểm tra trách nhiệm thao tác.
