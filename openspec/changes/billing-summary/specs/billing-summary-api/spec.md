## ADDED Requirements

### Requirement: Billing summary endpoint
`GET /api/billing/summary?periodStart=<date>&periodEnd=<date>&buildingId=<id?>` SHALL return aggregate billing stats and unpaid invoice list for the period. Response shape:
```ts
{
  stats: { total: number; totalAmount: number; totalCollected: number; outstanding: number; overdueCount: number }
  unpaidInvoices: Array<{ id, roomNumber, buildingName, totalAmount, paidAmount, status, dueDate? }>
}
```
Default period = current calendar month if not provided. Requires auth + `invoices.read` permission.

#### Scenario: Summary returned for period
- **WHEN** admin calls GET /api/billing/summary with period
- **THEN** returns stats and unpaid invoices for that period

#### Scenario: Empty period
- **WHEN** no invoices exist for the period
- **THEN** all stats = 0, unpaidInvoices = empty array
