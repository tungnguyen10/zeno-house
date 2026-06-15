## Purpose

API spec cho dashboard summary endpoint. Trả về aggregate stats toàn hệ thống trong 1 request.
## Requirements
### Requirement: Dashboard summary endpoint
`GET /api/dashboard/summary` SHALL return aggregate operational stats for the entire system in a single response. Response shape SHALL include:
```ts
{
  buildings: { total: number }
  rooms: { total: number; available: number; occupied: number; maintenance: number }
  tenants: { total: number }
  contracts: { active: number; expiringSoon: number }
  billing: {
    currentMonth: {
      period: string
      invoiceTotal: number
      paidAmount: number
      outstandingAmount: number
      overdueAmount: number
    }
  }
  buildingBreakdown: Array<{
    id: string
    slug: string
    name: string
    rooms: { total: number; available: number; occupied: number; maintenance: number }
  }>
  billingTrend: Array<{
    period: string
    invoiceTotal: number
    paidAmount: number
    outstandingAmount: number
  }>
  pendingOperations: Array<{
    type: 'missing_readings' | 'unissued_invoices' | 'overdue_invoices'
    buildingId: string
    buildingSlug: string
    buildingName: string
    period: string
    count: number
    severity: 'info' | 'warning' | 'danger'
    href: string
  }>
}
```
The endpoint SHALL require authentication. Admin and manager roles can access.

#### Scenario: Stats returned correctly
- **WHEN** admin calls GET /api/dashboard/summary
- **THEN** returns 200 with correct counts for buildings, rooms by status, tenants, active contracts, expiring contracts, and current-month billing totals

#### Scenario: Building breakdown included
- **WHEN** multiple buildings exist with rooms of different statuses
- **THEN** buildingBreakdown array contains one entry per building with slug and correct room counts

#### Scenario: Billing trend included
- **WHEN** billing invoice data exists for recent months
- **THEN** billingTrend contains paid and outstanding amounts grouped by period

#### Scenario: Pending operations included
- **WHEN** current-month operational blockers exist
- **THEN** pendingOperations contains actionable rows with workflow links

#### Scenario: Empty system
- **WHEN** no data exists
- **THEN** returns all counts and amounts as 0, with empty arrays for buildingBreakdown, billingTrend, and pendingOperations

#### Scenario: Unauthenticated request
- **WHEN** request has no auth token
- **THEN** returns 401 UNAUTHENTICATED

