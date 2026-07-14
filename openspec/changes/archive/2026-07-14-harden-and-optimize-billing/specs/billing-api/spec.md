## ADDED Requirements

### Requirement: Billing grid reuses a consistent input snapshot
The billing draft-grid API SHALL calculate its rows and overview from one consistent set of period, pricing, room, reading, contract, service, override, invoice, and audit inputs without reloading equivalent inputs through nested services.

#### Scenario: Load draft grid
- **WHEN** an authorized user loads a billing draft grid
- **THEN** grid rows and overview describe the same period snapshot and database round trips remain bounded independently of room count

### Requirement: Billing audit filters before enrichment
The billing audit API SHALL apply indexed filters, cursor ordering, and page limits before resolving display labels and SHALL return a stable continuation cursor.

#### Scenario: Search a large audit period
- **WHEN** a period contains more events than the requested page limit and the user supplies filters or search text
- **THEN** only the matching page is enriched and the next cursor continues without duplicate or missing events
