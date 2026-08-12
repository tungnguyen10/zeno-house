## MODIFIED Requirements

### Requirement: Read-only drawer preview
Click vào 1 row SHALL mở drawer (`UiDrawer`, `w-full sm:w-[480px]` theo pattern detail drawer hiện có) hiển thị chi tiết invoice read-only: charges breakdown, payments history, ghi chú. Drawer SHALL NOT chứa action sửa (`record payment`, `void`, `adjust`) nhưng SHALL cung cấp action read-only **In phiếu** cho invoice còn hiệu lực.

#### Scenario: Drawer mở với data đầy đủ
- **WHEN** user click row INV-2606-014
- **THEN** drawer mở với header (mã invoice, tenant, room, due date, status), section charges (line items + tổng), section payments (list payments nếu có)

#### Scenario: Drawer đóng giữ filter state
- **WHEN** user mở drawer xong đóng (ESC hoặc bấm overlay)
- **THEN** drawer đóng, list và filter giữ nguyên, không refetch

#### Scenario: Drawer không có action thay đổi
- **WHEN** user mở drawer của invoice "chưa thu"
- **THEN** không hiện nút "Ghi thanh toán" / "Huỷ" / "Adjust"
- **AND** có các action read-only "In phiếu", "Mở trong kỳ vận hành" và "Sao mã"

## ADDED Requirements

### Requirement: Current-page invoice print selection
The cross-period invoice browser SHALL support single and bulk printing of non-void invoices from the currently loaded page only.

#### Scenario: Select printable invoices on desktop or mobile
- **WHEN** the current page contains active and void invoices
- **THEN** desktop rows and mobile cards expose checkboxes only for active invoices

#### Scenario: Current selection is printed
- **WHEN** the user selects one or more active invoices and chooses **In phiếu** from the sticky action bar
- **THEN** the shared invoice print route opens with those invoice IDs

#### Scenario: Browse result changes
- **WHEN** filters, pagination, or refreshed results replace the current page
- **THEN** the prior print selection is cleared
