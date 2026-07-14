## Purpose

Defines the billing period Excel export contract for producing a landlord/accounting-friendly collection workbook.
## Requirements
### Requirement: Period Excel export endpoint
A `GET /api/billing/periods/:id/export` endpoint SHALL return an `.xlsx` workbook containing a single collection sheet for the billing period.

#### Scenario: Export returns single collection sheet
- **WHEN** the endpoint is called with `Accept: */*` or `Accept: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- **THEN** the response is an `.xlsx` binary with `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` containing one sheet named `Thu tiền phòng`

#### Scenario: Collection sheet title
- **WHEN** the workbook is rendered for a billing period
- **THEN** the top rows show `DANH SÁCH THU TIỀN PHÒNG ĐỢT MM/YYYY` using the period month/year and the building name from `building.name`

#### Scenario: Collection sheet columns
- **WHEN** the collection sheet renders invoice rows
- **THEN** each active invoice contributes one row with columns: `STT`, `Phòng`, `Số điện mới`, `Số nước mới`, `Tiền điện`, `Tiền nước`, `Tiền phòng`, `Phụ phí/Dịch vụ`, `Giảm giá`, `Tổng`, `Ghi chú`

#### Scenario: Collection sheet charge mapping
- **WHEN** invoice charges are mapped to collection columns
- **THEN** `Phụ phí/Dịch vụ` is calculated as `service + surcharge + adjustment`, `Giảm giá` is shown in a separate column, and `Tổng` uses the invoice total

#### Scenario: Collection sheet totals and formatting
- **WHEN** the workbook is rendered
- **THEN** the sheet includes a bold `TỔNG TIỀN` row summing all money columns, bold total values per row, full table borders across all columns and rows, readable spacing for title/header/data rows, and a footer date row in the format `Ngày DD tháng MM năm YYYY`

#### Scenario: Filename pattern
- **WHEN** the response sets `Content-Disposition`
- **THEN** the filename follows the pattern `billing-{building-slug}-{YYYY-MM}.xlsx`

#### Scenario: Permission required
- **WHEN** the caller lacks `billing.read` for the building
- **THEN** the request fails with `403 FORBIDDEN`

### Requirement: Export action available in workspace
The billing workspace SHALL expose an export action that downloads the period workbook.

#### Scenario: Export action in header
- **WHEN** the workspace renders the header kebab menu or actions bar
- **THEN** an item or button labelled `Xuất Excel` triggers a download of the period workbook

#### Scenario: Export progress feedback
- **WHEN** the user clicks the export action
- **THEN** the UI provides loading feedback until the download begins or fails, and surfaces a toast on failure

### Requirement: Billing export batches invoice relations
The billing period export SHALL load invoice charges and display dependencies in bounded batch queries rather than issuing a database query per invoice.

#### Scenario: Export many invoices
- **WHEN** a period export contains an increasing number of invoices
- **THEN** the number of application database round trips used to load charges remains constant

