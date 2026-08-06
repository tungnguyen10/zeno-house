# Quản Lý Truy Cập Và Người Dùng

Các màn hình trong chương này nằm trong mục **Cài đặt** và chủ yếu dành cho admin; một số phần owner cũng dùng được. Manager không thấy mục này.

## Duyệt Yêu Cầu Truy Cập

Route: `/dashboard/settings/access-requests` — chỉ admin.

Khi ai đó đăng ký tài khoản mới (email/password hoặc đăng nhập Google lần đầu) mà chưa có vai trò, yêu cầu của họ xuất hiện ở đây với trạng thái **Chờ duyệt**.

Mỗi dòng hiển thị họ tên (hoặc "Chưa cung cấp tên"), email, cảnh báo **"Email chưa xác minh"** nếu email chưa được xác thực, nguồn đăng nhập, ngày gửi và trạng thái.

### Duyệt yêu cầu

1. Nhấn **Duyệt** (hoặc **Tiếp tục** nếu yêu cầu đang ở trạng thái cần tiếp tục do lần trước bị gián đoạn).
2. Chọn **Vai trò**: Owner, Manager hoặc Tenant.
   - Với Owner/Manager: chọn ít nhất một **tòa nhà** trong phạm vi tòa nhà.
   - Với Tenant: tìm và chọn đúng **người thuê chưa có tài khoản** (theo tên, mã, số điện thoại hoặc CCCD).
3. Nhấn **Duyệt và cấp quyền**.

Không thể duyệt một danh tính có email chưa xác minh. Nếu quá trình bị gián đoạn giữa chừng (ví dụ lỗi mạng), yêu cầu chuyển sang trạng thái **Cần tiếp tục** — hãy dùng lại đúng quyết định cũ (cùng vai trò/phạm vi) để hệ thống hoàn tất an toàn, không tạo bản ghi trùng.

### Từ chối yêu cầu

1. Nhấn **Từ chối** (chỉ khả dụng khi yêu cầu đang **Chờ duyệt**).
2. Nhập **lý do** (tối thiểu 3 ký tự) để người đăng ký biết cần xử lý gì.
3. Nhấn **Xác nhận từ chối**.

Từ chối là quyết định cuối cùng: người dùng không thể tự đăng ký lại trong phiên bản hiện tại.

## Quản Lý Người Dùng (Managers)

Route: `/dashboard/settings/managers` — admin và owner (owner chỉ thấy phạm vi của mình).

Trang này dùng để tạo tài khoản owner/manager mới và gán họ vào tòa nhà.

### Tạo người dùng mới

1. Điền **Email**, **Mật khẩu** tạm, **Họ tên** (tùy chọn).
2. Chọn **vai trò**: admin/owner thấy cả "Chủ nhà (owner)" và "Quản lý (manager)"; owner chỉ tạo được "Quản lý (manager)".
3. Tùy chọn gán ngay một hoặc nhiều **tòa nhà**.
4. Nhấn **Tạo người dùng**, sau đó tự gửi email/mật khẩu cho người dùng đó — hệ thống không tự gửi.

Nếu có tòa nhà chưa có manager nào, trang hiển thị cảnh báo số lượng tòa nhà đang thiếu người quản lý.

### Gán/bỏ gán tòa nhà và quyền xóa dữ liệu

Mỗi thẻ người dùng liệt kê các tòa nhà đã gán. Với mỗi tòa nhà, bạn có thể:

- Bật/tắt quyền **"Cho xóa dữ liệu"** (cho phép người này thực hiện thao tác xóa nhạy cảm trong phạm vi tòa nhà đó).
- **Bỏ gán** khỏi tòa nhà.

Dùng ô chọn tòa nhà và nút **+ Gán** để gán thêm tòa nhà chưa có.

Nút **Sửa** cho phép đổi email/họ tên/mật khẩu (và vai trò nếu bạn là admin). Nút **Xoá** thu hồi quyền đăng nhập của tài khoản đó — thao tác này cần xác nhận vì không thể hoàn tác.

## Quản Lý Tài Khoản Người Thuê (Tenant Accounts)

Route: `/dashboard/settings/tenant-accounts`.

Trang này cấp và quản lý tài khoản đăng nhập cổng khách thuê (`/portal`) cho những khách thuê đã có hồ sơ trong hệ thống.

### Cấp tài khoản mới

1. Nhấn **+ Cấp tài khoản**.
2. Tìm và chọn khách thuê (theo tên, mã, số điện thoại hoặc CCCD) — trang hiển thị hợp đồng/phòng hiện tại của người này để bạn xác nhận đúng người.
3. Nhập **email đăng nhập**, nhấn **Cấp tài khoản**.
4. Hệ thống hiển thị **mật khẩu tạm chỉ một lần** — sao chép và gửi cho khách thuê ngay, vì màn hình này không hiển thị lại được.

### Các thao tác khác trên một tài khoản

- **Khóa / Mở lại**: tạm khóa hoặc mở lại quyền đăng nhập.
- **Đặt lại mật khẩu**: tạo mật khẩu tạm mới (mật khẩu cũ ngừng hoạt động ngay).
- **Gỡ**: thu hồi quyền truy cập cổng khách thuê. Hệ thống tự xóa tài khoản đăng nhập nếu an toàn, hoặc vô hiệu hóa (giữ lại lịch sử) nếu tài khoản còn dữ liệu tham chiếu.

Nếu cột **Liên kết** hiển thị lỗi (tài khoản đăng nhập không tìm thấy hồ sơ tương ứng), admin có thêm khu vực **"Tài khoản Auth mồ côi"** để kiểm tra và xử lý (xóa hoặc vô hiệu hóa) những tài khoản đăng nhập không còn liên kết tới khách thuê nào.

## Nhật Ký Hoạt Động (Audit History)

Route: `/dashboard/settings/history` — chỉ admin.

Trang này ghi lại mọi thay đổi dữ liệu quan trọng: master data (tòa nhà/phòng/khách thuê), phân quyền, hợp đồng, vận hành billing, và cổng khách thuê.

- Lọc theo **tòa nhà** và **loại đối tượng** (entity type).
- Mỗi sự kiện hiển thị hành động (tạo/sửa/xóa), đối tượng bị tác động, người thực hiện (hoặc "Hệ thống" nếu là tác vụ tự động), và thời gian.
- Nhấn vào một sự kiện để xem chi tiết: bảng **trước/sau** cho từng trường bị thay đổi, hoặc snapshot dữ liệu thô nếu là tạo mới/xóa.
- Nút **Làm mới** để tải lại danh sách; nút **Tải thêm** để xem các sự kiện cũ hơn.

Đây là công cụ để tra soát "ai đã đổi cái gì, khi nào" khi có sai lệch dữ liệu hoặc cần kiểm tra trách nhiệm thao tác.
