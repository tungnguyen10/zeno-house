## Why

Supabase Auth inserts an admin-created `auth.users` row before applying custom `app_metadata` in the same transaction. The current immediate `AFTER INSERT` trigger therefore cannot see the provisioned role and incorrectly creates a pending access request for accounts that already have application access.

## What Changes

- Defer access-request creation until the Auth transaction has finished applying metadata, then evaluate the current persisted Auth user state.
- Reconcile existing untouched pending requests whose Auth users already hold a valid application role.
- Append a system-attributed reconciliation audit before removing each stale request.
- Extend SQL verification to reproduce Supabase Admin Auth's actual insert-then-metadata-update ordering.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pending-account-approval`: Provisioned identities must skip the pending queue even when Supabase applies their role after the initial Auth row insert within one transaction; stale untouched requests are reconciled safely.
- `entity-audit-log`: Automated removal of stale provisioned-account requests must append a secret-free reconciliation event without deleting existing audit history.

## Impact

- Supabase migration and pending-account verification SQL.
- Shared audit action constants and audit display copy.
- Pending-account OpenSpec requirements and Auth/database documentation.
- No public API, DTO, table-shape, or generated database type changes.
