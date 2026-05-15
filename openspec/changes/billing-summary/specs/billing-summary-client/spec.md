## ADDED Requirements

### Requirement: Billing summary page
`/billing` page SHALL display: 5 stat cards (total invoices, total amount, collected, outstanding, overdue count) and a table of unpaid invoices (room, building, total, paid, remaining, status badge, link to invoice). Period filter defaults to current month. Building filter optional. AppSidebar SHALL have a "Billing" link.

#### Scenario: Billing page displays current month summary
- **WHEN** admin navigates to /billing
- **THEN** stats and unpaid invoices for current month shown

#### Scenario: Period filter updates data
- **WHEN** admin changes period filter
- **THEN** stats and list update to reflect selected period

#### Scenario: No invoices for period
- **WHEN** no invoices in selected period
- **THEN** empty state shown in table, stats all 0
