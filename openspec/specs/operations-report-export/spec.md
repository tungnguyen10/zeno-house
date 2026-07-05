## Purpose

Define Excel export behavior for monthly operations reports.

## Requirements

### Requirement: Operations report Excel export
The system SHALL export the monthly operations report for a selected building/month as an Excel workbook.

#### Scenario: Export returns a workbook
- **WHEN** an authorized user requests `GET /api/operations-report/export` with `building_id`, `period_year`, and `period_month`
- **THEN** the API returns an `.xlsx` response with `Content-Type` set to the spreadsheet MIME type and a `Content-Disposition` attachment filename containing the building slug and period

#### Scenario: Export content mirrors the report
- **WHEN** the export workbook is generated
- **THEN** it includes issued revenue, collected amount, debt, fixed-cost total, monthly expense total, total expense, profit by revenue, profit by cash, revenue-by-type rows, expense rows, and electricity/water margins for that building/month

#### Scenario: Export excludes voided and soft-deleted data
- **WHEN** the selected period contains void invoices or soft-deleted payments
- **THEN** the export excludes them consistently with the on-screen report

### Requirement: Export permission and scope
The system SHALL restrict operations report export to authorized, in-scope users.

#### Scenario: Export capability required
- **WHEN** a user without `operations-report.export` requests the export
- **THEN** the API responds with a forbidden error and no workbook is returned

#### Scenario: Manager cannot export
- **WHEN** a manager who lacks `operations-report.export` opens the operations report page
- **THEN** the export action is not available to them

#### Scenario: Export limited to assigned buildings
- **WHEN** a non-admin user requests an export for a building outside their assignment scope
- **THEN** the API responds with a forbidden error

### Requirement: Shared export utilities
The system SHALL share Excel-building and download helpers between billing and operations exports without changing billing export behavior.

#### Scenario: Billing export uses shared helpers
- **WHEN** billing export produces its workbook
- **THEN** it uses the shared server Excel helpers and the shared `slugifyName` helper while preserving its existing filename, headers, and sheet layout

#### Scenario: Client download reused
- **WHEN** either billing or operations report triggers a download
- **THEN** it uses the shared client download composable that parses the response filename and initiates the browser download
