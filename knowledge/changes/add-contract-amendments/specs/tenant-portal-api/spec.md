---
type: Proposed Capability Delta
title: "add-contract-amendments: spec.md"
status: in-progress
tags: [change, pending-review]
sources:
  - resource: "https://github.com/tungnguyen10/zeno-house/blob/ae95811bbdc1932368b4e6b9ed3e9540399d26e6/openspec/changes/add-contract-amendments/specs/tenant-portal-api/spec.md"
generated:
  by: "process:okf-migration"
  at: "2026-11-06T00:00:00Z"
---

## ADDED Requirements

### Requirement: Tenant-safe effective contract terms
Tenant contract summaries SHALL exclude internal `contracts.notes`, SHALL return the effective payment due day after contract/building inheritance, and SHALL expose `paymentDueDaySource` as `contract`, `building`, or `unset`.

#### Scenario: Contract inherits building due day
- **WHEN** an active contract has a null due-day override and its building has a configured due day
- **THEN** the summary returns the building day with source `building`

#### Scenario: Internal contract note exists
- **WHEN** an active contract contains an operator note
- **THEN** neither the tenant contract summary nor bootstrap payload contains the note

### Requirement: Primary-only amendment disclosure
The portal bootstrap SHALL include scheduled and applied amendment summaries for the current primary tenant. A roommate SHALL receive current applied terms and an empty amendment list. Draft and cancelled amendments SHALL never be disclosed through tenant APIs.

#### Scenario: Primary tenant has scheduled amendment
- **WHEN** the primary tenant loads portal bootstrap
- **THEN** the scheduled amendment's sequence, title, public content, effective date, status, and safe before/after changed terms are returned

#### Scenario: Roommate shares the contract
- **WHEN** an active roommate loads the same contract context
- **THEN** effective contract terms are returned and `contractAmendments` is empty
