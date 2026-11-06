---
type: Proposed Capability Delta
title: "add-contract-amendments: spec.md"
status: in-progress
tags: [change, pending-review]
sources:
  - resource: "https://github.com/tungnguyen10/zeno-house/blob/ae95811bbdc1932368b4e6b9ed3e9540399d26e6/openspec/changes/add-contract-amendments/specs/billing-api/spec.md"
generated:
  by: "process:okf-migration"
  at: "2026-11-06T00:00:00Z"
---

## ADDED Requirements

### Requirement: Billing draft uses due amendments
Before loading mutable contract terms for draft preparation, billing SHALL invoke the idempotent due-amendment application operation for the target building and period date. Existing non-void invoices SHALL remain immutable.

#### Scenario: Amendment is due before draft calculation
- **WHEN** billing prepares a draft for a contract with a due scheduled amendment
- **THEN** the amendment is applied first and the draft uses the new effective terms

#### Scenario: Invoice already issued
- **WHEN** an amendment operation runs after an invoice snapshot has been issued
- **THEN** the existing invoice and charge rows remain unchanged
