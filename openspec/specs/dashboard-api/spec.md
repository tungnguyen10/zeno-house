## Purpose

API spec cho dashboard summary endpoint. Trả về aggregate stats toàn hệ thống trong 1 request.
## Requirements
### Requirement: Dashboard summary endpoint
`GET /api/dashboard/summary` SHALL return aggregate operational stats for the entire system in a single response. Response SHALL follow the standard envelope `{ data, meta }` where `meta.generatedAt` is an ISO 8601 timestamp produced after all Supabase queries complete. Response shape SHALL be:
```ts
{
  data: {
    buildings: { total: number }
    rooms: { total: number; available: number; occupied: number; maintenance: number }
    tenants: { total: number }
    contracts: { active: number; expiringSoon: number; expiringUrgent: number }
    billing: {
      currentMonth: {
        period: string
        invoiceTotal: number
        paidAmount: number
        outstandingAmount: number
        overdueAmount: number
        collectionRate: number  // [0, 1], rounded to 4 decimals
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
      overdueAmount: number
      categories: Record<'rent' | 'electricity' | 'water' | 'service' | 'other', number>
      byBuilding: Record<string, {
        invoiceTotal: number
        paidAmount: number
        categories: Record<'rent' | 'electricity' | 'water' | 'service' | 'other', number>
      }>
    }>
    revenueBreakdown: {
      totalIssued: number
      totalPaid: number
      categories: Array<{
        key: 'rent' | 'electricity' | 'water' | 'service' | 'other'
        amount: number
      }>
    }
    pendingOperations: Array<{
      type: 'missing_readings' | 'unissued_invoices' | 'overdue_invoices'
      building: { id: string; slug: string; name: string }
      period: string
      count: number
      severity: 'info' | 'warning' | 'danger'
      amount?: number  // only set for type === 'overdue_invoices'
    }>
  }
  meta: { generatedAt: string }
}
```
The endpoint SHALL require authentication and SHALL gate access by capability `dashboard.read`. The endpoint SHALL NOT include any UI route string (e.g., `href`) in the payload — clients build links from the `building` object. The source snapshot SHALL cover the complete authorized building scope and the 12 calendar months of the current year. Internal errors SHALL be mapped through the standard error envelope with `error.code = 'INTERNAL'` and a generic user-facing message; raw Supabase error messages SHALL NOT be returned to the client.

#### Scenario: Stats returned correctly
- **WHEN** admin calls GET /api/dashboard/summary
- **THEN** returns 200 with correct counts for buildings, rooms by status, tenants, active contracts, expiring contracts, urgent-expiring contracts, and current-month billing totals plus collection rate, wrapped in `{ data, meta }`

#### Scenario: meta.generatedAt is present
- **WHEN** the endpoint returns 200
- **THEN** `meta.generatedAt` is a valid ISO 8601 timestamp generated after Supabase queries complete

#### Scenario: Building breakdown included
- **WHEN** multiple buildings exist with rooms of different statuses
- **THEN** `data.buildingBreakdown` array contains one entry per building with `id`, `slug`, `name`, and correct room counts

#### Scenario: Billing trend included with overdue per period
- **WHEN** billing invoice data exists in the current calendar year
- **THEN** `data.billingTrend` contains exactly 12 month buckets, including zero-filled months, with billing totals, revenue `categories`, and per-building `byBuilding` buckets

#### Scenario: Annual revenue breakdown included
- **WHEN** non-void invoice charges exist in the current calendar year
- **THEN** `data.revenueBreakdown` returns total issued, total paid, and non-zero category totals in canonical category order

#### Scenario: Collection rate computed for current month
- **WHEN** current-month invoice total is greater than zero
- **THEN** `data.billing.currentMonth.collectionRate` equals `paidAmount / invoiceTotal`, rounded to 4 decimal places, in the closed range `[0, 1]`

#### Scenario: Collection rate when no invoices
- **WHEN** current-month invoice total is zero (no invoices yet for the period)
- **THEN** `data.billing.currentMonth.collectionRate` equals `0`

#### Scenario: Urgent expiring contracts counted
- **WHEN** active contracts exist with `end_date` between today (inclusive) and today + 7 days (inclusive)
- **THEN** `data.contracts.expiringUrgent` equals that count, and `expiringUrgent` is always less than or equal to `expiringSoon`

#### Scenario: Pending operations include building object instead of href
- **WHEN** current-month operational blockers exist
- **THEN** each item in `data.pendingOperations` has a `building: { id, slug, name }` object and SHALL NOT contain an `href` field

#### Scenario: Overdue pending operation includes amount
- **WHEN** a pending operation has `type === 'overdue_invoices'`
- **THEN** the item SHALL include `amount` equal to the sum of `balance_amount` of all overdue invoices for that building in the current month

#### Scenario: Non-overdue pending operation omits amount
- **WHEN** a pending operation has `type === 'missing_readings'` or `type === 'unissued_invoices'`
- **THEN** the item SHALL omit the `amount` field (undefined)

#### Scenario: Pending operations sorted by priority
- **WHEN** multiple pending operations exist
- **THEN** the response array is sorted by `severity` desc (`danger` > `warning` > `info`), then by `amount` desc (items without amount treated as `0`), then by `period` desc, then by `building.name` asc

#### Scenario: Empty system
- **WHEN** no data exists
- **THEN** returns all counts and amounts as 0, `collectionRate` as 0, 12 zero-filled `billingTrend` buckets, and empty arrays for `buildingBreakdown`, revenue categories, and `pendingOperations`

#### Scenario: Unauthenticated request
- **WHEN** request has no auth token
- **THEN** returns 401 with `error.code = 'UNAUTHENTICATED'`

#### Scenario: User without dashboard.read capability
- **WHEN** authenticated user has a role that does not include `dashboard.read`
- **THEN** returns 403 with `error.code = 'FORBIDDEN'`

#### Scenario: Supabase query fails
- **WHEN** an underlying Supabase query throws an error
- **THEN** returns 500 with `error.code = 'INTERNAL'` and a generic message; raw Supabase error message is NOT included in the response body but IS logged on the server

#### Scenario: Invoice window is bounded to the current calendar year
- **WHEN** the system contains invoice data from multiple years
- **THEN** dashboard trend and revenue totals include only January through December of the current year

### Requirement: Dashboard summaries use complete scoped aggregation
The dashboard summary API SHALL compute metrics for all records in the caller's authorized building scope without relying on fixed application row limits, and SHALL preserve the existing response envelope and DTO.

#### Scenario: Scoped summary exceeds application limits
- **WHEN** an authorized scope contains more than 2000 rooms or invoices
- **THEN** the returned totals and trends include every matching record

#### Scenario: Repeated scoped request
- **WHEN** the same resolved scope requests the same current-period summary within the cache window
- **THEN** the server may reuse the scope-keyed result without changing response data
