---
type: Proposed Capability Delta
title: "harden-event-audit: spec.md"
status: in-progress
tags: [change, pending-review]
sources:
  - resource: "https://github.com/tungnguyen10/zeno-house/blob/ae95811bbdc1932368b4e6b9ed3e9540399d26e6/openspec/changes/harden-event-audit/specs/invoice-email-delivery/spec.md"
generated:
  by: "process:okf-migration"
  at: "2026-11-06T00:00:00Z"
---

## ADDED Requirements

### Requirement: Invoice-email setting mutation audit
Changing a building's automatic invoice-email setting SHALL atomically persist the setting and append `building.invoice_email_settings.updated` with the building scope, actor, and safe before/after enabled values.

#### Scenario: Automatic-send setting changes
- **WHEN** an authorized owner or admin enables or disables automatic invoice email
- **THEN** the setting and audit event commit together

#### Scenario: Setting audit fails
- **WHEN** the required audit event cannot be inserted
- **THEN** the setting remains unchanged
