## MODIFIED Requirements

### Requirement: Contract detail sectioned layout
`app/pages/contracts/[code]/index.vue` SHALL organize the detail body into sections with anchor IDs (preserving existing tab content): `#overview` (dates, rent, deposit, payment_day, terms), `#occupants` (current + history list with add/move-out actions), `#payments` (list + add), `#services` (list + edit), `#meter-readings` (link to meter workspace + handover summary), `#history` (renewal history and contract audit history), `#danger-zone` (Edit, Terminate, Delete actions). A sticky horizontal tab nav SHALL allow jumping to each section.

#### Scenario: Contract audit history is visible in context
- **WHEN** a user opens a contract detail page
- **THEN** the page shows a single "Lich su" section containing renewal history and audit events for `entity_type=contract` and the current contract id
- **AND** the request includes the contract building id so scoped users remain authorized

#### Scenario: Contract rent diff is readable
- **WHEN** a contract audit event changes `monthlyRent`
- **THEN** the history section shows a readable before/after row for "Gia thue / thang" using currency formatting

#### Scenario: Technical audit snapshots are admin-only
- **WHEN** a non-admin user views contract history
- **THEN** raw `before_data`, `after_data`, and metadata JSON are not rendered
- **AND** admins can expand an audit row to inspect the raw technical snapshot
