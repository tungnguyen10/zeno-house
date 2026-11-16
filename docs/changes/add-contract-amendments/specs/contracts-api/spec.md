---
type: Proposed Capability Delta
title: "add-contract-amendments: spec.md"
status: draft
change_state: in-progress
tags: [change, pending-review]
sources:
  - resource: "https://github.com/tungnguyen10/zeno-house/blob/ae95811bbdc1932368b4e6b9ed3e9540399d26e6/openspec/changes/add-contract-amendments/specs/contracts-api/spec.md"
generated:
  by: "process:okf-migration"
  at: "2026-11-06T00:00:00Z"
---

## ADDED Requirements

### Requirement: Contract lifecycle reconciles scheduled amendments
Contract termination and full renewal SHALL cancel any scheduled amendment for the source contract with a durable system reason before completing the lifecycle transition.

#### Scenario: Terminate contract with scheduled amendment
- **WHEN** an authorized user terminates a contract that has a scheduled amendment
- **THEN** the amendment is cancelled in the correlated operation and cannot later apply

### Requirement: Published amendments protect contract history
Contract deletion safety checks SHALL report retained scheduled, applied, or cancelled published amendments as blockers. Force delete SHALL NOT bypass amendment-history blockers.

#### Scenario: Delete contract with applied amendment
- **WHEN** an authorized user requests normal or force deletion of a contract with applied amendment history
- **THEN** deletion is rejected with an amendment-history blocker
