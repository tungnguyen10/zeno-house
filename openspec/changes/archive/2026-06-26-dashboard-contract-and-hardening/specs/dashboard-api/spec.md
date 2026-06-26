## MODIFIED Requirements

### Requirement: Dashboard summary endpoint
`GET /api/dashboard/summary` SHALL return aggregate operational stats for the entire system in a single response. Response SHALL follow the standard envelope `{ data, meta }` where `meta.generatedAt` is an ISO 8601 timestamp produced after all Supabase queries complete. Response shape SHALL be:
```ts
{
  data: {
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
      building: { id: string; slug: string; name: string }
      period: string
      count: number
      severity: 'info' | 'warning' | 'danger'
    }>
  }
  meta: { generatedAt: string }
}
```
The endpoint SHALL require authentication and SHALL gate access by capability `dashboard.read`. The endpoint SHALL NOT include any UI route string (e.g., `href`) in the payload — clients build links from the `building` object. The endpoint SHALL apply defensive limits to underlying queries: `rooms` `.limit(2000)`, `billing_periods` `.limit(500)`, `invoices` constrained to the last 6 billing periods relative to current month `.limit(2000)`. Internal errors SHALL be mapped through the standard error envelope with `error.code = 'INTERNAL'` and a generic user-facing message; raw Supabase error messages SHALL NOT be returned to the client.

#### Scenario: Stats returned correctly
- **WHEN** admin calls GET /api/dashboard/summary
- **THEN** returns 200 with correct counts for buildings, rooms by status, tenants, active contracts, expiring contracts, and current-month billing totals, wrapped in `{ data, meta }`

#### Scenario: meta.generatedAt is present
- **WHEN** the endpoint returns 200
- **THEN** `meta.generatedAt` is a valid ISO 8601 timestamp generated after Supabase queries complete

#### Scenario: Building breakdown included
- **WHEN** multiple buildings exist with rooms of different statuses
- **THEN** `data.buildingBreakdown` array contains one entry per building with `id`, `slug`, `name`, and correct room counts

#### Scenario: Billing trend included
- **WHEN** billing invoice data exists for recent months
- **THEN** `data.billingTrend` contains at most 6 entries with paid and outstanding amounts grouped by period

#### Scenario: Pending operations include building object instead of href
- **WHEN** current-month operational blockers exist
- **THEN** each item in `data.pendingOperations` has a `building: { id, slug, name }` object and SHALL NOT contain an `href` field

#### Scenario: Empty system
- **WHEN** no data exists
- **THEN** returns all counts and amounts as 0, with empty arrays for `buildingBreakdown`, `billingTrend`, and `pendingOperations`

#### Scenario: Unauthenticated request
- **WHEN** request has no auth token
- **THEN** returns 401 with `error.code = 'UNAUTHENTICATED'`

#### Scenario: User without dashboard.read capability
- **WHEN** authenticated user has a role that does not include `dashboard.read`
- **THEN** returns 403 with `error.code = 'FORBIDDEN'`

#### Scenario: Supabase query fails
- **WHEN** an underlying Supabase query throws an error
- **THEN** returns 500 with `error.code = 'INTERNAL'` and a generic message; raw Supabase error message is NOT included in the response body but IS logged on the server

#### Scenario: Invoice window is bounded
- **WHEN** the system has more than 6 months of billing data
- **THEN** the `invoices` query SHALL be constrained to billing periods within the last 6 months relative to current period
