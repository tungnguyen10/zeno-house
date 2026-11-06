# Xóa chi phí trả trước theo kỳ hiệu lực

## Mục tiêu

Cho phép người có quyền xóa một chi phí trả trước mà không làm thay đổi số liệu của các kỳ vận hành cũ. Thao tác trong tháng 08/2026 giữ nguyên phân bổ của 06–07/2026 và loại khoản đó khỏi báo cáo từ 08/2026. UI phải xác nhận rõ tác động trước khi gửi yêu cầu.

Đồng thời, client phải giữ lại thông báo lỗi nghiệp vụ từ API thay vì ghi đè lỗi 409 thành thông báo kết nối chung.

## Hành vi nghiệp vụ

- Kỳ ngừng phân bổ là tháng hiện tại tại server theo múi giờ `Asia/Ho_Chi_Minh`.
- Nếu chi phí đã có thời gian hiệu lực trước kỳ ngừng, thao tác xóa trở thành hủy theo kỳ hiệu lực:
  - giữ nguyên `total_amount`, `total_months`, `monthly_amount` và ngày bắt đầu;
  - đặt `end_date` thành ngày đầu của kỳ ngừng;
  - đặt trạng thái `cancelled`;
  - không chặn thao tác chỉ vì có báo cáo đã chốt trước kỳ ngừng.
- Báo cáo trước `end_date` vẫn bao gồm khoản phân bổ, kể cả khi bản ghi có trạng thái `cancelled`.
- Báo cáo từ `end_date` trở đi không bao gồm khoản phân bổ.
- Nếu khoản chưa có kỳ phân bổ nào trước kỳ ngừng, hệ thống xóa vật lý vì không có lịch sử cần bảo toàn.
- Không kỳ đã chốt nào được mở lại hoặc tính lại như một phần của thao tác này.
- Audit ghi nhận đầy đủ dữ liệu trước và sau. Hủy theo kỳ hiệu lực vẫn dùng hành động xóa hiện có, với `after_data` thể hiện trạng thái `cancelled` và `end_date` mới.

## API và dữ liệu

Endpoint giữ nguyên:

```text
DELETE /api/prepaid-expenses/:id
```

Service xác thực capability và building scope như hiện tại, sau đó xác định ngày đầu tháng hiện tại tại `Asia/Ho_Chi_Minh`.

- Nếu `start_date < cancellation_period_start < end_date`, repository cập nhật bản ghi thành `cancelled` và rút ngắn `end_date`.
- Nếu `cancellation_period_start <= start_date`, repository xóa bản ghi.
- Bản ghi `expired` hoặc `cancelled` là lịch sử chỉ đọc và không cung cấp lại thao tác xóa.

Truy vấn snapshot báo cáo được đổi từ điều kiện chỉ nhận `status = active` sang điều kiện cửa sổ hiệu lực. Trạng thái `cancelled` không tự loại khoản khỏi các tháng trước ngày hủy; `start_date <= period_start < end_date` là nguồn quyết định khoản có đóng góp hay không.

Không thêm bảng hay hệ thống snapshot mới. Schema hiện có đã hỗ trợ trạng thái `cancelled` và cửa sổ `start_date`/`end_date`.

## UI xác nhận

Nút xóa trên danh sách chi phí trả trước chỉ mở `UiConfirmModal`; không gọi API ngay.

Modal hiển thị:

- Tiêu đề: `Xóa chi phí trả trước?`
- Nội dung: `Xóa “<tên>”? Số liệu các kỳ đã chốt được giữ nguyên. Khoản này sẽ ngừng phân bổ từ MM/YYYY.`
- Nút xác nhận: `Xóa và ngừng phân bổ`
- Nút hủy dùng hành vi chuẩn của primitive.

Trong lúc gửi yêu cầu, nút xác nhận có loading state và modal không phát sinh yêu cầu lặp. Khi thành công, đóng modal, làm mới danh sách và hiển thị toast thành công. Khi thất bại, giữ ngữ cảnh danh sách và hiển thị thông báo API chuẩn.

Sau khi làm mới, bản ghi vẫn xuất hiện với nhãn `Đã hủy` để người vận hành tra cứu lịch sử; nút xóa chỉ xuất hiện với bản ghi `active`.

Trên mobile, modal dùng primitive hiện có nên giữ focus trap, Escape, phục hồi focus và bố cục responsive theo design system.

## Chuẩn hóa lỗi client

`apiFetch` phải nhận diện cả hai dạng lỗi:

- envelope chuẩn trực tiếp tại `error.data.error`;
- envelope Nitro lồng tại `error.data.data.error`.

Nếu tìm thấy lỗi API chuẩn, client chuẩn hóa hoặc chuyển tiếp nó để `resolveApiError` đọc đúng `code`, `message` và `details`. Chỉ lỗi mạng hoặc timeout thật sự mới dùng thông báo `Yêu cầu mất quá nhiều thời gian hoặc kết nối bị gián đoạn.`

## Đặc tả cần cập nhật

- `prepaid-expenses`: thêm kịch bản xóa theo kỳ hiệu lực và giữ phân bổ lịch sử.
- `operations-report`: thêm ngoại lệ cho thao tác hủy chi phí trả trước từ kỳ mở hiện tại; kỳ đã chốt trước đó không bị thay đổi.

## Kiểm thử

- Service test: khoản bắt đầu trước tháng hiện tại được cập nhật thành `cancelled`, `end_date` là đầu tháng hiện tại và không bị khóa bởi kỳ đã chốt cũ.
- Service test: khoản bắt đầu từ tháng hiện tại hoặc tương lai được xóa vật lý.
- Report/repository test: khoản `cancelled` vẫn xuất hiện trước `end_date` và không xuất hiện từ `end_date`.
- UI test: nhấn biểu tượng xóa chỉ mở modal; API chỉ được gọi sau confirm; modal hiển thị đúng tên và kỳ ngừng.
- UI test: bản ghi `cancelled` hoặc `expired` không còn nút xóa và bản ghi vừa hủy được giữ trong danh sách lịch sử.
- API fetch test: lỗi 409 trong envelope Nitro giữ nguyên thông báo nghiệp vụ; lỗi mạng không có envelope vẫn dùng thông báo kết nối chung.
- Chạy test hẹp trước, sau đó OpenSpec validation, typecheck và lint/test phù hợp với phạm vi thay đổi.

## Phạm vi không thực hiện

- Không xây hệ thống snapshot báo cáo toàn phần.
- Không tự động mở lại hoặc đóng lại báo cáo vận hành.
- Không thay đổi quyền quản lý chi phí trả trước.
- Không thay đổi design system hay tạo UI primitive mới.
