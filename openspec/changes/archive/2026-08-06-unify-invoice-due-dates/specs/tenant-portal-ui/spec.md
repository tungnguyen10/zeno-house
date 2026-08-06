## ADDED Requirements

### Requirement: Tenant invoice grace explanation
Tenant invoice detail and latest-outstanding surfaces SHALL display the invoice due date as the payment obligation date and SHALL explain an active grace interval without introducing a new invoice status.

#### Scenario: Invoice is within grace
- **WHEN** today is after `dueDate`, on or before `overdueDate`, and the invoice has a positive balance
- **THEN** the portal displays “Đang trong thời gian gia hạn đến …” using the Vietnamese-formatted overdue date

#### Scenario: Grace has ended
- **WHEN** today is after `overdueDate`
- **THEN** the portal uses the existing overdue status treatment and does not describe the invoice as still in grace

#### Scenario: Legacy due date is missing
- **WHEN** an invoice has no due date
- **THEN** detail surfaces display “Chưa có hạn thanh toán” instead of a synthetic four-day fallback
