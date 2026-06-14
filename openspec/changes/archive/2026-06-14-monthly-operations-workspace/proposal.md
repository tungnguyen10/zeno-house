# monthly-operations-workspace

## Why

Monthly billing is the main recurring job for a property manager. After `cleanup-billing-readiness`, the app has clean billing inputs but still lacks a single operational workspace where the manager can run a month end-to-end.

This change should be implemented after `adopt-operational-design-system`. The billing workspace is table-heavy, correction-heavy, and status-heavy; building it before design-system adoption would recreate the same raw controls, ad-hoc tables, and one-off alerts that the cleanup change is meant to remove.

Current state:

- `/billing` only selects building + month and jumps to the old meter-reading page
- Meter readings are usable inputs, but charge review is not represented
- Contract payments are deposit/prepaid/legacy records, not monthly invoice settlement
- There is no persisted billing period, invoice snapshot, invoice line item, invoice payment, debt state, or close-period state

The next product step should make `/billing` the real monthly operations center. The first screen should not be a dead-end selector; it should be a billing period list with filters, status, progress, and quick actions:

```text
/billing
  -> billing period list
      -> filters: building, month/year, status
      -> open/create period
      -> period rows: status, reading progress, issued total, paid total, debt
  -> workspace for one building + period
      -> overview
      -> enter readings
      -> review charges
      -> issue invoices
      -> collect payments / debt
      -> close period
```

## What Changes

- Turn `/billing` into the entry point and management list for Building + Period billing runs.
- Add a workspace route for one billing period, e.g. `/billing/:buildingId/:period` where `period = YYYY-MM`.
- Add a period list API and UI so users can scan current month work, previous unclosed periods, and outstanding debt without entering each workspace.
- Reuse the existing bulk meter reading model inside the workspace instead of keeping monthly entry as a building-detail task.
- Add a billing calculation layer that builds draft charges from:
  - active contracts in the building for the selected period
  - contract rent, discount, surcharge, payment day
  - billing-counted occupants
  - current and previous meter readings
  - building electricity/water pricing config
  - enabled contract services
- Add persistent billing runtime tables:
  - `billing_periods`
  - `invoices`
  - `invoice_charges`
  - `invoice_payments`
  - `billing_audit_events`
- Add a lightweight utility usage snapshot/override model for meter reset or meter replacement cases without reintroducing meter device lifecycle management.
- Support issuing invoice snapshots, recording invoice payments, viewing outstanding debt, and closing a period.
- Preserve monthly calculation snapshots and operational audit history for billing-critical actions.
- Define correction rules for pre-issue edits, void/reissue, paid-invoice adjustments, and closed-period corrections.
- Add billing permissions and Supabase RLS policies for the new tables.
- Document all database operations as manual SQL for Supabase Dashboard SQL Editor.
- Build the `/billing` entry page and workspace using the adopted operational design system:
  - `UiPageHeader`, `UiToolbar`, `UiMetric`, `UiTabs`, `UiTable`, `UiSection`
  - `UiInput`, `UiSelect`, `UiTextarea` with compact density for dense rows
  - searchable select primitive for building/room/tenant/contract/invoice selection where simple select is insufficient
  - `UiAlert`, `UiEmptyState`, `UiSkeleton`, `UiStatusBadge`, `UiModal`/optional `UiDrawer`
- Treat `adopt-operational-design-system` as a prerequisite for implementation sequencing.
- Optimize the implemented workspace with `optimize-billing-draft-grid` before archive:
  - replace separate Readings and Review Charges tabs with one `Chỉ số & hoá đơn nháp` work tab
  - render one row per room/contract billing subject instead of one row per room-meter pair
  - provide a batch reading date and row-level advanced override only when needed
  - show reading inputs, utility calculations, room/service totals, draft total, blockers, and warnings in the same row
  - include vacant rooms as optional baseline rows that do not create invoices and do not block issue
  - keep invoice issue, payment/debt, audit, and close-period flows as separate tabs

## Impact

- Client:
  - `/billing`
  - billing period list
  - new billing workspace page(s)
  - billing composables/components
  - navigation wording if needed
  - must consume primitives and patterns finalized by `adopt-operational-design-system`
  - add a draft-grid read model and `BillingDraftGridStep` UI composition
- Server:
  - new billing API endpoints
  - new billing service/repository
  - draft-grid endpoint composition built from existing services/repositories; no new repository layer for the optimization
  - permission map
  - database type generation after manual SQL is applied
- Database:
  - add 6 billing runtime tables
  - add indexes, constraints, triggers, and RLS policies
  - no destructive cleanup expected in this change
- Existing domains:
  - meter readings become an embedded workspace step
  - contract payments remain visible as contract-level records and are not used as invoice settlement source

## Non-Goals

- Tenant portal
- Online payment gateway integration
- Automated reminders
- Tax/VAT support
- Tiered electricity calculation engine
- Editing historical invoice charge formulas after issue
- Automatically migrating legacy `contract_payments.rent` rows into invoice payments
- Full accounting ledger or double-entry bookkeeping
- Recreating local billing-only UI primitives that duplicate `app/components/ui/*`
- New database tables for the draft-grid optimization
- Moving payment collection into the draft grid before invoice issue

## Supabase Manual DB Scope

This change requires schema additions. Implementation MUST provide one manual SQL script for Supabase Dashboard SQL Editor and MUST NOT rely on `supabase db push`.

Required objects:

- `public.billing_periods`
- `public.invoices`
- `public.invoice_charges`
- `public.invoice_payments`
- `public.billing_audit_events`
- `public.billing_utility_usages`
- indexes for period, invoice, status, and debt lookup
- indexes for audit lookup by period, entity, actor, and created_at
- RLS policies for admin/manager billing access
- `updated_at` triggers using existing `public.set_updated_at()`

The SQL script must include:

- operation list
- data impact note
- preflight verification queries
- post-apply verification queries
- rollback note

## Final Decisions For Implementation

- Managers may read/write billing work but may not close/reopen periods by default; close/reopen requires `billing.close`.
- Human-readable invoice numbers are deferred; this change can use internal UUIDs and display room/tenant/period context.
- Water `per_person` uses active `contract_occupants` with `billing_counted = true`; fallback to `contracts.occupant_count` only when no occupant rows exist.
