## MODIFIED Requirements

### Requirement: Invoices table
The database SHALL store issued invoice snapshots in `public.invoices`, including `due_date`, `grace_period_days` (non-negative integer default 0), and a stored generated `overdue_date` equal to `due_date + grace_period_days`, in addition to the existing identity, lifecycle, totals, notes, replacement links, and timestamps.

#### Scenario: Existing invoices preserve overdue behavior
- **WHEN** the migration is applied to existing invoices
- **THEN** they receive zero grace and their generated overdue date equals their existing due date

#### Scenario: Null legacy due date remains unknown
- **WHEN** an existing invoice has a null due date
- **THEN** its overdue date remains null

#### Scenario: New schedule is immutable
- **WHEN** an invoice is issued with a resolved due date and building grace duration
- **THEN** both values are stored on the invoice and later building or contract edits do not update them

#### Scenario: Overdue query is indexed
- **WHEN** invoice lists and dashboards filter unpaid invoices by overdue state
- **THEN** an index supports status, overdue date, balance, and issue ordering

#### Scenario: Existing invoice uniqueness and replacement rules remain
- **WHEN** invoices are issued, voided, or replaced
- **THEN** the existing one-active-invoice and supersession constraints remain in force
