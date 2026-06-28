## ADDED Requirements

### Requirement: Cross-period invoice list API
The API SHALL provide `GET /api/invoices` that returns invoices across periods filtered by query params, with server-side pagination.

Query params (all optional):
- `building_id`: scope to one building
- `period_year`, `period_month`: scope to a specific year/month
- `status`: repeatable param, one of `issued | partial | paid | overdue | void`
- `tenant_search`: free-text, matched against tenant name and phone (case-insensitive, substring)
- `page` (default 1), `page_size` (default 50, max 100)

Response shape:
```ts
{
  data: InvoiceListItem[]
  meta: {
    page: number
    page_size: number
    total: number
    total_pages: number
  }
}
```

`InvoiceListItem` SHALL include: `id`, `invoice_code`, `period_year`, `period_month`, `building_id`, `building_name`, `room_id`, `room_number`, `contract_id`, `contract_code`, `tenant_id`, `tenant_name`, `total_amount`, `paid_amount`, `balance_amount`, `due_date`, `status`, `issued_at`, `voided_at?`, `void_reason?`.

#### Scenario: Authenticated user sees scoped invoices
- **WHEN** a manager with assigned buildings `[B1, B2]` calls `GET /api/invoices` without `building_id`
- **THEN** response data only includes invoices where `building_id IN (B1, B2)`

#### Scenario: Admin sees all
- **WHEN** an admin calls `GET /api/invoices` without `building_id`
- **THEN** response data includes invoices from all buildings

#### Scenario: Unauthenticated request rejected
- **WHEN** an unauthenticated client calls `GET /api/invoices`
- **THEN** API returns 401 with `{ error: { code: "UNAUTHENTICATED", ... } }`

#### Scenario: Building filter outside user scope returns 403
- **WHEN** a manager requests `building_id=B3` where B3 is not assigned
- **THEN** API returns 403 with `{ error: { code: "FORBIDDEN", ... } }`

#### Scenario: Multi-status filter is OR
- **WHEN** client sends `?status=issued&status=overdue`
- **THEN** response includes invoices in EITHER status (union, not intersection)

#### Scenario: Pagination metadata accurate
- **WHEN** total 137 invoices match filter with `page_size=50`
- **THEN** response meta is `{ page: 1, page_size: 50, total: 137, total_pages: 3 }`

#### Scenario: Page size capped at 100
- **WHEN** client sends `page_size=500`
- **THEN** API validates and returns 422 with `{ error: { code: "VALIDATION_ERROR" } }`

#### Scenario: Tenant search matches name and phone
- **WHEN** client sends `tenant_search=Tung`
- **THEN** response includes invoices where tenant name contains "Tung" (case-insensitive)
- **WHEN** client sends `tenant_search=0912`
- **THEN** response includes invoices where tenant phone contains "0912"

#### Scenario: Default sort by issued date desc
- **WHEN** client calls without explicit sort
- **THEN** results ordered by `issued_at DESC, id DESC` (deterministic tiebreaker)

#### Scenario: Status `overdue` is derived not stored
- **WHEN** invoice has status `issued` and `due_date < today` and `balance_amount > 0`
- **THEN** API returns it as `status: "overdue"`
- **WHEN** filter `status=overdue` is applied
- **THEN** API computes overdue using same rule (status=issued AND due_date < today AND balance > 0)
