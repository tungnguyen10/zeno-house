# Hướng Dẫn Dùng AI Billing Assistant

AI Billing Assistant giúp owner và manager vận hành kỳ billing bằng hội thoại. Trợ lý có thể đọc dữ liệu trong phạm vi được cấp quyền, chuẩn bị thao tác và giải thích kết quả. Hệ thống backend vẫn là nơi kiểm tra quyền, tính tiền, xác thực dữ liệu và ghi nhận audit.

## Trước Khi Bắt Đầu

- Bạn phải đăng nhập và có quyền với building cần thao tác. Trợ lý không thể xem hoặc dò building ngoài scope của bạn.
- AI chat và từng nhóm thao tác có thể đang được tắt trong quá trình rollout. Nếu nút chat không xuất hiện hoặc nhận thông báo trợ lý tạm dừng, hãy liên hệ admin vận hành.
- Dữ liệu billing như giá điện nước, hợp đồng đang hoạt động và chỉ số trước đó nên được cấu hình đầy đủ trước khi phát hành.

## Cách Dùng Chat Và Action Card

1. Nhấn nút chat ở góc phải dưới màn hình.
2. Gõ yêu cầu bằng ngôn ngữ tự nhiên, có thể dùng tên, slug hoặc mã building khi phù hợp.
3. Đọc phản hồi, cảnh báo và action card do trợ lý tạo.
4. Kiểm tra kỹ nội dung trên action card rồi nhấn **Xác nhận** để thực hiện, hoặc **Hủy** để bỏ kế hoạch.

Chat không phải là lệnh ghi dữ liệu. Những câu như “xác nhận đi”, “cứ phát hành luôn” hoặc “bỏ qua cảnh báo” không thể tự thực hiện thao tác. Chỉ nút **Xác nhận** trên action card mới gửi yêu cầu ghi dữ liệu đến hệ thống.

Nếu building có tên trùng nhau trong phạm vi của bạn, trợ lý sẽ yêu cầu làm rõ. Hãy trả lời bằng slug, mã hoặc mô tả đủ cụ thể thay vì chọn ngầm một building.

## Quy Trình Billing Hằng Tháng

### 1. Mở kỳ

Ví dụ:

> Mở kỳ tháng 7/2026 cho building Zeno House Quận 7.

Trợ lý kiểm tra building và kỳ hiện có, sau đó tạo action card nếu kỳ chưa được mở. Xác nhận card để tạo kỳ. Nếu kỳ đã tồn tại, hệ thống trả về kỳ hiện có và không tạo bản ghi trùng.

### 2. Kiểm tra và nhập chỉ số điện nước

Để xem tiến độ:

> Kiểm tra chỉ số điện nước kỳ tháng 7/2026 của Zeno House Quận 7.

Để nhập hàng loạt, gửi yêu cầu và dán bảng chỉ số trong **cùng một tin nhắn**. Dòng tiêu đề phải có cột phòng và ít nhất một cột điện hoặc nước. Có thể ngăn cột bằng tab, dấu phẩy hoặc chấm phẩy; số thập phân dùng dấu chấm.

Ví dụ:

```text
Nhập chỉ số kỳ tháng 7/2026 cho Zeno House Quận 7:
Phòng;Điện;Nước
101;1250.5;88
102;980;73.5
103;1102;91
```

Trợ lý chỉ đọc bảng đã dán để tạo preview; không tự chép hoặc làm tròn lại số. Preview sẽ phân loại:

- **Blocker**: sai định dạng số, thiếu phòng, phòng không tìm thấy hoặc mơ hồ, dòng trùng, không có dữ liệu, kỳ không hợp lệ hoặc đang bị khóa.
- **Warning**: bỏ trống một loại chỉ số, chỉ số giảm hoặc mức tăng bất thường.

Sửa toàn bộ blocker trước. Khi preview không còn blocker, kiểm tra số dòng và cảnh báo rồi xác nhận action card. Một lần xác nhận ghi toàn bộ dữ liệu hợp lệ trong một transaction; sẽ không có lưu một phần.

### 3. Sửa một chỉ số hoặc usage override

Ví dụ sửa chỉ số đã có:

> Sửa chỉ số điện phòng 101 kỳ tháng 7/2026 thành 1260 vì đã nhập thiếu.

Trợ lý hiển thị giá trị trước/sau và tạo kế hoạch có kiểm tra phiên bản dữ liệu. Nếu ai đó đã sửa cùng dữ liệu trước khi bạn xác nhận, action sẽ báo xung đột; hãy tải lại hoặc yêu cầu preview mới.

Khi chỉ số meter không phản ánh lượng dùng thực tế, có thể yêu cầu usage override:

> Đặt usage điện 45 kWh cho phòng 101, kỳ tháng 7/2026, lý do đồng hồ bị lỗi.

