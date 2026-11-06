---
type: Proposed Capability Delta
title: "add-contract-amendments: spec.md"
status: in-progress
tags: [change, pending-review]
sources:
  - resource: "https://github.com/tungnguyen10/zeno-house/blob/ae95811bbdc1932368b4e6b9ed3e9540399d26e6/openspec/changes/add-contract-amendments/specs/entity-audit-log/spec.md"
generated:
  by: "process:okf-migration"
  at: "2026-11-06T00:00:00Z"
---

## ADDED Requirements

### Requirement: Contract amendment lifecycle audit
The audit log SHALL support the `contract_amendment` entity and created, updated, published, applied, cancelled, and deleted-draft actions. Application SHALL correlate the amendment event and resulting contract update under one correlation identifier, while the primary amendment event retains the unique operation identifier used for idempotency.

#### Scenario: Scheduled amendment applies
- **WHEN** a due amendment updates its contract
- **THEN** the amendment applied event and contract updated event share one correlation identifier and preserve safe before/after snapshots

#### Scenario: Amendment is cancelled
- **WHEN** a user or contract lifecycle cancels a scheduled amendment
- **THEN** the audit event identifies the actor or system source and retains the non-empty reason
