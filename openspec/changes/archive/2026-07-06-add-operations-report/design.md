## Context

Billing already owns invoice issuance, charge snapshots, payments, period status, and billing audit events. The missing layer is an operator-facing building/month report that combines those billing snapshots with building operating costs. The report must support scoped owner/manager access and must not let browser code query Supabase tables directly.

The primary workflow is for serviced-apartment and rent-to-rerent operations: the app bills tenants monthly, then records costs such as building rent, input electricity/water, cleaning, repairs, and administration costs to understand profit and cash position per building/month.

## Goals / Non-Goals

**Goals:**

- Store monthly building expenses as financial records that can be voided but not silently hard-deleted.
- Store fixed costs with effective period ranges so historical reports remain correct after rent changes.
- Aggregate issued revenue, collected payments, debt, expense totals, profit, cash profit, and utility margins for each building/month.
- Enforce capabilities and building assignment scope in services for every read/write path.
- Provide an operations report page using existing UI primitives.

**Non-Goals:**

- Approval workflow, attachments, accounting double-entry, tax/VAT, multi-currency, or custom categories.
- Replacing billing draft, invoice issue, or payment collection workflows.
- Recalculating historical billing from live contract/service/meter inputs.

## Decisions

### Revenue source

The report reads issued invoice snapshots and active invoice payments, not draft calculations.

Alternatives considered:

- Recompute revenue from contracts and meter readings: rejected because it can drift from issued invoices and historical corrections.
- Read `invoices.paid_amount` only for collected cash: rejected for report accuracy because active `invoice_payments` is the event source after payment soft-delete support.

### Data model

Use two tables:

- `building_expenses` for period-specific rows with `voided_at`, `voided_by`, and `void_reason`.
- `building_fixed_costs` for recurring fixed costs with `effective_from_period_year/month` and optional `effective_to_period_year/month`.

Alternatives considered:

- Add rent cost directly on `buildings`: rejected because historical reports would change when current rent changes.
- Store monthly fixed cost copies only: rejected because it creates avoidable duplication and manual monthly setup.

### Permission model

Add separate operations capabilities:

- `operations-report.read`
- `building-expenses.read`
- `building-expenses.write`
- `building-expenses.delete`
- `building-fixed-costs.read`
- `building-fixed-costs.write`

Admin and owner receive full capability set. Manager receives read and expense write capabilities by default, but not fixed-cost write or expense delete. All non-admin roles remain building-scoped through `user_building_assignments`.

### API/service layout

Use the existing flow:

```text
page -> composable -> server/api -> service -> repository -> Supabase
```

Repositories only query/persist. Services perform capability checks, scope checks, report calculations, and audit writes.

### Reporting shape

`GET /api/operations-report` accepts `building_id`, `period_year`, and `period_month`. It returns one building/month report containing:

- metric totals: issued revenue, collected amount, debt, fixed cost, variable expense, total expense, profit by revenue, profit by cash
- revenue breakdown by `invoice_charges.charge_type`
- expense breakdown by fixed-cost category and expense category
- electricity and water output/input/margin
- expense rows for the selected period

The MVP requires a selected building to keep scope and UI clear. A later version can add cross-building comparison summaries.

### Audit

Expense and fixed-cost mutations append audit events through the existing audit service if its schema can represent building-scoped financial events. If the current audit model is insufficient, the implementation will keep structured metadata in the domain rows and defer a dedicated operations audit table to a follow-up change.

## Risks / Trade-offs

- Report totals can be confusing when invoices are voided or payments are undone -> filter out void invoices and soft-deleted payments consistently.
- Fixed-cost ranges can overlap -> enforce overlap checks in service and, if practical, a database exclusion/constraint strategy.
- Payment aggregation from `invoice_payments` can differ from stale `invoices.paid_amount` after legacy data issues -> prefer active payment rows for cash collected and use invoice balance for debt.
- Manager write access for expenses may be broader than some operators want -> capability map keeps fixed-cost write/delete separate so this can be tightened later.

## Migration Plan

1. Add migration for `building_expenses` and `building_fixed_costs`, including indexes and RLS safety policies.
2. Regenerate database types after applying migration.
3. Add types, validators, mappers, repositories, services, and API routes.
4. Add page/composable using server APIs only.
5. Update docs for API, database, auth permissions, and feature behavior.
6. Verify with OpenSpec validation, focused tests, and typecheck.
