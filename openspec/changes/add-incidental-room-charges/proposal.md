## Why

`contracts.surcharge_amount` is a recurring commercial term and is therefore added to every monthly invoice. Operators also need to charge a room for one-off events in a specific billing period without changing the contract or risking that the amount repeats in later months.

## What Changes

- Add positive, free-text incidental charges scoped to one billing period, contract, and room.
- Let billing operators create, edit, and delete multiple incidental charges from the room row in **Soạn kỳ** before an effective invoice exists.
- Include incidental charges as distinct draft and invoice lines, totals, issue previews, printed invoices, exports, and reports without changing contract surcharge semantics.
- Protect financial writes with building scope, `billing.write`, optimistic locking, create idempotency, atomic audit events, closed-period locks, and effective-invoice locks.
- Preserve saved charges as read-only context after invoice issue; use the existing invoice-correction workflow for post-issue changes.

## Capabilities

### New Capabilities

- `billing-incidental-charges`: Period-scoped incidental charge persistence, CRUD rules, draft/invoice integration, and operator UI.

### Modified Capabilities

- `billing-api`: Add scoped incidental-charge endpoints and versioned financial write contracts.
- `billing-client`: Add per-room incidental-charge management to the draft workspace.
- `monthly-billing-database`: Store incidental source rows and snapshot them as a distinct invoice charge type.
- `billing-export`: Include incidental charges in the existing other/service charge reporting total.

## Impact

- Adds a Supabase migration, service-only transactional RPCs, RLS, indexes, and grants.
- Extends billing DTOs, validators, mappers, charge constants, repositories, services, APIs, issue snapshots, print/export/report grouping, workspace composables, and draft-grid UI.
- Updates OpenSpec requirements, billing documentation, API inventory, and focused database/service/component regression tests.
- Adds no third-party dependency and does not change existing contract surcharge or contract-service behavior.
