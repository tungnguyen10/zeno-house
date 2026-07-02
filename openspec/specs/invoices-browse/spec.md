## Purpose
Defines the cross-period invoice browse surface for read-only invoice lookup, filtering, preview, and deep-linking into the monthly operations workspace.

## Requirements

### Requirement: Cross-period invoice browse page
The system SHALL provide a `/invoices` page that lists all invoices the current user has access to, scoped by role (admin: all; manager: invoices belonging to assigned buildings).

#### Scenario: Mount with default filter
- **WHEN** user navigates to `/invoices` without query params
- **THEN** page mặc định filter theo tháng hiện tại (server time, Asia/Ho_Chi_Minh), tất cả building user có quyền, tất cả status
- **AND** danh sách invoice hiển thị tối đa 50 dòng (page 1)

#### Scenario: Empty result shows guidance
- **WHEN** filter trả về 0 invoice
- **THEN** page hiển thị empty state với gợi ý "Đổi tháng / building / mở rộng status"

### Requirement: Filter and search controls
The page SHALL provide filter controls: building (single select, default "tất cả"), month + year picker (single month or "tất cả tháng năm này"), status (multi-select chip: chưa thu / một phần / đã thu / quá hạn / huỷ), tenant search (free-text, search theo tên hoặc số điện thoại).

#### Scenario: Building filter narrows results
- **WHEN** user chọn building B1 từ dropdown
- **AND** trước đó list hiển thị invoice của B1, B2, B3
- **THEN** list chỉ còn invoice thuộc B1

#### Scenario: Multi-status filter
- **WHEN** user tick cả "Chưa thu" và "Quá hạn"
- **THEN** list hiển thị invoice ở 1 trong 2 trạng thái (OR), không phải AND

#### Scenario: Tenant search debounced
- **WHEN** user gõ chuỗi tìm kiếm vào ô tenant search
- **THEN** request gửi sau debounce 300ms (không gửi mỗi keystroke)

#### Scenario: All-months toggle
- **WHEN** user chọn "Tất cả tháng năm này"
- **THEN** filter month bị clear, chỉ giữ year; list mở rộng cross-month

### Requirement: Filter state persisted in URL query
The page SHALL persist filter state vào URL query params (`building_id`, `period_year`, `period_month`, `status`, `tenant_search`, `page`) để share link/refresh giữ nguyên view.

#### Scenario: Share link reproduces view
- **WHEN** user A áp filter (building=B1, month=2026-06, status=quá hạn) và copy URL
- **AND** user B (cùng quyền) mở URL đó
- **THEN** user B thấy filter state giống hệt user A

#### Scenario: Refresh keeps filter
- **WHEN** user áp filter rồi refresh trang
- **THEN** filter state restore từ URL, không reset về default

### Requirement: Server-side pagination
The page SHALL paginate server-side với default `page_size=50`, tối đa 100. Pagination controls cho phép jump page và hiển thị tổng số kết quả.

#### Scenario: Page navigation
- **WHEN** user bấm "Trang sau" ở page 1
- **THEN** request gửi với `page=2`, list cập nhật dòng 51-100, scroll về top
- **AND** URL query `page=2` được set

#### Scenario: Filter change resets to page 1
- **WHEN** user đang ở page 3 và đổi filter status
- **THEN** request tự reset về `page=1` và clear URL `page` param

### Requirement: Invoice row content
Mỗi row SHALL hiển thị: invoice code, kỳ (MM/YYYY), building name, room number, tenant name, total amount, paid amount, balance amount, due date, status badge.

#### Scenario: Row layout desktop vs mobile
- **WHEN** viewport ≥ md (768px)
- **THEN** row hiển thị tất cả cột
- **WHEN** viewport < md
- **THEN** row collapse: chỉ hiện tenant + building/room, total, balance, status; còn lại ẩn

#### Scenario: Status badge color
- **WHEN** invoice status là "quá hạn"
- **THEN** badge có tone error-vivid; status "đã thu" có tone success-neon; "chưa thu" có tone warning; "huỷ" có tone muted

### Requirement: Read-only drawer preview
Click vào 1 row SHALL mở drawer (`UiDrawer`, `w-full sm:w-[480px]` theo pattern detail drawer hiện có) hiển thị chi tiết invoice **read-only**: charges breakdown, payments history, ghi chú. Drawer KHÔNG chứa action sửa (record payment, void, adjust, print).

#### Scenario: Drawer mở với data đầy đủ
- **WHEN** user click row INV-2606-014
- **THEN** drawer mở với header (mã invoice, tenant, room, due date, status), section charges (line items + tổng), section payments (list payments nếu có)

#### Scenario: Drawer đóng giữ filter state
- **WHEN** user mở drawer xong đóng (ESC hoặc bấm overlay)
- **THEN** drawer đóng, list và filter giữ nguyên, không refetch

#### Scenario: Drawer không có action thay đổi
- **WHEN** user mở drawer của invoice "chưa thu"
- **THEN** không hiện nút "Ghi thanh toán" / "Huỷ" / "Adjust" — chỉ có nút "Mở trong kỳ vận hành" và "Sao mã"

### Requirement: Deep-link to period view
Drawer SHALL có CTA "Mở trong kỳ vận hành →" mở period view tương ứng với invoice được highlight.

#### Scenario: Deep-link mở đúng period và highlight invoice
- **WHEN** user click "Mở trong kỳ vận hành" cho invoice ID `<inv-id>` thuộc period 2026-06 của building B1
- **THEN** navigate tới `/billing/<B1-slug>/2026-06?invoice=<inv-id>`
- **AND** period page tự switch sang tab "Thu tiền & công nợ"
- **AND** scroll-into-view tới row invoice và highlight 2 giây

#### Scenario: Deep-link với period không tồn tại
- **WHEN** invoice thuộc period mà user mất quyền truy cập (vd manager bị unassign building)
- **THEN** navigate fail với error 403, không crash; user quay lại `/invoices`

### Requirement: Loading and error states
The page SHALL show skeleton khi loading lần đầu, inline error khi API fail, "Tải lại" button khi error.

#### Scenario: Loading skeleton
- **WHEN** request đang chạy lần đầu
- **THEN** hiển thị skeleton table (10 dòng) + skeleton filter chips

#### Scenario: API error shown inline
- **WHEN** API trả 500
- **THEN** page hiển thị UiAlert severity=danger với message từ server, nút "Tải lại"
