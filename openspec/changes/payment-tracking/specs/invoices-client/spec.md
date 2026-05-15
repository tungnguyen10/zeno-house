## MODIFIED Requirements

### Requirement: Invoice detail page
`/invoices/:id` page SHALL display invoice header, itemized table, **and a "Thanh toán" payment section** showing payment history, total paid, remaining balance, and a "Ghi nhận thanh toán" button. Status badge updates reactively after payment.

#### Scenario: Payment section visible in invoice detail
- **WHEN** admin views invoice detail
- **THEN** "Thanh toán" section is visible with payment history and record button
