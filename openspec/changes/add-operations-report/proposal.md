## Why

Zeno House can issue invoices and collect payments, but operators do not yet have a building/month profit view that combines billing revenue with operating costs. This change adds an operations report for serviced-apartment and rent-to-rerent workflows where each building needs monthly revenue, expenses, debt, and utility margin tracking.

## What Changes

- Add monthly building expense tracking for one-off operating costs such as electricity input, water input, repairs, cleaning, admin fees, supplies, staff, and other costs.
- Add effective-period fixed cost tracking, starting with building rent, so historical reports keep the correct cost when rent changes.
- Add operations report APIs that aggregate issued billing revenue, collected payments, outstanding debt, fixed costs, monthly expenses, and utility input/output margins by building and period.
- Add permission and building-scope enforcement for operations report reads and expense/fixed-cost writes.
- Add a `/operations-report` page for filtering by building/month/category, reviewing metrics, revenue breakdown, expense breakdown, and managing expense rows.
- Soft-void monthly expenses instead of hard-deleting financial records.

## Capabilities

### New Capabilities

- `operations-report`: Monthly building operations reporting, expense/fixed-cost management, permissions, and scoped API/UI behavior.

### Modified Capabilities

- None.

## Impact

- Database: new `building_expenses` and `building_fixed_costs` tables, indexes, RLS safety policies, and generated database types after migration.
- Server: new repositories, services, validators, API routes, and permission constants for operations report, expenses, and fixed costs.
- Client: new DTOs/composables/page components for the operations report workspace.
- Docs/specs: new OpenSpec capability plus updates to API/database/auth and feature documentation as needed.
