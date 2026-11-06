---
type: Proposed Capability Delta
title: "add-contract-amendments: spec.md"
status: draft
change_state: in-progress
tags: [change, pending-review]
sources:
  - resource: "https://github.com/tungnguyen10/zeno-house/blob/ae95811bbdc1932368b4e6b9ed3e9540399d26e6/openspec/changes/add-contract-amendments/specs/contract-renewal/spec.md"
generated:
  by: "process:okf-migration"
  at: "2026-11-06T00:00:00Z"
---

## ADDED Requirements

### Requirement: Renewal cancels future amendment
A renewal that supersedes a contract SHALL cancel its scheduled amendment before committing the renewal and SHALL use only currently applied contract terms as the renewal source.

#### Scenario: Full renewal with scheduled amendment
- **WHEN** a contract with a scheduled amendment is renewed into a successor contract
- **THEN** the scheduled amendment is cancelled and its future terms are not copied to the successor