Không thể sửa chỉ số hoặc override khi kỳ đã chốt hoặc phòng đã có hóa đơn hiệu lực, trừ khi bạn thực hiện correction theo luồng phù hợp.

### 4. Xem billing draft

Ví dụ:

> Tính và giải thích billing draft kỳ tháng 7/2026 cho Zeno House Quận 7.

Trợ lý trả về tổng tiền và các blocker/warning do billing engine tính trên server. Đây là thao tác chỉ đọc: AI không tự tính lại tiền và không ghi draft.

Nếu draft bị chặn, hãy xử lý chỉ số, biểu giá hoặc dữ liệu hợp đồng trước khi phát hành.

### 5. Preview và phát hành hóa đơn

Ví dụ phát hành tất cả hóa đơn đủ điều kiện:

> Xem trước và phát hành hóa đơn kỳ tháng 7/2026 cho Zeno House Quận 7.

Hoặc chỉ chọn một vài hợp đồng:

> Chỉ phát hành hóa đơn cho hợp đồng CT-001 và CT-002 trong kỳ tháng 7/2026.

Trợ lý tạo preview từ draft mới nhất trên server, hiển thị các mục có thể phát hành, bị chặn hoặc đã có hóa đơn. Tổng tiền và charge lines luôn do server tính; không thể yêu cầu AI thay đổi chúng bằng chat.

Khi xác nhận, hệ thống kiểm tra lại preview. Nếu chỉ số, draft hoặc trạng thái hóa đơn thay đổi, action card trở thành stale và không phát hành gì. Hãy yêu cầu preview mới. Retry cùng action đã thành công sẽ trả lại kết quả cũ, không tạo hóa đơn hay audit trùng.

### 6. Void, reissue và điều chỉnh hóa đơn đã thanh toán

**Void hóa đơn chưa có thanh toán**:

> Hủy hóa đơn INV-2026-07-0001 vì nhập sai chỉ số điện.

Trợ lý chỉ cho phép void hóa đơn chưa có khoản thu hiệu lực và kỳ chưa bị khóa. Xác nhận xong, có thể yêu cầu reissue:

> Phát hành lại hóa đơn thay thế cho INV-2026-07-0001.

Reissue luôn tính lại draft mới nhất và không tạo replacement nếu đã có hóa đơn hiệu lực cho cùng hợp đồng/kỳ.

**Hóa đơn đã thu một phần hoặc toàn bộ**:

> Tạo điều chỉnh -50.000 đồng cho hóa đơn INV-2026-07-0002, lý do giảm tiền nước tính nhầm.

Action card hiển thị tổng trước/sau, số dư và trạng thái. Adjustment chỉ thêm charge điều chỉnh; không tự undo, xóa, chuyển hay hoàn tiền payment. Nếu khoản thu sai, hãy dùng luồng undo payment của billing workspace trước, sau đó xử lý void/reissue khi phù hợp.

## Khi Có Cảnh Báo Hoặc Lỗi

| Tình huống | Cách xử lý |
| --- | --- |
| Building mơ hồ | Trả lời bằng slug, mã hoặc tên đầy đủ hơn. |
| Chỉ số bị blocker | Sửa dữ liệu dán, phòng, ngày/kỳ hoặc dữ liệu nguồn rồi preview lại. |
| Action báo stale hoặc conflict | Không bấm lại card cũ; yêu cầu trợ lý tạo preview/kế hoạch mới. |
| Kỳ đã chốt hoặc bị khóa | Không sửa trực tiếp qua AI; dùng quy trình reopen/correction có quyền phù hợp. |
| Hóa đơn đã có payment | Dùng explicit adjustment hoặc undo payment trước khi void/reissue; AI không tự thay đổi payment. |
| Thao tác bị từ chối quyền | Kiểm tra building scope và capability của tài khoản; liên hệ owner/admin khi cần. |
| Báo thao tác quá nhanh | Chờ theo thời gian được thông báo rồi gửi lại yêu cầu. |
| Trợ lý tạm dừng hoặc không phản hồi | Đợi và thử lại; nếu tiếp diễn, liên hệ admin vận hành để kiểm tra rollout hoặc trạng thái dịch vụ. |

## Những Điều Trợ Lý Không Làm

- Không tự xác nhận hoặc ghi dữ liệu chỉ từ nội dung chat.
- Không xem, tìm hoặc suy đoán dữ liệu của building ngoài quyền của bạn.
- Không bỏ qua validation, khóa kỳ, version conflict hoặc audit.
- Không tự quyết định tổng tiền, charge lines, trạng thái hóa đơn hay payment.
- Không duyệt hoàn tiền, undo payment, chuyển payment hoặc gọi dịch vụ bên ngoài.

Để xem chi tiết kỹ thuật, quyền, cấu hình rollout và xử lý sự cố vận hành, xem [AI Agent Architecture](../architecture/ai-agent.md). Quy tắc billing nền tảng nằm trong [Billing And Monthly Operations](billing.md).
