# Dịch Vụ Và Chỉ Số Điện Nước

## Danh Mục Dịch Vụ

Hệ thống có sẵn danh mục dịch vụ dùng chung (internet, rác, gửi xe, vệ sinh, thang máy, phụ thu, khác...). Nếu một tòa nhà cần dịch vụ ngoài danh mục sẵn có, bạn có thể tạo thêm dịch vụ riêng cho tòa nhà đó ngay trong màn hình cài đặt tòa nhà — dịch vụ riêng này chỉ hiển thị khi làm việc với tòa nhà đó.

## Dịch Vụ Mặc Định Của Tòa Nhà

Route: `/buildings/[id]/settings`.

Mỗi tòa nhà cấu hình danh sách dịch vụ mặc định: bật/tắt, số tiền, loại tính giá. Đây là bộ giá trị "chuẩn" — khi tạo hợp đồng mới, các dịch vụ này được sao chép vào hợp đồng, và có thể chỉnh riêng cho từng hợp đồng sau đó (xem [Hợp đồng](tenants-and-contracts.md#hợp-đồng)).

Nếu bạn cập nhật dịch vụ mặc định sau khi đã có hợp đồng đang hoạt động, dùng chức năng **đồng bộ** trong cài đặt tòa nhà để thêm các dòng dịch vụ còn thiếu vào những hợp đồng đang hoạt động — thao tác này chỉ bổ sung dòng thiếu, không ghi đè những dịch vụ đã được tùy chỉnh riêng cho hợp đồng.

## Nhập Chỉ Số Điện Nước

Route: `/buildings/[id]/meter-readings`.

Mỗi chỉ số được ghi theo phòng, loại đồng hồ (điện/nước), năm-tháng và loại lần đọc:

- **monthly** — chỉ số đọc hằng tháng, dùng để tính hóa đơn.
- **handover_in** — chỉ số bàn giao lúc bắt đầu hợp đồng (ghi khi tạo hợp đồng).
- **handover_out** — chỉ số bàn giao lúc kết thúc hợp đồng.

Màn hình này dùng cho việc nhập/soát chỉ số **monthly** hằng tháng, thường thực hiện ngay từ tab **Soạn kỳ** trong màn hình vận hành billing (xem [Vận hành billing và hóa đơn](billing-and-invoices.md)) — có thể nhập từng phòng hoặc dùng **Nhập nhanh** để dán nhiều dòng cùng lúc.

### Những điều cần lưu ý khi nhập chỉ số

- Chỉ số mới phải lớn hơn hoặc bằng chỉ số bàn giao/tháng trước gần nhất; nếu nhập số nhỏ hơn (ví dụ thay đồng hồ mới) hệ thống sẽ cảnh báo, không tự động chặn nhưng bạn nên kiểm tra kỹ.
- Không thể sửa chỉ số của một kỳ đã bị khóa (đã chốt) hoặc của một phòng đã có hóa đơn hiệu lực trong kỳ đó — trường hợp này cần dùng đúng quy trình mở lại kỳ hoặc điều chỉnh hóa đơn có phân quyền phù hợp.
- Khi chỉ số cho thấy mức tiêu thụ âm hoặc bất thường (ví dụ đồng hồ hỏng), dùng chức năng **usage override** (đặt mức tiêu thụ thủ công) thay vì cố sửa chỉ số gốc — usage override có ghi rõ lý do và không làm mất lịch sử chỉ số thật.

## Ảnh Hưởng Đến Billing

Khi tính hóa đơn hằng tháng, hệ thống ưu tiên dùng chỉ số tháng trước; nếu không có, dùng chỉ số bàn giao làm mốc thay thế. Tiêu thụ âm sẽ chặn phát hành hóa đơn của phòng đó cho tới khi được xử lý bằng usage override.
