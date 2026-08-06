# Trợ Lý AI

Trợ lý AI giúp bạn vận hành billing bằng hội thoại tự nhiên: mở kỳ, nhập/sửa chỉ số, xem draft, phát hành hóa đơn, ghi thu, hủy/phát hành lại hóa đơn. Trợ lý chỉ chuẩn bị và giải thích thao tác — mọi kiểm tra quyền, tính tiền, xác thực dữ liệu và ghi log vẫn do hệ thống backend đảm nhiệm như khi bạn thao tác trực tiếp trên giao diện billing (xem [Vận hành billing và hóa đơn](billing-and-invoices.md)).

## Trước Khi Dùng

- Bạn cần đăng nhập và có quyền với tòa nhà muốn thao tác; trợ lý không thể xem hoặc dò tòa nhà ngoài phạm vi của bạn.
- Tính năng này có thể đang tắt trong giai đoạn triển khai dần. Nếu không thấy nút chat, hoặc trợ lý báo tạm dừng, liên hệ admin vận hành.
- Chỉ số điện/nước, hợp đồng đang hoạt động và giá điện/nước của tòa nhà nên được cấu hình đầy đủ trước khi nhờ trợ lý phát hành hóa đơn.

## Cách Dùng

1. Nhấn nút chat ở góc dưới bên phải màn hình.
2. Gõ yêu cầu bằng ngôn ngữ tự nhiên; có thể dùng tên, mã hoặc slug tòa nhà khi cần phân biệt.
3. Đọc kỹ phản hồi và **action card** (thẻ thao tác) do trợ lý tạo ra.
4. Nhấn **Xác nhận** trên action card để thực sự thực hiện thao tác, hoặc **Hủy** để bỏ.

**Chat không phải là lệnh ghi dữ liệu.** Những câu như "xác nhận đi", "cứ phát hành luôn" không tự thực hiện gì cả — chỉ nút **Xác nhận** trên action card mới gửi yêu cầu ghi dữ liệu. Nếu tòa nhà có tên trùng nhau trong phạm vi của bạn, trợ lý sẽ hỏi lại để bạn làm rõ bằng slug/mã/tên đầy đủ hơn.

## Những Việc Trợ Lý Có Thể Làm

- **Mở kỳ mới**: "Mở kỳ tháng 7/2026 cho building Zeno House Quận 7." Nếu kỳ đã tồn tại, trợ lý trả về kỳ hiện có, không tạo trùng.
- **Nhập chỉ số hàng loạt**: dán một bảng chỉ số ngay trong tin nhắn (có cột phòng và ít nhất một cột điện/nước). Trợ lý chỉ đọc đúng bảng đã dán, không tự chép hay làm tròn số, và phân loại rõ **lỗi chặn** (phải sửa trước) và **cảnh báo** (không chặn nhưng nên kiểm tra).
- **Sửa một chỉ số hoặc đặt usage override**: ví dụ "Sửa chỉ số điện phòng 101 kỳ tháng 7/2026 thành 1260 vì nhập thiếu." Không thể sửa/override khi kỳ đã chốt hoặc phòng đã có hóa đơn hiệu lực.
- **Xem billing draft**: tính và giải thích số tiền dự kiến — đây là thao tác chỉ đọc, không ghi gì.
- **Xem trước và phát hành hóa đơn**: cho toàn bộ hoặc một vài hợp đồng cụ thể trong kỳ.
- **Ghi thu**: cho một phòng, danh sách phòng, hoặc toàn bộ phòng còn nợ của một tòa. Trợ lý luôn thu đủ số dư còn lại (không hỗ trợ thu một phần qua chat) và mặc định phương thức tiền mặt nếu bạn không nói rõ.
- **Hủy, phát hành lại, hoặc điều chỉnh hóa đơn đã thu**: hủy chỉ áp dụng cho hóa đơn chưa có thanh toán; hóa đơn đã thu một phần/toàn bộ chỉ có thể tạo khoản điều chỉnh (không tự hoàn tác thanh toán).

## Khi Gặp Cảnh Báo Hoặc Lỗi

| Tình huống | Cách xử lý |
| --- | --- |
| Tòa nhà mơ hồ (trùng tên) | Trả lời bằng slug, mã hoặc tên đầy đủ hơn |
| Chỉ số bị chặn (blocker) | Sửa dữ liệu đã dán, kiểm tra phòng/ngày/kỳ rồi yêu cầu xem trước lại |
| Action báo dữ liệu cũ hoặc xung đột | Không bấm lại action card cũ; yêu cầu trợ lý tạo bản xem trước/kế hoạch mới |
| Kỳ đã chốt hoặc bị khóa | Không sửa qua AI; dùng đúng quy trình mở lại kỳ có phân quyền phù hợp |
| Phòng đã ghi thu rồi | Trợ lý chỉ báo lại tình trạng, không tạo action mới |
| Hóa đơn đã có thanh toán cần sửa | Dùng điều chỉnh hoặc hoàn tác thanh toán trên giao diện billing trước khi hủy/phát hành lại |
| Bị từ chối do thiếu quyền | Kiểm tra phạm vi tòa nhà và quyền của tài khoản; liên hệ owner/admin nếu cần |
| Trợ lý tạm dừng hoặc không phản hồi | Thử lại sau; nếu vẫn tiếp diễn, liên hệ admin vận hành |

## Những Điều Trợ Lý Không Làm

- Không tự xác nhận hoặc ghi dữ liệu chỉ từ nội dung chat — luôn cần bấm **Xác nhận** trên action card.
- Không xem hoặc suy đoán dữ liệu ngoài phạm vi tòa nhà của bạn.
- Không tự quyết định tổng tiền, các khoản phí hay trạng thái hóa đơn — toàn bộ số tiền do server tính và khóa.
- Không hoàn tiền, hoàn tác thanh toán, chuyển thanh toán, hoặc gọi ra dịch vụ bên ngoài hệ thống.

Để biết chi tiết từng bước thao tác billing đầy đủ hơn (không qua AI), xem [Vận hành billing và hóa đơn](billing-and-invoices.md). Tài liệu kỹ thuật chi tiết hơn về trợ lý AI nằm ở [docs/features/ai-billing-assistant.md](../features/ai-billing-assistant.md).
