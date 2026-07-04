## Context

`ContractService.update` already appends `audit_events` with `entity_type = 'contract'`, `entity_id`, `before_data`, and `after_data`. `GET /api/audit` already accepts `entity_id`, and scoped roles must provide `building_id`.

## Decisions

### Data source

The contract detail page will fetch:

```text
GET /api/audit?building_id=<contract.buildingId>&entity_type=contract&entity_id=<contract.id>&limit=50
```

This keeps owner/manager scope checks intact and avoids admin-only global audit queries.

### UI shape

Add a single "Lich su" section to contract detail and the sticky section nav. It contains the existing renewal history plus a compact contract audit timeline with:

- action label and badge
- actor display
- timestamp
- readable field diffs

Raw JSON remains secondary and expandable only for admins. Owner and manager users see only readable history rows and formatted diffs.

### Formatting

Use a small shared audit display utility for action labels, actor labels, diff extraction, and value formatting. Contract-specific field labels and money/date formatting make rent changes readable without inspecting JSON.

## Non-Goals

- No new audit table.
- No contract term versioning.
- No changes to billing snapshot behavior.
- No changes to issued invoices or historical reports.
