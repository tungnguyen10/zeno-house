---
type: Proposed Capability Delta
title: "harden-event-audit: spec.md"
status: in-progress
tags: [change, pending-review]
sources:
  - resource: "https://github.com/tungnguyen10/zeno-house/blob/ae95811bbdc1932368b4e6b9ed3e9540399d26e6/openspec/changes/harden-event-audit/specs/building-invoice-profile/spec.md"
generated:
  by: "process:okf-migration"
  at: "2026-11-06T00:00:00Z"
---

## ADDED Requirements

### Requirement: Invoice profile snapshot refresh audit
Refreshing an invoice payment-profile snapshot SHALL atomically update the invoice and append `invoice.profile_snapshot.refreshed` with building scope, actor, invoice identifier, and safe before/after snapshot metadata.

#### Scenario: Authorized refresh succeeds
- **WHEN** an authorized scoped user refreshes an invoice payment-profile snapshot
- **THEN** the invoice update and audit event commit together without exposing private asset paths

#### Scenario: Refresh audit fails
- **WHEN** the audit event cannot be inserted
- **THEN** the invoice snapshot remains unchanged
