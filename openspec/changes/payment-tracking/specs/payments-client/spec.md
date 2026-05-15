## ADDED Requirements

### Requirement: Payment section in invoice detail
Invoice detail page SHALL display a "Thanh toán" section showing: total paid amount, remaining balance, payment history table (date, method, amount, delete button for admin). A "Ghi nhận thanh toán" button opens `RecordPaymentModal`.

#### Scenario: Payment history displayed
- **WHEN** invoice has payments
- **THEN** section shows each payment with date, method, amount and running total

#### Scenario: No payments yet
- **WHEN** invoice has no payments
- **THEN** section shows "Chưa có thanh toán" with record button

### Requirement: Record payment modal
`RecordPaymentModal` SHALL have fields: amount (number), payment_method (select), payment_date (date, default today), notes (optional). On success refreshes invoice detail and updates status badge.

#### Scenario: Modal submits and refreshes
- **WHEN** admin records valid payment
- **THEN** modal closes, payment appears in history, invoice status badge updates
