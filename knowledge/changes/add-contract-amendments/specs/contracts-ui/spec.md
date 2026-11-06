---
type: Proposed Capability Delta
title: "add-contract-amendments: spec.md"
status: in-progress
tags: [change, pending-review]
sources:
  - resource: "https://github.com/tungnguyen10/zeno-house/blob/ae95811bbdc1932368b4e6b9ed3e9540399d26e6/openspec/changes/add-contract-amendments/specs/contracts-ui/spec.md"
generated:
  by: "process:okf-migration"
  at: "2026-11-06T00:00:00Z"
---

## ADDED Requirements

### Requirement: Contract amendment management surface
Contract detail SHALL provide an amendment section that lists draft, scheduled, applied, and cancelled amendments and allows users with `contracts.update` to create/edit/delete drafts, publish valid drafts, and cancel scheduled amendments.

#### Scenario: Read-only manager views amendments
- **WHEN** a manager opens contract detail
- **THEN** amendment history is visible but mutation controls are absent

#### Scenario: Owner publishes a draft
- **WHEN** an in-scope owner confirms publication of a valid draft
- **THEN** the list refreshes and displays the resulting scheduled or applied state with effective date and term diff
