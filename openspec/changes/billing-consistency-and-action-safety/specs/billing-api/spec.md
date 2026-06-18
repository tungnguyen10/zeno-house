## ADDED Requirements

### Requirement: Billing APIs share billable period eligibility
Billing APIs SHALL use one shared billable-contract definition when calculating period summaries, workspace overview, draft invoices, and draft-grid rows.

#### Scenario: Non-billable contract is excluded everywhere
- **WHEN** a contract overlaps the selected period but has a non-billable status
- **THEN** period summaries, workspace overview, draft calculation, and draft-grid rows all exclude that contract from invoice-producing counts and totals

#### Scenario: Billable contract is included everywhere
- **WHEN** a contract is billable for the selected building and period
- **THEN** period summaries, workspace overview, draft calculation, and draft-grid rows all include that contract consistently

### Requirement: Billing APIs share pricing-aware reading progress
Billing APIs SHALL calculate required monthly readings from billable contracts and building utility pricing rules, not from occupied room count alone.

#### Scenario: Meter-priced utilities require readings
- **WHEN** a billable contract belongs to a building with electricity `per_kwh` and water `per_m3`
- **THEN** the required reading count includes electricity and water for that contract's room

#### Scenario: Non-meter water does not require water reading
- **WHEN** a billable contract belongs to a building with water `per_person` or `fixed_per_room`
- **THEN** the required reading count does not require a water reading for that contract

#### Scenario: Utility override counts as complete
- **WHEN** a required room meter has a saved billing utility usage override for the period
- **THEN** reading progress treats that meter as complete for period summary and overview purposes
