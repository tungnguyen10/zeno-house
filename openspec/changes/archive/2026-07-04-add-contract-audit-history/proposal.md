## Why

Contract mutations already append `audit_events`, including before/after snapshots for rent and other billing-critical terms. Operators can find those events in `/settings/history`, but contract detail does not show the contract-scoped trail where they actually review terms.

## What Changes

- Add a contract detail history section that lists audit events for the current contract.
- Reuse the existing `/api/audit` endpoint with `building_id`, `entity_type=contract`, and `entity_id`.
- Format important contract diffs, especially monthly rent changes, as readable before/after rows.
- Keep `/settings/history` as the global audit surface; no new audit table or mutation path is added.

## Impact

- Client: new reusable audit display helpers, contract audit composable/component, and a contract detail section/nav item.
- Server/API: no new endpoint required; add focused coverage that existing entity filters are forwarded.
- Docs/specs: contract detail behavior updated.
