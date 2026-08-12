## Why

Business mutations can currently succeed without a durable audit event, and deleting a building can erase its general and billing history. Bulk audit semantics, direct-access RLS, and newer settings/correction workflows also contain coverage and scoping gaps, so the audit trail cannot yet be treated as complete evidence of business changes.

## What Changes

- Preserve general and billing audit history independently of live building and billing-period rows.
- Make database-local business mutations and their audit events atomic and idempotent.
- Add a durable operation outbox for Auth, Storage, and provider-backed mutations so external changes cannot occur without a recoverable audit intent.
- Revoke direct audit-table access from browser roles and restrict audited mutation RPCs to `service_role`.
- Correct bulk parent/child semantics, building scope, action names, and duplicate emission.
- Audit invoice email setting changes, invoice profile-snapshot refreshes, tenant activation, and correlated contract side effects.
- Strengthen snapshot redaction, structured audit-failure telemetry, reconciliation, and CI coverage of business mutation routes.
- **BREAKING**: replace the accepted best-effort audit contract for business mutations with durable transactional/outbox semantics, and stop cascading audit history when source entities are deleted.

## Capabilities

### New Capabilities

- `audit-operation-outbox`: Durable intent, completion, idempotency, and reconciliation for business mutations that cross Postgres, Supabase Auth, Storage, or external providers.

### Modified Capabilities

- `entity-audit-log`: Preserve append-only history, enforce direct-access isolation, require atomic business audit writes, and cover corrected/new mutation semantics.
- `building-invoice-profile`: Audit invoice profile-snapshot refresh operations.
- `invoice-email-delivery`: Audit automatic-send configuration changes while retaining delivery trigger events.
- `contracts-api`: Emit correlated entity history for room status side effects and renewal successors.

## Impact

- Supabase migrations for audit history scope, operation outbox, RPC permissions, and atomic audited writes.
- Audit/billing types, mappers, constants, repositories, services, API query behavior, and reconciliation scheduling.
- Master-data bulk services, contract/renewal flows, invoice profile and email setting services.
- OpenSpec requirements, architecture/database/API documentation, and comprehensive Vitest migration/service/coverage tests.
