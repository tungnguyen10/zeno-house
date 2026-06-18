## Why

Billing issue and bulk payment flows currently rely on service-level sequencing and best-effort rollback. That is acceptable for early MVP behavior, but financial writes should become database-atomic before real usage volume increases.

## What Changes

- Replace best-effort multi-step financial writes with database-backed atomic operations where practical.
- Harden invoice issue so invoice row creation, charge snapshot creation, period status update, and audit metadata cannot leave a visible partial success.
- Harden bulk payment so all payment rows, invoice totals/status updates, period status updates, and bulk audit metadata commit or roll back together.
- Decide and document whether this is implemented through Supabase RPC functions, Postgres transactions exposed via service-role calls, or another repo-approved transaction pattern.
- Preserve existing endpoint shapes and client behavior.
- Add failure-path tests proving partial inserts/updates are not left behind when one operation fails.
- Document any required manual SQL migration and rollback notes if RPC/database functions are introduced.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `billing-api`: Invoice issue and bulk payment endpoints SHALL provide all-or-nothing persistence semantics for financial writes.
- `billing-bulk-operations`: Bulk payment recording SHALL remain transactional even when an individual row fails after earlier rows were attempted.
- `monthly-billing-database`: Any new transaction/RPC database objects SHALL be documented as manual Supabase SQL with verification and rollback instructions.
- `billing-test-coverage`: Failure-path coverage SHALL verify rollback behavior for issue and bulk payment flows.

## Impact

- Server:
  - `server/services/billing/invoices.ts`
  - `server/services/billing/payments.ts`
  - `server/repositories/billing/invoices.ts`
  - `server/repositories/billing/payments.ts`
  - potentially new RPC wrapper/repository helpers
- Database:
  - possible additive SQL migration for RPC functions or stored procedures
  - no table shape change expected unless required by the selected transaction pattern
- Tests:
  - service tests for issue rollback and bulk payment rollback
  - SQL/RLS tests if new functions are added
- Client:
  - no API contract change expected; existing toast/error handling should continue to work.
