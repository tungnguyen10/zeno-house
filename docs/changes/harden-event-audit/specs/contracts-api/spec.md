---
type: Proposed Capability Delta
title: "harden-event-audit: spec.md"
status: draft
change_state: in-progress
tags: [change, pending-review]
sources:
  - resource: "https://github.com/tungnguyen10/zeno-house/blob/ae95811bbdc1932368b4e6b9ed3e9540399d26e6/openspec/changes/harden-event-audit/specs/contracts-api/spec.md"
generated:
  by: "process:okf-migration"
  at: "2026-11-06T00:00:00Z"
---

## ADDED Requirements

### Requirement: Correlated audit for contract side effects
Contract mutations SHALL preserve entity-level history for derived room occupancy changes and renewal successors using one operation correlation identifier.

#### Scenario: Active contract claims a room
- **WHEN** contract creation or reactivation changes a room to occupied
- **THEN** the contract event and a `room.updated` child commit together with the same operation correlation

#### Scenario: Contract releases or reassigns rooms
- **WHEN** a contract stops occupying its old room or claims a new room
- **THEN** each changed room receives one correlated `room.updated` event with before/after status

#### Scenario: Renewal creates successor contract
- **WHEN** new-contract renewal succeeds
- **THEN** `contract.renewed` on the source and `contract.created` on the successor commit in the same audited transaction
