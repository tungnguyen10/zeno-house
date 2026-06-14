## ADDED Requirements

### Requirement: Period Excel export endpoint
A `GET /api/billing/periods/:id/export` endpoint SHALL return an `.xlsx` workbook containing invoices, payments, and KPI summary for the period.

#### Scenario: Export returns workbook with three sheets
- **WHEN** the endpoint is called with `Accept: */*` or `Accept: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- **THEN** the response is an `.xlsx` binary with `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` containing three sheets: `Hoá đơn`, `Thanh toán`, `Tổng hợp`

#### Scenario: Invoices sheet content
- **WHEN** the workbook `Hoá đơn` sheet is rendered
- **THEN** each invoice contributes one row with columns: phòng, khách, mã HĐ, ngày phát hành, hạn thanh toán, tiền nhà, tiền điện, tiền nước, dịch vụ khác, điều chỉnh, tổng, đã thu, còn lại, trạng thái

#### Scenario: Payments sheet content
- **WHEN** the workbook `Thanh toán` sheet is rendered
- **THEN** each payment contributes one row with columns: thời gian, hoá đơn (định danh khách + phòng), số tiền, phương thức, người ghi nhận

#### Scenario: Summary sheet content
- **WHEN** the workbook `Tổng hợp` sheet is rendered
- **THEN** the sheet contains KPI metrics from the workspace strip plus highlight counts (số HĐ phát hành, voided, paid)

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
- **THEN** an item or button labelled "Xuất Excel" triggers a download of the period workbook

#### Scenario: Export progress feedback
- **WHEN** the user clicks the export action
- **THEN** the UI provides loading feedback until the download begins or fails, and surfaces a toast on failure
