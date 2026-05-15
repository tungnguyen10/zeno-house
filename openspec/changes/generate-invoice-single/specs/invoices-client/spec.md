## ADDED Requirements

### Requirement: Invoice detail page
`/invoices/:id` page SHALL display invoice header (room, period, status badge, total amount, due date) and an itemized table with columns: type, description, unit_price, quantity, amount. Admin sees "Phát hành" button when status=draft. Shows loading skeleton while fetching.

#### Scenario: Invoice detail displays all items
- **WHEN** admin navigates to /invoices/:id
- **THEN** header and itemized lines shown with totals

#### Scenario: Issue action visible for draft
- **WHEN** invoice status is draft
- **THEN** "Phát hành" button visible; clicking updates status to issued

### Requirement: Generate invoice modal in room detail
Room detail page SHALL have a "Sinh hóa đơn" button that opens `GenerateInvoiceModal`. Modal fields: period_start (date), period_end (date, default last day of current month), electricity_rate (number), water_rate (number), notes (optional). On success navigates to new invoice detail page.

#### Scenario: Generate creates invoice and navigates
- **WHEN** admin fills form and submits
- **THEN** invoice created and admin redirected to /invoices/:id
