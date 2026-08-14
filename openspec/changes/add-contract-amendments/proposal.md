## Why

The tenant portal currently labels flat contract fields as “Điều chỉnh hợp đồng” and exposes the operator-only contract notes field, without a real amendment lifecycle or effective-date history. Zeno House needs an auditable contract-amendment model so future commercial-term changes are scheduled, applied consistently to billing, and disclosed only to the appropriate contract party.

## What Changes

- Add structured contract amendments with draft, scheduled, applied, and cancelled states; immutable published snapshots; optimistic draft editing; and one scheduled amendment per contract.
- Apply due amendments atomically to the current `contracts` snapshot through an idempotent RPC, a private scheduled worker, and a billing pre-draft safety call.
- Add internal amendment CRUD, publish, and cancel APIs plus a contract-detail management surface.
- Remove internal contract notes from tenant responses, resolve the effective payment due day and its source, and expose published amendments only to the primary tenant.
- Replace the portal’s misleading adjustment card with current effective terms and a primary-tenant amendment history.
- Cancel scheduled amendments when a contract is renewed or terminated, and prevent deletion of contracts that retain published amendment history.
- Record correlated, durable audit events for amendment publication, application, cancellation, and the resulting contract update.

## Capabilities

### New Capabilities
- `contract-amendments`: Structured amendment data, lifecycle, validation, atomic application, permissions, APIs, and worker behavior.

### Modified Capabilities
- `contracts-api`: Contract termination and deletion account for scheduled and retained amendments.
- `contracts-ui`: Contract detail gains amendment management and history.
- `contract-renewal`: Renewal cancels a scheduled amendment before superseding the contract.
- `tenant-portal-api`: Contract summaries exclude internal notes, resolve due-day inheritance, and return primary-only amendment summaries.
- `tenant-portal-ui`: The room page presents effective terms and primary-only published amendments.
- `billing-api`: Billing draft preparation applies due amendments before reading mutable contract terms.
- `entity-audit-log`: Amendment lifecycle and correlated contract changes are queryable audit events.
- `supabase-scheduled-workers`: Supabase Cron wakes the private due-amendment worker.

## Impact

- Adds a Supabase migration, generated database types, amendment DTOs/mappers/validators, repository/service layers, APIs, private worker, and scheduler verification.
- Changes contract renewal/termination/delete and billing draft preparation behavior.
- Extends tenant portal bootstrap and contract detail UI without adding dependencies or direct browser database access.
- Requires cloud migration application, generated-type refresh, Vault worker-secret configuration, and staging verification before enabling the new schedule.
