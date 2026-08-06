## Why

Building and contract due-day settings are persisted but ignored by invoice issuance, while the client independently defaults every batch to four days from today. This creates multiple competing sources of truth and leaves building grace periods unused by overdue calculations.

## What Changes

- Establish one server-owned due-date policy: explicit batch override, then contract due day, then building due day, then a four-calendar-day system fallback.
- Rename the contract due-day field from `payment_day` to `payment_due_day` while preserving stored data.
- Snapshot each invoice's resolved due date and building grace period, with a stored overdue date derived from both.
- Compute schedules per invoice for workspace, AI, issue-and-pay, reissue, and correction flows; bind the schedule inputs and outputs into issue preview hashes.
- Replace the required shared issue date with an optional batch override and show calculated per-invoice dates in the review UI.
- Derive overdue state from the snapshotted overdue date and explain active grace periods on invoice detail surfaces.
- **BREAKING**: contract API fields become `payment_due_day`/`paymentDueDay`; invoice preview and confirm use `due_date_override` instead of required `due_date`.

## Capabilities

### New Capabilities

- `invoice-due-policy`: Server-owned precedence, calendar resolution, grace snapshot, and immutability rules for invoice schedules.

### Modified Capabilities

- `contracts-database`: Rename the contract due-day column without losing data.
- `contracts-api`: Rename contract boundary and DTO fields and preserve create/update behavior.
- `monthly-billing-database`: Store grace and generated overdue dates on immutable invoice snapshots.
- `billing-api`: Accept an optional batch override and issue per-invoice schedules atomically.
- `monthly-operations-workspace`: Review calculated dates and opt into a shared override.
- `tenant-portal-api`: Return the snapshotted overdue date and grace duration.
- `tenant-portal-ui`: Explain the interval between payment due and overdue dates.

## Impact

This affects contract and invoice migrations, generated Supabase types, billing transaction RPCs, issue/reissue/correction services, AI invoice actions, invoice queries and dashboard aggregation, email/print rendering, and the admin and tenant invoice interfaces. Existing invoices retain their current overdue behavior through a zero-day grace backfill.
